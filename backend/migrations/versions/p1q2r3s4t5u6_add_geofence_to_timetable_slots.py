"""p1q2r3s4t5u6_add_geofence_to_timetable_slots.py
Revision ID: p1q2r3s4t5u6
Revises: o0p1q2r3s4t5
Create Date: 2026-08-23

Adds geofence coordinate columns to timetable_slots table:
  - latitude  FLOAT  (classroom center latitude)
  - longitude FLOAT  (classroom center longitude)  
  - radius_meters FLOAT  (geofence radius, default 50m)
"""

from alembic import op
import sqlalchemy as sa

revision = 'p1q2r3s4t5u6'
down_revision = 'o0p1q2r3s4t5'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('timetable_slots') as batch_op:
        batch_op.add_column(sa.Column('latitude', sa.Float(), nullable=True, server_default='25.4484'))
        batch_op.add_column(sa.Column('longitude', sa.Float(), nullable=True, server_default='81.8462'))
        batch_op.add_column(sa.Column('radius_meters', sa.Float(), nullable=True, server_default='50.0'))


def downgrade():
    with op.batch_alter_table('timetable_slots') as batch_op:
        batch_op.drop_column('radius_meters')
        batch_op.drop_column('longitude')
        batch_op.drop_column('latitude')
