from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from time import perf_counter

from shapely.geometry import Point

from .domain import DOMAIN
from .schemas import (
    AlertAudit,
    AlertState,
    AlertStatus,
    AlertTrace,
    ConvectiveState,
    DataQuality,
    FeatureEvidence,
    ForecastRevision,
    FusionState,
    HazardForecast,
    HazardState,
    HazardType,
    Metric,
    Mode,
    NowcastState,
    PerformanceState,
    ProcessingStage,
    Scenario,
    ScenarioParameters,
    SourceName,
    SourceState,
    StormCell,
    TrackPoint,
    TrajectoryPoint,
)


ENGINE_VERSION = "NOWCAST-ENGINE-1.0"
SCENARIO_VERSION = "SCENARIO-1.0"
BASE_TIME = datetime(2026, 10, 4, 12, 0, tzinfo=timezone.utc)
ORIGIN = (73.70, 18.48)
TARGET = (73.86, 18.52)

STATE_CELL_SPAWNS = {
    "SC-001": [
        ("WESTERN_MAHARASHTRA", (73.70, 18.48), 78, 48, 0),
        ("MARATHWADA", (75.45, 19.15), 48, 42, 8),
        ("VIDARBHA", (79.05, 20.85), 35, 38, 18),
        ("NORTH_MAHARASHTRA", (73.95, 20.05), 62, 44, 28),
    ],
    "SC-002": [("WESTERN_MAHARASHTRA", (74.15, 17.25), 55, 46, 0), ("MARATHWADA", (76.80, 19.30), 62, 40, 18), ("VIDARBHA", (78.95, 21.25), 42, 36, 38)],
    "SC-003": [("VIDARBHA", (79.10, 21.15), 70, 42, 0), ("MARATHWADA", (77.30, 18.95), 48, 38, 22)],
    "SC-004": [("WESTERN_MAHARASHTRA", (74.05, 18.25), 58, 44, 0), ("NORTH_MAHARASHTRA", (74.65, 20.55), 44, 40, 24)],
    "SC-005": [("KONKAN", (73.05, 17.15), 38, 28, 0), ("WESTERN_MAHARASHTRA", (74.10, 18.55), 46, 30, 14)],
    "SC-006": [("WESTERN_MAHARASHTRA", (73.70, 18.48), 70, 42, 0), ("VIDARBHA", (79.00, 20.80), 54, 36, 12)],
    "SC-007": [("WESTERN_MAHARASHTRA", (73.70, 18.48), 78, 42, 0)],
    "SC-008": [("WESTERN_MAHARASHTRA", (73.70, 18.48), 52, 42, 0), ("MARATHWADA", (76.25, 18.95), 46, 38, 18), ("VIDARBHA", (79.05, 21.00), 38, 35, 30)],
}


def clamp(value: float, lower: float = 0, upper: float = 100) -> float:
    return max(lower, min(upper, value))


def round_value(value: float, digits: int = 2) -> float:
    return round(value, digits)


DEFAULT_PARAMETERS = ScenarioParameters(
    intensity=58,
    lightning=48,
    velocity=42,
    cooling=55,
    noise=8,
    radarQuality=96,
    satelliteQuality=93,
    lightningQuality=90,
    confidenceThreshold=55,
    warningThreshold=65,
    direction=78,
)


