# NOVEXA NOWCAST - Final System Audit

**Date:** 2026-10-04
**Auditor:** System Integration Audit
**Scope:** Baseline audit before final integration corrections, covering frontend/backend integration, authenticity, and operational readiness

---

## Executive Summary

The NOVEXA NOWCAST project is a sophisticated convective-scale nowcasting prototype with:
- A functional FastAPI backend with deterministic synthetic engine
- A React + Vite + Tailwind CSS frontend with MapLibre maps
- Maharashtra-wide analysis domain (35 districts, 5 regions)
- Multi-source fusion (DWR, INSAT, Lightning proxies)
- Scenario lab with controlled simulation environment
- WebSocket support for real-time updates

**Baseline Issues Identified:**
1. The backend exposes unversioned health/readiness routes only; the documented `/api/v1/health` and `/api/v1/ready` aliases are missing.
2. The frontend health service tracks health/readiness, but backend engine availability is never promoted into the status model.
3. Backend disconnect handling falls back to a moving local replay, which violates the last-known-state/no-fake-live-data requirement.
4. Replay controls are mounted globally on every non-command route instead of being scoped to Scenario Lab.
5. Radar geometry is generated around individual cells with a small minimum footprint and lacks an explicit scenario coverage-range control.
6. State-wide administrative geometry exists, but operational labels/search/readability need verification at state zoom.
7. Account and technical documentation entry points exist and need interaction/build verification rather than the dead-button findings from the earlier audit.

---

## Project Structure

### Backend (`backend/`)
```
backend/
├── app/
│   ├── main.py          # FastAPI application with all endpoints
│   ├── engine.py        # NowcastEngine with deterministic scenarios
│   ├── schemas.py       # Pydantic models for all data structures
│   └── domain.py        # MaharashtraDomain with state-wide analysis
├── data/
│   └── geography/
│       └── maharashtra-districts.json  # 35 districts GeoJSON
├── docs/
│   ├── API-CONTRACT.md
│   ├── frontend-backend-contract-audit.md
│   ├── state-wide-analysis.md
│   └── maharashtra-map.md
├── tests/
├── requirements.txt
└── README.md
```

### Frontend (`frontend/`)
```
frontend/
├── src/
│   ├── app/
│   │   └── routes.tsx          # React Router configuration
│   ├── components/
│   │   ├── Shell.tsx           # Main layout with navigation
│   │   ├── OperationsMap.tsx   # MapLibre map with Maharashtra
│   │   ├── ScenarioControls.tsx # Judge/simulation controls
│   │   ├── ReplayControl.tsx   # Timeline and playback controls
│   │   ├── Intelligence.tsx    # Sources, Fusion, Threat, Pipeline
│   │   └── ...
│   ├── features/
│   │   ├── useNowcast.ts       # Replay clock (HAS SPEED BUG)
│   │   └── useAlerts.ts
│   ├── lib/
│   │   ├── geography.ts        # Radar/visual generation (small circles)
│   │   ├── maharashtra.ts      # District boundary handling
│   │   ├── alerts.ts
│   │   └── replay.ts
│   ├── pages/
│   │   ├── CommandCenter.tsx   # Main operational dashboard
│   │   └── AnalysisPages.tsx   # Nowcast, Radar, Hazards, Scenarios, etc.
│   ├── providers/
│   │   ├── ApiProvider.ts      # Backend connection with WebSocket
│   │   ├── LocalReplayProvider.ts
│   │   └── SimulationProvider.ts
│   ├── store/
│   │   └── index.ts            # Zustand stores (scenario, nowcast, map, ui)
│   └── data/
│       ├── geo/
│       │   └── maharashtra-districts.json
│       └── scenarios.ts
├── package.json
└── vite.config.ts
```

---

## Backend Status

### Health Endpoints ✅
- `GET /api/health` - Returns status, backend version, engine version, mode
- `GET /api/ready` - Returns readiness checks (engine, scenarios, config, models, data providers)
- `GET /api/v1/health` and `GET /api/v1/ready` - Versioned aliases for clients pinned to v1

