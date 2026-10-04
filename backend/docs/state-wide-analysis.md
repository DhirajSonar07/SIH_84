# State-Wide Maharashtra Analysis

## Root cause

The previous engine used a single `ORIGIN = (73.70, 18.48)`, emitted one `storm`, and the map rendered only that field. The camera was state-wide, but computation and response cardinality were Pune-centered.

## Current domain

`app/domain.py` loads the same 35-district Maharashtra geometry bundled for the frontend. It derives the WGS84 bounds dynamically, constructs a configurable polygon-masked grid, and exposes district and region lookup. Default resolution is `COARSE` / 3 km; `MEDIUM` / 2 km and `FINE` / 1 km are supported through `ANALYSIS_RESOLUTION`.

The default state domain is independent of the map camera and contains 34,304 valid grid cells at 3 km resolution. Cells outside the Maharashtra polygon are masked.

## Detection model

Synthetic truth is deterministic and region-spawned. Each scenario can produce zero or more stable cells across Western Maharashtra, Konkan, North Maharashtra, Marathwada, and Vidarbha. Each cell evolves independently through position, intensity, growth, lightning, cooling, lifecycle, trajectory, hazards, and confidence. Cell positions are checked against the domain; no Pune-only filter remains.

The current prototype uses transparent seeded convective structures as the synthetic source field. The existing causal radar/satellite/lightning/fusion/hazard pipeline is applied per cell, and state-wide outputs are aggregated for the global source/hazard panels. A future real-data adapter can replace the seeded field while preserving the domain and cell contracts.

## API output

`NowcastState.storm` remains the primary selected-cell compatibility field. `NowcastState.stormCells` contains every detected cell. Map state adds per-cell tracks, alerts, risk zones, district risks, regional risks, scope, resolution, domain metadata, and grid metadata.

`GET /api/v1/analysis/domain` exposes the canonical polygon/bounds/grid contract. `GET /api/v1/map/state` exposes current state-wide detections. District risk is calculated from actual storm-footprint intersection with district geometry, not hand-assigned labels.

## Verified scenarios

- `SC-001` at T+45 produces four cells across Western Maharashtra, Marathwada, Vidarbha, and North Maharashtra.
- `SC-003` at T+45 produces a Vidarbha-led cell around longitude 79.44, proving the engine does not recenter every scenario on Pune.
- Cell IDs remain stable (`CELL-001`, `CELL-002`, and so on) across replay frames.