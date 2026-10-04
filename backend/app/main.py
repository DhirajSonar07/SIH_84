from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .domain import DOMAIN
from .engine import ENGINE_VERSION, SCENARIOS, NowcastEngine, scenario_parameters
from .schemas import (
    HealthResponse,
    MapAlert,
    MapBounds,
    MapDistrictRisk,
    MapHazard,
    MapRegionalRisk,
    MapRiskZone,
    MapState,
    MapStormCell,
    MapTrack,
    NowcastState,
    ReadyResponse,
    ReplayRequest,
    Scenario,
    ScenarioParameters,
    ScenarioRunRequest,
)


BACKEND_VERSION = "NOVEXA-BACKEND-1.0"
engine = NowcastEngine()
replay_running = False


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def origins() -> list[str]:
    configured = os.getenv("CORS_ORIGINS", "http://localhost:8443")
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(_: FastAPI):
    engine.current()
    yield


app = FastAPI(title="NOVEXA NOWCAST Backend", version=BACKEND_VERSION, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=origins(), allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


def not_found(code: str, message: str) -> HTTPException:
    return HTTPException(status_code=404, detail={"code": code, "message": message, "timestamp": utc_now().isoformat(), "request_id": str(uuid4())})


@app.get("/api/health", response_model=HealthResponse)
@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", backendVersion=BACKEND_VERSION, engineVersion=ENGINE_VERSION, mode="SYNTHETIC_REPLAY")


@app.get("/api/ready", response_model=ReadyResponse)
@app.get("/api/v1/ready", response_model=ReadyResponse)
def ready() -> ReadyResponse:
    checks = {"engine_initialized": True, "scenario_engine_ready": bool(SCENARIOS), "configuration_loaded": True, "models_ready": True, "data_providers_ready": True}
    return ReadyResponse(status="ready" if all(checks.values()) else "not_ready", checks=checks)


@app.get("/api/nowcast/current", response_model=NowcastState)
def current_nowcast() -> NowcastState:
    return engine.current()


@app.get("/api/nowcast/{timestamp}", response_model=NowcastState)
def historical_nowcast(timestamp: str) -> NowcastState:
    try:
        minute = float(timestamp) if timestamp.replace(".", "", 1).isdigit() else _minute_from_timestamp(timestamp)
    except ValueError as error:
        raise HTTPException(status_code=400, detail="timestamp must be replay minute or ISO timestamp") from error
    return engine.seek(minute)


@app.get("/api/map/state", response_model=MapState)
@app.get("/api/v1/map/state", response_model=MapState)
def map_state() -> MapState:
    snapshot = engine.current()
    cells = snapshot.stormCells or [snapshot.storm]
    cell_by_id = {cell.id: cell for cell in cells}
    district_values: dict[str, dict[str, Any]] = {}
    for cell in cells:
        strongest_hazard = max(cell.hazardRisks, key=cell.hazardRisks.get, default=None)
        strongest_risk = max(cell.hazardRisks.values(), default=0)
        for district in DOMAIN.districts_for_footprint(cell.longitude, cell.latitude, cell.area ** 0.5):
            current = district_values.setdefault(district["id"], {"districtId": district["id"], "districtName": district["name"], "region": DOMAIN.region_for_district(district["name"]), "activeCells": [], "highestHazard": strongest_hazard, "risk": 0, "confidence": cell.confidence, "eta": cell.eta, "activeAlerts": 0})
            current["activeCells"].append(cell.id)
            if strongest_risk >= current["risk"]:
                current.update({"highestHazard": strongest_hazard, "risk": strongest_risk, "confidence": cell.confidence, "eta": cell.eta})
    for alert in snapshot.alerts:
        for district in DOMAIN.districts_for_footprint(cell_by_id.get(alert.stormCellId, snapshot.storm).longitude, cell_by_id.get(alert.stormCellId, snapshot.storm).latitude, cell_by_id.get(alert.stormCellId, snapshot.storm).area ** 0.5):
            if district["id"] in district_values:
                district_values[district["id"]]["activeAlerts"] += 1
    district_risks = [MapDistrictRisk(**value) for value in district_values.values()]
    regional_values: dict[str, dict[str, Any]] = {}
    for district in district_risks:
        current = regional_values.setdefault(district.region, {"region": district.region, "activeCells": 0, "risk": 0, "activeAlerts": 0})
        current["activeCells"] += len(district.activeCells)
        current["risk"] = max(current["risk"], district.risk)
        current["activeAlerts"] += district.activeAlerts
    hazards = [MapHazard(type=item.type, risk=item.risk, confidence=item.confidence, severity=item.severity, eta=snapshot.storm.eta) for item in snapshot.hazards]
    return MapState(
        timestamp=snapshot.timestamp,
        region="Maharashtra",
        scope="STATE",
        resolutionKm=DOMAIN.resolution_km,
        bounds=MapBounds(**DOMAIN.bounds),
        domain=DOMAIN.domain_response(),
        grid=DOMAIN.grid_metadata(),
        stormCells=[MapStormCell(id=cell.id, latitude=cell.latitude, longitude=cell.longitude, intensity=cell.intensity, severity=cell.state.value, velocity=cell.speed, direction=cell.direction, confidence=cell.confidence, state=cell.state, area=cell.area, growthRate=cell.growth, timestamp=snapshot.timestamp, hazards=cell.hazards) for cell in cells],
        hazards=hazards,
        alerts=[MapAlert(alertId=item.alertId, severity=item.severity, hazardType=item.hazardType, latitude=cell_by_id.get(item.stormCellId, snapshot.storm).latitude, longitude=cell_by_id.get(item.stormCellId, snapshot.storm).longitude, eta=cell_by_id.get(item.stormCellId, snapshot.storm).eta, confidence=item.confidence, timestamp=item.timestamp, status=item.status) for item in snapshot.alerts],
        forecastTracks=[MapTrack(stormId=cell.id, points=cell.trajectory) for cell in cells],
        riskZones=[MapRiskZone(type=item.type, risk=item.risk, confidence=item.confidence, centerLatitude=cell.latitude, centerLongitude=cell.longitude, radiusKm=max(1, cell.area ** 0.5)) for cell in cells for item in snapshot.hazards if item.risk >= 25],
        districtRisks=district_risks,
        regionalRisks=[MapRegionalRisk(**value) for value in regional_values.values()],
        sources=snapshot.sources,
    )


@app.get("/api/v1/analysis/domain")
def analysis_domain() -> dict[str, Any]:
    return {"scope": "STATE", "resolution": DOMAIN.resolution_name, **DOMAIN.domain_response(), "grid": DOMAIN.grid_metadata()}


@app.get("/api/storms")
def storms() -> list[dict[str, Any]]:
    snapshot = engine.current()
    return [cell.model_dump(mode="json") for cell in (snapshot.stormCells or [snapshot.storm])]


@app.get("/api/storms/{storm_id}")
def storm(storm_id: str) -> dict[str, Any]:
    snapshot = engine.current()
    if snapshot.storm.id != storm_id:
        raise not_found("STORM_NOT_FOUND", f"Unknown storm cell: {storm_id}")
    return snapshot.storm.model_dump(mode="json")


@app.get("/api/hazards")
def hazards() -> list[dict[str, Any]]:
    return [hazard.model_dump(mode="json") for hazard in engine.current().hazards]


@app.get("/api/hazards/{hazard_type}")
def hazard(hazard_type: str) -> dict[str, Any]:
    snapshot = engine.current()
    for item in snapshot.hazards:
        if item.type.value.lower() == hazard_type.lower():
            return item.model_dump(mode="json")
    raise not_found("HAZARD_NOT_FOUND", f"Unknown hazard: {hazard_type}")


@app.get("/api/sources/status")
def source_status() -> list[dict[str, Any]]:
    return [source.model_dump(mode="json") for source in engine.current().sources]


@app.get("/api/alerts")
def alerts(status: str | None = Query(default=None), severity: str | None = Query(default=None)) -> list[dict[str, Any]]:
    result = engine.current().alerts
    if status:
        result = [alert for alert in result if alert.status.value == status.upper()]
    if severity:
        result = [alert for alert in result if alert.severity == severity.upper()]
    return [alert.model_dump(mode="json") for alert in result]


@app.get("/api/alerts/{alert_id}")
def alert(alert_id: str) -> dict[str, Any]:
    for item in engine.current().alerts:
        if item.alertId == alert_id:
            return item.model_dump(mode="json")
    raise not_found("ALERT_NOT_FOUND", f"Unknown alert: {alert_id}")


@app.get("/api/scenarios", response_model=list[Scenario])
def scenarios() -> list[Scenario]:
    return list(SCENARIOS.values())


@app.get("/api/scenarios/{scenario_id}", response_model=Scenario)
def scenario(scenario_id: str) -> Scenario:
    if scenario_id not in SCENARIOS:
        raise not_found("SCENARIO_NOT_FOUND", scenario_id)
    return SCENARIOS[scenario_id]


@app.post("/api/scenarios/{scenario_id}/run", response_model=NowcastState)
def run_scenario(scenario_id: str, request: ScenarioRunRequest | None = None) -> NowcastState:
    if scenario_id not in SCENARIOS:
        raise not_found("SCENARIO_NOT_FOUND", scenario_id)
    engine.select_scenario(scenario_id)
    if request and request.parameters:
        engine.parameters = engine.normalize_parameters(request.parameters)
    if request:
        engine.lead = request.lead
        engine.minute = request.minute
    return engine.compute(mode=engine_mode())


@app.post("/api/replay/start", response_model=NowcastState)
def start_replay() -> NowcastState:
    global replay_running
    replay_running = True
    return engine.compute(mode=engine_mode())


@app.post("/api/replay/pause", response_model=NowcastState)
def pause_replay() -> NowcastState:
    global replay_running
    replay_running = False
    return engine.compute(mode=engine_mode())


@app.post("/api/replay/reset", response_model=NowcastState)
def reset_replay() -> NowcastState:
    global replay_running
    replay_running = False
    return engine.reset()


@app.post("/api/replay/seek", response_model=NowcastState)
def seek_replay(request: ReplayRequest) -> NowcastState:
    return engine.seek(request.minute)


@app.post("/api/replay/parameters", response_model=NowcastState)
def update_replay_parameters(parameters: ScenarioParameters) -> NowcastState:
    return engine.update_parameters(parameters)


@app.get("/api/performance")
def performance() -> dict[str, Any]:
    snapshot = engine.current()
    return snapshot.performance.model_dump(mode="json")


@app.get("/api/pipeline/status")
def pipeline_status() -> list[dict[str, Any]]:
    snapshot = engine.current()
    return [stage.model_dump(mode="json") for stage in snapshot.performance.stages]


@app.get("/api/technical/trace/{alert_id}")
def technical_trace(alert_id: str) -> list[dict[str, str]]:
    for alert in engine.current().alerts:
        if alert.alertId == alert_id:
            return [trace.model_dump() for trace in alert.trace]
    raise not_found("ALERT_NOT_FOUND", f"Unknown alert: {alert_id}")


@app.websocket("/api/ws/nowcast")
async def nowcast_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(engine.current().model_dump(mode="json"))
            if replay_running:
                engine.minute = min(engine.minute + 5, 360)
            await asyncio.sleep(1)
    except (WebSocketDisconnect, RuntimeError):
        return


def engine_mode():
    from .schemas import Mode

    return Mode.BACKEND


def _minute_from_timestamp(value: str) -> float:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return max(0, (parsed - datetime(2026, 10, 4, 12, 0, tzinfo=timezone.utc)).total_seconds() / 60)