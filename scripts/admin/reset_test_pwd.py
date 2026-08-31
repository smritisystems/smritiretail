"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.30.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

reset_test_pwd.py
============================
Admin utility: resets the test_user account password in the control-plane
database to 'password123' for local development and integration testing.

Usage:
    python scripts/admin/reset_test_pwd.py

SECURITY NOTE: Never run this script against a production database.
"""

import os
import sys
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text

sys.path.insert(0, os.path.abspath(os.path.join(os.getcwd(), "..")))
from backend.app.core.config import settings
from backend.app.core.security import hash_password


async def main() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with async_session() as session:
        hashed = hash_password("password123")
        await session.execute(
            text(
                "UPDATE users SET hashed_password = :hashed WHERE username = 'test_user'"
            ),
            {"hashed": hashed},
        )
        await session.commit()
        print("Updated test_user password to password123")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
