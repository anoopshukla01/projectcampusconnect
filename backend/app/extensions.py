"""
StudentSphere Backend — Application Extensions
All Flask extension instances are created here (without an app object)
and initialised via their init_app() in the factory.

WHY: Avoids circular imports. Every other module imports from here,
never directly from Flask.
"""

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_cors import CORS

# ORM — all models are registered against this instance.
db = SQLAlchemy()

# Alembic migration runner.
migrate = Migrate()

# JWT access + refresh token management.
jwt = JWTManager()

# Rate limiter. Key defaults to remote IP; overridden per-endpoint when needed.
limiter = Limiter(key_func=get_remote_address)

# CORS — origins are restricted in config, not here.
cors = CORS()
