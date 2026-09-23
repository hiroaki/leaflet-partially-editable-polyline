// Provides just enough of a browser for Leaflet to run under Node.
//
// This module must be imported before anything that imports Leaflet,
// because Leaflet inspects the environment when it is loaded.

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
  url: "http://localhost/",
});

const { window } = dom;

// Leaflet chooses its vector renderer by feature detection, and jsdom does
// not implement createSVGRect().
if (!window.SVGSVGElement.prototype.createSVGRect) {
  window.SVGSVGElement.prototype.createSVGRect = () => ({});
}

function define(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}

define("window", window);
define("document", window.document);
define("navigator", window.navigator);

for (const name of [
  "HTMLElement",
  "Element",
  "Node",
  "SVGElement",
  "Event",
  "MouseEvent",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "devicePixelRatio",
  "Image",
]) {
  if (window[name] !== undefined) {
    define(name, window[name]);
  }
}

define(
  "ResizeObserver",
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
