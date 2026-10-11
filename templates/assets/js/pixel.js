(() => {
  "use strict";

  const label = document.querySelector(".site-brand > span");
  if (!label) return;
  const text = label.textContent.trim().toUpperCase();
  const glyphs = {
    A: "0e11111f111111",
    B: "1e11111e11111e",
    C: "0f10101010100f",
    D: "1e11111111111e",
    E: "1f10101e10101f",
    F: "1f10101e101010",
    G: "0f10101711110f",
    H: "1111111f111111",
    I: "1f04040404041f",
    J: "0702020212120c",
    K: "11121418141211",
    L: "1010101010101f",
    M: "111b1515111111",
    N: "11191513111111",
    O: "0e11111111110e",
    P: "1e11111e101010",
    Q: "0e11111115120d",
    R: "1e11111e141211",
    S: "0f10100e01011e",
    T: "1f040404040404",
    U: "1111111111110e",
    V: "11111111110a04",
    W: "11111115151b11",
    X: "11110a040a1111",
    Y: "11110a04040404",
    Z: "1f01020408101f",
    0: "0e11131519110e",
    1: "040c040404040e",
    2: "0e11010204081f",
    3: "1e01010e01011e",
    4: "02060a121f0202",
    5: "1f10101e01011e",
    6: "0e10101e11110e",
    7: "1f010204080808",
    8: "0e11110e11110e",
    9: "0e11110f01010e",
    " ": "00000000000000",
    "-": "0000001f000000",
    ".": "00000000000606",
    "'": "04040800000000",
    "&": "0c12140c15120d",
    "!": "04040404040004",
    _: "0000000000001f",
  };
  if (!text || text.length > 32 || [...text].some((char) => !glyphs[char]))
    return;

  const namespace = "http://www.w3.org/2000/svg";
  const mark = document.createElementNS(namespace, "svg");
  const width = text.length * 6 - 1;
  mark.setAttribute("viewBox", `0 0 ${width} 7`);
  mark.setAttribute("width", width * 3);
  mark.setAttribute("height", "21");
  mark.setAttribute("aria-hidden", "true");
  mark.setAttribute("focusable", "false");
  mark.setAttribute("class", "pixel-wordmark");
  mark.setAttribute("shape-rendering", "crispEdges");
  const pixels = document.createElementNS(namespace, "path");
  const segments = [];
  [...text].forEach((char, index) => {
    const rows = glyphs[char].match(/../g);
    rows.forEach((row, y) => {
      const bits = parseInt(row, 16);
      for (let x = 0; x < 5; x++) {
        if (bits & (1 << (4 - x)))
          segments.push(`M${index * 6 + x} ${y}h1v1h-1z`);
      }
    });
  });
  pixels.setAttribute("d", segments.join(""));
  pixels.setAttribute("fill", "currentColor");
  mark.appendChild(pixels);
  label.before(mark);
  label.classList.add("visually-hidden");
})();
