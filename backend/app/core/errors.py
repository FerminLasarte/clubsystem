"""
Errores de dominio. Los services los lanzan; `app/api/errors.py` los traduce a HTTP.
Así los services no dependen de FastAPI y ningún endpoint arma respuestas de error a mano.
"""


class DomainError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        if code:
            self.code = code


class NotFound(DomainError):
    status_code = 404
    code = "not_found"


class Conflict(DomainError):
    status_code = 409
    code = "conflict"


class Forbidden(DomainError):
    status_code = 403
    code = "forbidden"


class Unauthorized(DomainError):
    status_code = 401
    code = "unauthorized"


class BusinessRuleViolation(DomainError):
    status_code = 422
    code = "business_rule"


class ServiceUnavailable(DomainError):
    status_code = 503
    code = "service_unavailable"