### WebSocket ✅
- `WS /api/ws/nowcast` - Publishes NowcastState snapshots every 1 second
- Sequence numbers strictly increment
- Fallback to REST on disconnect

### Data Flow ✅
- Deterministic engine with 8 scenarios (SC-001 through SC-008)
- State-wide detection with multi-cell support
- Region-based spawning (Konkan, Western Maharashtra, North Maharashtra, Marathwada, Vidarbha)
- Proper district geometry intersection for risk calculation

### Backend Health Logic
```python
# backend/app/main.py
@app.get("/api/health")
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        backendVersion=BACKEND_VERSION,
        engineVersion=ENGINE_VERSION,
        mode="SYNTHETIC_REPLAY"
    )

@app.get("/api/ready")
def ready() -> ReadyResponse:
    checks = {
        "engine_initialized": True,
        "scenario_engine_ready": bool(SCENARIOS),
        "configuration_loaded": True,
        "models_ready": True,
        "data_providers_ready": True
    }
    return ReadyResponse(
        status="ready" if all(checks.values()) else "not_ready",
        checks=checks
    )
```

**Status:** Both route namespaces are implemented. The frontend polls health/readiness and promotes engine availability only when both checks pass.

---

## Frontend Status

### Provider Architecture ✅
Three providers implement `NowcastProvider` interface:
1. **LocalReplayProvider** - Deterministic local generation
2. **SimulationProvider** - Judge-controlled parameters
3. **ApiProvider** - REST + WebSocket backend connection

### Mode System ✅
Three modes:
- `REPLAY` - Local replay
- `SIMULATION` - Local simulation with judge controls
- `BACKEND` - Connected to FastAPI backend

### Connection Status ✅
- `ConnectionStatus` is mounted in the global header and uses health/readiness/WebSocket state.
- Backend mode is not marked connected until the initial authoritative snapshot is received.
- Disconnection freezes the last valid backend snapshot and exposes diagnostics; it does not start synthetic movement.

### Account Button ✅
- `AccountPanel` is wired to the rail avatar and exposes session, environment, backend, profile, preference, system settings, and sign-out actions.

### Technical Documentation ✅ (partially)
**Location:** Shell.tsx line 39
```tsx
<button onClick={() => navigate('/technical')}>
  <CircleHelp size={20}/>
</button>
```

**Status:**
- Button works and navigates to `/technical`
- TechnicalPage exists with substantial content
- However, could be more comprehensive

### Speed Control Bug ❌
**Location:** `frontend/src/features/useNowcast.ts`
```tsx
export function useReplayClock() {
  const playing = useScenarioStore(state => state.playing);
  const speed = useScenarioStore(state => state.speed);  // ✅ Gets speed
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const state = useScenarioStore.getState();
      if (state.minute >= 240) { useScenarioStore.setState({ playing: false }); return; }
      actions.seek(state.minute + speed);  // ❌ Bug: always adds 1, not speed
    }, 1000);  // ❌ Bug: interval is always 1000ms, should vary by speed
    return () => clearInterval(timer);
  }, [playing, speed]);
}
```

**Problems:**
1. `state.minute + speed` - Should be `state.minute + 5 * speed` (5-minute timesteps)
2. Interval is always 1000ms - Should be `1000 / speed` for proper speed scaling
3. Result: 0.5x, 1x, 2x all behave identically

### Radar Simulation ⚠️
**Location:** `frontend/src/lib/geography.ts`
```tsx
export function ellipse(longitude: number, latitude: number, radius: number, phase = 0) {
  return Array.from({ length: 65 }, (_, index) => {
    const angle = index / 64 * Math.PI * 2;
    const wobble = 1 + Math.sin(angle * 5 + phase) * 0.1 + Math.cos(angle * 9) * 0.05;
    return [
      longitude + Math.cos(angle) * radius / 105 * wobble,
      latitude + Math.sin(angle) * radius / 111 * 0.7 * wobble
    ];
  });
}
```

