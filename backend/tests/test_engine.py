from app.engine import NowcastEngine, scenario_parameters
from app.schemas import ConvectiveState, ScenarioParameters, SourceName


def test_snapshot_matches_frontend_ordered_contract() -> None:
    snapshot = NowcastEngine().current()

    assert snapshot.schemaVersion == "1.0"
    assert [source.name for source in snapshot.sources] == list(SourceName)
    assert [hazard.type.value for hazard in snapshot.hazards] == ["Lightning", "Hail", "Downburst", "Cloudburst"]
    assert snapshot.observationTime <= snapshot.processingTime <= snapshot.timestamp
    assert len(snapshot.storm.trajectory) == 25


def test_intensity_change_is_causal() -> None:
    engine = NowcastEngine()
    baseline = engine.current()
    parameters = scenario_parameters("SC-001")
    stronger = parameters.model_copy(update={"intensity": 100, "lightning": 100, "cooling": 100})
    changed = engine.update_parameters(stronger)

    assert changed.sources[0].signal > baseline.sources[0].signal
    assert changed.fusion.signal > baseline.fusion.signal
    assert max(hazard.risk for hazard in changed.hazards) > max(hazard.risk for hazard in baseline.hazards)


def test_false_alarm_lowers_confidence_and_dissipates() -> None:
    engine = NowcastEngine()
    engine.select_scenario("SC-007")
    snapshot = engine.seek(100)

    assert snapshot.truth is False
    assert snapshot.fusion.confidence < 70
    assert snapshot.storm.state in {ConvectiveState.DISSIPATING, ConvectiveState.WATCH}


def test_degraded_source_is_propagated() -> None:
    engine = NowcastEngine()
    engine.select_scenario("SC-008")
    snapshot = engine.seek(60)

    assert snapshot.sources[1].quality.state == "DEGRADED"
    assert snapshot.fusion.quality < 80
    assert snapshot.fusion.confidence < 90


def test_replay_seek_is_deterministic() -> None:
    engine = NowcastEngine()
    first = engine.seek(90)
    second_engine = NowcastEngine()
    second = second_engine.seek(90)

    assert first.storm.longitude == second.storm.longitude
    assert first.hazards == second.hazards


def test_primary_scenario_detects_cells_across_state_regions() -> None:
    snapshot = NowcastEngine().seek(45)
    positions = {(round(cell.longitude, 1), round(cell.latitude, 1)) for cell in snapshot.stormCells}

    assert len(snapshot.stormCells) == 4
    assert len(positions) == 4
    assert any(cell.longitude > 78 for cell in snapshot.stormCells)
    assert any(cell.latitude > 19.5 for cell in snapshot.stormCells)
    assert any(cell.longitude < 75 for cell in snapshot.stormCells)


def test_vidarbha_scenario_is_not_recentered_on_pune() -> None:
    engine = NowcastEngine()
    engine.select_scenario("SC-003")
    snapshot = engine.seek(45)

    assert any(cell.longitude > 78 for cell in snapshot.stormCells)
    assert all(cell.id.startswith("CELL-") for cell in snapshot.stormCells)