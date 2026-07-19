"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-11
Modified     : 2026-07-19
Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import asyncio
import json
import os
import socket
from pathlib import Path
from urllib.parse import urlparse, urlunparse

from pydantic_settings import BaseSettings


def _is_port_open(host: str, port: int, timeout: float = 0.8) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _is_postgres_server(host: str, port: int, user: str = "postgres", password: str = "postgres", database: str = "postgres", timeout: float = 0.8) -> bool:
    if not _is_port_open(host, port, timeout=timeout):
        return False

    try:
        import asyncpg
    except ImportError:
        return False

    conn_str = f"postgresql://{user}:{password}@{host}:{port}/{database}"
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        conn = loop.run_until_complete(asyncpg.connect(conn_str, timeout=timeout))
        loop.run_until_complete(conn.close())
        return True
    except Exception:
        return False
    finally:
        try:
            loop.close()
        except Exception:
            pass


def _replace_url_port(conn_str: str, port_int: int) -> str:
    parsed = urlparse(conn_str)
    if parsed.scheme not in {"postgresql", "postgresql+asyncpg"}:
        return conn_str

    hostname = parsed.hostname or ""
    if not hostname:
        return conn_str

    if parsed.username:
        auth = parsed.username
        if parsed.password:
            auth += f":{parsed.password}"
        netloc = f"{auth}@{hostname}:{port_int}"
    else:
        netloc = f"{hostname}:{port_int}"

    if parsed.port is None:
        netloc = netloc

    return urlunparse(parsed._replace(netloc=netloc))


def _resolve_local_dev_postgres_url(conn_str: str) -> str:
    parsed = urlparse(conn_str)
    if parsed.scheme not in {"postgresql", "postgresql+asyncpg"}:
        return conn_str

    host = parsed.hostname or ""
    if host not in {"127.0.0.1", "localhost"}:
        return conn_str

    port = parsed.port
    if port is None:
        return conn_str

    if _is_postgres_server(host, port):
        return conn_str

    for alt_port in (5432, 5434):
        if alt_port == port:
            continue
        if _is_postgres_server(host, alt_port):
            return _replace_url_port(conn_str, alt_port)

    return conn_str


class Settings(BaseSettings):
    PROJECT_NAME: str = "SMRITI Retail OS"
    VERSION: str = "3.17.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    
    # Priority defaults
    PORT: int = 8000
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti_retail_db"
    JWT_SECRET_KEY: str  # Remove default â€” raise error if missing
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60       # 1 hour â€” suitable for retail POS sessions
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7          # 7-day sliding window refresh
    INTERNAL_SERVICE_KEY: str  # Required — raise startup error if env var missing (no default to prevent silent bypass)

    
    # Platform profiles
    EDITION: str = "Enterprise Edition"
    ORGANIZATION: str = "AITDL NETWORKS"
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ]

    # Feature Flags for Transactional Core Cutover
    USE_FASTAPI_SALES: bool = False
    USE_FASTAPI_PURCHASE: bool = False
    USE_FASTAPI_POS: bool = False

    # Cache Settings
    USE_REDIS_CACHE: bool = False
    REDIS_URL: str = "redis://localhost:6379/0"
    PERMISSION_CACHE_TTL: int = 300
    CACHE_PREFIX: str = "smriti"
    CACHE_VERSION: int = 1
    CACHE_FAILOVER_TO_MEMORY: bool = True

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore"
    }

def load_settings() -> Settings:
    # 1. Base defaults loaded from env / BaseSettings
    # We must ensure JWT_SECRET_KEY is present in env, otherwise Pydantic will raise error.
    base_settings = Settings()
    
    # 2. Layer JSON configs from smriti-config.json
    root_dir = Path(__file__).resolve().parent.parent.parent.parent
    config_json_path = root_dir / "smriti-config.json"
    
    json_data = {}
    if config_json_path.exists():
        try:
            with open(config_json_path, encoding="utf-8") as f:
                json_data = json.load(f)
        except Exception as e:
            print(f"[SDIC Settings] Failed to parse smriti-config.json: {e}")
            
    # Map json variables to settings if not explicitly overridden by environment variables
    db_url = os.getenv("DATABASE_URL")
    if not db_url and "database" in json_data and "connectionString" in json_data["database"]:
        # Convert standard postgresql:// to postgresql+asyncpg:// for SQLAlchemy asyncpg
        conn_str = json_data["database"]["connectionString"]
        if conn_str.startswith("postgresql://"):
            conn_str = conn_str.replace("postgresql://", "postgresql+asyncpg://", 1)
        base_settings.DATABASE_URL = conn_str

    # Prefer an explicit DATABASE_URL environment override.
    if db_url:
        base_settings.DATABASE_URL = db_url
    else:
        postgres_port = os.getenv("POSTGRES_PORT")
        if postgres_port:
            try:
                port_int = int(postgres_port)
                base_settings.DATABASE_URL = _replace_url_port(base_settings.DATABASE_URL, port_int)
            except ValueError:
                pass

        env = base_settings.ENVIRONMENT.strip().lower()
        is_local_dev = env in {"development", "local", "test"} or (env == "" and Path(__file__).resolve().parents[4].joinpath(".git").exists())
        if is_local_dev and base_settings.DATABASE_URL.startswith("postgresql+asyncpg://"):
            base_settings.DATABASE_URL = _resolve_local_dev_postgres_url(base_settings.DATABASE_URL)

    if "app" in json_data:
        app_data = json_data["app"]
        base_settings.PROJECT_NAME = app_data.get("productName", base_settings.PROJECT_NAME)
        base_settings.VERSION = app_data.get("version", base_settings.VERSION)
        base_settings.EDITION = app_data.get("edition", base_settings.EDITION)
        
    if "author" in json_data:
        auth_data = json_data["author"]
        base_settings.ORGANIZATION = auth_data.get("organization", base_settings.ORGANIZATION)

    # Parse ALLOWED_ORIGINS comma-separated string if provided
    allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
    if allowed_origins_env:
        base_settings.ALLOWED_ORIGINS = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

    # Ensure DATABASE_URL uses asyncpg driver
    if base_settings.DATABASE_URL.startswith("postgresql://"):
        base_settings.DATABASE_URL = base_settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

    return base_settings

settings = load_settings()
BaseDir = Path(__file__).resolve().parent.parent.parent.parent
