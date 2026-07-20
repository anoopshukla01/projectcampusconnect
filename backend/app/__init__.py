"""
StudentSphere Backend — Application Factory

DESIGN NOTES
────────────
* create_app() is the single entry point. Nothing is imported at module level
  that requires the app to exist — all extension binding is done inside this
  function to prevent circular imports.

* JWT blocklist: revoked tokens (logout, password change) are stored in Redis
  as "jti → expiry timestamp". The @jwt.token_in_blocklist_loader checks this
  set on every protected request. If Redis is unavailable, the check fails
  *closed* (returns True, i.e., treat token as revoked) in production —
  this is the safe-fail direction.

* All blueprints are registered here so there is one authoritative list of
  what routes exist. Adding a new feature = add one line here.
"""

import logging
import os

from flask import Flask

from .config import config_map, ProductionConfig
from .extensions import cors, db, jwt, limiter, migrate, mail
from .utils.errors import register_error_handlers

logger = logging.getLogger(__name__)


def create_app(config_name: str | None = None) -> Flask:
    """
    Flask application factory.

    Args:
        config_name: One of 'development', 'testing', 'production'.
                     Falls back to FLASK_ENV environment variable, then 'development'.
    """
    if config_name is None:
        config_name = os.environ.get("FLASK_ENV", "development")

    app = Flask(__name__)

    # ── Load config ────────────────────────────────────────────────────────
    cfg_class = config_map.get(config_name)
    if cfg_class is None:
        raise ValueError(
            f"Unknown config '{config_name}'. Choose from: {list(config_map.keys())}"
        )
    # Production-only validation (PostgreSQL enforced, no placeholder secrets).
    if config_name == "production":
        ProductionConfig.validate()

    app.config.from_object(cfg_class)

    # Import models to register on metadata before extensions init
    from app import models

    # ── Logging ────────────────────────────────────────────────────────────
    _configure_logging(app)

    # ── Initialise extensions ──────────────────────────────────────────────
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    limiter.init_app(app)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
        supports_credentials=True,
    )
    mail.init_app(app)

    # ── JWT blocklist (revoked tokens) ────────────────────────────────────
    _register_jwt_callbacks(app)

    # ── Register blueprints ────────────────────────────────────────────────
    _register_blueprints(app)

    # ── Global error handlers ─────────────────────────────────────────────
    register_error_handlers(app)

    # ── Health-check route (no auth, no rate limit) ───────────────────────
    @app.get("/api/health")
    def health():
        from flask import jsonify

        return jsonify({"status": "ok", "service": "studentsphere-backend"}), 200

    # ── CLI Commands ──────────────────────────────────────────────────────
    import click

    @app.cli.command("bootstrap-admin")
    @click.option("--email", prompt="Admin email", default="admin@college.edu.in")
    @click.option("--password", prompt="Admin password", hide_input=True)
    def bootstrap_admin(email, password):
        """Offline manual CLI process to create the initial college Admin account."""
        from app.models.user import User, UserRole
        existing = db.session.query(User).filter_by(email=email).first()
        if existing:
            click.echo(f"User with email '{email}' already exists.")
            return

        admin_user = User(email=email, role=UserRole.ADMIN, is_active=True)
        admin_user.set_password(password)
        db.session.add(admin_user)
        db.session.commit()
        click.echo(f"Successfully bootstrapped initial Admin account: {email}")

    return app


# ── Private helpers ────────────────────────────────────────────────────────────

def _configure_logging(app: Flask) -> None:
    level = logging.DEBUG if app.debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    # Silence overly verbose third-party loggers in production.
    if not app.debug:
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def _register_jwt_callbacks(app: Flask) -> None:
    """
    Wire JWT blocklist and custom error callbacks.

    The blocklist is stored in Redis as keys of the form:
        "jwt_blocklist:<jti>"
    with a TTL equal to the token's remaining validity.

    SAFE-FAIL: If Redis is unreachable, we treat every token as revoked
    (returns True) in production. In testing, we skip Redis entirely.
    """

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload: dict) -> bool:
        if app.config.get("TESTING") or app.config.get("RATELIMIT_STORAGE_URL") == "memory://":
            # In tests or dev with memory:// storage, use an in-memory set attached to app.
            if not hasattr(app, "_test_blocklist"):
                app._test_blocklist = set()
            return jwt_payload["jti"] in app._test_blocklist

        try:
            import redis as redis_lib

            r = redis_lib.from_url(app.config["RATELIMIT_STORAGE_URL"])
            return r.exists(f"jwt_blocklist:{jwt_payload['jti']}") == 1
        except Exception as exc:  # noqa: BLE001
            logger.error("Redis blocklist check failed: %s", exc)
            # Safe-fail: treat as revoked.
            return True

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        from flask import jsonify

        return jsonify({"error": "Your session has expired. Please log in again."}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(reason):
        from flask import jsonify

        return jsonify({"error": "Invalid token.", "detail": reason}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(reason):
        from flask import jsonify

        return jsonify({"error": "Authentication required.", "detail": reason}), 401

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        from flask import jsonify

        return jsonify({"error": "This token has been revoked. Please log in again."}), 401


def _register_blueprints(app: Flask) -> None:
    """
    Register all feature blueprints under /api/v1/.
    Import here (not at module top) to avoid circular imports.
    Blueprints are added as steps are completed — commented entries
    are placeholders for future steps.
    """
    # Step 3: Auth (OTP + Student registration + Login/Logout)
    from .blueprints.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")

    # Step 6: Student profile endpoints
    from .blueprints.students import students_bp
    app.register_blueprint(students_bp, url_prefix="/api/v1/students")

    # Step 7: Professor profile endpoints
    from .blueprints.professors import professors_bp
    app.register_blueprint(professors_bp, url_prefix="/api/v1/professors")

    # Step 8: Admin endpoints
    from .blueprints.admin import admin_bp
    app.register_blueprint(admin_bp, url_prefix="/api/v1/admin")

    # Step 9–10: Placement endpoints
    from .blueprints.placement import placement_bp
    app.register_blueprint(placement_bp, url_prefix="/api/v1/placement")

    # Academics & Community endpoints
    from .blueprints.academics import academics_bp
    app.register_blueprint(academics_bp, url_prefix="/api/v1/academics")

    from .blueprints.community import community_bp
    app.register_blueprint(community_bp, url_prefix="/api/v1/community")

    from .blueprints.career import career_bp
    app.register_blueprint(career_bp, url_prefix="/api/v1/career")

    from .blueprints.chats import chats_bp
    app.register_blueprint(chats_bp, url_prefix="/api/v1/career/chats")

    from .blueprints.notifications import notifications_bp
    app.register_blueprint(notifications_bp, url_prefix="/api/v1/notifications")

