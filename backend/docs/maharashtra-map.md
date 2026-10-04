# Maharashtra Map Architecture

## Boundary source

The frontend bundles `frontend/src/data/geo/maharashtra-districts.json`, converted from DataMeet's Census 2011 district boundary source:

`https://github.com/datameet/maps/tree/master/Districts/Census_2011`

The asset contains 35 Maharashtra district features and one outer state outline derived from those district geometries. District properties are normalized to `id`, `name`, `officialName`, `districtCode`, and `censusCode`. No demographic or weather statistics are attached to the boundary asset.

## Coordinate system

All administrative and simulated weather coordinates use WGS84 / EPSG:4326 with explicit `latitude` and `longitude` fields in API models.

## Frontend map

The existing MapLibre stack remains in place. The map now:

- fits the actual Maharashtra geometry on load and reset;
- renders state fill, state outline, district fill, district boundaries, and zoom-dependent labels;
- provides district search and selection;
- displays a limited set of major-city context markers;
- keeps storm, forecast, uncertainty, hazard, lightning, and alert overlays driven by the current nowcast snapshot;
- uses the same administrative geometry in the SVG fallback when WebGL is unavailable.

## Backend contract

`GET /api/map/state` and `GET /api/v1/map/state` return the current authoritative map state: Maharashtra bounds, storm cells, hazard summaries, alert locations, forecast tracks, risk-zone centers, and source status. Weather positions and risks are not calculated by the map component.

The current prototype exposes one synthetic cell. District-level weather attribution is intentionally not claimed until backend geometry intersection is implemented. District selection therefore identifies the authoritative administrative feature and clearly labels that limitation.

## Performance and limitations

Districts are one GeoJSON source with MapLibre layers rather than React DOM nodes. City labels are limited to major locations. The boundary is offline and locally bundled; no boundary API is required. Basemap tiles remain intentionally minimal/offline, and weather observations remain synthetic/replay data rather than operational DWR, INSAT, or lightning feeds.