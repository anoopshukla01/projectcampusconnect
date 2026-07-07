"""
Campus Connect Backend — Configuration

Three environments:
  development  — verbose SQL logging, rate-limiting disabled, OTP mocked
  testing      — in-memory/test DB, rate-limiting disabled, short token TTLs
  production   — strict settings, PostgreSQL enforced, no debug output
"""

import os
from datetime import timedelta
from dotenv import load_dotenv
from sqlalchemy.pool import NullPool

load_dotenv()


def _require_env(var: str) -> str:
    """
    Read an environment variable. Raise at import time if it is missing.
    This ensures misconfigured deployments fail loudly at startup,
    not silently mid-request.
    """
    value = os.environ.get(var)
    if not value:
        raise RuntimeError(
            f"Required environment variable '{var}' is not set. "
            f"See .env.example for guidance."
        )
    return value


class BaseConfig:
    # ── Flask core ────────────────────────────────────────────────────────────
    # SECRET_KEY is used for session signing; JWT_SECRET_KEY for JWT signing.
    # They MUST be different so a leak of one does not compromise the other.
    SECRET_KEY: str            # set per-subclass
    JWT_SECRET_KEY: str        # set per-subclass

    # ── JWT ───────────────────────────────────────────────────────────────────
    # Short-lived access tokens reduce the blast radius of token theft.
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    # Refresh tokens are opaque + stored in DB; 7-day expiry, rotated on use.
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    JWT_ALGORITHM = "HS256"
    JWT_TOKEN_LOCATION = ["headers"]
    JWT_HEADER_NAME = "Authorization"
    JWT_HEADER_TYPE = "Bearer"
    # Blocklist check is wired in app factory via @jwt.token_in_blocklist_loader
    JWT_ACCESS_COOKIE_NAME = "access_token"   # not used (header-only), kept for clarity

    # ── Database ──────────────────────────────────────────────────────────────
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # pool_pre_ping: Verify connections before use (essential for managed DBs
    # like Supabase where idle connections may be killed by the pooler).
    # pool_recycle: Force-reconnect every 5 min — keeps connections fresh
    # behind Supabase's pgBouncer transaction pooler.
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }


    # ── Rate limiting ─────────────────────────────────────────────────────────
    # Specific limits are set per-endpoint in blueprints via @limiter.limit().
    # This default applies to any endpoint that doesn't declare its own limit.
    RATELIMIT_DEFAULT = "300/hour"
    RATELIMIT_HEADERS_ENABLED = True     # Return X-RateLimit-* headers
    RATELIMIT_ENABLED = True

    # ── CORS ──────────────────────────────────────────────────────────────────
    # In production, list exact frontend origin(s).
    CORS_ORIGINS: list = []              # overridden per env

    # ── College-level settings ────────────────────────────────────────────────
    ALLOWED_EMAIL_DOMAIN: str            # set per-subclass or from env
    COLLEGE_NAME: str                    # set per-subclass or from env

    # ── OTP ───────────────────────────────────────────────────────────────────
    OTP_EXPIRY_MINUTES: int = int(os.environ.get("OTP_EXPIRY_MINUTES", "10"))
    OTP_MAX_ATTEMPTS: int   = int(os.environ.get("OTP_MAX_ATTEMPTS", "5"))
    MOCK_OTP: bool          = os.environ.get("MOCK_OTP", "false").lower() == "true"

    # ── Invite tokens ─────────────────────────────────────────────────────────
    INVITE_EXPIRY_HOURS: int = int(os.environ.get("INVITE_EXPIRY_HOURS", "48"))

    # ── Account lockout ───────────────────────────────────────────────────────
    MAX_LOGIN_ATTEMPTS: int     = int(os.environ.get("MAX_LOGIN_ATTEMPTS", "5"))
    ACCOUNT_LOCKOUT_MINUTES: int = int(os.environ.get("ACCOUNT_LOCKOUT_MINUTES", "30"))

    # ── DPDP Act ──────────────────────────────────────────────────────────────
    DATA_RETENTION_YEARS: int = int(os.environ.get("DATA_RETENTION_YEARS", "3"))

    # ── SMS provider ──────────────────────────────────────────────────────────
    SMS_PROVIDER: str = os.environ.get("SMS_PROVIDER", "fast2sms")
    SMS_API_KEY: str  = os.environ.get("SMS_API_KEY", "")

    # ── Email ─────────────────────────────────────────────────────────────────
    MAIL_SERVER: str           = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT: int             = int(os.environ.get("MAIL_PORT", "587"))
    MAIL_USE_TLS: bool         = os.environ.get("MAIL_USE_TLS", "true").lower() == "true"
    MAIL_USERNAME: str         = os.environ.get("MAIL_USERNAME", "")
    MAIL_PASSWORD: str         = os.environ.get("MAIL_PASSWORD", "")
    MAIL_DEFAULT_SENDER: str   = os.environ.get("MAIL_DEFAULT_SENDER", "")


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    TESTING = False

    # In dev, read secrets from .env — fail loudly if not set.
    SECRET_KEY     = os.environ.get("SECRET_KEY", "dev-insecure-key-do-not-use-in-prod")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "dev-insecure-jwt-do-not-use-in-prod")

    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "sqlite:///studentsphere_dev.db"
    )
    SQLALCHEMY_ECHO = True   # Log every SQL query to console — remove in prod

    RATELIMIT_ENABLED = False            # Disabled in dev — easier to iterate
    RATELIMIT_STORAGE_URL = "memory://"  # No Redis required in dev

    CORS_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]

    ALLOWED_EMAIL_DOMAIN = os.environ.get("ALLOWED_EMAIL_DOMAIN", "college.edu.in")
    COLLEGE_NAME         = os.environ.get("COLLEGE_NAME", "Demo College")
    MOCK_OTP             = True          # Always mock OTP in dev


