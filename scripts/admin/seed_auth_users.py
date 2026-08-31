"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.63.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import uuid
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session
from app.models.auth import User, UserRole
from app.core.security import hash_password


DEFAULT_USERS = [
    {
        "username": "admin",
        "email": "admin@smritibooks.com",
        "full_name": "System Administrator",
        "role": UserRole.SYSADMIN,
        "password": "Admin@123",
        "company_id": None,
        "branch_id": None,
    },
    {
        "username": "sysadmin",
        "email": "sysadmin@smritibooks.com",
        "full_name": "Chief System Admin",
        "role": UserRole.SYSADMIN,
        "password": "Admin@123",
        "company_id": None,
        "branch_id": None,
    },
    {
        "username": "usr_sysadmin",
        "email": "usr_sysadmin@smritibooks.com",
        "full_name": "System Administrator",
        "role": UserRole.SYSADMIN,
        "password": "Admin@123",
        "company_id": None,
        "branch_id": None,
    },
    {
        "username": "manager",
        "email": "manager@smritibooks.com",
        "full_name": "Store Operations Manager",
        "role": UserRole.MANAGER,
        "password": "Manager@123",
        "company_id": "COMP-001",
        "branch_id": "MAIN",
    },
    {
        "username": "usr_manager",
        "email": "usr_manager@smritibooks.com",
        "full_name": "Store Operations Manager",
        "role": UserRole.MANAGER,
        "password": "Manager@123",
        "company_id": "COMP-001",
        "branch_id": "MAIN",
    },
    {
        "username": "cashier",
        "email": "cashier@smritibooks.com",
        "full_name": "Senior POS Cashier",
        "role": UserRole.CASHIER,
        "password": "Cashier@123",
        "company_id": "COMP-001",
        "branch_id": "MAIN",
    },
    {
        "username": "usr_cashier",
        "email": "usr_cashier@smritibooks.com",
        "full_name": "Senior POS Cashier",
        "role": UserRole.CASHIER,
        "password": "Cashier@123",
        "company_id": "COMP-001",
        "branch_id": "MAIN",
    },
]


async def seed_users():
    print("[*] Seeding and resetting standard SMRITI authentication accounts...")
    async with async_session() as session:
        for u in DEFAULT_USERS:
            stmt = select(User).where(User.username == u["username"])
            existing = (await session.execute(stmt)).scalar_one_or_none()
            hashed_pwd = hash_password(u["password"])
            
            if existing:
                existing.hashed_password = hashed_pwd
                existing.role = u["role"]
                existing.is_active = True
                existing.is_deleted = False
                existing.company_id = u["company_id"]
                existing.branch_id = u["branch_id"]
                print(f" [OK] Updated existing user: {u['username']} (Role: {u['role'].value})")
            else:
                new_user = User(
                    id=f"usr_{uuid.uuid4().hex[:8]}",
                    uuid=str(uuid.uuid4()),
                    username=u["username"],
                    email=u["email"],
                    hashed_password=hashed_pwd,
                    role=u["role"],
                    is_active=True,
                    is_deleted=False,
                    company_id=u["company_id"],
                    branch_id=u["branch_id"],
                    status="Active",
                )
                session.add(new_user)
                print(f" [OK] Created new user: {u['username']} (Role: {u['role'].value})")

        await session.commit()
    print("[SUCCESS] All authentication accounts synchronized successfully.")


if __name__ == "__main__":
    asyncio.run(seed_users())
