"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-11-02
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Administrative Utility
Description  : Bulk Client Store Operators and Staff Provisioning Script
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any
from sqlalchemy import select

# Add backend to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.db.session import async_session
from app.models.auth import User, UserRole
from app.models.tenant import Company, Branch
from app.models.user_assignment import UserCompanyAssignment, UserBranchAssignment
from app.core.security import hash_password

async def provision_users(users_list: List[Dict[str, Any]], company_code: str = "001", branch_code: str = "001"):
    async with async_session() as db:
        print(f"Connecting to database to provision {len(users_list)} operational staff...")
        
        # Resolve company
        comp_stmt = select(Company).where(
            (Company.code == company_code) | (Company.id == company_code)
        )
        comp_res = await db.execute(comp_stmt)
        company = comp_res.scalars().first()
        company_id = company.id if company else company_code

        # Resolve branch
        branch_stmt = select(Branch).where(
            (Branch.code == branch_code) | (Branch.id == branch_code)
        )
        branch_res = await db.execute(branch_stmt)
        branch = branch_res.scalars().first()
        branch_id = branch.id if branch else branch_code

        created_count = 0
        updated_count = 0

        for udata in users_list:
            username = udata["username"].strip().lower()
            email = udata.get("email", f"{username}@smritibooks.com").strip().lower()
            role_str = udata.get("role", "CASHIER").strip().upper()
            try:
                role = UserRole[role_str]
            except KeyError:
                role = UserRole.CASHIER
            raw_password = udata.get("password", "Smriti@2026")
            name = udata.get("name", username)
            phone = udata.get("phone", "")

            # Check if user already exists
            user_stmt = select(User).where((User.username == username) | (User.email == email))
            user_res = await db.execute(user_stmt)
            existing_user = user_res.scalars().first()

            if existing_user:
                print(f"  [EXISTS] User '{username}' already present (id: {existing_user.id}). Updating profile...")
                existing_user.name = name
                existing_user.phone = phone
                existing_user.role = role
                existing_user.is_active = True
                user_obj = existing_user
                updated_count += 1
            else:
                user_obj = User(
                    username=username,
                    email=email,
                    hashed_password=hash_password(raw_password),
                    role=role,
                    name=name,
                    phone=phone,
                    is_active=True,
                )
                db.add(user_obj)
                await db.flush()
                print(f"  [CREATED] User '{username}' created successfully (id: {user_obj.id}, role: {role.value})")
                created_count += 1

            # Provision Company Assignment
            uca_stmt = select(UserCompanyAssignment).where(
                UserCompanyAssignment.user_id == user_obj.id,
                UserCompanyAssignment.company_id == company_id
            )
            uca_res = await db.execute(uca_stmt)
            if not uca_res.scalars().first():
                uca = UserCompanyAssignment(
                    user_id=user_obj.id,
                    company_id=company_id,
                    role_in_company=role.value,
                    is_default=True,
                    is_active=True,
                )
                db.add(uca)

            # Provision Branch Assignment
            uba_stmt = select(UserBranchAssignment).where(
                UserBranchAssignment.user_id == user_obj.id,
                UserBranchAssignment.branch_id == branch_id
            )
            uba_res = await db.execute(uba_stmt)
            if not uba_res.scalars().first():
                uba = UserBranchAssignment(
                    user_id=user_obj.id,
                    branch_id=branch_id,
                    is_default=True,
                    is_active=True,
                )
                db.add(uba)

        await db.commit()
        print(f"\nPROVISIONING COMPLETE: {created_count} created, {updated_count} updated.")

if __name__ == "__main__":
    # If a JSON file is passed as an argument, load it; otherwise use sample schema
    if len(sys.argv) > 1 and os.path.isfile(sys.argv[1]):
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            data = json.load(f)
        asyncio.run(provision_users(data))
    else:
        print("Usage: python scripts/seed_client_store_users.py <path_to_users.json>")
        print("Example JSON format:\n" + json.dumps([
            {"username": "rajesh_kumar", "name": "Rajesh Kumar", "role": "CASHIER", "email": "rajesh@retail.com", "phone": "9876543210"},
            {"username": "sunita_sharma", "name": "Sunita Sharma", "role": "MANAGER", "email": "sunita@retail.com", "phone": "9876543211"}
        ], indent=2))

