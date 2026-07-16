"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-07-11
Modified     : 2026-07-12
Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import os
import json
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "SMRITI Retail OS"
    VERSION: str = "3.16.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    
    # Priority defaults
    PORT: int = 8000
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti_retail_db"
    JWT_SECRET_KEY: str  # Remove default â€” raise error if missing
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60       # 1 hour â€” suitable for retail POS sessions
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7          # 7-day sliding window refresh
    INTERNAL_SERVICE_KEY: str = "smriti_secret_fallback_key"

    
    # Platform profiles
    EDITION: str = "Enterprise Edition"
    ORGANIZATION: str = "AITDL NETWORKS"
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
    ]

    # Feature Flags for Transactional Core Cutover
    USE_FASTAPI_SALES: bool = False
    USE_FASTAPI_PURCHASE: bool = False
    USE_FASTAPI_POS: bool = False

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
