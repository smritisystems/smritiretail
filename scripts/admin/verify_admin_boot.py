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

verify_admin_boot.py
===================================
Admin verification utility: exercises AuthService.bootstrap_admin() directly
via the service layer (not HTTP) to confirm the admin user creation flow is
operational after a fresh database migration or seeding operation.

Usage:
    python scripts/admin/verify_admin_boot.py

SECURITY NOTE: Uses a test account. Never run against production without
reviewing the target DATABASE_URL first.
"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from app.core.config import settings
from app.services.auth import AuthService
from app.schemas.auth import BootstrapRequest


async def main() -> None:
    print("DATABASE_URL =", settings.DATABASE_URL)
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with async_session() as session:
        service = AuthService(session)
        req = BootstrapRequest(
            username="admin_test",
            password="Admin@123",
            email="admin_test@smriti.test",
        )
        try:
            user = await service.bootstrap_admin(req)
            print("Created:", user.id, user.username)
        except IntegrityError as err:
            print("IntegrityError:", err)
            print("orig:", err.orig)
            print("params:", err.params)
            await session.rollback()
        except SQLAlchemyError as err:
            print("SQLAlchemyError:", type(err), err)
            await session.rollback()
        except Exception as err:
            print("Exception:", type(err), err)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
