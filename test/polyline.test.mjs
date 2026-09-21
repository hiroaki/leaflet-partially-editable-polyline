import "./support/dom.mjs";

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { LatLng } from "leaflet";

import {
  EditingDisabledError,
  PartiallyEditablePolyline,
} from "../src/leaflet-partially-editable-polyline.js";

import {
  at,
  contextmenu,
  createMap,
  disposeMap,
  drag,
  eventTypes,
  layerCount,
  makePoints,
  markerIndices,
  midpointMarker,
  pointMarker,
  recordEvents,
} from "./support/helpers.mjs";

const range = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe("PartiallyEditablePolyline", () => {
  let map;

  beforeEach(() => {
    map = createMap();
  });

  afterEach(() => {
    disposeMap(map);
  });

  function createEditor(count = 30, options = { editablePointRadius: 5 }) {
    return new PartiallyEditablePolyline(makePoints(count), options).addTo(map);
  }

  describe("geometry", () => {
    it("discards alt passed to the constructor", () => {
      const editor = new PartiallyEditablePolyline(makePoints(3, { alt: 10 }));

      assert.equal(editor.getLatLngs().length, 3);
      assert.ok(editor.getLatLngs().every((latlng) => latlng.alt === undefined));
    });

    it("accepts arrays, objects and LatLngs in setLatLngs() and discards alt", () => {
      const editor = createEditor();

      editor.setLatLngs([
        [1, 2, 3],
        { lat: 4, lng: 5, alt: 6 },
        new LatLng(7, 8, 9),
      ]);

      const latlngs = editor.getLatLngs();

      assert.deepEqual(
        latlngs.map((latlng) => [latlng.lat, latlng.lng]),
        [[1, 2], [4, 5], [7, 8]],
      );
      assert.ok(latlngs.every((latlng) => latlng.alt === undefined));
    });

    it("throws for nested coordinate arrays", () => {
      const nested = [[[1, 2], [3, 4]]];

      assert.throws(() => new PartiallyEditablePolyline(nested), Error);
      assert.throws(() => createEditor().setLatLngs(nested), Error);
    });

    it("does not support addLatLng()", () => {
      const editor = createEditor();

      assert.throws(() => editor.addLatLng([1, 2]), /setLatLngs/);
      assert.equal(editor.getLatLngs().length, 30);
    });

    it("keeps its editing state independent of the objects returned by getLatLngs()", () => {
      const editor = createEditor();
      const original = editor.getLatLngs()[0].lat;

      editor.startEditing(at(10));

      // Commit once, so that the geometry has been rebuilt from the records.
      drag(pointMarker(editor, 10), new LatLng(36, 140));

      editor.getLatLngs()[0].lat = 0;
      assert.equal(editor._pointRecords[0].latlng.lat, original);

      // The next commit restores the geometry from the editor's own records.
      drag(pointMarker(editor, 10), new LatLng(36.1, 140.1));
      assert.equal(editor.getLatLngs()[0].lat, original);
    });

    it("never reports alt, even if a dragged marker carries one", () => {
      const editor = new PartiallyEditablePolyline(makePoints(30, { alt: 7 }), {
        editablePointRadius: 5,
      }).addTo(map);
      const events = recordEvents(editor);

      editor.startEditing(at(10));
      drag(pointMarker(editor, 10), new LatLng(36, 140, 99));
      drag(midpointMarker(editor, 10), new LatLng(35.7, 139.8, 99));

      assert.ok(editor.getLatLngs().every((latlng) => latlng.alt === undefined));

      for (const event of events.filter((e) => e.latlng)) {
        assert.equal(event.latlng.alt, undefined);
        assert.equal(event.previousLatLng?.alt, undefined);
      }
    });
  });

  describe("startEditing()", () => {
    it("selects the point nearest to the given LatLng", () => {
      const editor = createEditor();
      const events = recordEvents(editor);

      editor.startEditing(new LatLng(at(10).lat + 0.0001, at(10).lng));

      assert.deepEqual(eventTypes(events), ["editingstart"]);
      assert.equal(events[0].index, 10);
    });

    it("creates markers only around the selected point", () => {
      const editor = createEditor();

      editor.startEditing(at(10));
      assert.equal(editor._pointMarkers.length, 11);
      assert.equal(editor._newPointMarkers.length, 10);

      editor.startEditing(at(0));
      assert.equal(editor._pointMarkers.length, 6);
      assert.equal(editor._newPointMarkers.length, 5);

      editor.startEditing(at(29));
      assert.equal(editor._pointMarkers.length, 6);
      assert.equal(editor._newPointMarkers.length, 5);
    });

    it("does nothing when the polyline is not on a map", () => {
      const editor = new PartiallyEditablePolyline(makePoints(5));
      const events = recordEvents(editor);

      editor.startEditing(at(1));

      assert.deepEqual(events, []);
    });

    it("ends the current session first", () => {
      const editor = createEditor();
      const events = recordEvents(editor);

      editor.startEditing(at(10));
      editor.startEditing(at(15));

      assert.deepEqual(eventTypes(events), [
        "editingstart",
        "editingend",
        "editingstart",
      ]);
    });

    it("throws a TypeError, without editingerror, for a non-LatLng argument", () => {
      const editor = createEditor();
      const events = recordEvents(editor);

      assert.throws(() => editor.startEditing({ lat: 1, lng: 2 }), TypeError);
      assert.deepEqual(events, []);
    });
  });

  describe("editablePointRadius", () => {
    it("uses the constructor's value by default", () => {
      const editor = createEditor();

      editor.startEditing(at(10));

      assert.deepEqual(markerIndices(editor), range(5, 15));
    });

    it("can be overridden for a single session", () => {
      const editor = createEditor();

      editor.startEditing(at(10), { editablePointRadius: 2 });
      assert.deepEqual(markerIndices(editor), range(8, 12));

      // The next session goes back to the constructor's value.
      editor.startEditing(at(10));
      assert.deepEqual(markerIndices(editor), range(5, 15));
    });

    it("with 0 gives a single marker and no midpoint markers", () => {
      const editor = createEditor();

      editor.startEditing(at(10), { editablePointRadius: 0 });

      assert.equal(editor._pointMarkers.length, 1);
      assert.equal(editor._newPointMarkers.length, 0);
    });

    it("with Infinity covers every point", () => {
      const editor = createEditor();

      editor.startEditing(at(10), { editablePointRadius: Infinity });

      assert.equal(editor._pointMarkers.length, 30);
      assert.equal(editor._newPointMarkers.length, 29);
    });

    it("throws a RangeError for invalid values", () => {
      const editor = createEditor();

      for (const value of [1.5, -1, NaN, "5", {}]) {
        assert.throws(
          () => editor.startEditing(at(3), { editablePointRadius: value }),
          RangeError,
          `value: ${String(value)}`,
        );
      }
    });

    it("leaves the current session untouched when a value is rejected", () => {
      const editor = createEditor();
      const events = recordEvents(editor);

      editor.startEditing(at(10));

      assert.throws(
        () => editor.startEditing(at(3), { editablePointRadius: -1 }),
        RangeError,
      );

      assert.deepEqual(markerIndices(editor), range(5, 15));
      assert.deepEqual(eventTypes(events), ["editingstart"]);
    });

    it("reports an invalid constructor value at startEditing()", () => {
      const editor = new PartiallyEditablePolyline(makePoints(5), {
        editablePointRadius: 1.5,
      }).addTo(map);

      assert.throws(() => editor.startEditing(at(1)), RangeError);
    });
  });

  describe("editing operations", () => {
    it("moving a point fires pointchange after the geometry is updated", () => {
      const editor = createEditor();
      const events = recordEvents(editor);
      let seenInHandler = null;

      editor.on("pointchange", (event) => {
        seenInHandler = editor.getLatLngs()[event.index].lat;
      });

      editor.startEditing(at(10));
      drag(pointMarker(editor, 10), new LatLng(36, 140));

      const change = events.find((event) => event.type === "pointchange");

      assert.equal(change.index, 10);
      assert.equal(change.latlng.lat, 36);
      assert.equal(change.previousLatLng.lat, at(10).lat);
      assert.equal(seenInHandler, 36);
      assert.equal(editor.getLatLngs()[10].lat, 36);
    });

    it("gives handlers snapshots that are independent of the library's data", () => {
      const editor = createEditor();

      editor.on("pointchange", (event) => {
        event.latlng.lat = 0;
        event.previousLatLng.lat = 0;
      });

      editor.startEditing(at(10));
      drag(pointMarker(editor, 10), new LatLng(36, 140));

      assert.equal(editor.getLatLngs()[10].lat, 36);
      assert.equal(editor._pointRecords[10].latlng.lat, 36);
    });

    it("inserts a point when a midpoint marker is dragged", () => {
      const editor = createEditor();
      const events = recordEvents(editor);

      editor.startEditing(at(10));
      drag(midpointMarker(editor, 10), new LatLng(35.7, 139.8));

      assert.deepEqual(eventTypes(events), ["editingstart", "pointinsert"]);
      assert.equal(events[1].index, 11);
      assert.equal(editor.getLatLngs().length, 31);
      assert.equal(editor.getLatLngs()[11].lat, 35.7);

      // The range is recalculated around the inserted point.
      assert.deepEqual(markerIndices(editor), range(6, 16));
    });

    it("deletes a point on contextmenu", () => {
      const editor = createEditor();
      const events = recordEvents(editor);

      editor.startEditing(at(10));
      contextmenu(pointMarker(editor, 12));

      assert.deepEqual(eventTypes(events), ["editingstart", "pointdelete"]);
      assert.equal(events[1].index, 12);
      assert.equal(editor.getLatLngs().length, 29);

      // The range is recalculated around the position of the deleted point.
      assert.deepEqual(markerIndices(editor), range(7, 17));
    });

    it("keeps the radius of the session after an insertion and a deletion", () => {
      const editor = createEditor();

      editor.startEditing(at(10), { editablePointRadius: 2 });

      drag(midpointMarker(editor, 10), new LatLng(35.71, 139.81));
      assert.deepEqual(markerIndices(editor), range(9, 13));

      contextmenu(pointMarker(editor, 11));
      assert.deepEqual(markerIndices(editor), range(9, 13));
    });

    it("ignores contextmenu on a midpoint marker", () => {
      const editor = createEditor();
      const events = recordEvents(editor);

      editor.startEditing(at(10));
      contextmenu(midpointMarker(editor, 10));

      assert.deepEqual(eventTypes(events), ["editingstart"]);
      assert.equal(editor.getLatLngs().length, 30);
    });

    it("ends the session after pointdelete when the last point is deleted", () => {
      const editor = createEditor(2);
      const events = recordEvents(editor);

      editor.startEditing(at(0));
      contextmenu(pointMarker(editor, 0));
      contextmenu(pointMarker(editor, 0));

      assert.deepEqual(eventTypes(events), [
        "editingstart",
        "pointdelete",
        "pointdelete",
        "editingend",
      ]);
      assert.equal(editor.getLatLngs().length, 0);
    });
  });

  describe("session lifecycle", () => {
    it("ends the session on setLatLngs() and edits the new geometry afterwards", () => {
      const editor = createEditor();
      const events = recordEvents(editor);

      editor.startEditing(at(10));
      editor.setLatLngs([[1, 2], [4, 5], [7, 8]]);

      assert.deepEqual(eventTypes(events), ["editingstart", "editingend"]);

      editor.startEditing(new LatLng(4, 5));
      assert.equal(editor._pointMarkers.length, 3);
    });

    it("refuses to start while disabled, and ends a running session on disable", () => {
      const editor = createEditor();
      const events = recordEvents(editor);

      editor.startEditing(at(10));
      editor.disableEditing();
      assert.deepEqual(eventTypes(events), ["editingstart", "editingend"]);

      let thrown = null;

      try {
        editor.startEditing(at(10));
      } catch (error) {
        thrown = error;
      }

      assert.ok(thrown instanceof EditingDisabledError);
      assert.equal(events.at(-1).type, "editingerror");
      assert.equal(events.at(-1).error, thrown);

      editor.enableEditing();
      editor.startEditing(at(10));
      assert.equal(events.at(-1).type, "editingstart");
    });

    it("can be removed from the map while editing", () => {
      const editor = createEditor();
      const events = recordEvents(editor);

      editor.startEditing(at(10));

      const markers = [...editor._pointMarkers, ...editor._newPointMarkers];

      assert.doesNotThrow(() => map.removeLayer(editor));

      assert.equal(events.at(-1).type, "editingend");
      assert.ok(markers.every((marker) => !map.hasLayer(marker)));
    });

    it("can be removed from the map while idle, and added and edited again", () => {
      const editor = createEditor();

      assert.doesNotThrow(() => map.removeLayer(editor));

      editor.addTo(map);
      editor.startEditing(at(10));

      assert.equal(editor._pointMarkers.length, 11);
    });

    it("leaves no layers behind after a full session", () => {
      const editor = createEditor();
      const baseline = layerCount(map);

      editor.startEditing(at(10));
      drag(pointMarker(editor, 10), new LatLng(36, 140));
      drag(midpointMarker(editor, 10), new LatLng(35.7, 139.8));
      contextmenu(pointMarker(editor, 12));
      editor.endEditing();

      assert.equal(layerCount(map), baseline);
    });
  });

  describe("large polylines", () => {
    it("creates markers only for the editable range of a 10,000-point polyline", () => {
      const points = Array.from({ length: 10000 }, (_, i) => [
        35.6 + Math.sin(i / 50) * 0.05,
        139.7 + i * 0.00001,
      ]);

      const editor = new PartiallyEditablePolyline(points, {
        editablePointRadius: 100,
      }).addTo(map);

      editor.startEditing(new LatLng(points[5000][0], points[5000][1]));

      assert.equal(editor._pointMarkers.length, 201);
      assert.equal(editor._newPointMarkers.length, 200);
    });
  });
});
