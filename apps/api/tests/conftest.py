"""
Pytest configuration and fixtures for Mira API tests.

This module provides shared fixtures for testing the Mira API:
- Test database setup with SQLite in-memory
- FastAPI test client
- Authentication fixtures (users, tokens)
- Workspace fixtures
- Member fixtures
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from mira_api.main import app
from mira_api.models import Base
from mira_api.database import get_db_dependency
from mira_api.auth_utils import create_access_token, hash_password
from mira_api.context import set_workspace_id, workspace_context
from mira_api.storage import utc_now


# Test database engine (in-memory SQLite)
@pytest.fixture(scope="function")
def test_db_engine():
    """Create a test database engine using in-memory SQLite."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # Use StaticPool for in-memory database
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture(scope="function")
def test_db(test_db_engine):
    """Create a test database session."""
    TestSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=test_db_engine
    )
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def client(test_db, test_workspace):
    """Create a test client with test database."""

    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db_dependency] = override_get_db

    # Also create the default workspace for unauthenticated requests
    from mira_api.models import Workspace
    default_ws = Workspace(
        id="ws_default",
        name="Default Workspace",
        slug="default",
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    test_db.add(default_ws)
    test_db.commit()

    with TestClient(app) as test_client:
        yield test_client

    # Clean up
    app.dependency_overrides.clear()
    workspace_context.set(None)


# Workspace fixtures
@pytest.fixture
def test_workspace(test_db):
    """Create a test workspace."""
    from mira_api.models import Workspace

    workspace = Workspace(
        id="ws_test",
        name="Test Workspace",
        slug="test-workspace",
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    test_db.add(workspace)
    test_db.commit()
    test_db.refresh(workspace)
    return workspace


# User fixtures
@pytest.fixture
def test_user(test_db, test_workspace, test_member):
    """Create a test user linked to test workspace and test member."""
    from mira_api.models import User, UserWorkspace, UserMember

    user = User(
        id="usr_test",
        email="test@example.com",
        password_hash=hash_password("testpass123"),
        is_active=True,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    test_db.add(user)

    # Link user to workspace
    user_workspace = UserWorkspace(
        id="uw_test",
        user_id=user.id,
        workspace_id=test_workspace.id,
        role="member",
        created_at=utc_now(),
    )
    test_db.add(user_workspace)

    # Link user to member (needed for login)
    user_member = UserMember(
        id="um_test",
        user_id=user.id,
        member_id=test_member.id,
        role="member",
        created_at=utc_now(),
    )
    test_db.add(user_member)

    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def test_admin_user(test_db, test_workspace):
    """Create a test admin user."""
    from mira_api.models import User, UserWorkspace

    user = User(
        id="usr_admin",
        email="admin@example.com",
        password_hash=hash_password("adminpass123"),
        is_active=True,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    test_db.add(user)

    # Link user to workspace as admin
    user_workspace = UserWorkspace(
        id="uw_admin",
        user_id=user.id,
        workspace_id=test_workspace.id,
        role="workspace_admin",
        created_at=utc_now(),
    )
    test_db.add(user_workspace)

    test_db.commit()
    test_db.refresh(user)
    return user


# Member fixtures
@pytest.fixture
def test_member(test_db, test_workspace):
    """Create a test member that works in all workspaces."""
    from mira_api.models import Member

    # Use workspace_id=None so this member is accessible from any workspace
    # This allows tests to work both with and without authentication
    member = Member(
        id="m_test",
        workspace_id=None,
        name="Test Member",
        role="Engineer",
        department="Engineering",
        is_manager=0,
        created_at=utc_now(),
    )
    test_db.add(member)
    test_db.commit()
    test_db.refresh(member)
    return member


@pytest.fixture
def test_manager(test_db, test_workspace):
    """Create a test manager in the test workspace."""
    from mira_api.models import Member

    member = Member(
        id="m_manager",
        workspace_id=test_workspace.id,
        name="Test Manager",
        role="Engineering Manager",
        department="Engineering",
        is_manager=1,
        created_at=utc_now(),
    )
    test_db.add(member)
    test_db.commit()
    test_db.refresh(member)
    return member


# User-Member link fixture (deprecated - test_user now creates this link automatically)
@pytest.fixture
def linked_user_member(test_db, test_user, test_member):
    """Link test user to test member - now redundant, returns existing link."""
    from mira_api.models import UserMember

    # The link already exists from test_user fixture, just return it
    user_member = test_db.query(UserMember).filter(
        UserMember.user_id == test_user.id,
        UserMember.member_id == test_member.id
    ).first()
    return user_member


# Authentication fixtures
@pytest.fixture
def auth_headers(test_user):
    """Generate authentication headers with access token."""
    access_token = create_access_token(test_user.id, test_user.email)
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def auth_cookies(test_user):
    """Generate authentication cookies with access token."""
    access_token = create_access_token(test_user.id, test_user.email)
    return {"mira_access_token": access_token}


@pytest.fixture
def admin_auth_cookies(test_admin_user):
    """Generate authentication cookies for admin user."""
    access_token = create_access_token(test_admin_user.id, test_admin_user.email)
    return {"mira_access_token": access_token}


# Todo fixtures
@pytest.fixture
def test_todo(test_db, test_member, test_workspace):
    """Create a test todo that works in all workspaces."""
    from mira_api.models import Todo

    # Use workspace_id=None so this todo is accessible from any workspace
    # This allows tests to work both with and without authentication
    todo = Todo(
        id="t_test",
        workspace_id=None,
        member_id=test_member.id,
        content="Test todo item",
        summary="Test summary",
        category="Development",
        priority="normal",
        done=0,
        week_key="2024-W20",
        created_at=utc_now(),
    )
    test_db.add(todo)
    test_db.commit()
    test_db.refresh(todo)
    return todo


# Weekly report fixtures
@pytest.fixture
def test_report(test_db, test_member, test_workspace):
    """Create a test weekly report that works in all workspaces."""
    from mira_api.models import WeeklyReport

    # Use workspace_id=None so this report is accessible from any workspace
    # This allows tests to work both with and without authentication
    report = WeeklyReport(
        id="wr_test",
        workspace_id=None,
        member_id=test_member.id,
        week_key="2024-W20",
        completed="Completed test task",
        in_progress="Working on test feature",
        next_week="Plan next test",
        risks="No risks",
        archived=0,
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    test_db.add(report)
    test_db.commit()
    test_db.refresh(report)
    return report


# Knowledge entry fixtures
@pytest.fixture
def test_knowledge_entry(test_db, test_member, test_workspace):
    """Create a test knowledge entry."""
    from mira_api.models import KnowledgeEntry

    entry = KnowledgeEntry(
        id="kb_test",
        workspace_id=test_workspace.id,
        member_id=test_member.id,
        report_id=None,
        week_key="2024-W20",
        text="Test knowledge content",
        source="completed",
        markdown_path=None,
        created_at=utc_now(),
    )
    test_db.add(entry)
    test_db.commit()
    test_db.refresh(entry)
    return entry


# Helper functions
@pytest.fixture
def create_member(test_db, test_workspace):
    """Factory fixture to create members."""

    def _create_member(
        name="New Member",
        role="Engineer",
        department="Engineering",
        is_manager=0,
    ):
        from mira_api.models import Member
        import uuid

        member = Member(
            id=f"m_{uuid.uuid4().hex[:10]}",
            workspace_id=test_workspace.id,
            name=name,
            role=role,
            department=department,
            is_manager=is_manager,
            created_at=utc_now(),
        )
        test_db.add(member)
        test_db.commit()
        test_db.refresh(member)
        return member

    return _create_member


@pytest.fixture
def create_todo(test_db, test_workspace):
    """Factory fixture to create todos."""

    def _create_todo(
        member_id,
        content="Test todo",
        category="Other",
        priority="normal",
        done=0,
    ):
        from mira_api.models import Todo
        import uuid

        todo = Todo(
            id=f"t_{uuid.uuid4().hex[:10]}",
            workspace_id=test_workspace.id,
            member_id=member_id,
            content=content,
            category=category,
            priority=priority,
            done=done,
            week_key="2024-W20",
            created_at=utc_now(),
        )
        test_db.add(todo)
        test_db.commit()
        test_db.refresh(todo)
        return todo

    return _create_todo
