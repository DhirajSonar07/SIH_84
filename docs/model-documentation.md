# Model Documentation

| Model | Purpose | Inputs | Output | Status |
|---|---|---|---|---|
| `convective-baseline-v1` | Explainable convective detection | Radar, satellite, lightning, growth, quality, agreement | Convective probability and confidence | Ready |
| `hazard-risk-rules-v1` | Feature-weighted hazard risk | Fused signal, agreement, growth, lead | Hazard risk, severity, evidence | Ready |
| `nowcast-motion-v1` | Motion-plus-correction forecast | Track history, velocity, direction, uncertainty | Forecast track and spread | Ready |

These are deterministic baseline implementations for the synthetic/replay
environment. The system does not claim operational accuracy, calibration,
precision, recall, F1, AUC, or independent forecast skill.

The registry endpoint is available at `/api/v1/models`; component health is
available at `/api/v1/ai/status`.
