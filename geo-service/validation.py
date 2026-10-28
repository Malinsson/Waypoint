import math


class ValidationError(Exception):
    """Raised when a request does not match the service contract."""


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def validate_request(body):
    """Validate a request for the break-point endpoint."""
    if not isinstance(body, dict):
        raise ValidationError("Request body must be a JSON object.")

    if "legs" not in body:
        raise ValidationError("Missing 'legs' field in request body.")
    if "maxDrivingSeconds" not in body:
        raise ValidationError("Missing 'maxDrivingSeconds' field in request body.")

    if not isinstance(body["legs"], list):
        raise ValidationError("The 'legs' field must be a list.")

    max_driving_seconds = body["maxDrivingSeconds"]
    if not isinstance(max_driving_seconds, int) or isinstance(max_driving_seconds, bool):
        raise ValidationError("The 'maxDrivingSeconds' field must be an integer.")
    if max_driving_seconds <= 0:
        raise ValidationError("The 'maxDrivingSeconds' field must be a positive integer.")
    if max_driving_seconds > 100_000:
        raise ValidationError("The 'maxDrivingSeconds' field must not exceed 100000 seconds.")

    for leg_index, leg in enumerate(body["legs"]):
        if not isinstance(leg, dict):
            raise ValidationError(f"Each leg must be an object. Leg {leg_index} is not.")

        if "durationSeconds" not in leg:
            raise ValidationError(f"Missing 'durationSeconds' field in leg {leg_index}.")
        if not _is_number(leg["durationSeconds"]):
            raise ValidationError(f"The 'durationSeconds' field in leg {leg_index} must be a number.")
        if leg["durationSeconds"] < 0:
            raise ValidationError(f"The 'durationSeconds' field in leg {leg_index} cannot be negative.")

        if "coordinates" not in leg:
            raise ValidationError(f"Missing 'coordinates' field in leg {leg_index}.")
        coordinates = leg["coordinates"]
        if not isinstance(coordinates, list):
            raise ValidationError(f"The 'coordinates' field in leg {leg_index} must be a list.")
        if len(coordinates) < 2:
            raise ValidationError(f"Leg {leg_index} must contain at least two coordinates.")

        for coordinate_index, coordinate in enumerate(coordinates):
            if not isinstance(coordinate, list) or len(coordinate) != 2:
                raise ValidationError(
                    f"Coordinate {coordinate_index} in leg {leg_index} must contain two numbers."
                )
            longitude, latitude = coordinate
            if not _is_number(longitude) or not _is_number(latitude):
                raise ValidationError(
                    f"Coordinate {coordinate_index} in leg {leg_index} must contain only numbers."
                )
            if not -180 <= longitude <= 180:
                raise ValidationError(
                    f"Longitude in coordinate {coordinate_index} of leg {leg_index} must be between -180 and 180."
                )
            if not -90 <= latitude <= 90:
                raise ValidationError(
                    f"Latitude in coordinate {coordinate_index} of leg {leg_index} must be between -90 and 90."
                )