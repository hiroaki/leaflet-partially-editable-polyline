# leaflet-partially-editable-polyline

A Leaflet v2 plugin for editing only a local portion of a large polyline.

`PartiallyEditablePolyline` extends Leaflet's `Polyline` and provides a lightweight editing interface that creates editor markers only around the currently selected vertex. This makes it possible to edit a small portion of a large polyline without creating markers for every vertex.

> **Status: Early development**
>
> This project is currently under development. The repository is being published primarily to share the implementation and design for review. Package distribution and build tooling are not set up yet.

## Requirements

- Leaflet v2
- Modern browser with ES module support

This library currently targets Leaflet v2 and is not intended to support older Leaflet versions.

## Features

- Edit only a local portion of a large polyline
- Existing vertices can be dragged to new positions
- Midpoint markers can be dragged to insert new vertices
- Existing vertices can be deleted using `contextmenu`
- Only vertices within the current editing range receive editor markers
- Editing markers are rebuilt when the editing target changes
- External `setLatLngs()` calls remain supported as part of the normal Leaflet `Polyline` API
- Editing operations are reported through dedicated events
- The library does not manage application-specific GPX or geospatial metadata

## Current Status

This project is intentionally kept small and focused.

The library currently provides the editing interaction and geometry management required by the application that motivated it. It does not attempt to be a complete GPX editor.

In particular, the following are outside the responsibility of this library:

- GPX parsing or serialization
- Track/segment/route structure
- Elevation calculation or interpolation
- Timestamp management
- Persistence
- Undo/redo
- Application-specific data synchronization

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

The polyline itself remains a normal Leaflet layer. Editing can be started explicitly:

```js
editor.startEditing(latlng);
```

or by responding to a polyline click:

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

When editing starts, the nearest vertex to the supplied `LatLng` is selected. Only a local range of vertices around that vertex receives editing markers.

The default range is 100 vertices before and after the selected vertex.

For example, with:

```js
{
  editablePointRadius: 100
}
```

the editor may display markers for up to 201 vertices around the selected vertex.

The range is expressed in terms of the flat polyline vertex array. It does not represent a geographic distance.

The editable range is an implementation detail of the editing interaction; the application continues to own the complete geometry.

## Options

### `editablePointRadius`

Number of vertices to include on either side of the selected vertex.

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

Leaflet icon used for existing editable vertices.

### `newPointIcon`

Leaflet icon used for midpoint markers.

The default icons are provided by the library.

## API

### `startEditing(latlng)`

Starts an editing session around the vertex nearest to the supplied Leaflet `LatLng`.

```js
editor.startEditing(latlng);
```

The argument must be a Leaflet `LatLng`.

The method does not accept a point index or a Leaflet event object. If the caller has a Leaflet event, pass its `latlng` property explicitly:

```js
editor.startEditing(event.latlng);
```

If editing has been disabled with `disableEditing()`, `startEditing()` throws `EditingDisabledError` and fires the `editingerror` event.

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

`PartiallyEditablePolyline` retains Leaflet's normal `Polyline#setLatLngs()` API.

When called externally:

1. An active editing session is ended.
2. The Polyline geometry is replaced.
3. The library's internal editing state is rebuilt from the new geometry.

This means the application can continue to treat the Polyline as a normal Leaflet geometry layer.

The library currently supports a flat `LatLng[]` geometry only. Nested coordinate arrays are not supported.

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

`index` is the global index of the selected vertex in the complete flat polyline.

### `editingend`

Fired when an active editing session ends.

No additional payload is provided.

### `pointchange`

Fired once when an existing vertex has been moved and the drag operation has completed.

Payload:

```js
{
  index,
  previousLatLng,
  latlng
}
```

`index` is the global index of the changed vertex.

The operation corresponds conceptually to:

```js
latlngs[index] = latlng;
```

The event is fired after the library's internal geometry has been updated.

`previousLatLng` and `latlng` are independent `LatLng` snapshots and are not references to the library's internal objects.

### `pointinsert`

Fired once when a midpoint marker has been dragged to insert a new vertex.

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

Fired when an existing vertex is deleted.

Payload:

```js
{
  index,
  latlng
}
```

`index` is the global index of the vertex immediately before deletion.

The operation corresponds conceptually to:

```js
latlngs.splice(index, 1);
```

`latlng` is a snapshot of the deleted vertex.

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

The library does not manage elevation.

If a `LatLng` contains an `alt` value, the library carries that value when creating its internal and event-side `LatLng` objects, but it does not calculate, interpolate, or otherwise manage elevation.

Applications that require elevation-aware editing are responsible for updating elevation values as appropriate.

## Interaction

Existing vertex markers are draggable.

Midpoint markers between editable vertices can be dragged to insert a new vertex.

Existing vertices can be deleted through the Leaflet `contextmenu` interaction. This supports the standard desktop right-click interaction and Leaflet's corresponding long-press behavior on touch devices.

The library does not define application-level map interaction. For example, an application may use a map click to end editing.

Polyline and editor marker pointer events are configured so that their interaction does not unintentionally bubble into the map's general pointer handling.

## Data Model

The library operates on a flat sequence of Leaflet `LatLng` objects:

```js
[
  LatLng,
  LatLng,
  LatLng,
  // ...
]
```

It does not model GPX-specific structures such as:

- tracks
- track segments
- routes
- waypoints

If an application needs to preserve such structure, it should maintain that information separately and use the editing events to update the appropriate application data.

## Design

`PartiallyEditablePolyline` is implemented as a subclass of Leaflet's `Polyline`.

The library deliberately keeps the editing state small:

- The complete polyline remains the underlying Leaflet geometry.
- `_pointRecords` maintain the library's editing state.
- Editor markers are created only for the current local editing range.
- The application remains responsible for the semantic meaning and persistence of the data.

This separation allows the library to provide local editing without taking ownership of GPX-specific or application-specific data structures.

## Limitations

The current implementation has several intentional limitations:

- Leaflet v2 only
- Flat `LatLng[]` geometry only
- No GPX parsing or serialization
- No track/segment/route semantics
- No elevation calculation or interpolation
- No timestamp management
- No persistence
- No undo/redo
- No npm package distribution yet
- No build system yet
- No compatibility layer for older Leaflet versions

The project is still under development, so the public API may evolve.

## Development Status

The repository is currently intended primarily for experimentation, review, and further development.

Package metadata, build tooling, automated tests, and distribution mechanisms are still TODO.

## License

This project is released under the **Zero-Clause BSD License (0BSD)**.

See [LICENSE](LICENSE) for the full license text.
