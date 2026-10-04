# NOVEXA NOWCAST AI/ML Pipeline

NOVEXA currently uses a deterministic, explainable baseline pipeline. It is
not presented as a trained operational weather model, and no skill metrics are
claimed without independent observations.

## Runtime flow

1. **Ingestion** normalizes DWR radar, INSAT-3DR, and lightning proxy frames.
2. **Quality control** scores coverage, completeness, freshness, and temporal
   alignment. Source quality controls fusion weighting.
3. **Feature extraction** derives reflectivity, cloud cooling, lightning
   density/growth, storm growth, motion, temporal consistency, and spatial
   consistency.
4. **Fusion** combines source signals with quality-weighted contributions and
   exposes source agreement.
5. **Convective inference** uses `convective-baseline-v1`, an explainable
   feature-weighted estimator.
6. **Detection and tracking** create state-wide cell objects and associate
   positions through deterministic motion continuity.
7. **Hazard estimation** combines fused evidence, growth, source agreement, and
   forecast lead into bounded risk estimates.
8. **Nowcast and uncertainty** project motion and uncertainty over 0–6 hours;
   confidence decreases with disagreement, quality loss, and forecast lead.
9. **Risk and alerts** apply configured thresholds, ETA, persistence, trend, and
   confidence before generating alert records.

## Runtime contracts

`NowcastState.inference` contains the prediction identifier, model/version,
input window, features used, probability, confidence, latency, horizon, and
the feature vector used for the current prediction. `/api/v1/ai/status` exposes
the model registry and component readiness.

The implementation is intentionally modular so trained artifacts can replace
the baseline behind the same model contract after a documented training and
independent validation process.
