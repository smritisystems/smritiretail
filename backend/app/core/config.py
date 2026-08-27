"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-11
Modified     : 2026-08-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import os
os.environ.setdefault("JWT_SECRET_KEY", "dev-test-jwt-secret-key-32-chars-long-smriti")
os.environ.setdefault("INTERNAL_SERVICE_KEY", "dev-test-internal-service-key-32-chars")
import json
import socket
import asyncio
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

    port = parsed.port or 5432

    if _is_postgres_server(host, port):
        return conn_str

    try:
        import subprocess
        out = subprocess.check_output(["wsl", "-d", "docker-desktop", "-e", "/sbin/ip", "addr"], text=True, stderr=subprocess.DEVNULL)
        for line in out.splitlines():
            line = line.strip()
            if line.startswith("inet "):
                ip = line.split()[1].split("/")[0]
                if ip != "127.0.0.1" and _is_postgres_server(ip, port):
                    auth = ""
                    if parsed.username:
                        auth = parsed.username
                        if parsed.password:
                            auth += f":{parsed.password}"
                        auth += "@"
                    netloc = f"{auth}{ip}:{port}"
                    return urlunparse(parsed._replace(netloc=netloc))
    except Exception:
        pass

    for alt_port in (5432, 5434):
        if alt_port == port:
            continue
        if _is_postgres_server(host, alt_port):
            return _replace_url_port(conn_str, alt_port)

    return conn_str


class Settings(BaseSettings):
    PROJECT_NAME: str = "SMRITI Retail OS"
    VERSION: str = "3.16.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    
    # Priority defaults
    PORT: int = 8000
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/smritisys"
    JWT_SECRET_KEY: str  # Remove default — raise error if missing
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480      # 8 hours — covers a full retail shift without interruption
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7          # 7-day sliding window refresh
    INTERNAL_SERVICE_KEY: str  # Remove default — raise error if missing

    
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

    # Multi-Database Platform Architecture v1.1 Configuration
    USE_MULTI_DB_ROUTER: bool = False
    # Statutory Compliance Configuration
    STRICT_STATUTORY_MODE: bool = False

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
            with open(config_json_path, "r", encoding="utf-8") as f:
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

    # Ensure DATABASE_URL uses asyncpg driver
    if base_settings.DATABASE_URL.startswith("postgresql://"):
        base_settings.DATABASE_URL = base_settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

    env = base_settings.ENVIRONMENT.strip().lower()
    is_local_dev = env in {"development", "local", "test"} or (env == "" and Path(__file__).resolve().parents[4].joinpath(".git").exists())
    if is_local_dev and base_settings.DATABASE_URL.startswith("postgresql+asyncpg://"):
        base_settings.DATABASE_URL = _resolve_local_dev_postgres_url(base_settings.DATABASE_URL)

    strict_env = os.getenv("STRICT_STATUTORY_MODE")
    if strict_env is not None:
        base_settings.STRICT_STATUTORY_MODE = strict_env.strip().lower() in ("true", "1", "yes")
    elif env in {"production", "prod"}:
        base_settings.STRICT_STATUTORY_MODE = True

    # Fail closed on insecure secrets in production
    if env in {"production", "prod"}:
        dev_jwt = "dev-test-jwt-secret-key-32-chars-long-smriti"
        dev_internal = "dev-test-internal-service-key-32-chars"
        if not base_settings.JWT_SECRET_KEY or base_settings.JWT_SECRET_KEY == dev_jwt or len(base_settings.JWT_SECRET_KEY) < 32:
            raise ValueError(
                "SECURITY FAULT: Production mode requires a dedicated, cryptographically strong JWT_SECRET_KEY (min 32 chars). Dev defaults forbidden."
            )
        if not base_settings.INTERNAL_SERVICE_KEY or base_settings.INTERNAL_SERVICE_KEY == dev_internal or len(base_settings.INTERNAL_SERVICE_KEY) < 32:
            raise ValueError(
                "SECURITY FAULT: Production mode requires a dedicated, cryptographically strong INTERNAL_SERVICE_KEY (min 32 chars). Dev defaults forbidden."
            )
        pg_pwd = os.getenv("POSTGRES_PASSWORD") or ""
        if not pg_pwd or pg_pwd == "postgres" or ":postgres@" in base_settings.DATABASE_URL:
            raise ValueError(
                "SECURITY FAULT: Production mode requires a dedicated, non-default POSTGRES_PASSWORD. Default credentials 'postgres:postgres' forbidden in production."
            )

    return base_settings

settings = load_settings()
BaseDir = Path(__file__).resolve().parent.parent.parent.parent
