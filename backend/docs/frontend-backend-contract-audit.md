# NOVEXA NOWCAST Frontend/Backend Contract Audit

## Scope

This audit is based on the existing source under `frontend/src`. No frontend files are changed by the backend implementation. The backend must preserve the current visual surface and emit the snapshot shape already validated by `frontend/src/lib/snapshotSchema.ts`.

## Routes and Screens

`frontend/src/app/routes.tsx` defines:

- `/` and fallback: Command Center
- `/nowcast`: nowcast intelligence
- `/radar`: radar/source intelligence
- `/hazards`: hazard intelligence and alert ledger
- `/scenarios`: scenario lab and judge controls
- `/performance`: synthetic evaluation metrics
- `/technical`: integration, schema, recovery, and limitations

`Shell` owns the global navigation rail, provider mode selector, replay controls, alert count, inspection drawer, notices, and trust/disclaimer footer.

## Provider Boundary

The frontend has an explicit adapter seam:

- `NowcastProvider` is the provider interface.
- `LocalReplayProvider` uses the local deterministic engine.
- `SimulationProvider` applies judge-controlled parameters locally.
- `ApiProvider` reads `GET /api/nowcast/current` and subscribes to `/api/ws/nowcast`.

The current API provider expects complete `NowcastState` snapshots, validates them with Zod, rejects duplicate/out-of-order sequence numbers, and performs REST recovery after WebSocket gaps. It falls back to local replay after repeated connection failures.

## Frontend State

`frontend/src/store/index.ts` contains:

- `useScenarioStore`: scenario, parameters, replay minute, lead, playback, mode, and interventions.
- `useNowcastStore`: current/observed snapshots, received history, alert journal, request, connection status, and audit.
- `useMapStore`: layer visibility and focused storm.
- `useUiStore`: inspection drawer, notices, and keyboard state.

Local replay transitions are deterministic. Selecting a scenario resets replay. Seeking reconstructs parameters and alerts. Playing advances five-minute replay frames. Adjusting a judge parameter changes the causal simulation and returns to local simulation mode.

## Canonical TypeScript Contract

The authoritative frontend interfaces are in `frontend/src/types/nowcast.ts`:

- `NowcastState`
- `SourceState` and `DataQuality`
- `FeatureEvidence`
- `StormCell` and `TrajectoryPoint`
- `FusionState`
- `HazardState`
- `AlertState`, `AlertRecord`, and `AlertTrace`
- `PerformanceState` and `ProcessingStage`
- `ForecastRevision`
- `Scenario`, `ScenarioParameters`, `ScenarioIntervention`, and `ProviderRequest`

The backend-compatible snapshot must satisfy `frontend/src/lib/snapshotSchema.ts`:

- `schemaVersion` is exactly `1.0`.
- Sources are exactly and in order: `DWR RADAR`, `INSAT-3DR`, `LIGHTNING`.
- Hazards are exactly and in order: `Lightning`, `Hail`, `Downburst`, `Cloudburst`.
- Percentages are `0..100`; coordinates and timestamps are validated.
- `observationTime <= processingTime <= timestamp`.
- Fusion weights sum to one, or are all zero when unavailable.
- Alert IDs are unique and alerts reference the active scenario and storm cell.

## Existing Demo/Data Model

`frontend/src/data/scenarios.ts` provides eight deterministic synthetic scenarios, including severe approach, rapid initiation, lightning burst, hail, cloudburst, weakening storm, false alarm, and degraded sources. Parameters include intensity, lightning, velocity, cooling, noise, per-source quality, confidence/warning thresholds, and direction.

`frontend/src/lib/engine.ts` derives radar, satellite, and lightning signals from a shared scenario state. It computes quality-adjusted fusion, agreement, confidence, convective state, storm motion, ETA, four hazard risks, evidence, alert traces, pipeline stages, and synthetic truth labels. These are explicit heuristics and not operational meteorology.

`frontend/src/lib/replay.ts` generates five-minute frames, applies interventions, reconstructs history, and performs linear advection through six hours.

## Maps and Charts

`OperationsMap` renders local schematic Pune geography and GeoJSON overlays for radar rings, cloud envelope, lightning, observed/forecast tracks, uncertainty, hazard extent, and the storm cell. There are no external operational tiles or feeds. `OfflineMapFallback` preserves a local view if MapLibre/WebGL is unavailable.

Recharts displays hazard/confidence forecast, storm evolution, reflectivity, area, lightning, cooling, and pipeline state. Backend history is only the history of snapshots actually received.

## Interactions and State Transitions

- Provider mode changes between local replay, simulation, and backend.
- Backend mode fetches the current snapshot, then connects to the WebSocket.
- WebSocket sequence gaps trigger a full REST snapshot recovery.
- Three failed reconnect attempts return the UI to local replay.
- Scenario selection, seek, play/pause, reset, speed, and lead controls are local today.
- Judge controls change the causal parameters locally and intentionally leave backend mode.
- Local alert acknowledgement/resolution exists; backend persistence is not wired.
- Technical screen presents intended health, readiness, nowcast, scenario, replay, performance, and trace paths, but only current nowcast and WebSocket are currently called by the API provider.

## Backend Assumptions and Gaps

The backend must initially provide an offline deterministic replay through the same processing stages, not random response values. It must expose the current snapshot and WebSocket first, then historical snapshots, scenarios, replay commands, health/readiness, source status, performance, and trace endpoints.

Known integration gaps are:

1. `ApiProvider.getSnapshot()` now forwards scenario, minute, lead, and parameters to the backend scenario-run endpoint. Server-side replay seek and parameter controls remain separate REST commands.
2. No frontend API calls exist for alert review, so backend review endpoints can be added without changing the current UI.
3. Vite has no proxy or backend URL setting; same-origin `/api` is the current deployment assumption.
4. There are no existing backend tests, scripts, models, or environment files.

## Implementation Boundary

All new work belongs under `backend/`. The first backend release will implement a deterministic, transparent engine with source adapters, quality checks, feature extraction, fusion, cell detection/tracking, hazards, forecast, alerts, trace, REST, WebSocket, replay, and tests. Frontend changes are deferred until an end-to-end contract mismatch is proven.