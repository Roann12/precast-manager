# File overview: Core configuration/security setup for app/core/config.py.
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import AnyUrl, model_validator

BACKEND_DIR = Path(__file__).resolve().parents[2]
BACKEND_ENV_FILE = BACKEND_DIR / ".env"


# Data model for settings.
# Maps object fields to storage columns/constraints.
class Settings(BaseSettings):
    PROJECT_NAME: str = "Precast Manager"
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    ENVIRONMENT: str = "development"
    ENABLE_DEV_ENDPOINTS: bool = False

    POSTGRES_SERVER: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "precast"
    POSTGRES_PASSWORD: str = "precast"
    POSTGRES_DB: str = "precast_manager"

    SQLALCHEMY_DATABASE_URI: AnyUrl | str | None = None
    # Must be set via environment/.env. No insecure fallback.
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    @model_validator(mode="after")
    # Handles validate security settings flow.
    def validate_security_settings(self) -> "Settings":
        secret = (self.JWT_SECRET_KEY or "").strip()
        if not secret or secret.upper() == "CHANGE_ME":
            raise ValueError("JWT_SECRET_KEY must be set to a non-placeholder value.")
        if len(secret) < 16:
            raise ValueError("JWT_SECRET_KEY must be at least 16 characters long.")
        if self.ENVIRONMENT == "production" and "*" in self.BACKEND_CORS_ORIGINS:
            raise ValueError("BACKEND_CORS_ORIGINS cannot include '*' in production.")
        if self.ENVIRONMENT == "production":
            for name, val in (
                ("POSTGRES_USER", self.POSTGRES_USER),
                ("POSTGRES_PASSWORD", self.POSTGRES_PASSWORD),
                ("POSTGRES_DB", self.POSTGRES_DB),
            ):
                if not (val or "").strip():
                    raise ValueError(f"{name} must be set for production.")
        return self

    # Data model for config.
    # Maps object fields to storage columns/constraints.
    class Config:
        env_file = str(BACKEND_ENV_FILE)
        case_sensitive = True

    @property
    # Handles sqlalchemy database uri flow.
    def sqlalchemy_database_uri(self) -> str:
        if self.SQLALCHEMY_DATABASE_URI:
            return str(self.SQLALCHEMY_DATABASE_URI)
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:"
            f"{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:"
            f"{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()

