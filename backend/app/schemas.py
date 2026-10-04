from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Mode(str, Enum):
    REPLAY = "REPLAY"
    SIMULATION = "SIMULATION"
    BACKEND = "BACKEND"


class SourceName(str, Enum):
    RADAR = "DWR RADAR"
    SATELLITE = "INSAT-3DR"
    LIGHTNING = "LIGHTNING"


class HazardType(str, Enum):
    LIGHTNING = "Lightning"
    HAIL = "Hail"
    DOWNBURST = "Downburst"
    CLOUDBURST = "Cloudburst"


class ConvectiveState(str, Enum):
    NORMAL = "NORMAL"
    WATCH = "WATCH"
    INITIATING = "INITIATING"
    ACTIVE = "ACTIVE"
    SEVERE = "SEVERE"
    DISSIPATING = "DISSIPATING"


class AlertStatus(str, Enum):
    GENERATED = "GENERATED"
    ACTIVE = "ACTIVE"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    ESCALATED = "ESCALATED"
    RESOLVED = "RESOLVED"
    EXPIRED = "EXPIRED"


class DataQuality(BaseModel):
    coverage: float = Field(ge=0, le=100)
    completeness: float = Field(ge=0, le=100)
    freshness: float = Field(ge=0, le=100)
    alignment: float = Field(ge=0, le=100)
    score: float = Field(ge=0, le=100)
    state: str


class Metric(BaseModel):
    label: str
    value: float
    unit: str


class SourceState(BaseModel):
    name: SourceName
    frameId: str
    timestamp: datetime
    quality: DataQuality
    signal: float = Field(ge=0, le=100)
    contribution: float = Field(ge=0, le=100)
    latency: float = Field(ge=0)
    metrics: list[Metric] = Field(min_length=3, max_length=32)


class FeatureEvidence(BaseModel):
    source: SourceName
    feature: str
    value: float
    unit: str
    frameId: str
    quality: float = Field(ge=0, le=100)
    derivation: str


class TrajectoryPoint(BaseModel):
    longitude: float = Field(ge=-180, le=180)
    latitude: float = Field(ge=-90, le=90)
    leadMinutes: float = Field(ge=0, le=360)
    uncertaintyKm: float = Field(ge=0)


class TrackPoint(BaseModel):
    longitude: float = Field(ge=-180, le=180)
    latitude: float = Field(ge=-90, le=90)
    minute: float = Field(ge=0)


class StormCell(BaseModel):
    id: str
    longitude: float = Field(ge=-180, le=180)
    latitude: float = Field(ge=-90, le=90)
    intensity: float
    area: float = Field(ge=0)
    growth: float
    speed: float = Field(ge=0)
    direction: float = Field(ge=0, le=360)
    confidence: float = Field(ge=0, le=100)
    state: ConvectiveState
    distance: float = Field(ge=0)
    eta: float | None = Field(default=None, ge=0)
    trajectory: list[TrajectoryPoint] = Field(min_length=1, max_length=128)
    observedTrack: list[TrackPoint] | None = Field(default=None, max_length=128)
    hazards: list[HazardType] = Field(default_factory=list)
    hazardRisks: dict[HazardType, float] = Field(default_factory=dict)


class HazardForecast(BaseModel):
    minute: float = Field(ge=0, le=360)
    risk: float = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=100)


class HazardState(BaseModel):
    type: HazardType
    risk: float = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=100)
    severity: str
    evidence: list[FeatureEvidence] = Field(max_length=32)
    forecast: list[HazardForecast] = Field(min_length=1, max_length=128)


class FusionState(BaseModel):
    signal: float = Field(ge=0, le=100)
    agreement: float = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=100)
    quality: float = Field(ge=0, le=100)
    weights: list[float] = Field(min_length=3, max_length=3)


class AlertTrace(BaseModel):
    stage: str
    detail: str


class AlertAudit(BaseModel):
    time: datetime
    action: str


class AlertState(BaseModel):
    alertId: str
    scenarioId: str
    stormCellId: str
    hazardType: HazardType
    timestamp: datetime
    severity: str
    confidence: float = Field(ge=0, le=100)
    status: AlertStatus
    trace: list[AlertTrace] = Field(min_length=1, max_length=32)
    audit: list[AlertAudit] = Field(max_length=200)


class ProcessingStage(BaseModel):
    name: str
    status: str
    records: int = Field(ge=0)


class PerformanceState(BaseModel):
    computationMs: float = Field(ge=0)
    frames: int = Field(ge=0)
    stages: list[ProcessingStage] = Field(max_length=32)


class ForecastRevision(BaseModel):
    previousEta: float | None = Field(default=None, ge=0)
    eta: float | None = Field(default=None, ge=0)
    previousRisk: float = Field(ge=0, le=100)
    risk: float = Field(ge=0, le=100)
    previousConfidence: float = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=100)
    reason: str


