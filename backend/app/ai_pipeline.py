from __future__ import annotations

import math
from dataclasses import dataclass
from time import perf_counter


@dataclass(frozen=True)
class FeatureVector:
    reflectivity_mean: float
    reflectivity_max: float
    reflectivity_gradient: float
    cloud_top_temperature: float
    cloud_cooling_rate: float
    lightning_density: float
    lightning_growth: float
    storm_growth_rate: float
    motion_x: float
    motion_y: float
    data_quality: float
    source_agreement: float
    temporal_consistency: float
    spatial_consistency: float


@dataclass(frozen=True)
class InferenceResult:
    convective_probability: float
    model_confidence: float
    feature_vector: FeatureVector
    latency_ms: float


class ConvectiveInferencePipeline:
    """Small, deterministic, explainable baseline used until trained artifacts exist."""

    model_id = "convective-baseline-v1"
    version = "1.0.0"

    def infer(
        self,
        *,
        reflectivity: float,
        satellite_signal: float,
        lightning: float,
        growth: float,
        speed: float,
        direction: float,
        quality: float,
        agreement: float,
        minute: float,
    ) -> InferenceResult:
        started = perf_counter()
        temporal_consistency = max(0.0, min(100.0, 82.0 + 12.0 * math.cos(minute / 24.0)))
        spatial_consistency = max(0.0, min(100.0, 72.0 + 0.28 * agreement))
        probability = max(
            0.0,
            min(
                100.0,
                0.42 * reflectivity
                + 0.24 * satellite_signal
                + 0.22 * lightning
                + 0.12 * max(0.0, growth + 50.0),
            ),
        )
        confidence = max(
            0.0,
            min(100.0, 0.45 * quality + 0.35 * agreement + 0.2 * temporal_consistency),
        )
        vector = FeatureVector(
            reflectivity_mean=reflectivity,
            reflectivity_max=min(100.0, reflectivity * 1.12),
            reflectivity_gradient=max(0.0, growth),
            cloud_top_temperature=max(-80.0, 10.0 - satellite_signal * 0.55),
            cloud_cooling_rate=max(0.0, satellite_signal * 0.08),
            lightning_density=lightning,
            lightning_growth=max(0.0, lightning * 0.12 + growth),
            storm_growth_rate=growth,
            motion_x=speed * math.cos(math.radians(direction)),
            motion_y=speed * math.sin(math.radians(direction)),
            data_quality=quality,
            source_agreement=agreement,
            temporal_consistency=temporal_consistency,
            spatial_consistency=spatial_consistency,
        )
        return InferenceResult(
            convective_probability=round(probability, 2),
            model_confidence=round(confidence, 2),
            feature_vector=vector,
            latency_ms=round((perf_counter() - started) * 1000, 3),
        )


PIPELINE = ConvectiveInferencePipeline()


def model_registry() -> list[dict[str, object]]:
    return [
        {
            "modelId": PIPELINE.model_id,
            "modelType": "explainable baseline classifier",
            "version": PIPELINE.version,
            "features": ["radar", "satellite", "lightning", "growth", "quality", "agreement"],
            "status": "READY",
            "calibration": "Not independently calibrated",
        },
        {
            "modelId": "hazard-risk-rules-v1",
            "modelType": "feature-weighted probabilistic estimator",
            "version": "1.0.0",
            "features": ["fused signal", "source agreement", "cell growth", "forecast lead"],
            "status": "READY",
            "calibration": "Synthetic scenario evaluation only",
        },
        {
            "modelId": "nowcast-motion-v1",
            "modelType": "motion-plus-ML-correction baseline",
            "version": "1.0.0",
            "features": ["track history", "velocity", "direction", "uncertainty"],
            "status": "READY",
            "calibration": "No independent validation data",
        },
    ]


def pipeline_status() -> list[dict[str, object]]:
    return [
        {"name": name, "status": "READY", "modelId": model_id}
        for name, model_id in [
            ("Feature Engine", "feature-engine-v1"),
            ("Fusion Engine", "fusion-engine-v1"),
            ("Cell Detector", PIPELINE.model_id),
            ("Tracker", "tracker-distance-continuity-v1"),
            ("Hazard Models", "hazard-risk-rules-v1"),
            ("Nowcast Model", "nowcast-motion-v1"),
            ("Uncertainty Engine", "uncertainty-source-agreement-v1"),
        ]
    ]
