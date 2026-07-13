"""add event columns

Revision ID: e7f8a9b0c1d2
Revises: dbcb9dee9e8a
Create Date: 2026-07-13 12:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7f8a9b0c1d2'
down_revision = 'dbcb9dee9e8a'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('campus_events', sa.Column('created_by_id', sa.UUID(), nullable=True))
    op.add_column('campus_events', sa.Column('class_branch', sa.String(length=50), nullable=True))
    op.add_column('campus_events', sa.Column('class_course_code', sa.String(length=50), nullable=True))
    op.add_column('campus_events', sa.Column('approval_status', sa.String(length=20), nullable=False, server_default='live'))
    op.add_column('campus_events', sa.Column('approved_by_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_campus_events_created_by', 'campus_events', 'users', ['created_by_id'], ['id'])
    op.create_foreign_key('fk_campus_events_approved_by', 'campus_events', 'users', ['approved_by_id'], ['id'])


def downgrade():
    op.drop_constraint('fk_campus_events_approved_by', 'campus_events', type_='foreignkey')
    op.drop_constraint('fk_campus_events_created_by', 'campus_events', type_='foreignkey')
    op.drop_column('campus_events', 'approved_by_id')
    op.drop_column('campus_events', 'approval_status')
    op.drop_column('campus_events', 'class_course_code')
    op.drop_column('campus_events', 'class_branch')
    op.drop_column('campus_events', 'created_by_id')