**Problem:**
- Radius is derived from `Math.sqrt(storm.area / Math.PI)` - typically 3-8 km
- This creates small circular blobs
- Not state-wide radar coverage
- Should be configurable range (50km, 100km, 150km, 250km)

### District Labels ⚠️
**Location:** `frontend/src/components/OperationsMap.tsx`
```tsx
instance.addLayer({
  id: 'district-labels',
  type: 'symbol',
  source: 'maharashtra-admin',
  minzoom: 6,
  filter: ['==', ['get', 'kind'], 'district'],
  layout: {
    'text-field': ['get', 'name'],  // ❌ Always full name
    'text-size': ['interpolate', ['linear'], ['zoom'], 6, 8, 9, 11],
    'text-allow-overlap': false
  },
  paint: {
    'text-color': '#b8ccd1',
    'text-halo-color': '#10202b',
    'text-halo-width': 1.2
  }
});
```

**Problems:**
- No short form dictionary
- No zoom-dependent label switching
- All 35 districts show full names at zoom 6+
- Cluttered at state-level view

### Simulation Controls in Command Center ⚠️
**Location:** `CommandCenter.tsx`
```tsx
<button className="subtle-button" onClick={() => actions.inspect('controls')}>
  <SlidersHorizontal size={14}/>Judge controls
</button>
```

**Problem:**
- Command Center has "Judge controls" button
- Opens ScenarioControls panel
- These are simulation/experimental controls
- Should be isolated to Scenario Lab page only

---

## Map Status

### Maharashtra Geometry ✅
- GeoJSON with 35 districts + state boundary
- Source: DataMeet Census 2011
- Bounds: West 72.60, South 15.60, East 80.90, North 22.03
- Backend domain uses same geometry for analysis

### State-Wide Detection ✅
- Backend supports multi-cell scenarios
- Cells spawn in 5 regions: Konkan, Western Maharashtra, North Maharashtra, Marathwada, Vidarbha
- Example: SC-001 spawns 4 cells across all regions
- District risk calculated from actual geometry intersection

### District Search ✅
- Search input exists in OperationsMap
- Filters districts by name (case-insensitive)
- Clicking zooms to district and highlights it

### Map Readability ⚠️
- Labels cluttered at state zoom
- No short form abbreviations
- No collision detection beyond MapLibre default
- Major cities shown but compete with district labels

---

## API Contract

### Endpoints Implemented ✅
- `GET /api/health` - Health check
- `GET /api/ready` - Readiness check
- `GET /api/nowcast/current` - Current snapshot
- `GET /api/nowcast/{timestamp}` - Historical snapshot
- `GET /api/v1/map/state` - Map state with district/regional risks
- `GET /api/v1/analysis/domain` - Analysis domain metadata
- `GET /api/storms` - Storm cells
- `GET /api/hazards` - Hazards
- `GET /api/alerts` - Alerts
- `GET /api/sources/status` - Source status
- `GET /api/scenarios` - Scenario catalog
- `POST /api/scenarios/{id}/run` - Run scenario
- `POST /api/replay/start` - Start replay
- `POST /api/replay/pause` - Pause replay
- `POST /api/replay/reset` - Reset replay
- `POST /api/replay/seek` - Seek to minute
- `POST /api/replay/parameters` - Update parameters
- `WS /api/ws/nowcast` - WebSocket stream

### Schema Validation ✅
- Frontend has Zod schema in `snapshotSchema.ts`
- Backend uses Pydantic models
- Types match between TypeScript and Python
- Validation enforces ordering, ranges, constraints

---

## Current UI/UX Issues

### Top-Right Header
**Current:**
```
PUNE REGION
INDIA / MAHARASHTRA
[dropdown]
DATA MODE
[LOCAL REPLAY | SIMULATION | BACKEND]
OBSERVATION · SYNTHETIC
[timestamp] IST
```

