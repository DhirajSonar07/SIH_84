# NOVEXA NOWCAST — API & Data Contract

**Specification Version**: 1.0.0  
**Backend Version**: NOVEXA-BACKEND-1.0  
**Domain**: Maharashtra State, India (Lat: 15.6°N – 22.1°N, Lon: 72.6°E – 80.9°E)  
**Target Resolution**: 1.0 – 3.0 km grid cells, 0–6 hour convective lead times  

---

## 1. Overview & Operational Principles

NOVEXA NOWCAST is an advanced convective-scale early warning platform. The system operates on a strictly decoupled contract between the operational Command Center / Scenario Lab and the Python FastAPI backend engine.

- **Truthful Observability**: The frontend detects real connection health via standard `/api/health` and `/api/ready` probes.
- **Fail-Safe Operation**: In the event of backend unavailability, the frontend degrades gracefully to deterministic synthetic replay while clearly marking all data as synthetic.
- **Unified Schema**: Both REST snapshots and WebSocket continuous frames share the canonical `NowcastState` schema.

---

## 2. Health & Lifecycle Endpoints

### `GET /api/health`
Basic service liveness check.

**Response `200 OK`**:
```json
{
  "status": "ok",
  "backendVersion": "NOVEXA-BACKEND-1.0",
  "engineVersion": "1.0.0",
  "mode": "SYNTHETIC_REPLAY"
}
```

### `GET /api/ready`
Subsystem readiness and component probe.

The versioned aliases `/api/v1/health` and `/api/v1/ready` expose the same
responses for clients that pin the v1 API namespace.

**Response `200 OK`**:
```json
{
  "status": "ready",
  "checks": {
    "engine_initialized": true,
    "scenario_engine_ready": true,
    "configuration_loaded": true,
    "models_ready": true,
    "data_providers_ready": true
  }
}
```

---

## 3. Core Nowcast & Spatial Map APIs

### `GET /api/nowcast/current`
Returns the authoritative nowcast state snapshot computed by the backend engine at the current minute.

### `GET /api/nowcast/{timestamp}`
Returns the nowcast state at a historical ISO timestamp or relative scenario minute (e.g. `45`).

**Schema Highlights (`NowcastState`)**:
- `scenarioId`: e.g., `"SC-001"`
- `minute`: Current timeline minute (0–360)
- `lead`: Forecast lead time offset in minutes (0, 15, 30, 45, 60)
- `observationTime`: ISO timestamp of latest radar/satellite observation
- `timestamp`: Computation ISO timestamp
- `mode`: `"BACKEND" | "SIMULATION" | "REPLAY"`
- `storm`: Primary tracked storm cell (`StormState`)
- `stormCells`: Multi-cell cluster across Maharashtra (`StormState[]`)
- `hazards`: Vector of evaluated hazards (`Hazard[]`)
  - Types: `LIGHTNING`, `HAIL`, `WIND_GUST`, `DOWNBURST`, `FLASH_FLOOD`, `TORNADO_VORTEX`
  - Fields: `risk` (0–100), `confidence` (0–100), `severity` (`LOW`, `ELEVATED`, `HIGH`, `SEVERE`), `eta` (min)
- `fusion`: Multi-source confidence metrics (`quality`, `confidence`, `dwrWeight`, `insatWeight`, `lightningWeight`)
- `sources`: Physical sensor status (`SourceStatus[]`)
- `alerts`: Active early-warning alerts (`AlertRecord[]`)
- `forecast`: Temporal forecast trend vectors (`ForecastPoint[]`)

### `GET /api/map/state` (or `/api/v1/map/state`)
Returns full Maharashtra state-wide GIS features, storm cells, risk zones, and district/regional aggregates.

