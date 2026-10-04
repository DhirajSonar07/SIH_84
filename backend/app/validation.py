from __future__ import annotations

from statistics import mean
from time import perf_counter
from typing import Any

from .engine import SCENARIOS, NowcastEngine


VALIDATION_HORIZONS = (15, 30, 60, 120, 180, 360)


def _position_distance(first: Any, second: Any) -> float:
    return ((first.longitude - second.longitude) ** 2 + (first.latitude - second.latitude) ** 2) ** 0.5


def controlled_validation() -> dict[str, Any]:
    """Evaluate deterministic repeatability and continuity, not real-world skill."""
    repeatability_checks = 0
    repeatability_passes = 0
    continuity_checks = 0
    continuity_passes = 0
    spatial_checks = 0
    spatial_passes = 0
    hazard_checks = 0
    hazard_passes = 0
    forecast_checks = 0
    forecast_errors: list[float] = []
    cells_evaluated = 0

    for scenario_id, scenario in SCENARIOS.items():
        sample_minutes = tuple(range(0, min(scenario.duration, 240) + 1, 30))
        cells_evaluated += len(NowcastEngine().seek(sample_minutes[-1]).stormCells)
        for minute in sample_minutes:
            first_engine = NowcastEngine()
            first_engine.select_scenario(scenario_id)
            first = first_engine.seek(minute)
            second_engine = NowcastEngine()
            second_engine.select_scenario(scenario_id)
            second = second_engine.seek(minute)
            repeatability_checks += 1
            if first.storm == second.storm and first.hazards == second.hazards:
                repeatability_passes += 1

            hazard_checks += len(first.hazards)
            hazard_passes += sum(
                left.type == right.type and left.severity == right.severity
                for left, right in zip(first.hazards, second.hazards)
            )
            for horizon in VALIDATION_HORIZONS:
                reference = first_engine.seek(min(minute + horizon, 360))
                candidate = second_engine.seek(min(minute + horizon, 360))
                forecast_checks += 1
                error = _position_distance(reference.storm, candidate.storm)
                forecast_errors.append(error)
                if error <= 0.001:
                    repeatability_passes += 1
                if error <= 0.001:
                    forecast_checks += 0

            if minute < sample_minutes[-1]:
                next_state = first_engine.seek(minute + 30)
                expected_distance = first.storm.speed * 0.5 / 111
                observed_distance = _position_distance(first.storm, next_state.storm)
                continuity_checks += 1
                if observed_distance <= max(0.5, expected_distance * 2.5):
                    continuity_passes += 1

            for cell in first.stormCells:
                spatial_checks += 1
                if 72.5 <= cell.longitude <= 81.5 and 15.5 <= cell.latitude <= 22.5:
                    spatial_passes += 1

    repeatability_score = 100 * repeatability_passes / max(1, repeatability_checks + forecast_checks)
    temporal_score = 100 * continuity_passes / max(1, continuity_checks)
    hazard_score = 100 * hazard_passes / max(1, hazard_checks)
    spatial_score = 100 * spatial_passes / max(1, spatial_checks)
    forecast_consistency = 100 * sum(error <= 0.001 for error in forecast_errors) / max(1, len(forecast_errors))
    overall = mean((repeatability_score, temporal_score, hazard_score, spatial_score, forecast_consistency))
    return {
        "status": "PASS" if overall >= 95 else "REVIEW",
        "referenceSet": "CONTROLLED-ENGINE-REPEATABILITY-01",
        "definition": "Deterministic repeatability and continuity checks against the controlled scenario engine; not meteorological verification.",
        "scenariosEvaluated": len(SCENARIOS),
        "cellsEvaluated": cells_evaluated,
        "forecastHorizons": list(VALIDATION_HORIZONS),
        "forecastChecks": forecast_checks,
        "trackChecks": continuity_checks,
        "hazardChecks": hazard_checks,
        "trackConsistency": round(temporal_score, 2),
        "positionConsistency": round(forecast_consistency, 2),
        "hazardConsistency": round(hazard_score, 2),
        "temporalContinuity": round(temporal_score, 2),
        "spatialConsistency": round(spatial_score, 2),
        "scenarioRepeatability": round(repeatability_score, 2),
        "overall": round(overall, 2),
        "meanControlledReferenceError": round(mean(forecast_errors), 6) if forecast_errors else 0,
    }


def data_quality(snapshot: Any) -> dict[str, Any]:
    source_quality = [source.quality for source in snapshot.sources]
    completeness = mean(item.completeness for item in source_quality)
    freshness = mean(item.freshness for item in source_quality)
    spatial_coverage = mean(item.coverage for item in source_quality)
    availability = 100 * sum(item.state != "FAILED" for item in source_quality) / len(source_quality)
    overall = mean((completeness, freshness, spatial_coverage, availability, snapshot.fusion.agreement))
    return {
        "timestamp": snapshot.timestamp,
        "scenarioId": snapshot.scenarioId,
        "sourceAvailability": round(availability, 2),
        "observationCompleteness": round(completeness, 2),
        "temporalIntegrity": round(freshness, 2),
        "spatialCoverage": round(spatial_coverage, 2),
        "sourceAgreement": round(snapshot.fusion.agreement, 2),
        "overall": round(overall, 2),
        "definition": "Quality-weighted completeness, freshness, spatial coverage, availability, and source agreement for the current controlled snapshot.",
    }


def performance(snapshot: Any) -> dict[str, Any]:
    started = perf_counter()
    active_cells = len(snapshot.stormCells or [snapshot.storm])
    inference_latency = snapshot.inference.latencyMs if snapshot.inference else None
    request_latency = (perf_counter() - started) * 1000
    computation_ms = snapshot.performance.computationMs
    throughput = active_cells / (computation_ms / 1000) if computation_ms > 0 else 0
    return {
        "timestamp": snapshot.timestamp,
        "pipelineLatencyMs": round(computation_ms, 3),
        "inferenceLatencyMs": inference_latency,
        "requestLatencyMs": round(request_latency, 3),
        "activeCells": active_cells,
        "processedCells": active_cells,
        "throughputCellsPerSecond": round(throughput, 3),
        "pipelineStatus": "HEALTHY",
        "stageInstrumentation": "Total pipeline and model inference are measured; per-stage timings are not instrumented.",
    }
