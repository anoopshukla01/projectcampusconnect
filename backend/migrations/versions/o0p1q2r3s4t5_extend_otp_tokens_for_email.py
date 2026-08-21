"""extend otp_tokens for email: identifier length + college_id + index

Revision ID: o0p1q2r3s4t5
Revises: e7f8a9b0c1d2
Create Date: 2026-08-14 10:00:00.000000

Changes:
  1. ALTER COLUMN otp_tokens.identifier: String(20) → String(255)
     — Required to hold email addresses (up to 254 chars per RFC 5321).
  2. ADD COLUMN otp_tokens.college_id: UUID FK → colleges.id (nullable)
     — Multi-tenancy: email OTPs are scoped to a college to prevent
       a student from College A being verified against College B's OTP.
       NULL is allowed for existing phone-based OTPs (backward compat).
  3. CREATE INDEX ix_otp_tokens_lookup
     — Composite index on (identifier, college_id, purpose, is_used)
       for the hot lookup path in A1 + A2 endpoints.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'o0p1q2r3s4t5'
down_revision = 'n9o0p1q2r3s4'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Widen identifier column to support email addresses
    with op.batch_alter_table('otp_tokens', schema=None) as batch_op:
        batch_op.alter_column(
            'identifier',
            existing_type=sa.String(length=20),
            type_=sa.String(length=255),
            existing_nullable=False,
        )

    # 2. Add college_id for multi-tenant OTP scoping
    with op.batch_alter_table('otp_tokens', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('college_id', sa.UUID(), nullable=True)
        )
        batch_op.create_foreign_key(
            'fk_otp_tokens_college_id',
            'colleges',
            ['college_id'],
            ['id'],
            ondelete='CASCADE',
        )

    # 3. Composite lookup index
    op.create_index(
        'ix_otp_tokens_lookup',
        'otp_tokens',
        ['identifier', 'college_id', 'purpose', 'is_used'],
        unique=False,
    )


def downgrade():
    op.drop_index('ix_otp_tokens_lookup', table_name='otp_tokens')

    with op.batch_alter_table('otp_tokens', schema=None) as batch_op:
        batch_op.drop_constraint('fk_otp_tokens_college_id', type_='foreignkey')
        batch_op.drop_column('college_id')

    with op.batch_alter_table('otp_tokens', schema=None) as batch_op:
        batch_op.alter_column(
            'identifier',
            existing_type=sa.String(length=255),
            type_=sa.String(length=20),
            existing_nullable=False,
        )
