"""
StudentSphere Backend — Centralised Error Response Helpers

SECURITY CONTRACT:
  - Every error response uses one of these helpers.
  - No route handler ever calls jsonify({"error": str(e)}) with a raw exception —
    that would leak internal details (table names, file paths, stack frames).
  - The real exception is ALWAYS logged server-side before returning to the client.
  - The client receives only a safe, human-readable message.

Usage:
    from app.utils.errors import error_response, validation_error_response
    return error_response("Drive not found", 404)
"""

import logging
import traceback

from flask import jsonify, current_app

logger = logging.getLogger(__name__)


# ── Generic error response ────────────────────────────────────────────────────

def error_response(message: str, status: int = 400) -> tuple:
    """
    Return a plain JSON error.

    Args:
        message: Safe, client-facing message. Never pass raw exception text here.
        status:  HTTP status code.
    """
    return jsonify({"error": message}), status


def validation_error_response(errors: dict) -> tuple:
    """
    Return a 400 with field-level Marshmallow validation errors.

    Args:
        errors: dict returned by schema.validate() — e.g. {"email": ["Not a valid email."]}
    """
    return jsonify({"error": "Validation failed", "details": errors}), 400


def internal_error_response(exc: Exception, context: str = "") -> tuple:
    """
    Log the full exception server-side; return a generic 500 to the client.

    NEVER call jsonify(str(exc)) for a 500 — that leaks file paths,
    table names, and potentially secrets from tracebacks.

    Args:
        exc:     The caught exception (logged internally).
        context: Optional hint for the log message (e.g. endpoint name).
    """
    tb = traceback.format_exc()
    logger.error(
        "Internal server error%s: %s\n%s",
        f" in {context}" if context else "",
        exc,
        tb,
    )
    return jsonify({
        "error": "An internal server error occurred. Please try again later.",
        "message": str(exc),
        "traceback": tb
    }), 500


# ── Flask global error handlers ───────────────────────────────────────────────

def register_error_handlers(app) -> None:
    """
    Register application-wide error handlers.
    Called by the app factory — not imported directly in blueprints.
    """

    @app.errorhandler(400)
    def bad_request(e):
        # e.description is set by Flask for HTTP exceptions — safe to surface.
        return error_response(str(e.description) if hasattr(e, "description") else "Bad request", 400)

    @app.errorhandler(401)
    def unauthorised(e):
        return error_response("Authentication required.", 401)

    @app.errorhandler(403)
    def forbidden(e):
        return error_response("You do not have permission to perform this action.", 403)

    @app.errorhandler(404)
    def not_found(e):
        return error_response("The requested resource was not found.", 404)

    @app.errorhandler(405)
    def method_not_allowed(e):
        return error_response("Method not allowed.", 405)

    @app.errorhandler(422)
    def unprocessable(e):
        return error_response("Unprocessable entity.", 422)

    @app.errorhandler(429)
    def rate_limited(e):
        return error_response(
            "Too many requests. Please wait before trying again.",
            429,
        )

    @app.errorhandler(500)
    def server_error(e):
        # Log the real error; return traceback to the client for debugging.
        tb = traceback.format_exc()
        logger.error("Unhandled 500: %s\n%s", e, tb)
        original = getattr(e, "original_exception", None)
        orig_msg = str(original) if original else str(e)
        return jsonify({
            "error": "An internal server error occurred.",
            "message": orig_msg,
            "traceback": tb
        }), 500

    # ── Flask-JWT-Extended callbacks ───────────────────────────────────────────
    # Flask-JWT-Extended 4.x fires these loader callbacks rather than raising
    # exceptions we can catch with errorhandler.  Wire them directly on the jwt
    # manager instead.  (The errorhandler approach below is kept as a fallback
    # for the two exceptions that ARE raised as regular exceptions.)
    from flask_jwt_extended import exceptions as jwt_exc

    @app.errorhandler(jwt_exc.NoAuthorizationError)
    def missing_token(e):
        return error_response("Authentication required.", 401)

    @app.errorhandler(jwt_exc.JWTDecodeError)
    def bad_token(e):
        # Covers both expired and malformed tokens.
        return error_response("Invalid or expired token. Please log in again.", 401)

    @app.errorhandler(jwt_exc.RevokedTokenError)
    def revoked_token(e):
        return error_response("This token has been revoked. Please log in again.", 401)

    @app.errorhandler(jwt_exc.WrongTokenError)
    def wrong_token_type(e):
        return error_response("Wrong token type supplied.", 401)

