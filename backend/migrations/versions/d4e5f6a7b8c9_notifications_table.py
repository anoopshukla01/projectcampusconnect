"""notifications_table

Create notifications table.
Idempotent — only creates if it doesn't already exist.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-08 03:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def _table_exists(name):
    bind = op.get_bind()
    result = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_name=:t AND table_schema='public'"
    ), {"t": name})
    return result.fetchone() is not None


def _idx_exists(idx):
    bind = op.get_bind()
    result = bind.execute(sa.text(
        "SELECT 1 FROM pg_indexes WHERE indexname=:i"
    ), {"i": idx})
    return result.fetchone() is not None


def upgrade():
    if not _table_exists('notifications'):
        op.create_table('notifications',
            sa.Column('id',         sa.UUID(),      nullable=False),
            sa.Column('user_id',    sa.UUID(),      nullable=False),
            sa.Column('title',      sa.String(255), nullable=False),
            sa.Column('body',       sa.Text(),      nullable=True),
            sa.Column('notif_type', sa.String(50),  nullable=False,
                      server_default='general'),
            sa.Column('link',       sa.String(500), nullable=True),
            sa.Column('is_read',    sa.Boolean(),   nullable=False,
                      server_default=sa.text('false')),
            sa.Column('created_at', sa.DateTime(),  nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )

    if not _idx_exists('ix_notifications_user_id_is_read'):
        op.create_index('ix_notifications_user_id_is_read',
                        'notifications', ['user_id', 'is_read'])

    if not _idx_exists('ix_notifications_created_at'):
        op.create_index('ix_notifications_created_at',
                        'notifications', ['created_at'])


def downgrade():
    try:
        op.drop_index('ix_notifications_created_at',
                      table_name='notifications')
    except Exception:
        pass
    try:
        op.drop_index('ix_notifications_user_id_is_read',
                      table_name='notifications')
    except Exception:
        pass
    try:
        op.drop_table('notifications')
    except Exception:
        pass
