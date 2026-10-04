# Backend Implementation Plan

1. Establish Pydantic schemas matching the frontend snapshot validator.
2. Build deterministic shared synthetic storm truth and replay scenarios.
3. Derive replay radar, satellite, and lightning observations from that truth.
4. Add quality, temporal alignment, feature extraction, fusion, detection, tracking, trajectory, hazards, confidence, and alert trace stages.
5. Add FastAPI REST routes and complete-snapshot WebSocket publication.
6. Add scenario/replay controls, health/readiness, performance, and technical trace routes.
7. Add unit and API tests for causal coherence, degraded sources, false alarms, and sequence behavior.
8. Run backend tests/build and verify the emitted snapshot against the frontend Zod contract without modifying frontend files.

The first implementation stays in-memory and offline. Database, external feeds, authentication, and distributed infrastructure are intentionally out of scope.