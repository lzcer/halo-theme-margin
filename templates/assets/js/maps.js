(() => {
  "use strict";

  const page = document.querySelector(".maps-page");
  if (!page) return;

  const mapElement = page.querySelector("[data-map]");
  const message = page.querySelector("[data-map-message]");
  const placeList = page.querySelector("[data-place-list]");
  const count = page.querySelector("[data-map-count]");
  const provider = page.dataset.provider || "mapbox";
  const configuredClusterRadius = Number(page.dataset.clusterRadius);
  const clusterRadius = Number.isFinite(configuredClusterRadius)
    ? Math.min(100, Math.max(1, configuredClusterRadius))
    : 20;
  const api =
    "/apis/api.plugin.halo.run/v1alpha1/plugins/PluginMaps/map/v1/mapFeature";

  const setMessage = (text, state = "") => {
    message.textContent = text;
    message.dataset.state = state;
  };

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error("地图脚本加载失败"));
      document.head.append(script);
    });

  const loadMapbox = async () => {
    if (!document.querySelector("link[data-mapbox-style]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.css";
      link.dataset.mapboxStyle = "true";
      document.head.append(link);
    }
    if (!window.mapboxgl) {
      await loadScript(
        "https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.js",
      );
    }
    return window.mapboxgl;
  };

  const parseCenter = (value) => {
    const center = String(value || "105,36")
      .split(",")
      .map(Number);
    return center.length === 2 && center.every(Number.isFinite)
      ? center
      : [105, 36];
  };

  const asArray = (value) => {
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(value || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  let localizedStyle = false;

  const localizeTextExpression = (expression) => {
    if (
      typeof expression === "string" &&
      /\{name(?:_[^}]+)?\}/.test(expression)
    ) {
      localizedStyle = true;
      return [
        "coalesce",
        ["get", "name_zh-Hans"],
        ["get", "name_zh"],
        ["get", "name_en"],
        ["get", "name"],
      ];
    }
    if (!Array.isArray(expression)) return expression;
    if (
      expression[0] === "get" &&
      typeof expression[1] === "string" &&
      /^name(?:_|$)/.test(expression[1])
    ) {
      localizedStyle = true;
      return [
        "coalesce",
        ["get", "name_zh-Hans"],
        ["get", "name_zh"],
        ["get", "name_en"],
        ["get", "name"],
      ];
    }
    const localized = expression.map(localizeTextExpression);
    return localized.some((value, index) => value !== expression[index])
      ? localized
      : expression;
  };

  const applyChineseLabels = (map) => {
    localizedStyle = false;
    const style = map.getStyle();
    (style.layers || []).forEach((layer) => {
      const textField = layer.layout?.["text-field"];
      if (!textField) return;
      const localizedTextField = localizeTextExpression(textField);
      if (localizedTextField === textField) return;
      map.setLayoutProperty(layer.id, "text-field", localizedTextField);
    });
    return localizedStyle;
  };

  const createPopup = (mapboxgl, feature) => {
    const properties = feature.properties || {};
    const popup = document.createElement("div");
    popup.className = "maps-popup";
    const title = document.createElement("strong");
    title.textContent = properties.title || "未命名地点";
    popup.append(title);
    const descriptions = asArray(properties.description);
    const permalinks = asArray(properties.permalink);
    if (descriptions.length) {
      const list = document.createElement("ul");
      descriptions.forEach((description, index) => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.textContent = description;
        link.href = permalinks[index] || "#";
        if (link.href !== "#") {
          link.target = "_blank";
          link.rel = "noopener";
        }
        item.append(link);
        list.append(item);
      });
      popup.append(list);
    } else {
      const empty = document.createElement("span");
      empty.textContent = "暂无相关文章";
      popup.append(empty);
    }
    return new mapboxgl.Popup({ offset: 14 }).setDOMContent(popup);
  };

  const renderPlaces = (map, features) => {
    if (!placeList || !count) return;
    placeList.replaceChildren();
    count.textContent = String(features.length);
    features.forEach((feature) => {
      const properties = feature.properties || {};
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = properties.title || "未命名地点";
      button.addEventListener("click", () => {
        map.flyTo({
          center: feature.geometry.coordinates,
          zoom: Math.max(map.getZoom(), 8),
        });
        createPopup(window.mapboxgl, feature)
          .setLngLat(feature.geometry.coordinates)
          .addTo(map);
      });
      item.append(button);
      placeList.append(item);
    });
  };

  const renderMap = async (mapboxgl, data) => {
    const token = page.dataset.token;
    if (!token) throw new Error("尚未配置 Mapbox Public Token");
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: mapElement,
      style: page.dataset.style,
      center: parseCenter(page.dataset.center),
      zoom: Number(page.dataset.zoom || 3),
      minZoom: Number(page.dataset.minZoom || 1),
      maxZoom: Number(page.dataset.maxZoom || 18),
      attributionControl: true,
    });
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-right",
    );
    map.on("load", () => {
      const normalizedData = {
        ...data,
        features: (data.features || []).map((feature) => {
          const properties = feature.properties || {};
          return {
            ...feature,
            properties: {
              ...properties,
              articleCount: asArray(properties.permalink).filter(Boolean)
                .length,
            },
          };
        }),
      };
      const addPlaces = () => {
        map.addSource("places", {
          type: "geojson",
          data: normalizedData,
          cluster: true,
          clusterMaxZoom: 10,
          clusterRadius,
        });
        map.addLayer({
          id: "place-clusters",
          type: "circle",
          source: "places",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#d33c1c",
            "circle-radius": [
              "step",
              ["get", "point_count"],
              10,
              10,
              10,
              50,
              20,
              100,
              30,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        });
        map.addLayer({
          id: "place-cluster-count",
          type: "symbol",
          source: "places",
          filter: ["has", "point_count"],
          layout: {
            "text-field": "{point_count_abbreviated}",
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 12,
          },
          paint: { "text-color": "#fff" },
        });
        map.addLayer({
          id: "places",
          type: "circle",
          source: "places",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": [
              "case",
              [">", ["get", "articleCount"], 0],
              "#FFA500",
              "#0074D9",
            ],
            "circle-radius": 8,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#fff",
          },
        });
        const places = normalizedData.features.filter(
          (feature) => feature.geometry?.coordinates,
        );
        renderPlaces(map, places);
        setMessage("", "ready");
        map.on("click", "place-clusters", (event) => {
          const feature = map.queryRenderedFeatures(event.point, {
            layers: ["place-clusters"],
          })[0];
          map
            .getSource("places")
            .getClusterExpansionZoom(
              feature.properties.cluster_id,
              (error, zoom) => {
                if (!error)
                  map.easeTo({ center: feature.geometry.coordinates, zoom });
              },
            );
        });
        ["place-clusters", "places"].forEach((layer) => {
          map.on("mouseenter", layer, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layer, () => {
            map.getCanvas().style.cursor = "";
          });
        });
        map.on("click", "places", (event) => {
          const feature = event.features?.[0];
          if (feature)
            createPopup(mapboxgl, feature)
              .setLngLat(feature.geometry.coordinates)
              .addTo(map);
        });
      };
      applyChineseLabels(map);
      addPlaces();
    });
  };

  const start = async () => {
    if (provider !== "mapbox") {
      setMessage("当前主题尚未支持此地图供应商", "error");
      return;
    }
    try {
      const mapboxgl = await loadMapbox();
      const response = await fetch(api, { credentials: "same-origin" }).then(
        (result) => {
          if (!result.ok) throw new Error("足迹数据加载失败");
          return result.json();
        },
      );
      await renderMap(mapboxgl, response);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "地图加载失败",
        "error",
      );
    }
  };

  start();
})();