class NowcastState(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schemaVersion: str = "1.0"
    sequence: int = Field(ge=0)
    timestamp: datetime
    observationTime: datetime
    processingTime: datetime
    mode: Mode
    scenarioId: str
    scenarioVersion: str
    engineVersion: str
    minute: float = Field(ge=0)
    lead: float = Field(ge=0, le=360)
    sources: list[SourceState] = Field(min_length=3, max_length=3)
    storm: StormCell
    fusion: FusionState
    hazards: list[HazardState] = Field(min_length=4, max_length=4)
    alerts: list[AlertState] = Field(max_length=200)
    evidence: list[FeatureEvidence] = Field(max_length=100)
    performance: PerformanceState
    revision: ForecastRevision | None = None
    truth: bool
    stormCells: list[StormCell] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_snapshot(self) -> "NowcastState":
        if [source.name for source in self.sources] != list(SourceName):
            raise ValueError("sources must be ordered DWR RADAR, INSAT-3DR, LIGHTNING")
        if [hazard.type for hazard in self.hazards] != list(HazardType):
            raise ValueError("hazards must be ordered Lightning, Hail, Downburst, Cloudburst")
        if not self.observationTime <= self.processingTime <= self.timestamp:
            raise ValueError("observationTime <= processingTime <= timestamp required")
        total = sum(self.fusion.weights)
        if total and abs(total - 1) > 0.01:
            raise ValueError("fusion weights must sum to one")
        cell_ids = {self.storm.id, *(cell.id for cell in self.stormCells)}
        if any(alert.scenarioId != self.scenarioId or alert.stormCellId not in cell_ids for alert in self.alerts):
            raise ValueError("alert origin must match snapshot scenario and storm")
        return self


class ScenarioParameters(BaseModel):
    intensity: float = Field(ge=0, le=100)
    lightning: float = Field(ge=0, le=100)
    velocity: float = Field(ge=0, le=100)
    cooling: float = Field(ge=0, le=100)
    noise: float = Field(ge=0, le=100)
    radarQuality: float = Field(ge=0, le=100)
    satelliteQuality: float = Field(ge=0, le=100)
    lightningQuality: float = Field(ge=0, le=100)
    confidenceThreshold: float = Field(ge=0, le=100)
    warningThreshold: float = Field(ge=0, le=100)
    direction: float = Field(ge=0, le=360)


class Scenario(BaseModel):
    id: str
    name: str
    description: str
    duration: int = Field(ge=0, le=360)
    seed: int
    truth: bool
    parameters: dict[str, float]


class ScenarioRunRequest(BaseModel):
    minute: float = Field(default=0, ge=0, le=360)
    lead: float = Field(default=60, ge=0, le=360)
    parameters: ScenarioParameters | None = None


class ReplayRequest(BaseModel):
    minute: float = Field(ge=0, le=360)


class MapBounds(BaseModel):
    north: float = Field(ge=-90, le=90)
    south: float = Field(ge=-90, le=90)
    east: float = Field(ge=-180, le=180)
    west: float = Field(ge=-180, le=180)


class MapStormCell(BaseModel):
    id: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    intensity: float
    severity: str
    velocity: float = Field(ge=0)
    direction: float = Field(ge=0, le=360)
    confidence: float = Field(ge=0, le=100)
    state: ConvectiveState
    area: float = Field(ge=0)
    growthRate: float
    timestamp: datetime
    hazards: list[HazardType]


class MapHazard(BaseModel):
    type: HazardType
    risk: float = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=100)
    severity: str
    eta: float | None = Field(default=None, ge=0)


class MapAlert(BaseModel):
    alertId: str
    severity: str
    hazardType: HazardType
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    eta: float | None = Field(default=None, ge=0)
    confidence: float = Field(ge=0, le=100)
    timestamp: datetime
    status: AlertStatus


class MapTrack(BaseModel):
    stormId: str
    points: list[TrajectoryPoint] = Field(min_length=1, max_length=128)


class MapRiskZone(BaseModel):
    type: HazardType
    risk: float = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=100)
    centerLatitude: float = Field(ge=-90, le=90)
    centerLongitude: float = Field(ge=-180, le=180)
    radiusKm: float = Field(ge=0)


class MapDistrictRisk(BaseModel):
    districtId: str
    districtName: str
    region: str
    activeCells: list[str]
    highestHazard: HazardType | None = None
    risk: float = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=100)
    eta: float | None = Field(default=None, ge=0)
    activeAlerts: int = Field(ge=0)


class MapRegionalRisk(BaseModel):
    region: str
    activeCells: int = Field(ge=0)
    risk: float = Field(ge=0, le=100)
    activeAlerts: int = Field(ge=0)


class MapState(BaseModel):
    timestamp: datetime
    region: str
    scope: str = "STATE"
    resolutionKm: float = Field(default=3, ge=1, le=3)
    bounds: MapBounds
    domain: dict[str, Any] = Field(default_factory=dict)
    grid: dict[str, Any] = Field(default_factory=dict)
    stormCells: list[MapStormCell]
    hazards: list[MapHazard]
    alerts: list[MapAlert]
    forecastTracks: list[MapTrack]
    riskZones: list[MapRiskZone]
    districtRisks: list[MapDistrictRisk] = Field(default_factory=list)
    regionalRisks: list[MapRegionalRisk] = Field(default_factory=list)
    sources: list[SourceState]


class HealthResponse(BaseModel):
    status: str
    backendVersion: str
    engineVersion: str
    mode: str


class ReadyResponse(BaseModel):
    status: str
    checks: dict[str, bool]


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = {}
    timestamp: datetime
    request_id: str