from app import app


def valid_request():
    return {
        "legs": [
            {
                "durationSeconds": 36000,
                "distanceMeters": 1111950,
                "coordinates": [[0.0, 0.0], [10.0, 0.0]],
            }
        ],
        "maxDrivingSeconds": 14400,
    }


def test_health_endpoint_returns_ok():
    client = app.test_client()

    response = client.get("/health")

    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


def test_find_break_points_returns_calculated_points():
    client = app.test_client()

    response = client.post("/find-break-points", json=valid_request())

    assert response.status_code == 200
    assert response.get_json() == {
        "breakPoints": [
            {
                "legIndex": 0,
                "location": [4.0, 0.0],
                "cumulativeSeconds": 14400,
            },
            {
                "legIndex": 0,
                "location": [8.0, 0.0],
                "cumulativeSeconds": 28800,
            },
        ]
    }


def test_empty_legs_returns_empty_break_points():
    client = app.test_client()
    body = {"legs": [], "maxDrivingSeconds": 14400}

    response = client.post("/find-break-points", json=body)

    assert response.status_code == 200
    assert response.get_json() == {"breakPoints": []}


def test_invalid_request_returns_json_validation_error():
    client = app.test_client()

    response = client.post("/find-break-points", json={"legs": []})

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"


def test_invalid_json_returns_json_validation_error():
    client = app.test_client()

    response = client.post(
        "/find-break-points",
        data="{not valid json}",
        content_type="application/json",
    )

    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "VALIDATION_ERROR"


def test_wrong_method_returns_json_error():
    client = app.test_client()

    response = client.get("/find-break-points")

    assert response.status_code == 405
    assert response.get_json()["error"]["code"] == "METHOD_NOT_ALLOWED"


def test_configured_service_key_is_required(monkeypatch):
    monkeypatch.setenv("GEO_SERVICE_KEY", "test-secret")
    client = app.test_client()

    response = client.post("/find-break-points", json=valid_request())

    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "UNAUTHORIZED"


def test_correct_service_key_is_accepted(monkeypatch):
    monkeypatch.setenv("GEO_SERVICE_KEY", "test-secret")
    client = app.test_client()

    response = client.post(
        "/find-break-points",
        json=valid_request(),
        headers={"X-Service-Key": "test-secret"},
    )

    assert response.status_code == 200