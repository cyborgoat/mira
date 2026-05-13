"""baseline_schema_with_auth_tables

Revision ID: e5ccce4cd5a2
Revises: 
Create Date: 2026-05-13 11:41:08.774738

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5ccce4cd5a2'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add auth tables only."""
    # Create auth tables
    op.create_table('users',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('email', sa.String(), nullable=False),
    sa.Column('password_hash', sa.String(), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.String(), nullable=False),
    sa.Column('updated_at', sa.String(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    op.create_index('idx_users_email', 'users', ['email'], unique=False)

    op.create_table('refresh_tokens',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('user_id', sa.String(), nullable=False),
    sa.Column('token_hash', sa.String(), nullable=False),
    sa.Column('expires_at', sa.String(), nullable=False),
    sa.Column('revoked', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.String(), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    op.create_index('idx_refresh_tokens_user', 'refresh_tokens', ['user_id', 'expires_at'], unique=False)

    op.create_table('user_members',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('user_id', sa.String(), nullable=False),
    sa.Column('member_id', sa.String(), nullable=False),
    sa.Column('role', sa.String(), nullable=True),
    sa.Column('created_at', sa.String(), nullable=False),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_user_members_member', 'user_members', ['member_id'], unique=False)
    op.create_index('idx_user_members_user', 'user_members', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema - Remove auth tables only."""
    # Drop auth tables
    op.drop_index('idx_user_members_user', table_name='user_members')
    op.drop_index('idx_user_members_member', table_name='user_members')
    op.drop_table('user_members')
    op.drop_index('idx_refresh_tokens_user', table_name='refresh_tokens')
    op.drop_table('refresh_tokens')
    op.drop_index('idx_users_email', table_name='users')
    op.drop_table('users')