SCENARIOS: dict[str, Scenario] = {
    "SC-001": Scenario(id="SC-001", name="Severe Thunderstorm Approach", description="Coherent strengthening cell approaching the Pune risk zone.", duration=240, seed=26084, truth=True, parameters={"intensity": 62, "lightning": 58, "velocity": 48, "cooling": 66}),
    "SC-002": Scenario(id="SC-002", name="Rapid Convective Initiation", description="A growing cell transitions rapidly from watch to active convection.", duration=180, seed=26085, truth=True, parameters={"intensity": 46, "lightning": 42, "cooling": 78}),
    "SC-003": Scenario(id="SC-003", name="Lightning Burst", description="Lightning acceleration leads the radar intensity increase.", duration=150, seed=26086, truth=True, parameters={"intensity": 52, "lightning": 82, "cooling": 60}),
    "SC-004": Scenario(id="SC-004", name="Hail Event", description="A compact, intense cell with elevated hail proxy risk.", duration=180, seed=26087, truth=True, parameters={"intensity": 78, "lightning": 62, "cooling": 76}),
    "SC-005": Scenario(id="SC-005", name="Cloudburst Risk", description="Deepening convection with a precipitation accumulation proxy.", duration=210, seed=26088, truth=True, parameters={"intensity": 70, "lightning": 54, "cooling": 70}),
    "SC-006": Scenario(id="SC-006", name="Weakening Storm", description="A mature cell loses intensity and progressively dissipates.", duration=240, seed=26089, truth=True, parameters={"intensity": 74, "lightning": 58, "cooling": 42}),
    "SC-007": Scenario(id="SC-007", name="False Alarm", description="Potential convection with weak source agreement and declining confidence.", duration=120, seed=26090, truth=False, parameters={"intensity": 37, "lightning": 16, "cooling": 28, "noise": 22}),
    "SC-008": Scenario(id="SC-008", name="Degraded Sources", description="A valid signal continues while source quality degrades.", duration=180, seed=26091, truth=True, parameters={"intensity": 62, "lightning": 52, "radarQuality": 72, "satelliteQuality": 42, "lightningQuality": 58}),
}


def scenario_parameters(scenario_id: str) -> ScenarioParameters:
    scenario = SCENARIOS[scenario_id]
    values = DEFAULT_PARAMETERS.model_dump()
    values.update(scenario.parameters)
    return ScenarioParameters(**values)


