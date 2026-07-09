"""content_models

Create mentor_profiles, mentorship_requests, mock_interview_sessions,
mock_interview_bookings, lecture_recordings, syllabus_progress tables.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-08 02:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('mentor_profiles',
        sa.Column('id',             sa.UUID(),          nullable=False),
        sa.Column('user_id',        sa.UUID(),          nullable=True),
        sa.Column('name',           sa.String(255),     nullable=False),
        sa.Column('role_title',     sa.String(255),     nullable=False),
        sa.Column('expertise',      sa.String(500),     nullable=True),
        sa.Column('rating',         sa.Numeric(3, 1),   nullable=True),
        sa.Column('sessions_count', sa.Integer(),       nullable=False, server_default='0'),
        sa.Column('is_available',   sa.Boolean(),       nullable=False, server_default=sa.text('true')),
        sa.Column('is_active',      sa.Boolean(),       nullable=False, server_default=sa.text('true')),
        sa.Column('created_at',     sa.DateTime(),      nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('mentorship_requests',
        sa.Column('id',         sa.UUID(),      nullable=False),
        sa.Column('mentor_id',  sa.UUID(),      nullable=False),
        sa.Column('student_id', sa.UUID(),      nullable=False),
        sa.Column('topic',      sa.String(255), nullable=False),
        sa.Column('message',    sa.Text(),      nullable=True),
        sa.Column('status',     sa.Enum('PENDING','ACCEPTED','DECLINED','COMPLETED',
                                         name='mentorshiprequeststatus'), nullable=False,
                  server_default='PENDING'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['mentor_id'],  ['mentor_profiles.id']),
        sa.ForeignKeyConstraint(['student_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('mock_interview_sessions',
        sa.Column('id',               sa.UUID(),      nullable=False),
        sa.Column('session_type',     sa.String(100), nullable=False),
        sa.Column('company_style',    sa.String(100), nullable=True),
        sa.Column('difficulty',       sa.String(20),  nullable=True),
        sa.Column('duration_minutes', sa.Integer(),   nullable=True),
        sa.Column('scheduled_at',     sa.DateTime(),  nullable=True),
        sa.Column('capacity',         sa.Integer(),   nullable=True),
        sa.Column('is_active',        sa.Boolean(),   nullable=False, server_default=sa.text('true')),
        sa.Column('created_at',       sa.DateTime(),  nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('mock_interview_bookings',
        sa.Column('id',         sa.UUID(),     nullable=False),
        sa.Column('session_id', sa.UUID(),     nullable=False),
        sa.Column('student_id', sa.UUID(),     nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['session_id'], ['mock_interview_sessions.id']),
        sa.ForeignKeyConstraint(['student_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('session_id', 'student_id', name='uq_booking_session_student'),
    )

    op.create_table('lecture_recordings',
        sa.Column('id',             sa.UUID(),       nullable=False),
        sa.Column('title',          sa.String(255),  nullable=False),
        sa.Column('subject',        sa.String(255),  nullable=False),
        sa.Column('course_code',    sa.String(50),   nullable=True),
        sa.Column('professor_name', sa.String(255),  nullable=False),
        sa.Column('uploaded_by_id', sa.UUID(),       nullable=True),
        sa.Column('branch',         sa.String(50),   nullable=True),
        sa.Column('video_url',      sa.String(1000), nullable=True),
        sa.Column('duration',       sa.String(20),   nullable=True),
        sa.Column('created_at',     sa.DateTime(),   nullable=True),
        sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table('syllabus_progress',
        sa.Column('id',           sa.UUID(),      nullable=False),
        sa.Column('subject',      sa.String(255), nullable=False),
        sa.Column('course_code',  sa.String(50),  nullable=False),
        sa.Column('module_info',  sa.String(255), nullable=True),
        sa.Column('progress_pct', sa.Integer(),   nullable=False, server_default='0'),
        sa.Column('branch',       sa.String(50),  nullable=True),
        sa.Column('professor_id', sa.UUID(),      nullable=True),
        sa.Column('updated_at',   sa.DateTime(),  nullable=True),
        sa.ForeignKeyConstraint(['professor_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('syllabus_progress')
    op.drop_table('lecture_recordings')
    op.drop_table('mock_interview_bookings')
    op.drop_table('mock_interview_sessions')
    op.drop_table('mentorship_requests')
    op.drop_table('mentor_profiles')
    op.execute("DROP TYPE IF EXISTS mentorshiprequeststatus")
