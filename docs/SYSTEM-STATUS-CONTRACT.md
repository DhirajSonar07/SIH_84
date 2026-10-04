# NOVEXA NOWCAST — System Status & Observability Contract

**Document Version**: 1.0.0  
**Scope**: Status semantics, health check protocol, failure modes, recovery transitions, and UI indicators.

---

## 1. System Health Status Model

The frontend health monitoring service (`HealthCheckService` in `src/lib/health.ts`) conducts periodic background health audits (default: every 5 seconds) to determine system integrity.

### Status Dimensions

```
                    ┌─────────────────────────┐
                    │      Health Status      │
                    └───────────┬─────────────┘
                                │
       ┌────────────────────────┼────────────────────────┐
       │                        │                        │
       ▼                        ▼                        ▼
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  REST API    │         │  Subsystems  │         │  WebSocket   │
│  Liveness    │         │  Readiness   │         │  Connection  │
└──────────────┘         └──────────────┘         └──────────────┘
       │                        │                        │
       └────────────────────────┼────────────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │     Overall Status      │
                    │ CONNECTED|DEGRADED|...  │
                    └─────────────────────────┘
```

| Dimension | Type | Values | Description |
| :--- | :--- | :--- | :--- |
| `overall` | Enum | `CONNECTED`, `DEGRADED`, `OFFLINE`, `CONNECTING` | Authoritative operational health indicator |
| `api` | Enum | `REACHABLE`, `UNREACHABLE`, `NOT_CHECKED` | Direct HTTP availability of backend root `/api` |
| `health` | Enum | `OK`, `FAILED`, `NOT_CHECKED` | Return status from `/api/health` |
| `readiness` | Enum | `READY`, `NOT_READY`, `NOT_CHECKED` | Return status from `/api/ready` |
| `websocket` | Enum | `CONNECTED`, `DISCONNECTED`, `NOT_CHECKED` | Realtime bidirectional WebSocket socket state |
| `engine` | Enum | `AVAILABLE`, `UNAVAILABLE`, `NOT_CHECKED` | Convective nowcasting engine operational status |
| `lastUpdate`| ISO8601 | `string \| null` | Timestamp of latest validated state ingest |
| `reason` | String | String explanation | Human/machine-readable diagnostic reason code |

---

## 2. Overall Status Evaluation Rules

The overall status is computed deterministically using the following truth table:

| Condition | Overall Status | Header Badge | Reason Code / Message |
| :--- | :--- | :--- | :--- |
| `api == UNREACHABLE` or `health == FAILED` | **`OFFLINE`** | 🔴 `CORE OFFLINE` | `BACKEND_UNREACHABLE`: Backend server is not responding |
| `readiness == NOT_READY` | **`DEGRADED`** | 🟡 `SYSTEM DEGRADED` | `SUBSYSTEM_NOT_READY`: Subsystems initializing or partial check failed |
| `websocket == DISCONNECTED` (REST OK) | **`DEGRADED`** | 🟡 `SYSTEM DEGRADED` | `REALTIME_DISCONNECTED`: Realtime feed disconnected; polling active |
| `sources.some(s => s.quality < 0.5)` | **`DEGRADED`** | 🟡 `SYSTEM DEGRADED` | `DATA_DEGRADED`: One or more observation feeds degraded |
| `api == REACHABLE` && `ready` && `ws == CONNECTED` | **`CONNECTED`** | 🟢 `CORE CONNECTED` | `NOMINAL`: All operational systems nominal |
| Pending initial probe | **`CONNECTING`** | 🔵 `CONNECTING...` | `INITIALIZING`: In-flight verification |

---

## 3. Top-Right Header Truthfulness Rule

The top-right status indicator in `ConnectionStatus.tsx` must **never falsely display green**:

1. **LIVE / BACKEND Mode**:
   - 🟢 **CORE CONNECTED** (`#34d399`): Backend is actively reachable, all readiness checks pass, and WebSocket or high-frequency polling is active.
   - 🟡 **SYSTEM DEGRADED** (`#fbbf24`): REST is answering, but either WebSocket is disconnected, engine checks are partially failing, or sensor inputs are degraded.
   - 🔴 **CORE OFFLINE** (`#f87171`): Backend server process is stopped, crashed, or port 8000 unreachable.
   - 🔵 **CONNECTING** (`#38bdf8`): Probing backend.
2. **LOCAL REPLAY / SIMULATION Mode**:
   - 🟡 **SIMULATION** (`#fbbf24`): Controlled scenario lab simulation in progress; clearly marked as synthetic.
   - 🔵 **LOCAL REPLAY** (`#38bdf8`): Pre-computed offline replay loaded for demonstration without backend dependency.

---

## 4. Failure States & Graceful Degradation

### 4.1 Server Down (`OFFLINE`)
- **Trigger**: 3 consecutive failed HTTP requests to `/api/health` or timeout > 3000ms.
- **System Behavior**:
  1. Frontend flags `overall = OFFLINE`.
  2. The `ServerDownPopup` dialog renders non-intrusively with diagnostic summary.
  3. Seamlessly retains the last-known valid frame (`staleState`).
  4. Automatic background retry initiates every 5 seconds.
  5. User can manually click "Retry" or switch to "LOCAL REPLAY" to continue inspecting the interface.

### 4.2 Partial Sensor Failure (`DATA_DEGRADED`)
- **Trigger**: DWR, INSAT, or Lightning quality factor drops below threshold (e.g., radar maintenance or attenuation).
- **System Behavior**:
  1. Fusion module lowers weight for the degraded source.
  2. Overall confidence score recalculates downwards.
  3. Source tile displays amber warning `DEGRADED (42%)`.
  4. Status displays `🟡 SYSTEM DEGRADED`.

### 4.3 WebSocket Failure (`REALTIME_DISCONNECTED`)
- **Trigger**: WebSocket handshake failure or connection dropped.
- **System Behavior**:
  1. REST polling takes over at 3-second intervals to maintain data freshness.
  2. Status displays `🟡 SYSTEM DEGRADED` (`REALTIME DISCONNECTED`).
  3. Does **not** falsely claim the entire server is offline when REST is working.

---

## 5. Recovery Transitions

When an offline or degraded component recovers:

1. `/api/health` succeeds with HTTP 200.
2. `/api/ready` confirms all subsystem checks pass.
3. System status changes from `OFFLINE` $\rightarrow$ `CONNECTED`.
4. Header updates to 🟢 **CORE RESTORED** then settles to 🟢 **CORE CONNECTED**.
5. Server down modal automatically closes.
6. The event is recorded in the operational audit log with ISO timestamp.
