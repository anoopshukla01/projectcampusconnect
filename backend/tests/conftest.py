"""
StudentSphere Backend — Pytest Configuration

Strategy:
  - session-scoped app: Flask app created once per test session
  - function-scoped db: tables created and dropped for each test function
    (create_all / drop_all is essentially instant on in-memory SQLite)
  - This gives us perfect test isolation with no shared state

Usage in tests:
    def test_something(client, db_session):
        user = User(...)
        db_session.add(user)
        db_session.commit()
        resp = client.post("/api/v1/auth/login", json={...})
        assert resp.status_code == 200
"""

import pytest
from app import create_app
from app.extensions import db as _db


@pytest.fixture(scope="session")
def app():
    """Session-wide Flask application in testing config."""
    application = create_app("testing")
    # Push a permanent app context for the entire session so that
    # Flask-SQLAlchemy can find the app without explicit with-blocks.
    ctx = application.app_context()
    ctx.push()
    yield application
    ctx.pop()


@pytest.fixture(autouse=True)
def db_session(app):
    """
    Per-test: create all tables → yield the session → drop all tables.
    Isolation is achieved by dropping and recreating the schema between tests,
    not by rollback. This is safe and reliable on SQLite.
    """
    _db.create_all()
    yield _db.session
    _db.session.remove()
    _db.drop_all()


@pytest.fixture
def client(app):
    """Flask test client — uses the session-wide app."""
    return app.test_client()

