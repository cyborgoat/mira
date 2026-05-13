"""
Integration tests for todo endpoints.

Tests cover:
- Creating todos
- Listing todos
- Updating todos
- Marking todos as done
- Deleting todos
- Workspace isolation
- Member validation
"""

import pytest


class TestCreateTodo:
    """Test POST /todos endpoint."""

    def test_create_todo_success(self, client, test_member, test_workspace):
        """Test successfully creating a new todo."""
        response = client.post(
            "/todos",
            json={
                "member_id": test_member.id,
                "content": "New task to complete",
                "summary": "Task summary",
                "category": "Development",
                "priority": "high",
                "week_key": "2024-W20",
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert "id" in data
        assert data["member_id"] == test_member.id
        assert data["content"] == "New task to complete"
        assert data["summary"] == "Task summary"
        assert data["category"] == "Development"
        assert data["priority"] == "high"
        assert data["done"] == 0
        assert data["week_key"] == "2024-W20"

    def test_create_todo_minimal(self, client, test_member, test_workspace):
        """Test creating todo with minimal required fields."""
        response = client.post(
            "/todos",
            json={
                "member_id": test_member.id,
                "content": "Minimal todo",
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["content"] == "Minimal todo"
        assert "id" in data
        # Should have defaults
        assert data["category"] is not None
        assert data["priority"] is not None

    def test_create_todo_invalid_member(self, client, test_workspace):
        """Test creating todo with non-existent member fails."""
        response = client.post(
            "/todos",
            json={
                "member_id": "m_nonexistent",
                "content": "Invalid member todo",
            },
        )

        assert response.status_code == 404
        assert "member not found" in response.text.lower()

    def test_create_todo_missing_content(self, client, test_member, test_workspace):
        """Test creating todo without content fails."""
        response = client.post(
            "/todos",
            json={
                "member_id": test_member.id,
                # Missing content
            },
        )

        assert response.status_code == 422  # Validation error

    def test_create_todo_workspace_isolation(
        self, client, test_db, test_member, test_workspace
    ):
        """Test that created todos are scoped to current workspace."""
        from mira_api.models import Todo

        response = client.post(
            "/todos",
            json={
                "member_id": test_member.id,
                "content": "Workspace todo",
            },
        )

        assert response.status_code == 200
        todo_id = response.json()["id"]

        # Verify workspace_id in database
        # Unauthenticated requests default to ws_default workspace
        todo = test_db.query(Todo).filter(Todo.id == todo_id).first()
        assert todo.workspace_id == "ws_default"


class TestListTodos:
    """Test GET /state endpoint (includes todos)."""

    def test_list_todos_in_state(
        self, client, test_member, test_todo, test_workspace
    ):
        """Test that todos are included in /state response."""
        response = client.get("/state")

        assert response.status_code == 200
        data = response.json()

        assert "todos" in data
        assert isinstance(data["todos"], list)
        assert len(data["todos"]) > 0

        # Find our test todo
        test_todo_data = next((t for t in data["todos"] if t["id"] == test_todo.id), None)
        assert test_todo_data is not None
        assert test_todo_data["content"] == test_todo.content

    def test_list_todos_workspace_filtered(
        self, client, test_db, test_member, test_workspace, create_todo
    ):
        """Test that only todos from current workspace are returned."""
        from mira_api.models import Todo, Workspace
        from mira_api.storage import utc_now

        # Create another workspace
        other_workspace = Workspace(
            id="ws_other",
            name="Other Workspace",
            slug="other",
            created_at=utc_now(),
            updated_at=utc_now(),
        )
        test_db.add(other_workspace)
        test_db.commit()

        # Create todo in current workspace (ws_default for unauthenticated requests)
        current_todo = Todo(
            id="t_current",
            workspace_id="ws_default",
            member_id=test_member.id,
            content="Current workspace todo",
            category="Other",
            priority="normal",
            done=0,
            week_key="2024-W20",
            created_at=utc_now(),
        )
        test_db.add(current_todo)

        # Create todo in other workspace directly in DB
        other_todo = Todo(
            id="t_other",
            workspace_id="ws_other",
            member_id=test_member.id,
            content="Other workspace todo",
            category="Other",
            priority="normal",
            done=0,
            week_key="2024-W20",
            created_at=utc_now(),
        )
        test_db.add(other_todo)
        test_db.commit()

        # Get state (should only return current workspace todos)
        response = client.get("/state")
        data = response.json()

        todo_ids = [t["id"] for t in data["todos"]]
        assert current_todo.id in todo_ids
        assert other_todo.id not in todo_ids  # Should be filtered out


class TestUpdateTodo:
    """Test PATCH /todos/{id} endpoint."""

    def test_update_todo_success(self, client, test_todo, test_workspace):
        """Test successfully updating a todo."""
        response = client.patch(
            f"/todos/{test_todo.id}",
            json={
                "content": "Updated content",
                "priority": "urgent",
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == test_todo.id
        assert data["content"] == "Updated content"
        assert data["priority"] == "urgent"

    def test_update_todo_mark_done(self, client, test_todo, test_workspace):
        """Test marking a todo as done."""
        response = client.patch(
            f"/todos/{test_todo.id}",
            json={"done": 1},
        )

        assert response.status_code == 200
        data = response.json()

        assert data["done"] == 1
        assert "finished_at" in data
        # finished_at should be set when done=1

    def test_update_todo_nonexistent(self, client, test_workspace):
        """Test updating non-existent todo fails."""
        response = client.patch(
            "/todos/t_nonexistent",
            json={"content": "Updated"},
        )

        assert response.status_code == 404

    def test_update_todo_partial(self, client, test_todo, test_workspace):
        """Test partial update (only some fields)."""
        original_content = test_todo.content

        response = client.patch(
            f"/todos/{test_todo.id}",
            json={"priority": "low"},  # Only update priority
        )

        assert response.status_code == 200
        data = response.json()

        assert data["priority"] == "low"
        assert data["content"] == original_content  # Should be unchanged


class TestDeleteTodo:
    """Test DELETE /todos/{id} endpoint."""

    def test_delete_todo_success(self, client, test_db, test_todo, test_workspace):
        """Test successfully deleting a todo."""
        from mira_api.models import Todo

        response = client.delete(f"/todos/{test_todo.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True

        # Verify deleted from database
        deleted_todo = test_db.query(Todo).filter(Todo.id == test_todo.id).first()
        assert deleted_todo is None

    def test_delete_todo_nonexistent(self, client, test_workspace):
        """Test deleting non-existent todo fails."""
        response = client.delete("/todos/t_nonexistent")

        assert response.status_code == 404


class TestTodoCRUDFlow:
    """Test complete CRUD flow for todos."""

    def test_full_todo_lifecycle(self, client, test_member, test_db, test_workspace):
        """Test create -> read -> update -> delete flow."""
        from mira_api.models import Todo

        # 1. Create
        create_response = client.post(
            "/todos",
            json={
                "member_id": test_member.id,
                "content": "Lifecycle test todo",
                "category": "Testing",
            },
        )
        assert create_response.status_code == 200
        todo_id = create_response.json()["id"]

        # 2. Read (via /state)
        state_response = client.get("/state")
        assert state_response.status_code == 200
        todos = state_response.json()["todos"]
        created_todo = next((t for t in todos if t["id"] == todo_id), None)
        assert created_todo is not None
        assert created_todo["content"] == "Lifecycle test todo"
        assert created_todo["done"] == 0

        # 3. Update
        update_response = client.patch(
            f"/todos/{todo_id}",
            json={
                "content": "Updated lifecycle todo",
                "done": 1,
            },
        )
        assert update_response.status_code == 200
        assert update_response.json()["content"] == "Updated lifecycle todo"
        assert update_response.json()["done"] == 1

        # 4. Delete
        delete_response = client.delete(f"/todos/{todo_id}")
        assert delete_response.status_code == 200

        # 5. Verify deletion
        deleted = test_db.query(Todo).filter(Todo.id == todo_id).first()
        assert deleted is None


class TestTodoPriorities:
    """Test todo priority handling."""

    def test_create_todo_with_priorities(
        self, client, test_member, test_workspace, create_todo
    ):
        """Test creating todos with different priorities."""
        priorities = ["low", "normal", "high", "urgent"]

        for priority in priorities:
            response = client.post(
                "/todos",
                json={
                    "member_id": test_member.id,
                    "content": f"{priority} priority todo",
                    "priority": priority,
                },
            )

            assert response.status_code == 200
            assert response.json()["priority"] == priority


class TestTodoCategories:
    """Test todo category handling."""

    def test_create_todo_with_categories(self, client, test_member, test_workspace):
        """Test creating todos with different categories."""
        categories = ["Development", "Testing", "Documentation", "Meeting", "Other"]

        for category in categories:
            response = client.post(
                "/todos",
                json={
                    "member_id": test_member.id,
                    "content": f"{category} task",
                    "category": category,
                },
            )

            assert response.status_code == 200
            assert response.json()["category"] == category


class TestTodoWeekKeys:
    """Test week key handling in todos."""

    def test_create_todo_with_week_key(self, client, test_member, test_workspace):
        """Test creating todo with specific week key."""
        response = client.post(
            "/todos",
            json={
                "member_id": test_member.id,
                "content": "Weekly todo",
                "week_key": "2024-W25",
            },
        )

        assert response.status_code == 200
        assert response.json()["week_key"] == "2024-W25"

    def test_create_todo_default_week_key(self, client, test_member, test_workspace):
        """Test that todo gets current week key if not specified."""
        response = client.post(
            "/todos",
            json={
                "member_id": test_member.id,
                "content": "Default week todo",
            },
        )

        assert response.status_code == 200
        # Should have a week_key set (current week)
        assert "week_key" in response.json()
        assert response.json()["week_key"] is not None


class TestTodoSummary:
    """Test todo summary field."""

    def test_create_todo_with_summary(self, client, test_member, test_workspace):
        """Test creating todo with summary."""
        response = client.post(
            "/todos",
            json={
                "member_id": test_member.id,
                "content": "Long detailed task description that needs doing",
                "summary": "Short summary",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["summary"] == "Short summary"
        assert data["content"] == "Long detailed task description that needs doing"

    def test_update_todo_summary(self, client, test_todo, test_workspace):
        """Test updating todo summary."""
        response = client.patch(
            f"/todos/{test_todo.id}",
            json={"summary": "New summary"},
        )

        assert response.status_code == 200
        assert response.json()["summary"] == "New summary"