**Response Payload**:
```json
{
  "timestamp": "2026-10-04T12:45:00Z",
  "region": "Maharashtra",
  "scope": "STATE",
  "resolutionKm": 1.0,
  "bounds": {
    "west": 72.6,
    "south": 15.6,
    "east": 80.9,
    "north": 22.1
  },
  "stormCells": [
    {
      "id": "CELL-001",
      "latitude": 18.52,
      "longitude": 73.85,
      "intensity": 58.2,
      "severity": "SEVERE",
      "velocity": 34.0,
      "direction": "ENE",
      "confidence": 88.0,
      "hazards": ["LIGHTNING", "HAIL", "FLASH_FLOOD"]
    }
  ],
  "districtRisks": [
    {
      "districtId": "pune",
      "districtName": "Pune",
      "region": "Western Maharashtra",
      "activeCells": ["CELL-001"],
      "highestHazard": "LIGHTNING",
      "risk": 82.5,
      "confidence": 88.0,
      "eta": 12.0,
      "activeAlerts": 1
    }
  ],
  "regionalRisks": [
    {
      "region": "Western Maharashtra",
      "activeCells": 1,
      "risk": 82.5,
      "activeAlerts": 1
    }
  ]
}
```

### `GET /api/v1/analysis/domain`
Metadata regarding Maharashtra state bounds, 35 district centroids, 5 regional divisions, and grid configuration.

---

## 4. Entity Query Endpoints

### `GET /api/storms` & `GET /api/storms/{storm_id}`
Query all detected convective storm cells or a specific cell by ID (`CELL-001`, `CELL-002`, etc.).

### `GET /api/hazards` & `GET /api/hazards/{hazard_type}`
Query calculated hazard probabilities and severities.

### `GET /api/sources/status`
Real-time ingestion status of primary observing networks:
1. `DWR` — Doppler Weather Radar (Reflectivity, Radial Velocity, Spectrum Width)
2. `INSAT` — INSAT-3D/3DR (Thermal Infrared, Water Vapor Channel)
3. `LIGHTNING` — Lightning Detection Network (IC & CG Flash Density)
4. `NWP` — Numerical Weather Prediction Background (WRF / NCUM 3km)

### `GET /api/alerts` & `GET /api/alerts/{alert_id}`
Query bulletin records filtered by optional `?status=OPEN|DELIVERED|ACKNOWLEDGED` and `?severity=WATCH|WARNING|CRITICAL`.

---

## 5. Scenario Lab & Simulation Replay APIs

### `GET /api/scenarios` & `GET /api/scenarios/{scenario_id}`
List catalogued meteorological scenarios:
- `SC-001`: Multi-Cell Severe Convective Cluster (Pune & Western Ghats)
- `SC-002`: Rapid Squall Line (Vidarbha / Nagpur Sector)
- `SC-003`: Tropical Coastal Inundation (Konkan / Mumbai / Raigad)
- `SC-004`: Dryline Thunderstorm Outbreak (Marathwada & Solapur)

### `POST /api/scenarios/{scenario_id}/run`
Executes an experimental scenario with optional parameter overrides:
```json
{
  "minute": 45.0,
  "lead": 15,
  "parameters": {
    "intensity": 65.0,
    "speed": 40.0,
    "direction": "ENE",
    "dwrQuality": 0.95,
    "insatQuality": 0.90,
    "lightningQuality": 0.85
  }
}
```

### Replay Controls
- `POST /api/replay/start` — Resumes replay clock
- `POST /api/replay/pause` — Freezes replay state
- `POST /api/replay/reset` — Resets simulation minute to T+0
- `POST /api/replay/seek` — Jump to specific minute `{"minute": 60}`
- `POST /api/replay/parameters` — Live parameter intervention

---

## 6. Real-Time WebSocket Streaming

### `WS /api/ws/nowcast`
Bidirectional WebSocket connection broadcasting continuous updates at 1 Hz:
- When replay is running, simulation time advances synchronously.
- Sends full `NowcastState` payload on each tick.
- Reconnection logic on frontend polls with exponential backoff on disconnect.

---

## 7. Diagnostics & Tracing

### `GET /api/performance`
Provides frame latency, inference execution time, radar grid rendering times, and pipeline statistics.

### `GET /api/pipeline/status`
Status of 6 pipeline stages:
1. Ingestion & Quality Control
2. Coordinate Transform & Grid Mapping
3. Source Fusion & Quality Weighting
4. Convective Cell Tracking (TITAN/SCIT)
5. Hazard Assessment & Severity Thresholding
6. Alert Generation & Bulletin Dispatch

### `GET /api/technical/trace/{alert_id}`
Full causal lineage audit trail for an alert showing the exact decision chain from sensor inputs to warning issuance.
