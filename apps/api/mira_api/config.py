from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def csv_env(name: str, default: str) -> list[str]:
    value = os.getenv(name, default)
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    repo_root: Path = Path(__file__).resolve().parents[3]
    workspace_dir: Path = Path(os.getenv("MIRA_WORKSPACE_DIR", Path(__file__).resolve().parents[3] / "mira-workspace"))
    cors_origins: tuple[str, ...] = tuple(csv_env("MIRA_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"))
    max_upload_bytes: int = int(os.getenv("MIRA_MAX_UPLOAD_BYTES", str(2 * 1024 * 1024)))
    default_language: str = os.getenv("MIRA_DEFAULT_LANGUAGE", "en")


settings = Settings()
