# NOVEXA NOWCAST API Contract

## Conventions

- Base path: `/api`
- JSON timestamps: ISO-8601 UTC strings.
- Risk, confidence, probability, quality, and agreement in the frontend snapshot are percentages `0..100`.
- Internal engine calculations use `0.0..1.0` and are converted at the adapter boundary.
- All current snapshots are complete `NowcastState` objects, never partial patches.
- Unknown or invalid requests return `{code, message, details, timestamp, request_id}`.

## Frontend-Critical Endpoints

| Method | Path | Purpose | Frontend consumer |
| --- | --- | --- | --- |
| GET | `/api/nowcast/current` | Latest authoritative complete snapshot | `ApiProvider.getSnapshot` |
| GET | `/api/nowcast/{timestamp}` | Deterministic snapshot at a replay timestamp | recovery/history/technical |
| WebSocket | `/api/ws/nowcast` | Complete snapshots on replay ticks | `ApiProvider.connect` |

WebSocket messages are JSON `NowcastState` snapshots. Sequence numbers start at zero and increase strictly by one for each published frame. A reconnect client receives the latest complete snapshot immediately.

## Operational Endpoints

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/health` | process health and backend version |
| GET | `/api/ready` | engine, scenario, configuration, and source readiness |
| GET | `/api/storms` | active `StormCell` records from current state |
| GET | `/api/storms/{storm_id}` | one active or replayed storm cell |
| GET | `/api/hazards` | ordered four-hazard array |
| GET | `/api/hazards/{hazard_type}` | one hazard record |
| GET | `/api/sources/status` | DWR, INSAT, and lightning quality/status records |
| GET | `/api/alerts` | current alert records, optionally filtered by status/severity |
| GET | `/api/alerts/{alert_id}` | alert and traceable evidence chain |
| GET | `/api/performance` | measured processing and throughput metrics |
| GET | `/api/pipeline/status` | stage statuses and record counts |
| GET | `/api/technical/trace/{alert_id}` | source -> quality -> feature -> fusion -> storm -> hazard -> alert trace |

## Map State

`GET /api/map/state` and `GET /api/v1/map/state` return the current map contract. Both paths are aliases so the existing `/api` frontend base and the versioned integration contract can coexist.

```json
{
	"timestamp": "2026-10-04T13:30:00Z",
	"region": "Maharashtra",
	"bounds": {"north": 22.03, "south": 15.60, "east": 80.90, "west": 72.60},
	"stormCells": [],
	"hazards": [],
	"alerts": [],
	"forecastTracks": [],
	"riskZones": [],
	"sources": []
}
```

The frontend administrative geometry is a locally bundled DataMeet Census 2011 asset. Weather coordinates, risks, alerts, tracks, and source status in this response come from the same authoritative nowcast snapshot used by the WebSocket.

The map response also includes `districtRisks` and `regionalRisks`. District risks are derived from actual storm-footprint intersections. `scope` is `STATE` by default and `resolutionKm` reports the configured analysis grid resolution.

## Scenario and Replay Endpoints

| Method | Path | Request | Purpose |
| --- | --- | --- | --- |
| GET | `/api/scenarios` | none | deterministic scenario catalog |
| GET | `/api/scenarios/{scenario_id}` | none | scenario metadata and parameters |
| POST | `/api/scenarios/{scenario_id}/run` | optional `ScenarioRunRequest` | select scenario and compute a complete snapshot |
| POST | `/api/replay/start` | optional speed | start server replay publication |
| POST | `/api/replay/pause` | none | pause server replay |
| POST | `/api/replay/reset` | none | reset active scenario to minute zero |
| POST | `/api/replay/seek` | `{minute}` | seek to a deterministic replay minute |
| POST | `/api/replay/parameters` | validated `ScenarioParameters` | causal judge-control update |

## Snapshot Schema Mapping

The response of `/nowcast/current` and WebSocket messages maps directly to the TypeScript `NowcastState` interface:

| Field | Backend meaning | Source |
| --- | --- | --- |
| `sources` | ordered source frame, signal, quality, metrics | replay source adapters |
| `evidence` | feature provenance used by fusion/hazards | feature engine |
| `fusion` | signal, agreement, quality, confidence, weights | transparent fusion |
| `storm` | detected/tracked cell and trajectory | detection/tracking |
| `stormCells` | complete detected-cell collection; `storm` remains the primary compatibility cell | state-wide detection/tracking |
| `hazards` | ordered risk, confidence, severity, evidence, forecast | hazard engine |
| `alerts` | threshold-qualified lifecycle records | alert engine |
| `performance` | measured stage latency and counts | pipeline instrumentation |
| `revision` | comparison with preceding snapshot | revision service |
| `truth` | synthetic ground-truth availability flag | scenario engine |

## Scenario Parameters

`intensity`, `lightning`, `velocity`, `cooling`, `noise`, `radarQuality`, `satelliteQuality`, `lightningQuality`, `confidenceThreshold`, and `warningThreshold` are bounded numeric controls. `direction` is degrees `0..360`. Parameters flow through source observations, quality, features, fusion, detection, tracking, hazards, forecast, and alerts; they do not directly overwrite output risks.

## Error Contract

Standard codes include `SOURCE_UNAVAILABLE`, `STALE_DATA`, `INVALID_FRAME`, `PROCESSING_FAILED`, `MODEL_UNAVAILABLE`, `SCENARIO_NOT_FOUND`, `INVALID_PARAMETER`, and `INTERNAL_ERROR`. Errors include a request ID and UTC timestamp.

## Mode and Provenance

The demo uses `REPLAY` or `SIMULATION` semantics internally. Backend snapshots are labelled `BACKEND` at the frontend adapter boundary. No endpoint claims operational DWR, INSAT, or national lightning access; source metadata explicitly identifies replay/synthetic provenance and limitations.