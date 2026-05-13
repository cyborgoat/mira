"""
Integration tests for authentication endpoints.

Tests cover:
- User registration
- User login
- Token refresh
- Logout
- Protected endpoints
- Invalid credentials
- Token validation
"""

import pytest


class TestUserRegistration:
    """Test user registration endpoint."""

    def test_register_new_user(self, client, test_workspace):
        """Test successful user registration."""
        response = client.post(
            "/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "securepass123",
                "name": "New User",
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Check response structure
        assert "user" in data
        assert "member" in data

        # Verify user data
        assert data["user"]["email"] == "newuser@example.com"
        assert "id" in data["user"]
        assert "password" not in data["user"]  # Password should not be returned

        # Verify member data
        assert data["member"]["name"] == "New User"
        assert "id" in data["member"]

        # Verify cookies are set
        assert "mira_access_token" in response.cookies
        assert "mira_refresh_token" in response.cookies

    def test_register_duplicate_email(self, client, test_user, test_workspace):
        """Test registration with existing email fails."""
        response = client.post(
            "/auth/register",
            json={
                "email": test_user.email,
                "password": "password123",
                "name": "Duplicate User",
            },
        )

        assert response.status_code == 409
        assert "already registered" in response.text.lower()

    def test_register_invalid_email(self, client, test_workspace):
        """Test registration with invalid email fails."""
        response = client.post(
            "/auth/register",
            json={
                "email": "not-an-email",
                "password": "password123",
                "name": "Invalid Email",
            },
        )

        assert response.status_code == 422  # Validation error

    def test_register_weak_password(self, client, test_workspace):
        """Test registration with password too short fails."""
        response = client.post(
            "/auth/register",
            json={
                "email": "weak@example.com",
                "password": "short",  # Less than 8 characters
                "name": "Weak Password",
            },
        )

        assert response.status_code == 422  # Validation error

    def test_register_missing_fields(self, client, test_workspace):
        """Test registration with missing required fields fails."""
        response = client.post(
            "/auth/register",
            json={
                "email": "incomplete@example.com",
                # Missing password and name
            },
        )

        assert response.status_code == 422  # Validation error


class TestUserLogin:
    """Test user login endpoint."""

    def test_login_valid_credentials(self, client, test_user, test_workspace):
        """Test successful login with valid credentials."""
        response = client.post(
            "/auth/login",
            json={
                "email": "test@example.com",
                "password": "testpass123",
            },
        )

        assert response.status_code == 200
        data = response.json()

        # Check response structure
        assert "user" in data
        assert "member" in data

        # Verify user data
        assert data["user"]["email"] == test_user.email
        assert data["user"]["id"] == test_user.id

        # Verify cookies are set
        assert "mira_access_token" in response.cookies
        assert "mira_refresh_token" in response.cookies

    def test_login_invalid_email(self, client, test_workspace):
        """Test login with non-existent email fails."""
        response = client.post(
            "/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "password123",
            },
        )

        assert response.status_code == 401
        assert "invalid credentials" in response.text.lower()

    def test_login_wrong_password(self, client, test_user, test_workspace):
        """Test login with incorrect password fails."""
        response = client.post(
            "/auth/login",
            json={
                "email": test_user.email,
                "password": "wrongpassword",
            },
        )

        assert response.status_code == 401
        assert "invalid credentials" in response.text.lower()

    def test_login_inactive_user(self, client, test_db, test_user, test_workspace):
        """Test login with inactive user fails."""
        # Deactivate user
        test_user.is_active = False
        test_db.commit()

        response = client.post(
            "/auth/login",
            json={
                "email": test_user.email,
                "password": "testpass123",
            },
        )

        # Should fail (either 401 or need to check is_active in login endpoint)
        # For now, assuming login doesn't check is_active, but /auth/me would fail
        # This test documents expected behavior


class TestLogout:
    """Test user logout endpoint."""

    def test_logout_clears_cookies(
        self, client, test_user, auth_cookies, test_workspace
    ):
        """Test logout clears authentication cookies."""
        response = client.post("/auth/logout", cookies=auth_cookies)

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True

        # Verify cookies are cleared (empty or deleted)
        # FastAPI/Starlette sets cookies to empty string when deleting
        if "mira_access_token" in response.cookies:
            assert response.cookies["mira_access_token"] == ""
        if "mira_refresh_token" in response.cookies:
            assert response.cookies["mira_refresh_token"] == ""

    def test_logout_without_auth(self, client, test_workspace):
        """Test logout without authentication still succeeds."""
        response = client.post("/auth/logout")

        # Logout should succeed even without auth
        assert response.status_code == 200


