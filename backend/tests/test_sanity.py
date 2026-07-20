def test_health_check(client):
    """Verify that the health check endpoint returns 200 OK."""
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json == {"status": "ok", "service": "studentsphere-backend"}

def test_db_setup(db_session):
    """Verify that the database tables are successfully created and accessible."""
    from app.models.college import DEFAULT_COLLEGE_ID
    from app.models import User, UserRole
    # Try inserting a test user to ensure SQLAlchemy models are registered
    user = User(
        college_id=DEFAULT_COLLEGE_ID,
        email="test@college.edu.in",
        role=UserRole.ADMIN,
        is_active=True
    )
    user.set_password("admin123")
    db_session.add(user)
    db_session.commit()

    retrieved = db_session.query(User).filter_by(email="test@college.edu.in").first()
    assert retrieved is not None
    assert retrieved.role == UserRole.ADMIN
    assert retrieved.check_password("admin123")
