import { LatLng, Map } from "leaflet";

const EVENT_TYPES = [
  "editingstart",
  "editingend",
  "editingerror",
  "pointchange",
  "pointinsert",
  "pointdelete",
];

/**
 * Create a Leaflet map in a detached-from-layout container.
 */
export function createMap() {
  const container = document.createElement("div");
  container.style.width = "800px";
  container.style.height = "600px";
  document.body.append(container);

  const map = new Map(container);
  map.setView([35.68, 139.76], 14);

  return map;
}

export function disposeMap(map) {
  const container = map.getContainer();

  map.remove();
  container.remove();
}

/**
 * `count` points on a diagonal, as `[lat, lng]` (or `[lat, lng, alt]`).
 */
export function makePoints(count, { alt } = {}) {
  return Array.from({ length: count }, (_, i) => {
    const point = [35.68 + i * 0.001, 139.76 + i * 0.001];

    if (alt !== undefined) {
      point.push(alt);
    }

    return point;
  });
}

/**
 * The position of the i-th point of `makePoints()`, as a LatLng.
 */
export function at(i) {
  return new LatLng(35.68 + i * 0.001, 139.76 + i * 0.001);
}

/**
 * Record every editing event of `editor`, in emission order.
 */
export function recordEvents(editor) {
  const events = [];

  for (const type of EVENT_TYPES) {
    editor.on(type, (event) => {
      events.push({
        type,
        index: event.index,
        latlng: event.latlng,
        previousLatLng: event.previousLatLng,
        error: event.error,
      });
    });
  }

  return events;
}

export function eventTypes(events) {
  return events.map((event) => event.type);
}

/*
 * The helpers below reach into the editor's internals to find the editor
 * markers. If the internals are refactored, these are the only places
 * that need to follow.
 */

export function pointMarker(editor, index) {
  return editor._pointMarkers.find((marker) => marker._editablePointIndex === index);
}

export function midpointMarker(editor, previousIndex) {
  return editor._newPointMarkers.find(
    (marker) => marker._editablePreviousIndex === previousIndex,
  );
}

/**
 * Indices of the points that currently have an editor marker, ascending.
 */
export function markerIndices(editor) {
  return editor._pointMarkers
    .map((marker) => marker._editablePointIndex)
    .sort((a, b) => a - b);
}

/**
 * Simulate dragging a marker to `latlng`.
 *
 * The events are fired directly; Leaflet's pointer-driven Draggable is not
 * exercised.
 */
export function drag(marker, latlng) {
  marker.fire("dragstart");
  marker.setLatLng(latlng);
  marker.fire("drag");
  marker.fire("dragend");
}

/**
 * Simulate the contextmenu interaction on a marker.
 */
export function contextmenu(marker) {
  marker.fire("contextmenu");
}

/**
 * Number of layers on the map, used to detect leaks.
 */
export function layerCount(map) {
  return Object.keys(map._layers).length;
}
