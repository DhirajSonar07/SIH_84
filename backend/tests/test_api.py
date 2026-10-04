from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health_and_readiness() -> None:
    assert client.get("/api/health").status_code == 200
    response = client.get("/api/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"


def test_current_snapshot_is_frontend_compatible() -> None:
    response = client.get("/api/nowcast/current")
    body = response.json()

    assert response.status_code == 200
    assert body["schemaVersion"] == "1.0"
    assert len(body["sources"]) == 3
    assert len(body["hazards"]) == 4


def test_map_state_contract_is_maharashtra_wide() -> None:
    client.post("/api/scenarios/SC-001/run", json={"minute": 45, "lead": 60})
    response = client.get("/api/v1/map/state")
    body = response.json()

    assert response.status_code == 200
    assert body["region"] == "Maharashtra"
    assert body["bounds"]["west"] < body["bounds"]["east"]
    assert body["bounds"]["south"] < body["bounds"]["north"]
    assert len(body["stormCells"]) == 4
    assert len(body["forecastTracks"]) == 4
    assert len(body["districtRisks"]) >= 1
    assert len(body["regionalRisks"]) >= 2


def test_scenario_run_and_replay_controls() -> None:
    response = client.post("/api/scenarios/SC-007/run", json={"minute": 90, "lead": 120})
    assert response.status_code == 200
    assert response.json()["scenarioId"] == "SC-007"
    response = client.post("/api/replay/seek", json={"minute": 30})
    assert response.status_code == 200
    assert response.json()["minute"] == 30


def test_websocket_sends_complete_snapshot() -> None:
    with client.websocket_connect("/api/ws/nowcast") as websocket:
        body = websocket.receive_json()

    assert body["scenarioId"] == "SC-007"
    assert body["storm"]["id"] == "CELL-001"
    assert len(body["alerts"]) >= 0