import pytest

from validation import ValidationError, validate_request


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


def test_valid_request_is_accepted():
    validate_request(valid_request())


@pytest.mark.parametrize(
    "body, message",
    [
        (None, "JSON object"),
        ({}, "'legs'"),
        ({"legs": []}, "'maxDrivingSeconds'"),
        ({"legs": {}, "maxDrivingSeconds": 14400}, "list"),
        (
            {"legs": [{}], "maxDrivingSeconds": 14400},
            "durationSeconds",
        ),
        (
            {
                "legs": [{"durationSeconds": 3600}],
                "maxDrivingSeconds": 14400,
            },
            "coordinates",
        ),
        (
            {
                "legs": [
                    {"durationSeconds": 3600, "coordinates": [[0, 0]]}
                ],
                "maxDrivingSeconds": 14400,
            },
            "at least two",
        ),
    ],
)
def test_invalid_request_shape_is_rejected(body, message):
    with pytest.raises(ValidationError, match=message):
        validate_request(body)


@pytest.mark.parametrize(
    "max_driving_seconds",
    [0, -1, 100001, 14_400.5, True],
)
def test_invalid_driving_limit_is_rejected(max_driving_seconds):
    body = valid_request()
    body["maxDrivingSeconds"] = max_driving_seconds

    with pytest.raises(ValidationError):
        validate_request(body)


@pytest.mark.parametrize(
    "coordinate",
    [
        [181, 0],
        [0, 91],
        ["18", 59],
        [18],
    ],
)
def test_invalid_coordinate_is_rejected(coordinate):
    body = valid_request()
    body["legs"][0]["coordinates"][1] = coordinate

    with pytest.raises(ValidationError):
        validate_request(body)


def test_negative_duration_is_rejected():
    body = valid_request()
    body["legs"][0]["durationSeconds"] = -1

    with pytest.raises(ValidationError):
        validate_request(body)
