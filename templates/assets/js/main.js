(() => {
  "use strict";

  const navigation = document.querySelector(".site-navigation");
  const mobileToggle = document.querySelector(".mobile-menu-toggle");
  const menuControls = new Map();

  function closeSubmenu(button) {
    button.setAttribute("aria-expanded", "false");
    const panel = menuControls.get(button);
    if (!panel) return;
    panel.hidden = true;
    panel.querySelectorAll(".submenu-toggle").forEach(closeSubmenu);
  }

  function closeNavigation() {
    menuControls.forEach((_, button) => closeSubmenu(button));
    if (navigation) navigation.dataset.mobileOpen = "false";
    if (mobileToggle) mobileToggle.setAttribute("aria-expanded", "false");
  }

  if (navigation && mobileToggle) {
    navigation.querySelectorAll(".submenu-toggle").forEach((button) => {
      const panel = document.getElementById(
        button.getAttribute("aria-controls"),
      );
      if (!panel) return;
      menuControls.set(button, panel);
      panel.hidden = true;
      button.hidden = false;
      button.addEventListener("click", () => {
        const opening = button.getAttribute("aria-expanded") !== "true";
        const list = button.closest(".menu-list");
        menuControls.forEach((_, other) => {
          if (other !== button && other.closest(".menu-list") === list)
            closeSubmenu(other);
        });
        if (!opening) {
          closeSubmenu(button);
          return;
        }
        panel.hidden = false;
        button.setAttribute("aria-expanded", "true");
      });
    });

    mobileToggle.hidden = false;
    navigation.dataset.mobileOpen = "false";
    mobileToggle.addEventListener("click", () => {
      const opening = mobileToggle.getAttribute("aria-expanded") !== "true";
      closeNavigation();
      navigation.dataset.mobileOpen = String(opening);
      mobileToggle.setAttribute("aria-expanded", String(opening));
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".header-navigation")) closeNavigation();
    });

    navigation
      .closest(".header-navigation")
      .addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        if (event.target.matches('.submenu-toggle[aria-expanded="true"]')) {
          closeSubmenu(event.target);
          return;
        }
        const parentPanel = event.target.closest(".submenu");
        if (parentPanel) {
          const parentButton = [...menuControls].find(
            ([, panel]) => panel === parentPanel,
          )?.[0];
          if (parentButton) {
            closeSubmenu(parentButton);
            parentButton.focus();
            return;
          }
        }
        const expandedButton = event.target
          .closest(".menu-item")
          ?.querySelector('.submenu-toggle[aria-expanded="true"]');
        if (expandedButton) {
          closeSubmenu(expandedButton);
          expandedButton.focus();
        } else if (mobileToggle.getAttribute("aria-expanded") === "true") {
          closeNavigation();
          mobileToggle.focus();
        }
      });

    navigation.addEventListener("focusout", (event) => {
      if (
        event.relatedTarget &&
        !event.relatedTarget.closest(".header-navigation")
      )
        closeNavigation();
    });

    const mobileMedia = window.matchMedia("(max-width: 767px)");
    mobileMedia.addEventListener("change", () => {
      const focusInMenu = navigation.contains(document.activeElement);
      closeNavigation();
      if (focusInMenu && mobileMedia.matches) mobileToggle.focus();
    });

    function normalizedPath(url) {
      return decodeURI(url.pathname).replace(/\/+$/, "") || "/";
    }
    const current = new URL(window.location.href);
    navigation.querySelectorAll(".menu-entry > a").forEach((link) => {
      try {
        const destination = new URL(link.href);
        if (
          destination.origin !== current.origin ||
          destination.hash ||
          link.getAttribute("href") === "#"
        )
          return;
        if (
          normalizedPath(destination) === normalizedPath(current) &&
          destination.search === current.search
        ) {
          link.setAttribute("aria-current", "page");
          let parent = link.closest(".submenu");
          while (parent) {
            parent.closest(".menu-item")?.classList.add("is-ancestor");
            parent = parent.parentElement.closest(".submenu");
          }
        }
      } catch {
        // Invalid custom links must not interrupt the rest of the navigation.
      }
    });
  }

  document.documentElement.classList.add("js");

  const content = document.querySelector("#article-content");
  if (!content) return;

  const toc = document.querySelector(".article-toc");
  const headings = [...content.querySelectorAll("h2, h3")];
  if (toc && headings.length >= 2) {
    const usedIds = new Set(
      [...document.querySelectorAll("[id]")].map((element) => element.id),
    );
    const list = toc.querySelector("ol");
    headings.forEach((heading, index) => {
      if (!heading.id) {
        let id = `margin-heading-${index + 1}`;
        while (usedIds.has(id)) id += "-section";
        heading.id = id;
        usedIds.add(id);
      }
      const item = document.createElement("li");
      if (heading.tagName === "H3") item.className = "toc-child";
      const link = document.createElement("a");
      link.href = `#${encodeURIComponent(heading.id)}`;
      link.textContent = heading.textContent.trim();
      item.append(link);
      list.append(item);
    });
    toc.hidden = false;
    const readingLayout = toc.closest(".reading-layout");
    const sideToc = ["left", "right"].includes(
      readingLayout?.dataset.tocPosition,
    );
    const desktopToc = window.matchMedia("(min-width: 1100px)");
    const syncTocState = () => {
      if (sideToc) toc.open = desktopToc.matches;
    };
    syncTocState();
    desktopToc.addEventListener("change", syncTocState);
  }

  content.querySelectorAll("table").forEach((table) => {
    if (table.parentElement.classList.contains("table-scroll")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "table-scroll";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "region");
    wrapper.setAttribute(
      "aria-label",
      table.caption?.textContent.trim() || "表格，可横向滚动",
    );
    table.before(wrapper);
    wrapper.append(table);
  });

  const articleImages = [
    ...content.querySelectorAll("img"),
    ...document.querySelectorAll(".article-cover"),
  ];
  articleImages.forEach((image) => {
    if (
      !image.classList.contains("article-cover") &&
      !image.hasAttribute("loading")
    ) {
      image.loading = "lazy";
    }
    if (!image.hasAttribute("decoding")) image.decoding = "async";
  });

  if (articleImages.length) {
    const lightbox = document.createElement("div");
    lightbox.className = "image-lightbox";
    lightbox.hidden = true;
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", "图片预览");
    const backdrop = document.createElement("div");
    backdrop.className = "image-lightbox-backdrop";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "image-lightbox-close";
    close.setAttribute("aria-label", "关闭图片预览");
    close.textContent = "×";
    const figure = document.createElement("figure");
    figure.className = "image-lightbox-figure";
    const preview = document.createElement("img");
    preview.className = "image-lightbox-image";
    const caption = document.createElement("figcaption");
    caption.className = "image-lightbox-caption";
    figure.append(preview, caption);
    lightbox.append(backdrop, figure, close);
    document.body.append(lightbox);

    let lastFocusedImage = null;
    function closeLightbox() {
      lightbox.hidden = true;
      document.body.classList.remove("lightbox-open");
      preview.removeAttribute("src");
      if (lastFocusedImage) lastFocusedImage.focus();
    }
    function openLightbox(image) {
      lastFocusedImage = image;
      preview.src = image.currentSrc || image.src;
      preview.alt = image.alt || "";
      caption.textContent = image.alt || "";
      caption.hidden = !image.alt;
      lightbox.hidden = false;
      document.body.classList.add("lightbox-open");
      close.focus();
    }
    close.addEventListener("click", closeLightbox);
    backdrop.addEventListener("click", closeLightbox);
    preview.addEventListener("click", closeLightbox);
    document.addEventListener("keydown", (event) => {
      if (!lightbox.hidden && event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
      }
    });
    articleImages.forEach((image) => {
      image.classList.add("is-zoomable");
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute(
        "aria-label",
        `查看大图${image.alt ? `：${image.alt}` : ""}`,
      );
      image.addEventListener("click", (event) => {
        event.preventDefault();
        openLightbox(image);
      });
      image.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openLightbox(image);
      });
    });
  }

  if (!navigator.clipboard?.writeText) return;
  content.querySelectorAll("pre").forEach((pre) => {
    if (pre.parentElement.classList.contains("code-block")) return;
    const code = pre.querySelector("code") || pre;
    const wrapper = document.createElement("div");
    wrapper.className = "code-block";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-code";
    button.textContent = "复制";
    button.setAttribute("aria-label", "复制代码");
    button.setAttribute("aria-live", "polite");
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await navigator.clipboard.writeText(code.textContent);
        button.textContent = "已复制";
      } catch {
        button.textContent = "复制失败，请手动选择";
      }
      window.setTimeout(() => {
        button.textContent = "复制";
        button.disabled = false;
      }, 2000);
    });
    pre.before(wrapper);
    wrapper.append(pre, button);
  });
})();