class NowcastEngine:
    def __init__(self) -> None:
        self.scenario_id = "SC-001"
        self.minute = 0.0
        self.lead = 60.0
        self.parameters = scenario_parameters(self.scenario_id)
        self.sequence = 0
        self.previous: NowcastState | None = None

    def select_scenario(self, scenario_id: str) -> None:
        if scenario_id not in SCENARIOS:
            raise KeyError(scenario_id)
        self.scenario_id = scenario_id
        self.minute = 0
        self.parameters = scenario_parameters(scenario_id)
        self.previous = None

    def reset(self) -> NowcastState:
        self.minute = 0
        self.previous = None
        return self.compute()

    def seek(self, minute: float) -> NowcastState:
        self.minute = clamp(minute, 0, 360)
        return self.compute()

    def update_parameters(self, parameters: ScenarioParameters) -> NowcastState:
        self.parameters = self.normalize_parameters(parameters)
        return self.compute(mode=Mode.SIMULATION)

    def normalize_parameters(self, parameters: ScenarioParameters) -> ScenarioParameters:
        values = parameters.model_dump()
        baseline = scenario_parameters(self.scenario_id)
        for key in ("intensity", "lightning", "cooling"):
            if values[key] <= 5:
                values[key] = getattr(baseline, key) * values[key]
        return ScenarioParameters(**values)

    def current(self) -> NowcastState:
        return self.compute()

    def compute(self, mode: Mode = Mode.BACKEND) -> NowcastState:
        started = perf_counter()
        scenario = SCENARIOS[self.scenario_id]
        parameters = self.parameters
        cell_specs = self._cell_specs()
        _, primary_origin, primary_direction, _, _ = cell_specs[0]
        direction = (primary_direction + parameters.direction - 70) % 360
        now = BASE_TIME + timedelta(minutes=self.minute)
        processing_time = now - timedelta(milliseconds=8)

        signal_curve = self._signal_curve(self.minute)
        intensity = clamp(parameters.intensity * signal_curve + self._noise(self.minute, 2.0))
        lightning = clamp(parameters.lightning * (0.45 + 0.75 * signal_curve) + self._noise(self.minute, 3.0))
        cooling = clamp(parameters.cooling * (0.55 + 0.65 * signal_curve) + self._noise(self.minute, 1.5))
        velocity = clamp(20 + parameters.velocity * 0.65 + 5 * math.sin(self.minute / 45))

        qualities = [parameters.radarQuality, parameters.satelliteQuality, parameters.lightningQuality]
        source_signals = [intensity, cooling, lightning]
        source_names = list(SourceName)
        frame_time = now - timedelta(minutes=2)
        sources: list[SourceState] = []
        evidence: list[FeatureEvidence] = []
        for index, (name, quality, signal) in enumerate(zip(source_names, qualities, source_signals)):
            alignment = clamp(96 - abs(self.minute % 5) * 1.2)
            state = "GOOD" if quality >= 75 else "DEGRADED" if quality >= 35 else "FAILED"
            data_quality = DataQuality(coverage=quality, completeness=quality, freshness=clamp(100 - 2 * index), alignment=alignment, score=round_value(quality * 0.65 + alignment * 0.35), state=state)
            frame_id = f"{self.scenario_id}-{name.split()[0]}-{int(self.minute):04d}"
            metrics = self._source_metrics(name, intensity, lightning, cooling, velocity)
            sources.append(SourceState(name=name, frameId=frame_id, timestamp=frame_time, quality=data_quality, signal=round_value(signal), contribution=0, latency=round_value(80 + index * 25), metrics=metrics))
            feature_name, unit, derivation = self._feature_metadata(name)
            evidence.append(FeatureEvidence(source=name, feature=feature_name, value=round_value(signal), unit=unit, frameId=frame_id, quality=quality, derivation=derivation))

        weights = self._weights(qualities)
        fused_signal = sum(signal * weight for signal, weight in zip(source_signals, weights))
        mean_signal = sum(source_signals) / len(source_signals)
        disagreement = sum(abs(signal - mean_signal) for signal in source_signals) / 2.0
        agreement = clamp(100 - disagreement)
        quality = sum(quality * weight for quality, weight in zip(qualities, weights))
        confidence = clamp(agreement * 0.42 + quality * 0.38 + (100 - parameters.noise) * 0.20)
        if self.scenario_id == "SC-007":
            confidence = clamp(confidence - 24 - self.minute * 0.08)
        if self.scenario_id == "SC-008":
            confidence = clamp(confidence - 10)
        for source, weight in zip(sources, weights):
            source.contribution = round_value(weight * source.signal)
        fusion = FusionState(signal=round_value(fused_signal), agreement=round_value(agreement), confidence=round_value(confidence), quality=round_value(quality), weights=[round_value(weight, 4) for weight in weights])

        state = self._convective_state(fused_signal, confidence, signal_curve)
        longitude, latitude = self._position_from(primary_origin, self.minute, velocity, direction)
        distance = self._distance_km((longitude, latitude), TARGET)
        eta = round_value(distance / max(velocity, 1) * 60) if distance > 1 else 0
        track = [TrackPoint(longitude=self._position_from(primary_origin, max(self.minute - lead, 0), velocity, direction)[0], latitude=self._position_from(primary_origin, max(self.minute - lead, 0), velocity, direction)[1], minute=lead) for lead in [0, 5, 10, 15, 20] if self.minute - lead >= 0]
        trajectory = [self._trajectory_point(longitude, latitude, velocity, direction, lead, confidence) for lead in range(0, 361, 15)]
        hazards = self._hazards(storm := StormCell(id="CELL-001", longitude=round_value(longitude, 5), latitude=round_value(latitude, 5), intensity=round_value(intensity), area=round_value(18 + intensity * 0.55), growth=round_value((signal_curve - 0.5) * 20), speed=round_value(velocity), direction=round_value(direction), confidence=round_value(confidence), state=state, distance=round_value(distance), eta=eta, trajectory=trajectory, observedTrack=track), intensity, lightning, cooling, velocity, confidence, evidence)
        storm.hazards = [hazard.type for hazard in hazards if hazard.risk >= 25]
        storm.hazardRisks = {hazard.type: hazard.risk for hazard in hazards}
        storm_cells = [storm]
        hazard_sets = [hazards]
        for index, (region, origin, direction, cell_velocity, active_from) in enumerate(cell_specs[1:], start=2):
            if self.minute < active_from:
                continue
            cell, cell_hazards = self._build_secondary_cell(index, region, origin, direction, cell_velocity, active_from, now, parameters, evidence)
            if cell is not None:
                storm_cells.append(cell)
                hazard_sets.append(cell_hazards)
        hazards = self._aggregate_hazards(hazard_sets)
        alerts = [alert for cell, cell_hazard_set in zip(storm_cells, hazard_sets) for alert in self._alerts(cell_hazard_set, cell, cell.confidence, now, parameters)]
        revision = self._revision(storm, hazards)
        elapsed = (perf_counter() - started) * 1000
        stages = [ProcessingStage(name=name, status="COMPLETE", records=len(storm_cells) if name in {"DETECTION", "TRACKING", "HAZARDS", "NOWCAST", "ALERTS"} else 3) for name in ["INGESTION", "QUALITY", "FEATURES", "FUSION", "DETECTION", "TRACKING", "HAZARDS", "NOWCAST", "ALERTS"]]
        performance = PerformanceState(computationMs=round_value(elapsed, 3), frames=3, stages=stages)
        snapshot = NowcastState(sequence=self.sequence, timestamp=now, observationTime=frame_time, processingTime=processing_time, mode=mode, scenarioId=self.scenario_id, scenarioVersion=SCENARIO_VERSION, engineVersion=ENGINE_VERSION, minute=self.minute, lead=self.lead, sources=sources, storm=storm, stormCells=storm_cells, fusion=fusion, hazards=hazards, alerts=alerts, evidence=evidence, performance=performance, revision=revision, truth=scenario.truth)
        self.previous = snapshot
        self.sequence += 1
        return snapshot

    def _cell_specs(self):
        return STATE_CELL_SPAWNS.get(self.scenario_id, STATE_CELL_SPAWNS["SC-001"])

    def _build_secondary_cell(self, index: int, region: str, origin: tuple[float, float], direction: float, base_velocity: float, active_from: int, timestamp: datetime, parameters: ScenarioParameters, evidence: list[FeatureEvidence]) -> tuple[StormCell | None, list[HazardState]]:
        if not DOMAIN.analysis_geometry.covers(Point(origin[0], origin[1])):
            return None, []
        age = max(0, self.minute - active_from)
        curve = clamp(0.30 + age / 150, 0.18, 1.0)
        if self.scenario_id == "SC-006":
            curve = clamp(1.0 - age / 190, 0.18, 1.0)
        if self.scenario_id == "SC-007":
            curve = clamp(0.42 - age / 300, 0.18, 0.5)
        phase = index * 13.7 + SCENARIOS[self.scenario_id].seed
        intensity = clamp(parameters.intensity * curve * (0.72 + index * 0.035) + math.sin(phase + self.minute / 18) * 2)
        lightning = clamp(parameters.lightning * (0.35 + curve * 0.8) * (0.72 + index * 0.04) + math.sin(phase / 2 + self.minute / 21) * 2)
        cooling = clamp(parameters.cooling * (0.45 + curve * 0.75) * (0.75 + index * 0.025) + math.cos(phase + self.minute / 19) * 1.5)
        velocity = clamp(18 + base_velocity * 0.65 + 4 * math.sin(self.minute / 43 + index))
        confidence = clamp(72 + parameters.radarQuality * 0.08 - parameters.noise * 0.5 - index * 2)
        if self.scenario_id == "SC-008":
            confidence = clamp(confidence - 12)
        state = self._convective_state(intensity * 0.7 + lightning * 0.3, confidence, curve)
        longitude, latitude = self._position_from(origin, self.minute - active_from, velocity, direction)
        if not DOMAIN.analysis_geometry.covers(Point(longitude, latitude)):
            state = ConvectiveState.DISSIPATING
        distance = self._distance_km((longitude, latitude), TARGET)
        eta = round_value(distance / max(velocity, 1) * 60) if distance > 1 else 0
        trajectory = [self._trajectory_point(longitude, latitude, velocity, direction, lead, confidence) for lead in range(0, 361, 15)]
        cell = StormCell(id=f"CELL-{index:03d}", longitude=round_value(longitude, 5), latitude=round_value(latitude, 5), intensity=round_value(intensity), area=round_value(12 + intensity * 0.42), growth=round_value((curve - 0.5) * 18), speed=round_value(velocity), direction=round_value(direction), confidence=round_value(confidence), state=state, distance=round_value(distance), eta=eta, trajectory=trajectory, observedTrack=[], hazards=[])
        hazards = self._hazards(cell, intensity, lightning, cooling, velocity, confidence, evidence)
        cell.hazards = [hazard.type for hazard in hazards if hazard.risk >= 25]
        cell.hazardRisks = {hazard.type: hazard.risk for hazard in hazards}
        return cell, hazards

    def _aggregate_hazards(self, hazard_sets: list[list[HazardState]]) -> list[HazardState]:
        if not hazard_sets:
            return []
        aggregated: list[HazardState] = []
        for hazard_type in HazardType:
            candidates = [hazards[list(HazardType).index(hazard_type)] for hazards in hazard_sets if len(hazards) == len(HazardType)]
            strongest = max(candidates, key=lambda hazard: hazard.risk)
            forecast = [HazardForecast(minute=point.minute, risk=max(hazard.forecast[index].risk for hazard in candidates), confidence=max(hazard.forecast[index].confidence for hazard in candidates)) for index, point in enumerate(strongest.forecast)]
            aggregated.append(HazardState(type=hazard_type, risk=strongest.risk, confidence=strongest.confidence, severity=strongest.severity, evidence=strongest.evidence, forecast=forecast))
        return aggregated

    def _signal_curve(self, minute: float) -> float:
        if self.scenario_id == "SC-006":
            return clamp(1.15 - minute / 280, 0.2, 1.15)
        if self.scenario_id == "SC-007":
            return clamp(0.42 + 0.10 * math.sin(minute / 24) - minute / 500, 0.18, 0.55)
        return clamp(0.28 + minute / 170, 0.18, 1.0)

    def _noise(self, minute: float, scale: float) -> float:
        seed = SCENARIOS[self.scenario_id].seed
        return math.sin(seed + minute / 17) * scale

    def _weights(self, qualities: list[float]) -> list[float]:
        total = sum(qualities)
        return [quality / total for quality in qualities] if total else [0, 0, 0]

    def _source_metrics(self, name: SourceName, intensity: float, lightning: float, cooling: float, velocity: float) -> list[Metric]:
        if name == SourceName.RADAR:
            return [Metric(label="MAX REFLECTIVITY", value=round_value(intensity), unit="dBZ"), Metric(label="CELL AREA", value=round_value(18 + intensity * 0.55), unit="km²"), Metric(label="VELOCITY", value=round_value(velocity), unit="km/h")]
        if name == SourceName.SATELLITE:
            return [Metric(label="CLOUD TOP", value=round_value(243 - cooling * 0.35), unit="K"), Metric(label="COOLING RATE", value=round_value(cooling / 12), unit="K/15m"), Metric(label="THERMAL TREND", value=round_value(cooling), unit="index")]
        return [Metric(label="STRIKES/MIN", value=round_value(lightning / 8), unit="count"), Metric(label="DENSITY", value=round_value(lightning), unit="strokes/100km²"), Metric(label="ACCELERATION", value=round_value(lightning / 10), unit="index")]

    def _feature_metadata(self, name: SourceName) -> tuple[str, str, str]:
        return {SourceName.RADAR: ("max_reflectivity", "dBZ", "quality-controlled replay reflectivity"), SourceName.SATELLITE: ("cooling_rate", "K/15m", "thermal trend from replay infrared proxy"), SourceName.LIGHTNING: ("strike_density", "strokes/100km²", "aggregated replay strike density")}[name]

    def _convective_state(self, signal: float, confidence: float, curve: float) -> ConvectiveState:
        if self.scenario_id == "SC-007" and (confidence < 58 or self.minute >= 60):
            return ConvectiveState.DISSIPATING
        if curve < 0.35:
            return ConvectiveState.NORMAL
        if signal < 45:
            return ConvectiveState.WATCH
        if signal < 58:
            return ConvectiveState.INITIATING
        if signal < 76:
            return ConvectiveState.ACTIVE
        if self.scenario_id == "SC-006" and curve < 0.7:
            return ConvectiveState.DISSIPATING
        return ConvectiveState.SEVERE

    def _position(self, minute: float, velocity: float, direction: float) -> tuple[float, float]:
        return self._position_from(ORIGIN, minute, velocity, direction)

    def _position_from(self, origin: tuple[float, float], minute: float, velocity: float, direction: float) -> tuple[float, float]:
        distance = velocity * minute / 60
        radians = math.radians(direction)
        return origin[0] + distance * math.sin(radians) / 111, origin[1] + distance * math.cos(radians) / 111

    def _trajectory_point(self, longitude: float, latitude: float, velocity: float, direction: float, lead: int, confidence: float) -> TrajectoryPoint:
        radians = math.radians(direction)
        distance = velocity * lead / 60
        return TrajectoryPoint(longitude=round_value(longitude + distance * math.sin(radians) / 111, 5), latitude=round_value(latitude + distance * math.cos(radians) / 111, 5), leadMinutes=lead, uncertaintyKm=round_value(1.5 + lead / 35 + (100 - confidence) / 25))

    def _distance_km(self, first: tuple[float, float], second: tuple[float, float]) -> float:
        return math.hypot((first[0] - second[0]) * 96, (first[1] - second[1]) * 111)

    def _hazards(self, storm: StormCell, intensity: float, lightning: float, cooling: float, velocity: float, confidence: float, evidence: list[FeatureEvidence]) -> list[HazardState]:
        base = {HazardType.LIGHTNING: clamp(lightning * 0.72 + storm.growth * 0.7), HazardType.HAIL: clamp(intensity * 0.48 + cooling * 0.28 + lightning * 0.18), HazardType.DOWNBURST: clamp(intensity * 0.42 + velocity * 0.28 + storm.growth * 0.8), HazardType.CLOUDBURST: clamp(intensity * 0.38 + cooling * 0.45 + storm.area * 0.12)}
        if self.scenario_id == "SC-007":
            base = {key: clamp(value - 16) for key, value in base.items()}
        result: list[HazardState] = []
        for hazard_type in HazardType:
            risk = base[hazard_type]
            hazard_confidence = clamp(confidence - (18 if hazard_type in {HazardType.HAIL, HazardType.DOWNBURST} else 8))
            severity = "CRITICAL" if risk >= 82 else "WARNING" if risk >= 65 else "WATCH" if risk >= 45 else "ADVISORY" if risk >= 25 else "NORMAL"
            relevant = evidence[:2] if hazard_type != HazardType.LIGHTNING else evidence[2:]
            forecast = [HazardForecast(minute=lead, risk=round_value(clamp(risk + lead * 0.015 - lead * 0.006 if self.scenario_id != "SC-006" else risk - lead * 0.04)), confidence=round_value(clamp(hazard_confidence - lead * 0.025))) for lead in range(0, 361, 30)]
            result.append(HazardState(type=hazard_type, risk=round_value(risk), confidence=round_value(hazard_confidence), severity=severity, evidence=relevant, forecast=forecast))
        return result

    def _alerts(self, hazards: list[HazardState], storm: StormCell, confidence: float, timestamp: datetime, parameters: ScenarioParameters) -> list[AlertState]:
        alerts: list[AlertState] = []
        for hazard in hazards:
            if hazard.risk < parameters.warningThreshold or hazard.confidence < parameters.confidenceThreshold:
                continue
            severity = "SEVERE" if hazard.risk >= 82 else "WARNING" if hazard.risk >= 65 else "WATCH"
            traces = [AlertTrace(stage=stage, detail=detail) for stage, detail in [("SOURCE", "Replay radar, INSAT-3DR, and lightning frames received"), ("QUALITY", f"Source quality fused at {storm.confidence:.0f}% confidence"), ("FEATURE", f"Evidence supports {hazard.type.value.lower()} risk"), ("FUSION", f"Multi-source agreement is {self.previous.fusion.agreement if self.previous else 0:.0f}%"), ("STORM", f"Tracked cell {storm.id} is {storm.state.value}"), ("HAZARD", f"{hazard.type.value} risk is {hazard.risk:.0f}%"), ("CONFIDENCE", f"Hazard confidence is {hazard.confidence:.0f}%"), ("ALERT", "Configured warning threshold exceeded")]]
            alerts.append(AlertState(alertId=f"ALERT-{self.scenario_id}-{storm.id}-{hazard.type.value.upper()}", scenarioId=self.scenario_id, stormCellId=storm.id, hazardType=hazard.type, timestamp=timestamp, severity=severity, confidence=hazard.confidence, status=AlertStatus.ACTIVE, trace=traces, audit=[AlertAudit(time=timestamp, action="GENERATED")]))
        return alerts

    def _revision(self, storm: StormCell, hazards: list[HazardState]) -> ForecastRevision | None:
        if not self.previous:
            return None
        previous_hazard = max(self.previous.hazards, key=lambda item: item.risk)
        current_hazard = max(hazards, key=lambda item: item.risk)
        return ForecastRevision(previousEta=self.previous.storm.eta, eta=storm.eta, previousRisk=previous_hazard.risk, risk=current_hazard.risk, previousConfidence=self.previous.storm.confidence, confidence=storm.confidence, reason="Updated replay frame and motion-aware forecast")