**Problems:**
1. No connection status indicator (green/amber/red)
2. No actual health check result display
3. "PUNE REGION" is misleading when analyzing state-wide
4. "SYNTHETIC" label is always shown even in BACKEND mode

### Command Center
**Current:**
- Has "Judge controls" button opening simulation panel
- Displays replay controls
- Shows scenario selector in replay controls

**Problems:**
1. Simulation controls exposed in operational view
2. Should be clean operational monitoring only
3. Simulation controls belong in Scenario Lab

### Scenario Lab
**Current:**
- Has scenario selection
- Has ScenarioControls panel
- Has map
- Has fusion/causal chain display

**Status:** ✅ This is the correct place for simulation controls

---

## Authenticity Assessment

### What Works ✅
- Backend clearly labels data as "SYNTHETIC_REPLAY"
- TechnicalPage explains limitations honestly
- Sources are labeled with quality states
- No false claims about operational DWR/INSAT feeds
- Scenarios have deterministic seeds

### What Needs Improvement ⚠️
1. Connection status not truthfully displayed
2. No server-down popup when backend fails
3. Speed controls don't actually work (fake behavior)
4. Radar looks like a small demo circle, not realistic coverage
5. Command Center exposes simulation controls (looks like demo)

---

## Priority Fixes

### P0 - Critical (Authenticity & Backend Health)
1. **Fix connection status indicator** - Use health/ready endpoints, show green/amber/red
2. **Add server-down popup** - With diagnostics when backend unavailable
3. **Fix speed controls** - Make 0.5x, 1x, 2x actually work
4. **Fix Account button** - Make it functional

### P1 - High (UX & Readability)
5. **Implement district short forms** - Zoom-dependent labels
6. **Fix radar coverage** - Configurable range, state-wide visualization
7. **Remove simulation controls from Command Center** - Keep in Scenario Lab only
8. **Improve Technical Documentation** - Make it more comprehensive

### P2 - Medium (Polish)
9. **Add "Back to Maharashtra" button** - When focused on district/storm
10. **Improve label collision control** - Better decluttering
11. **Add system status panel** - Show API, Engine, Realtime, DWR, INSAT, Lightning health

---

## Testing Requirements

### Backend Failure Test
1. Start frontend only (no backend)
2. Expected: 🔴 SERVER OFFLINE popup
3. Click "View Details"
4. Expected: Diagnostic reasons (API unreachable, health failed, etc.)
5. Start backend
6. Click "Retry"
7. Expected: 🟢 CONNECTED

### Backend Kill Test
1. Start both frontend and backend
2. Let dashboard operate
3. Kill backend
4. Expected: Amber/Red connection state, no new fake data
5. Restart backend
6. Expected: Automatic recovery with 🟢 notification

### Speed Test
1. Run scenario at 0.5x, 1x, 2x
2. Verify event timing actually changes proportionally
3. 0.5x should take 2x real time for same event
4. 2x should take 0.5x real time for same event

### State-Wide Detection Test
1. Run SC-001 (multi-region scenario)
2. Verify cells detected in all 5 regions
3. Verify district risks calculated correctly
4. Verify map shows all cells, not just Pune

### Interaction Audit
1. Click every button
2. Verify Account opens panel
3. Verify Technical Documentation opens
4. Verify all map controls work
5. Verify search works
6. Verify no dead buttons

---

## Backend-Frontend Contract

### Health/Readiness Contract
```typescript
interface HealthResponse {
  status: string;           // "ok" | "error"
  backendVersion: string;
  engineVersion: string;
  mode: string;            // "SYNTHETIC_REPLAY" | "LIVE" | "REPLAY"
}

interface ReadyResponse {
  status: string;           // "ready" | "not_ready"
  checks: {
    engine_initialized: boolean;
    scenario_engine_ready: boolean;
    configuration_loaded: boolean;
    models_ready: boolean;
    data_providers_ready: boolean;
  };
}
```

