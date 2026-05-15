# Mira Quickstart

This guide gets the local Mira scaffold running with the FastAPI backend and the Vite React frontend.

## Prerequisites

- Python 3.11 or newer
- Node.js 20 or newer
- npm

Install `uv` if it is not already available:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv --version
```

## 1. Install Backend Dependencies

From the repository root:

```bash
uv sync --project apps/api --extra dev
```

This installs the FastAPI backend package from `apps/api/pyproject.toml`, including the `dev` extras used for tests and linting. `uv` creates and manages the backend virtual environment in `apps/api/.venv`.

To confirm the backend environment is ready:

```bash
uv run --project apps/api python --version
uv run --project apps/api python -c "import mira_api"
```

## 2. Install Frontend Dependencies

```bash
npm --prefix apps/web install
```

## 3. Start the API

```bash
npm run dev:api
```

The `dev:api` script runs `uv run --project apps/api ...`, so it uses the backend environment installed above.

The API runs on `http://localhost:8000`.

To verify it is healthy:

```bash
curl http://localhost:8000/health
```

## 4. Start the Web App

In another terminal:

```bash
npm run dev:web
```

Vite prints the local web URL, usually `http://localhost:5173`.

## Runtime Data

The API creates local runtime data in `mira-workspace/`:

```text
mira-workspace/
  mira.sqlite3
  members/<member>/reports/<week>.md
  team/summaries/<summary-id>.md
```

This directory is intentionally ignored by git.

## Configuration

The backend supports these environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MIRA_WORKSPACE_DIR` | `./mira-workspace` | Local runtime database and Markdown output directory |
| `MIRA_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allowed frontend origins |
| `MIRA_MAX_UPLOAD_BYTES` | `2097152` | Maximum upload size for report imports |
| `MIRA_DEFAULT_LANGUAGE` | `en` | Backend generated fallback text language |

The frontend calls `http://localhost:8000` by default. Override it with:

```bash
VITE_MIRA_API_URL=http://localhost:8000 npm run dev:web
```

## Useful Commands

```bash
npm run dev:api      # Start FastAPI with reload
npm run start:api    # Start FastAPI without reload
npm run dev:web      # Start Vite dev server
npm run build:web    # Type-check and build the frontend
```
