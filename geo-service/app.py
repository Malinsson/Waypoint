import os

from flask import Flask
from flask import jsonify, request

from breakpoints import find_break_points as calculate_break_points
from validation import ValidationError, validate_request

app = Flask(__name__)


def error_response(status_code, code, message):
    return jsonify({"error": {"code": code, "message": message}}), status_code


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/find-break-points")
def find_break_points_endpoint():
    configured_key = os.getenv("GEO_SERVICE_KEY")
    if configured_key and request.headers.get("X-Service-Key") != configured_key:
        return error_response(401, "UNAUTHORIZED", "A valid service key is required.")

    body = request.get_json(silent=True)

    try:
        validate_request(body)
    except ValidationError as error:
        return error_response(400, "VALIDATION_ERROR", str(error))

    break_points = calculate_break_points(
        body["legs"],
        body["maxDrivingSeconds"],
    )
    return jsonify({"breakPoints": break_points})


@app.errorhandler(400)
def handle_bad_request(error):
    return error_response(400, "VALIDATION_ERROR", "The request is invalid.")


@app.errorhandler(405)
def handle_method_not_allowed(error):
    return error_response(405, "METHOD_NOT_ALLOWED", "This HTTP method is not allowed.")


@app.errorhandler(413)
def handle_payload_too_large(error):
    return error_response(413, "PAYLOAD_TOO_LARGE", "The request body is too large.")


@app.errorhandler(500)
def handle_internal_error(error):
    return error_response(500, "INTERNAL_ERROR", "The service could not process the request.")