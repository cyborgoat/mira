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

    # Database
    database_url: str = os.getenv(
        "MIRA_DATABASE_URL",
        f"sqlite:///{Path(os.getenv('MIRA_WORKSPACE_DIR', Path(__file__).resolve().parents[3] / 'mira-workspace')) / 'mira.sqlite3'}"
    )
    debug: bool = os.getenv("MIRA_DEBUG", "false").lower() == "true"

    # Auth
    jwt_secret: str = os.getenv("MIRA_JWT_SECRET", "dev-secret-CHANGE-IN-PRODUCTION")
    jwt_access_expiry: int = int(os.getenv("MIRA_JWT_ACCESS_EXPIRY", "900"))  # 15 min
    jwt_refresh_expiry: int = int(os.getenv("MIRA_JWT_REFRESH_EXPIRY", "604800"))  # 7 days
    bcrypt_rounds: int = int(os.getenv("MIRA_BCRYPT_ROUNDS", "12"))

    # CORS
    cors_origins: tuple[str, ...] = tuple(csv_env("MIRA_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"))

    # Upload
    max_upload_bytes: int = int(os.getenv("MIRA_MAX_UPLOAD_BYTES", str(2 * 1024 * 1024)))

    # i18n
    default_language: str = os.getenv("MIRA_DEFAULT_LANGUAGE", "en")


settings = Settings()
