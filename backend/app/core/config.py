from functools import lru_cache
from typing import List
from urllib.parse import quote_plus

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )

    app_env: str = "development"
    log_level: str = "INFO"
    cors_origins_raw: str = Field(default="http://localhost:5175", validation_alias="CORS_ORIGINS")

    mysql_host: str
    mysql_port: int = 3306
    mysql_user: str
    mysql_password: str
    mysql_database: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 15
    jwt_refresh_expire_days: int = 7

    admin_email: str = "admin@yoradm.com"
    admin_username: str = "admin"
    admin_password: str = "ChangeMe123!"
    admin_full_name: str = "System Admin"
    profile_photo_max_bytes: int = 1 * 1024 * 1024

    @computed_field  # type: ignore[prop-decorator]
    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]

    @property
    def database_url(self) -> str:
        password = quote_plus(self.mysql_password)
        database = quote_plus(self.mysql_database)
        return (
            f"mysql+pymysql://{self.mysql_user}:{password}"
            f"@{self.mysql_host}:{self.mysql_port}/{database}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
