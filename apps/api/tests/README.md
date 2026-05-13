# Mira API Testing Guide

Complete guide for running and writing tests for the Mira API.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Code Coverage](#code-coverage)
- [Writing Tests](#writing-tests)
- [Test Fixtures](#test-fixtures)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Install Dependencies

```bash
cd apps/api
pip install -e ".[dev]"
```

### Run All Tests

```bash
pytest
```

### Run with Coverage

```bash
pytest --cov=mira_api --cov-report=term --cov-report=html
```

### View Coverage Report

```bash
# Open in browser
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
```

---

## Test Structure

```
apps/api/tests/
├── __init__.py
├── conftest.py              # Shared fixtures
├── test_auth.py             # Authentication tests
├── test_todos.py            # Todo CRUD tests
├── test_workspaces.py       # Workspace management tests
├── test_reports.py          # Weekly report tests
└── README.md               # This file
```

### Test Coverage by Module

| Module | Test File | Coverage Target | Status |
|--------|-----------|-----------------|--------|
| Authentication | `test_auth.py` | >80% | ✅ Complete |
| Todos | `test_todos.py` | >80% | ✅ Complete |
| Workspaces | `test_workspaces.py` | >75% | ✅ Complete |
| Reports | `test_reports.py` | >70% | ✅ Complete |
| **Overall** | **All files** | **>70%** | **✅ Target** |

---

## Running Tests

### Run All Tests

```bash
pytest
```

### Run Specific Test File

```bash
pytest tests/test_auth.py
pytest tests/test_todos.py
pytest tests/test_workspaces.py
pytest tests/test_reports.py
```

### Run Specific Test Class

```bash
pytest tests/test_auth.py::TestUserRegistration
pytest tests/test_todos.py::TestCreateTodo
```

### Run Specific Test Function

```bash
pytest tests/test_auth.py::TestUserRegistration::test_register_new_user
pytest tests/test_todos.py::TestCreateTodo::test_create_todo_success
```

### Run Tests with Pattern Matching

```bash
# Run all registration tests
pytest -k "register"

# Run all creation tests
pytest -k "create"

# Run all workspace isolation tests
pytest -k "isolation"
```

### Run Tests in Parallel

```bash
# Install pytest-xdist first
pip install pytest-xdist

# Run with 4 workers
pytest -n 4
```

### Run Tests with Verbose Output

```bash
pytest -v
pytest -vv  # Extra verbose
```

### Run Tests and Stop on First Failure

```bash
pytest -x
```

### Run Tests with Last Failed

```bash
# Re-run only failed tests from last run
pytest --lf

# Re-run failed first, then all others
pytest --ff
```

---

## Code Coverage

### Generate Coverage Report

```bash
# Terminal report
pytest --cov=mira_api --cov-report=term

# HTML report
pytest --cov=mira_api --cov-report=html

# XML report (for CI/CD)
pytest --cov=mira_api --cov-report=xml

# All formats
pytest --cov=mira_api --cov-report=term --cov-report=html --cov-report=xml
```

### Coverage Reports

After running tests with `--cov-report=html`:

```bash
# Open HTML coverage report
open htmlcov/index.html
```

The HTML report shows:
- Line-by-line coverage highlighting
- Branch coverage (if statements)
- Missing lines
- Coverage percentage per file

### Coverage Configuration

Coverage settings in `pyproject.toml`:

```toml
[tool.coverage.run]
source = ["mira_api"]
omit = [
  "*/tests/*",
  "*/__pycache__/*",
]

[tool.coverage.report]
precision = 2
show_missing = true
fail_under = 70  # Fail if coverage below 70%
```

### Check Coverage Threshold

```bash
# Will exit with error if coverage < 70%
pytest --cov=mira_api --cov-report=term --cov-fail-under=70
```

---

## Writing Tests

### Test Structure

Use descriptive class and function names:

```python
class TestFeatureName:
    """Test suite for feature."""

    def test_specific_behavior(self, fixtures):
        """Test that specific behavior works as expected."""
        # Arrange
        setup_data = create_test_data()

        # Act
        result = perform_action(setup_data)

        # Assert
        assert result == expected_value
```

### Test Naming Conventions

- **Test files**: `test_*.py`
- **Test classes**: `Test*` (e.g., `TestUserRegistration`)
- **Test functions**: `test_*` (e.g., `test_register_new_user`)

### AAA Pattern (Arrange, Act, Assert)

```python
def test_create_todo_success(self, client, test_member):
    # Arrange: Set up test data
    todo_data = {
        "member_id": test_member.id,
        "content": "Test task",
    }

    # Act: Perform the action
    response = client.post("/todos", json=todo_data)

    # Assert: Verify the result
    assert response.status_code == 200
    assert response.json()["content"] == "Test task"
```

### Testing Best Practices

1. **One assertion per test** (when possible)
   ```python
   def test_user_has_email(self, test_user):
       assert test_user.email == "test@example.com"
   ```

2. **Test both success and failure cases**
   ```python
   def test_login_success(self, client):
       # Test valid credentials
       pass

   def test_login_invalid_password(self, client):
       # Test invalid credentials
       pass
   ```

3. **Use descriptive assertions**
   ```python
   # Good
   assert response.status_code == 200, "Expected successful response"

   # Better
   assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
   ```

4. **Test isolation**: Each test should be independent
   - Use fixtures for setup
   - Don't rely on test execution order
   - Clean up after tests (fixtures handle this)

5. **Test edge cases**
   ```python
   def test_create_todo_empty_content(self, client):
       # Test with empty string
       pass

   def test_create_todo_very_long_content(self, client):
       # Test with 10000 character string
       pass
   ```

---

## Test Fixtures

Fixtures provide reusable test data and setup. All fixtures are defined in `conftest.py`.

### Database Fixtures

```python
@pytest.fixture
def test_db(test_db_engine):
    """Provides a clean database session for each test."""
```

### Client Fixtures

```python
@pytest.fixture
def client(test_db):
    """Provides a test client for making API requests."""
```

### Data Fixtures

```python
@pytest.fixture
def test_workspace(test_db):
    """Provides a test workspace."""

@pytest.fixture
def test_user(test_db, test_workspace):
    """Provides a test user linked to workspace."""

@pytest.fixture
def test_member(test_db, test_workspace):
    """Provides a test member in workspace."""

@pytest.fixture
def test_todo(test_db, test_member, test_workspace):
    """Provides a test todo."""
```

### Authentication Fixtures

```python
@pytest.fixture
def auth_cookies(test_user):
    """Provides authentication cookies for test_user."""

@pytest.fixture
def admin_auth_cookies(test_admin_user):
    """Provides authentication cookies for admin user."""
```

### Factory Fixtures

```python
@pytest.fixture
def create_member(test_db, test_workspace):
    """Factory for creating multiple members."""
    def _create_member(name="New Member", role="Engineer"):
        # Create and return member
        pass
    return _create_member

# Usage in test:
def test_multiple_members(create_member):
    member1 = create_member(name="Alice")
    member2 = create_member(name="Bob")
```

### Using Fixtures

```python
def test_with_fixtures(client, test_user, test_workspace, auth_cookies):
    """Fixtures are automatically injected by pytest."""
    response = client.get("/auth/me", cookies=auth_cookies)
    assert response.status_code == 200
```

---

## CI/CD Integration

Tests run automatically on every commit via GitHub Actions.

### CI Workflow

Located at `.github/workflows/ci.yml`:

1. **Backend Tests**: Runs pytest on Python 3.11 and 3.12
2. **Frontend Build**: TypeScript check and production build
3. **Docker Build**: Validates Dockerfiles build successfully
4. **Integration Tests**: Runs tests against PostgreSQL
5. **Lint**: Code quality checks with ruff
6. **Security**: Vulnerability scanning with Trivy

### Running CI Locally

```bash
# Backend tests
cd apps/api
pytest --cov=mira_api --cov-report=term

# Lint
ruff check mira_api/
ruff format --check mira_api/

# Type checking (frontend)
cd apps/web
npx tsc --noEmit

# Build
npm run build
```

### Coverage in CI

CI enforces minimum 70% code coverage:

```yaml
- name: Check coverage threshold
  run: |
    cd apps/api
    coverage report --fail-under=70
```

### Badge Status

Add to README.md:

```markdown
![Tests](https://github.com/your-org/mira/actions/workflows/ci.yml/badge.svg)
[![codecov](https://codecov.io/gh/your-org/mira/branch/main/graph/badge.svg)](https://codecov.io/gh/your-org/mira)
```

---

## Troubleshooting

### Tests Fail with "ModuleNotFoundError"

**Problem**: Python can't find `mira_api` module

**Solution**:
```bash
# Install in development mode
cd apps/api
pip install -e .
```

### Tests Fail with Import Errors

**Problem**: Missing test dependencies

**Solution**:
```bash
pip install -e ".[dev]"
```

### Database Errors in Tests

**Problem**: SQLite3 threading errors

**Solution**: Tests use in-memory SQLite with `StaticPool` to avoid threading issues. This is configured in `conftest.py`.

### Fixture Not Found

**Problem**: pytest can't find a fixture

**Solution**:
1. Check fixture is defined in `conftest.py`
2. Check fixture name matches exactly
3. Verify `conftest.py` is in the tests directory

### Coverage Report Not Generated

**Problem**: No `htmlcov/` directory

**Solution**:
```bash
# Ensure pytest-cov is installed
pip install pytest-cov

# Run with --cov-report=html
pytest --cov=mira_api --cov-report=html
```

### Tests Pass Locally But Fail in CI

**Problem**: Environment differences

**Solutions**:
1. Check Python version matches CI (3.11 or 3.12)
2. Check for missing environment variables
3. Review CI logs for specific errors
4. Test against PostgreSQL locally:
   ```bash
   export MIRA_DATABASE_URL="postgresql://user:pass@localhost:5432/test_db"
   pytest
   ```

### Slow Tests

**Problem**: Tests take too long to run

**Solutions**:
1. Run tests in parallel:
   ```bash
   pip install pytest-xdist
   pytest -n auto
   ```

2. Run only fast tests:
   ```bash
   pytest -m "not slow"
   ```

3. Use pytest-watch for development:
   ```bash
   pip install pytest-watch
   ptw  # Watches files and re-runs tests on change
   ```

---

## Test Categories

### Unit Tests
- Test individual functions in isolation
- Mock external dependencies
- Fast execution

### Integration Tests
- Test multiple components together
- Use test database
- Test API endpoints end-to-end

### Functional Tests
- Test complete user workflows
- Test business logic
- Verify requirements

---

## Test Markers

Mark tests for selective execution:

```python
import pytest

@pytest.mark.slow
def test_expensive_operation():
    """This test takes a long time."""
    pass

@pytest.mark.integration
def test_database_integration():
    """Tests database integration."""
    pass
```

Run marked tests:

```bash
# Run only slow tests
pytest -m slow

# Skip slow tests
pytest -m "not slow"

# Run integration tests only
pytest -m integration
```

---

## Performance Testing

For load testing, use tools like:
- **locust**: Python-based load testing
- **ab** (Apache Bench): Simple HTTP load testing
- **k6**: Modern load testing tool

Example with Apache Bench:

```bash
# Install
# macOS: brew install httpd
# Ubuntu: sudo apt install apache2-utils

# Test /health endpoint
ab -n 1000 -c 50 http://localhost:8000/health

# Test /state endpoint
ab -n 1000 -c 50 -H "Cookie: mira_access_token=YOUR_TOKEN" \
   http://localhost:8000/state
```

---

## Resources

- **pytest Documentation**: https://docs.pytest.org/
- **pytest-cov Documentation**: https://pytest-cov.readthedocs.io/
- **Coverage.py**: https://coverage.readthedocs.io/
- **FastAPI Testing**: https://fastapi.tiangolo.com/tutorial/testing/
- **SQLAlchemy Testing**: https://docs.sqlalchemy.org/en/20/core/testing.html

---

**Last Updated**: 2026-05-13
**Minimum Coverage**: 70%
**Test Count**: 100+ tests across 4 modules
