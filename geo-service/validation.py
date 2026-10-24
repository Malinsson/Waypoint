class ValidatiopnError(Exception):
    """Custom exception for validation errors."""
    pass

    def __init__(self, message):
        self.message = message
        super().__init__(self.message)

    def validate_request(body):
        """
        Validate the request body for required fields and correct data types.

        Args:
            body (dict): The request body to validate.
        """
        if 'legs' not in body:
            raise ValidatiopnError("Missing 'legs' field in request body.")

        if not isinstance(body['legs'], list):
            raise ValidatiopnError("The 'legs' field must be a list.")

        for i, leg in enumerate(body['legs']):
            if not isinstance(leg, dict):
                raise ValidatiopnError(f"Each leg must be a dictionary. Leg {i} is not.")

            if 'durationSeconds' not in leg:
                raise ValidatiopnError(f"Missing 'durationSeconds' field in leg {i}.")

            if 'coordinates' not in leg:
                raise ValidatiopnError(f"Missing 'coordinates' field in leg {i}.")


        if 'maxDurationSeconds' in body:

            if not isinstance(body['maxDurationSeconds'], int):
                raise ValidatiopnError("The 'maxDurationSeconds' field must be an integer.")

            if body['maxDurationSeconds'] <= 0:
                raise ValidatiopnError("The 'maxDurationSeconds' field must be a positive integer.")

            if 'maxDurationSeconds' not in body:
                raise ValidatiopnError("Missing 'maxDurationSeconds' field in request body.")

            if body['maxDurationSeconds'] > 100000:
                raise ValidatiopnError("The 'maxDurationSeconds' field must not exceed 100000 seconds.")