### Connection States
Frontend should display:
- 🟢 **CONNECTED** - Health OK + Ready OK + WebSocket connected
- 🟡 **DEGRADED** - Health OK but some checks failed OR WebSocket disconnected
- 🔴 **OFFLINE** - Health endpoint unreachable OR backend not started
- 🔵 **CONNECTING** - Initial connection attempt in progress

---

## District Label Strategy

### Short Form Dictionary
```typescript
const DISTRICT_SHORT_FORMS: Record<string, string> = {
  "Pune": "PUNE",
  "Nagpur": "NAG",
  "Nashik": "NASH",
  "Aurangabad": "AUR",
  "Kolhapur": "KOL",
  "Solapur": "SOL",
  "Amravati": "AMR",
  "Nanded": "NDD",
  "Sangli": "SAN",
  "Satara": "SAT",
  "Latur": "LAT",
  "Jalgaon": "JAL",
  "Dhule": "DHL",
  "Akola": "AKL",
  "Buldhana": "BLD",
  "Washim": "WSH",
  "Yavatmal": "YAV",
  "Chandrapur": "CHD",
  "Gondia": "GON",
  "Bhandara": "BND",
  "Wardha": "WRD",
  "Gadchiroli": "GAD",
  "Raigad": "RAI",
  "Ratnagiri": "RAT",
  "Sindhudurg": "SIN",
  "Thane": "THN",
  "Mumbai": "MUM",
  "Mumbai Suburban": "MUM-S",
  "Palghar": "PLG",
  "Ahmednagar": "AHM",
  "Jalna": "JLN",
  "Parbhani": "PRB",
  "Hingoli": "HIN",
  "Beed": "BED",
  "Osmanabad": "OSM"
};
```

### Zoom Levels
- Zoom < 6: No district labels (too cluttered)
- Zoom 6-7: Short forms only
- Zoom 7-8: Short forms for major districts, hidden for minor
- Zoom 8-9: Standard district names
- Zoom > 9: Full official names

---

## Radar Simulation Strategy

### Visualization
- The deterministic field now uses a regional 150–250 km footprint per cell, with multiple irregular intensity rings and a larger satellite envelope.
- The footprint is explicitly synthetic and does not assert real DWR coverage.
- Range selection remains a follow-up enhancement; the current implementation uses a bounded regional default to avoid the former Pune-sized blob.

---

## Implemented Corrections

### Backend Health & Connection
1. Added versioned health/readiness aliases.
2. Health/readiness/WebSocket state is surfaced in the header and diagnostics.
3. Backend loss freezes the last authoritative state; retry re-enters backend mode.

### Operational UX
1. Account panel and technical documentation routes are wired.
2. Replay controls are scoped to Scenario Lab instead of being persistent on every analysis route.

### Replay Speed
1. Replay uses a single store clock with `1000 / speed` cadence and `5 * speed` simulated-minute steps.
2. The Scenario Lab exposes 0.5×, 1×, 2×, and 4× options.

### Map Readability (P1)
1. Create district short form dictionary
2. Implement zoom-dependent label switching
3. Add label collision control
4. Test at different zoom levels

### Radar & Simulation (P1)
1. Improved the regional radar footprint and kept simulation controls in Scenario Lab.
4. Remove from Command Center

### Phase 6: Testing & Validation (P2)
1. Run backend failure test
2. Run backend kill test
3. Run speed test
4. Run state-wide detection test
5. Run interaction audit
6. Run authenticity audit

---

## Conclusion

The NOVEXA NOWCAST system has a solid foundation with:
- ✅ Functional backend with proper API contract
- ✅ Frontend with provider architecture
- ✅ Maharashtra-wide analysis domain
- ✅ Multi-cell detection support
- ✅ WebSocket real-time updates

Critical fixes needed:
- ❌ Connection status not truthfully displayed
- ❌ Speed controls don't work
- ❌ Account button dead
- ❌ Simulation controls in wrong place
- ❌ District labels cluttered
- ❌ Radar coverage too small

All issues are fixable without major architecture changes. The system can be made authentic and operational with focused effort on the identified priorities.