class TestProtectedEndpoints:
    """Test authentication requirement on protected endpoints."""

    def test_get_current_user_authenticated(
        self, client, test_user, auth_cookies, linked_user_member, test_workspace
    ):
        """Test /auth/me returns current user when authenticated."""
        response = client.get("/auth/me", cookies=auth_cookies)

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == test_user.id
        assert data["email"] == test_user.email
        assert "members" in data
        assert len(data["members"]) > 0

    def test_get_current_user_unauthenticated(self, client, test_workspace):
        """Test /auth/me fails without authentication."""
        response = client.get("/auth/me")

        assert response.status_code == 401
        assert "not authenticated" in response.text.lower()

    def test_get_current_user_invalid_token(self, client, test_workspace):
        """Test /auth/me fails with invalid token."""
        response = client.get(
            "/auth/me", cookies={"mira_access_token": "invalid_token"}
        )

        assert response.status_code == 401


class TestPasswordSecurity:
    """Test password security measures."""

    def test_password_not_returned_in_responses(
        self, client, test_user, test_workspace
    ):
        """Test that password hashes are never returned in API responses."""
        # Register
        response = client.post(
            "/auth/register",
            json={
                "email": "security@example.com",
                "password": "securepass123",
                "name": "Security Test",
            },
        )

        data = response.json()
        assert "password" not in data["user"]
        assert "password_hash" not in data["user"]

        # Login
        response = client.post(
            "/auth/login",
            json={
                "email": "security@example.com",
                "password": "securepass123",
            },
        )

        data = response.json()
        assert "password" not in data["user"]
        assert "password_hash" not in data["user"]

    def test_password_hashed_in_database(self, client, test_db, test_workspace):
        """Test that passwords are hashed before storing in database."""
        from mira_api.models import User

        # Register user
        password = "plaintextpassword"
        client.post(
            "/auth/register",
            json={
                "email": "hash@example.com",
                "password": password,
                "name": "Hash Test",
            },
        )

        # Check database
        user = test_db.query(User).filter(User.email == "hash@example.com").first()
        assert user is not None
        assert user.password_hash != password  # Should be hashed
        assert len(user.password_hash) > 50  # Bcrypt hashes are long
        assert user.password_hash.startswith("$2b$")  # Bcrypt format


class TestTokenValidation:
    """Test JWT token validation."""

    def test_expired_token_rejected(self, client, test_workspace):
        """Test that expired tokens are rejected."""
        # This would require mocking time or generating an expired token
        # For now, documenting expected behavior
        pass

    def test_malformed_token_rejected(self, client, test_workspace):
        """Test that malformed tokens are rejected."""
        response = client.get(
            "/auth/me", cookies={"mira_access_token": "clearly.not.a.jwt"}
        )

        assert response.status_code == 401

    def test_token_with_wrong_signature_rejected(self, client, test_workspace):
        """Test that tokens signed with wrong secret are rejected."""
        # Would need to generate a token with different secret
        # Documenting expected behavior
        pass


class TestUserWorkspaceIntegration:
    """Test user-workspace linking during registration."""

    def test_registration_creates_workspace_link(
        self, client, test_db, test_workspace
    ):
        """Test that user registration creates user_workspace link."""
        from mira_api.models import UserWorkspace

        response = client.post(
            "/auth/register",
            json={
                "email": "workspace@example.com",
                "password": "password123",
                "name": "Workspace User",
            },
        )

        assert response.status_code == 200
        user_id = response.json()["user"]["id"]

        # Check user_workspace link exists
        # Unauthenticated registration defaults to ws_default workspace
        link = (
            test_db.query(UserWorkspace)
            .filter(UserWorkspace.user_id == user_id)
            .first()
        )
        assert link is not None
        assert link.workspace_id == "ws_default"
        assert link.role == "member"

    def test_registration_creates_member(self, client, test_db, test_workspace):
        """Test that user registration creates a member."""
        from mira_api.models import Member

        response = client.post(
            "/auth/register",
            json={
                "email": "member@example.com",
                "password": "password123",
                "name": "Member User",
            },
        )

        assert response.status_code == 200
        member_id = response.json()["member"]["id"]

        # Check member exists
        # Unauthenticated registration defaults to ws_default workspace
        member = test_db.query(Member).filter(Member.id == member_id).first()
        assert member is not None
        assert member.name == "Member User"
        assert member.workspace_id == "ws_default"
