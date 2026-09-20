# leaflet-partially-editable-polyline

A Leaflet v2 plugin for editing only a local portion of a large polyline.

[Live Demo](https://hiroaki.github.io/leaflet-partially-editable-polyline/examples/demo.html)

`PartiallyEditablePolyline` extends Leaflet's `Polyline` and provides a lightweight editing interface that creates editor markers only around the currently selected point. This makes it possible to edit a small portion of a large polyline without creating markers for every point.

> **Status: Early development**
>
> This project is currently under development. The repository is being published primarily to share the implementation and design for review. Package distribution and build tooling are not set up yet.

## Requirements

- Leaflet v2
- Modern browser with ES module support

This library currently targets Leaflet v2 and is not intended to support older Leaflet versions.

The source imports Leaflet with the bare module specifier `"leaflet"`, so the application needs an import map or a bundler that resolves it. The application and the library must use the same Leaflet module instance; for example, a `LatLng` passed to `startEditing()` must be an instance of that module's `LatLng` class.

## Features

- Edit only a local portion of a large polyline
- Existing points can be dragged to new positions
- Midpoint markers can be dragged to insert new points
- Existing points can be deleted using `contextmenu`
- Only points within the current editing range receive editor markers
- Editing markers are rebuilt when the editing target changes
- External `setLatLngs()` calls are supported and rebuild the editing state
- Editing operations are reported through dedicated events
- The library does not manage application-specific geospatial metadata

## Scope

This project is intentionally kept small and focused.

The library currently provides the editing interaction and geometry management required by the application that motivated it.

In particular, the following are outside the responsibility of this library:

- Application-specific data structure or synchronization
- Elevation calculation or interpolation
- Timestamp management
- Persistence
- Undo/redo

The application using the library remains the source of truth for such data.

## Usage

The library is currently used directly from its source files. Build and package distribution are not set up yet.

Include the stylesheet:

```html
<link rel="stylesheet" href="./src/leaflet-partially-editable-polyline.css" />
```

Then import the class from the source module:

```js
import { PartiallyEditablePolyline } from "./src/leaflet-partially-editable-polyline.js";
```

Create a polyline in the same way as a normal Leaflet `Polyline`:

```js
const editor = new PartiallyEditablePolyline(latlngs, {
  editablePointRadius: 100,
});

editor.addTo(map);
```

The polyline itself remains a Leaflet layer. The library does not start editing by itself; the application decides when editing starts. Editing can be started explicitly, once the polyline has been added to a map:

```js
editor.startEditing(latlng);
```

or by responding to a polyline click (the library does not register a click handler on its own):

```js
editor.on("click", (event) => {
  editor.startEditing(event.latlng);
});
```

When the user clicks elsewhere on the map, an application can end the current editing session:

```js
map.on("click", () => {
  editor.endEditing();
});
```

## Editing Range

The library is designed for large polylines.

When editing starts, the nearest point to the supplied `LatLng` is selected. Only a local range of points around that point receives editing markers.

The default range is 100 points before and after the selected point.

For example, with:

```js
{
  editablePointRadius: 100
}
```

the editor may display markers for up to 201 points around the selected point.

The range is expressed in terms of the flat polyline point array. It does not represent a geographic distance.

After a point is inserted or deleted, the range is recalculated around the inserted point or, after a deletion, around the point that took the deleted point's position (the last point if the last one was deleted). Moving a point does not change the range.

The range only determines which points receive editor markers; the application continues to own the complete geometry.

## Options

### `editablePointRadius`

Number of points to include on either side of the selected point.

It must be a non-negative integer. Other values are not validated and may cause errors or an editing session without markers. With `0`, only the selected point receives a marker and no midpoint markers are shown.

Default:

```js
100
```

Example:

```js
const editor = new PartiallyEditablePolyline(latlngs, {
  editablePointRadius: 50,
});
```

### `pointIcon`

Leaflet icon used for existing editable points.

### `newPointIcon`

Leaflet icon used for midpoint markers.

The default icons are provided by the library.

## API

### `startEditing(latlng)`

Starts an editing session around the point nearest to the supplied Leaflet `LatLng`.

```js
editor.startEditing(latlng);
```

The argument must be a Leaflet `LatLng` (an instance of the same Leaflet module's `LatLng` class). Anything else throws a `TypeError`; `editingerror` is not fired in this case.

The method does not accept a point index or a Leaflet event object. If the caller has a Leaflet event, pass its `latlng` property explicitly:

```js
editor.startEditing(event.latlng);
```

If editing has been disabled with `disableEditing()`, `startEditing()` throws `EditingDisabledError` and fires the `editingerror` event.

If the polyline has not been added to a map, or has no points, the method does nothing and fires no event.

If an editing session is already active, it is ended first (`editingend` is fired) and then the new session starts (`editingstart` is fired).

`EditingDisabledError` is exported from the same module as `PartiallyEditablePolyline`.

### `endEditing()`

Ends the current editing session.

If no editing session is active, this method does nothing and does not fire `editingend`.

```js
editor.endEditing();
```

### `enableEditing()`

Enables editing.

```js
editor.enableEditing();
```

### `disableEditing()`

Disables editing.

If an editing session is active, it is ended immediately.

Subsequent calls to `startEditing()` throw `EditingDisabledError`.

```js
editor.disableEditing();
```

### `setLatLngs(latlngs)`

Replaces the whole geometry. This is the only supported way to change the geometry from outside the library: when the application's own data changes, pass the new coordinates to this method.

`PartiallyEditablePolyline` retains Leaflet's normal `Polyline#setLatLngs()` call signature.

When called externally:

1. An active editing session is ended.
2. The coordinates are copied and normalized to latitude and longitude (see [Elevation and `LatLng.alt`](#elevation-and-latlngalt)), and the Polyline geometry is replaced with the copy.
3. The library's internal editing state is rebuilt from the new geometry.

The same normalization is applied to the coordinates passed to the constructor.

The library supports a flat geometry only. Each element may be a `LatLng`, a `[lat, lng]` array, or a `{ lat, lng }` object. Nested coordinate arrays are not supported and cause an error to be thrown.

### `addLatLng()`

Not supported. `addLatLng()` always throws an error.

The polyline held by the library is an editing copy of the application's geometry (see [Design](#design)), and changing the copy independently of the application's data is not supported. Update the application's own data and call `setLatLngs()` instead.

## Events

The library emits the following editing events.

### `editingstart`

Fired when an editing session starts.

Payload:

```js
{
  index
}
```

`index` is the global index of the selected point in the complete flat polyline.

### `editingend`

Fired when an active editing session ends.

This happens when the session is ended by `endEditing()`, `disableEditing()` or `setLatLngs()`, when the layer is removed from the map, when `startEditing()` is called during an active session, or when the last remaining point is deleted.

No additional payload is provided.

### `pointchange`

Fired once when an existing point has been moved and the drag operation has completed.

Payload:

```js
{
  index,
  previousLatLng,
  latlng
}
```

`index` is the global index of the changed point.

The operation corresponds conceptually to:

```js
latlngs[index] = latlng;
```

The event is fired after the library's internal geometry has been updated.

`previousLatLng` and `latlng` are independent `LatLng` snapshots and are not references to the library's internal objects.

### `pointinsert`

Fired once when a midpoint marker has been dragged to insert a new point.

Payload:

```js
{
  index,
  latlng
}
```

The operation corresponds conceptually to:

```js
latlngs.splice(index, 0, latlng);
```

The event is fired after the insertion has been applied.

The event represents the completed insertion. The midpoint drag does not generate an additional `pointchange` event.

### `pointdelete`

Fired when an existing point is deleted.

Payload:

```js
{
  index,
  latlng
}
```

`index` is the global index of the point immediately before deletion.

The operation corresponds conceptually to:

```js
latlngs.splice(index, 1);
```

`latlng` is a snapshot of the deleted point.

There is no lower limit on the number of points. When the last remaining point is deleted, `pointdelete` is followed by `editingend`.

### `editingerror`

Fired when an editing operation cannot be started.

For example, attempting to call `startEditing()` while editing is disabled produces:

```js
{
  error
}
```

where `error` is an `EditingDisabledError`.

The error is also thrown by `startEditing()`.

## Event Ordering and Indices

Editing events describe completed operations and are emitted after the corresponding internal geometry/state update.

Indices are **global indices in the complete flat polyline**, not indices relative to the currently editable range.

Consumers should process events in emission order.

For example:

```js
pointinsert
```

changes the array before any subsequent event is interpreted, so a later index refers to the geometry state resulting from the previous event.

This follows the semantics of JavaScript array operations such as assignment and `splice()`.

## Elevation and `LatLng.alt`

The library does not manage elevation. The geometry held by the library is an editing copy that contains latitude and longitude only: `alt` values passed to the constructor or to `setLatLngs()` are discarded, and `getLatLngs()` and the `latlng` / `previousLatLng` values in events never contain `alt`.

Applications should keep elevation and other point data themselves and update it using the `index` in editing events.

## Interaction

Existing point markers are draggable. While a marker is being dragged, the other editor markers are hidden and dashed helper lines to the adjacent points are shown; the polyline itself is updated when the drag ends.

Midpoint markers between editable points can be dragged to insert a new point.

Existing points can be deleted through Leaflet's `contextmenu` interaction, such as the standard desktop right-click interaction. The `contextmenu` interaction on a midpoint marker does nothing.

The library does not define application-level map interaction. For example, an application may use a polyline click to start editing and a map click to end editing.

Polyline and editor marker pointer events are configured so that their interaction does not unintentionally bubble into the map's general pointer handling.

## Data Model

The library operates on a single flat sequence of Leaflet `LatLng` objects:

```js
[
  LatLng,
  LatLng,
  LatLng,
  // ...
]
```

Each `LatLng` represents one point of the polyline and carries latitude and longitude only. The library treats this sequence as geometry and does not attach any application-specific meaning to individual points.

Applications that need to associate additional information with points or maintain application-specific data structures should manage that information separately and use the editing events to keep it in sync with the edited geometry.

## Design

`PartiallyEditablePolyline` is implemented as a subclass of Leaflet's `Polyline`.

The polyline is an editing aid rather than the original data. It holds an editing copy of the geometry (latitude and longitude only), and the application remains the source of truth: editing results are reported through events, and the application applies them to its own data. When the application's data changes, it replaces the geometry with `setLatLngs()`; operations that would change the copy independently of the application's data, such as `addLatLng()`, are not supported.

The library deliberately keeps the editing state small:

- The Leaflet geometry of the polyline is an editing copy of the complete geometry, not shared with the application's data.
- The library keeps its own internal records of the points as its editing state.
- Editor markers are created only for the current local editing range.
- The application remains responsible for the semantic meaning and persistence of the data.

This separation allows the library to provide local editing without taking ownership of application-specific data structures.

## Limitations

The current implementation has several intentional limitations:

- Leaflet v2 only
- Flat `LatLng[]` geometry only
- `LatLng.alt` is discarded
- `addLatLng()` is not supported
- Directly modifying the array returned by `getLatLngs()`, or the `LatLng` objects in it, is not supported
- No npm package distribution yet
- No build system yet
- No compatibility layer for older Leaflet versions

The project is still under development, so the public API may evolve.

## Acknowledgements

This project was inspired by and developed with reference to
[Leaflet.js Editable Polylines plugin](https://github.com/tkrajina/leaflet-editable-polyline)
by tkrajina.

If you are using Leaflet v1, consider using
[Leaflet.js Editable Polylines plugin](https://github.com/tkrajina/leaflet-editable-polyline)
instead. This project is specifically designed for Leaflet v2.

## License

This project is released under the **Zero-Clause BSD License (0BSD)**.

See [LICENSE](LICENSE) for the full license text.
