"""add_workspaces_and_isolation

Revision ID: 831be18c80c6
Revises: e5ccce4cd5a2
Create Date: 2026-05-13 15:40:51.736056

"""
from typing import Sequence, Union
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '831be18c80c6'
down_revision: Union[str, Sequence[str], None] = 'e5ccce4cd5a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - add workspace isolation."""

    # 1. Create workspaces table
    op.create_table('workspaces',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.Column('updated_at', sa.String(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug')
    )

    # 2. Create default workspace
    now = datetime.now(timezone.utc).isoformat()
    op.execute(f"""
        INSERT INTO workspaces (id, name, slug, created_at, updated_at)
        VALUES ('ws_default', 'Default Workspace', 'default', '{now}', '{now}')
    """)

    # 3. Create audit_logs table
    op.create_table('audit_logs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('entity_type', sa.String(), nullable=False),
        sa.Column('entity_id', sa.String(), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_audit_logs_user', 'audit_logs', ['user_id', 'created_at'], unique=False)
    op.create_index('idx_audit_logs_workspace', 'audit_logs', ['workspace_id', 'created_at'], unique=False)

    # 4. Create user_workspaces table
    op.create_table('user_workspaces',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('role', sa.String(), nullable=True),
        sa.Column('created_at', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_user_workspaces_user', 'user_workspaces', ['user_id'], unique=False)
    op.create_index('idx_user_workspaces_workspace', 'user_workspaces', ['workspace_id'], unique=False)

    # 5. Link existing users to default workspace
    op.execute(f"""
        INSERT INTO user_workspaces (id, user_id, workspace_id, role, created_at)
        SELECT
            'uw_' || substr(lower(hex(randomblob(5))), 1, 10),
            id,
            'ws_default',
            'member',
            '{now}'
        FROM users
    """)

    # 6. Add workspace_id columns to all data tables
    op.add_column('members', sa.Column('workspace_id', sa.String(), nullable=True))
    op.add_column('todos', sa.Column('workspace_id', sa.String(), nullable=True))
    op.add_column('weekly_reports', sa.Column('workspace_id', sa.String(), nullable=True))
    op.add_column('knowledge_entries', sa.Column('workspace_id', sa.String(), nullable=True))
    op.add_column('tags', sa.Column('workspace_id', sa.String(), nullable=True))
    op.add_column('achievement_events', sa.Column('workspace_id', sa.String(), nullable=True))
    op.add_column('team_summaries', sa.Column('workspace_id', sa.String(), nullable=True))
    op.add_column('import_batches', sa.Column('workspace_id', sa.String(), nullable=True))

    # 7. Backfill existing data with default workspace
    op.execute("UPDATE members SET workspace_id = 'ws_default' WHERE workspace_id IS NULL")
    op.execute("UPDATE todos SET workspace_id = 'ws_default' WHERE workspace_id IS NULL")
    op.execute("UPDATE weekly_reports SET workspace_id = 'ws_default' WHERE workspace_id IS NULL")
    op.execute("UPDATE knowledge_entries SET workspace_id = 'ws_default' WHERE workspace_id IS NULL")
    op.execute("UPDATE tags SET workspace_id = 'ws_default' WHERE workspace_id IS NULL")
    op.execute("UPDATE achievement_events SET workspace_id = 'ws_default' WHERE workspace_id IS NULL")
    op.execute("UPDATE team_summaries SET workspace_id = 'ws_default' WHERE workspace_id IS NULL")
    op.execute("UPDATE import_batches SET workspace_id = 'ws_default' WHERE workspace_id IS NULL")

    # 8. Create indexes for workspace_id columns
    op.create_index('idx_members_workspace', 'members', ['workspace_id'], unique=False)
    op.create_index('idx_todos_workspace', 'todos', ['workspace_id'], unique=False)
    op.create_index('idx_reports_workspace', 'weekly_reports', ['workspace_id'], unique=False)
    op.create_index('idx_kb_workspace', 'knowledge_entries', ['workspace_id'], unique=False)
    op.create_index('idx_tags_workspace', 'tags', ['workspace_id'], unique=False)
    op.create_index('idx_achievements_workspace', 'achievement_events', ['workspace_id'], unique=False)
    op.create_index('idx_team_summaries_workspace', 'team_summaries', ['workspace_id'], unique=False)
    op.create_index('idx_import_batches_workspace', 'import_batches', ['workspace_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema - remove workspace isolation."""

    # Drop indexes
    op.drop_index('idx_import_batches_workspace', table_name='import_batches')
    op.drop_index('idx_team_summaries_workspace', table_name='team_summaries')
    op.drop_index('idx_achievements_workspace', table_name='achievement_events')
    op.drop_index('idx_tags_workspace', table_name='tags')
    op.drop_index('idx_kb_workspace', table_name='knowledge_entries')
    op.drop_index('idx_reports_workspace', table_name='weekly_reports')
    op.drop_index('idx_todos_workspace', table_name='todos')
    op.drop_index('idx_members_workspace', table_name='members')

    # Drop workspace_id columns
    op.drop_column('import_batches', 'workspace_id')
    op.drop_column('team_summaries', 'workspace_id')
    op.drop_column('achievement_events', 'workspace_id')
    op.drop_column('tags', 'workspace_id')
    op.drop_column('knowledge_entries', 'workspace_id')
    op.drop_column('weekly_reports', 'workspace_id')
    op.drop_column('todos', 'workspace_id')
    op.drop_column('members', 'workspace_id')

    # Drop user_workspaces table
    op.drop_index('idx_user_workspaces_workspace', table_name='user_workspaces')
    op.drop_index('idx_user_workspaces_user', table_name='user_workspaces')
    op.drop_table('user_workspaces')

    # Drop audit_logs table
    op.drop_index('idx_audit_logs_workspace', table_name='audit_logs')
    op.drop_index('idx_audit_logs_user', table_name='audit_logs')
    op.drop_table('audit_logs')

    # Drop workspaces table
    op.drop_table('workspaces')
