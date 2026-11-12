import "./support/dom.mjs";

import assert from "node:assert/strict";
import { it } from "node:test";
import { Polyline } from "leaflet";

import { PartiallyEditablePolyline } from "../src/leaflet-partially-editable-polyline.js";

it("runs Polyline init hooks only on actual editor instances", () => {
  const initialized = [];
  Polyline.addInitHook(function () {
    initialized.push(this);
  });

  const editor = new PartiallyEditablePolyline([[1, 2], [3, 4]]);
  assert.deepEqual(initialized, [editor]);

  editor.setLatLngs([[5, 6]]);
  assert.throws(
    () => editor.setLatLngs([[{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]]),
    /Nested coordinate arrays are not supported/,
  );
  assert.throws(
    () => new PartiallyEditablePolyline([[[1, 2], [3, 4]]]),
    /Nested coordinate arrays are not supported/,
  );
  assert.deepEqual(initialized, [editor]);
});