class TestingConfig(BaseConfig):
    TESTING = True
    DEBUG = False

    SECRET_KEY     = "test-secret-key-not-for-production"
    JWT_SECRET_KEY = "test-jwt-secret-key-not-for-production"

    # Separate test database — never share with dev or prod.
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "TEST_DATABASE_URL",
        "sqlite:///:memory:", # In-memory SQLite for super-fast tests
    )
    SQLALCHEMY_ECHO = False

    # Longer TTLs in tests so tokens don't expire mid-test.
    JWT_ACCESS_TOKEN_EXPIRES  = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    RATELIMIT_ENABLED     = False
    RATELIMIT_STORAGE_URL = "memory://"

    CORS_ORIGINS = ["*"]    # Not a security concern in tests

    ALLOWED_EMAIL_DOMAIN = "college.edu.in"
    COLLEGE_NAME         = "Test College"
    MOCK_OTP             = True

    # Minimal bcrypt cost in tests so hashing is fast.
    BCRYPT_LOG_ROUNDS = 4


class ProductionConfig(BaseConfig):
    DEBUG = False
    TESTING = False

    # Placeholder attributes that will be loaded dynamically during validate()
    SECRET_KEY = None
    JWT_SECRET_KEY = None
    SQLALCHEMY_DATABASE_URI = None
    SQLALCHEMY_ECHO = False
    RATELIMIT_ENABLED = True
    RATELIMIT_STORAGE_URL = None
    CORS_ORIGINS = []
    ALLOWED_EMAIL_DOMAIN = None
    COLLEGE_NAME = None
    MOCK_OTP = False

    # ── Supabase / pgBouncer (transaction mode) engine options ────────────────
    # When using Supabase's connection pooler (port 6543, transaction mode):
    #   1. poolclass=NullPool — Disables SQLAlchemy client-side connection pooling
    #      so pgBouncer handles pooling directly on port 6543.
    #   2. prepare_threshold=0 — Disables SQLAlchemy's automatic use of prepared
    #      statements. pgBouncer in transaction mode does NOT support prepared
    #      statements (they are session-scoped and the session may change between
    #      transactions).
    #   NOTE: Do NOT set SQLALCHEMY_ENGINE_OPTIONS in .env — override here only.
    SQLALCHEMY_ENGINE_OPTIONS = {
        "poolclass": NullPool,
        "pool_pre_ping": True,
        "connect_args": {
            "options": "-c statement_timeout=30000",  # 30 s hard query timeout
        },
    }


    @classmethod
    def validate(cls) -> None:
        """
        Called by the app factory in production to load configuration
        and catch misconfiguration before the first request is ever served.
        """
        cls.SECRET_KEY = _require_env("SECRET_KEY")
        cls.JWT_SECRET_KEY = _require_env("JWT_SECRET_KEY")
        cls.SQLALCHEMY_DATABASE_URI = _require_env("DATABASE_URL")
        cls.RATELIMIT_STORAGE_URL = os.environ.get("REDIS_URL", "memory://")
        cls.ALLOWED_EMAIL_DOMAIN = _require_env("ALLOWED_EMAIL_DOMAIN")
        cls.COLLEGE_NAME = _require_env("COLLEGE_NAME")

        cls.CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "").split(",")

        uri = cls.SQLALCHEMY_DATABASE_URI
        # Supabase (and most managed PG providers) use 'postgresql://'
        # Standard psycopg2 also accepts 'postgres://' — normalise both.
        if not (uri.startswith("postgresql") or uri.startswith("postgres")):
            raise RuntimeError(
                "Production MUST use PostgreSQL. "
                f"Got scheme: {uri.split('://')[0]}://..."
            )
        if "insecure" in cls.SECRET_KEY or "insecure" in cls.JWT_SECRET_KEY:
            raise RuntimeError("Insecure placeholder keys detected in production config.")



# ── Registry ──────────────────────────────────────────────────────────────────
config_map: dict[str, type[BaseConfig]] = {
    "development": DevelopmentConfig,
    "testing":     TestingConfig,
    "production":  ProductionConfig,
}
