"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-08-18
Modified     : 2026-08-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import asyncio
import json
from sqlalchemy import select
try:
    from app.db.session import async_session
    import app.models.role
    import app.models.auth
    import app.models.tenant
    import app.models.user_assignment
    import app.models.company_database_registry
    from app.models.auth import User, UserRole
    from app.models.role import Role
    from app.models.tenant import Company, Branch
    from app.models.company_database_registry import CompanyDatabaseRegistry
    from app.models.user_assignment import UserCompanyAssignment, UserBranchAssignment
    from app.core.security import hash_password
except ImportError:
    from backend.app.db.session import async_session
    import backend.app.models.role
    import backend.app.models.auth
    import backend.app.models.tenant
    import backend.app.models.user_assignment
    import backend.app.models.company_database_registry
    from backend.app.models.auth import User, UserRole
    from backend.app.models.role import Role
    from backend.app.models.tenant import Company, Branch
    from backend.app.models.company_database_registry import CompanyDatabaseRegistry
    from backend.app.models.user_assignment import UserCompanyAssignment, UserBranchAssignment
    from backend.app.core.security import hash_password


async def seed():
    async with async_session() as db:
        # 0. Ensure default system roles exist
        for r_name in ["SYSADMIN", "ADMIN", "MANAGER", "CASHIER", "SALES_EXECUTIVE"]:
            r_id = f"role-{r_name.lower()}"
            r = await db.get(Role, r_id)
            if not r:
                r = Role(
                    id=r_id,
                    name=r_name,
                    description=f"{r_name} role",
                    permissions_json=json.dumps(["*"]),
                    is_active=True,
                    is_system=True,
                )
                db.add(r)
        await db.flush()

        # 1. Multiple Enterprise Companies with Branches & READY Registries
        enterprise_companies = [
            {
                "id": "COMP-001",
                "name": "Tattly Threads",
                "gst_number": "27AAXFT2508H1ZR",
                "db_name": "smriti001",
                "branches": [
                    {"id": "BR-MAIN-001", "name": "Main Corporate Branch", "code": "MAIN"},
                    {"id": "BR-SOUTH-001", "name": "South Distribution Hub", "code": "SOUTH-01"},
                ]
            },
            {
                "id": "COMP-002",
                "name": "SMRITI Fashion & Lifestyle Hub",
                "gst_number": "27AABCS1429B1ZB",
                "db_name": "smriti002",
                "branches": [
                    {"id": "BR-BND-001", "name": "Bandra Flagship Store", "code": "BANDRA-01"},
                    {"id": "BR-BKC-001", "name": "BKC Boutique Mall", "code": "BKC-01"},
                ]
            },
            {
                "id": "COMP-003",
                "name": "SMRITI Electronics & Digital Hyperstore",
                "gst_number": "27AABCS9988C1ZC",
                "db_name": "smriti003",
                "branches": [
                    {"id": "BR-ADH-001", "name": "Andheri Mega Superstore", "code": "ANDHERI-01"},
                    {"id": "BR-THN-001", "name": "Thane Central Experience Center", "code": "THANE-01"},
                ]
            },
        ]

        for comp_def in enterprise_companies:
            # Company
            comp = await db.get(Company, comp_def["id"])
            if not comp:
                comp = Company(
                    id=comp_def["id"],
                    name=comp_def["name"],
                    gst_number=comp_def["gst_number"],
                    is_active=True,
                )
                db.add(comp)
            else:
                comp.name = comp_def["name"]
                comp.gst_number = comp_def["gst_number"]
                comp.is_active = True

            # Database Registry (READY)
            reg = await db.get(CompanyDatabaseRegistry, comp_def["id"])
            if not reg:
                reg = CompanyDatabaseRegistry(
                    company_id=comp_def["id"],
                    database_id=f"db-{comp_def['id'].lower()}",
                    database_name=comp_def["db_name"],
                    status="READY",
                )
                db.add(reg)
            else:
                reg.status = "READY"
                reg.database_name = comp_def["db_name"]

            # Branches
            for br_def in comp_def["branches"]:
                br = await db.get(Branch, br_def["id"])
                if not br:
                    br = Branch(
                        id=br_def["id"],
                        company_id=comp_def["id"],
                        name=br_def["name"],
                        code=br_def["code"],
                        is_active=True,
                    )
                    db.add(br)
                else:
                    br.name = br_def["name"]
                    br.code = br_def["code"]
                    br.company_id = comp_def["id"]
                    br.is_active = True

        await db.flush()

        # 2. Users: admin (SYSADMIN - global access to all companies), manager, cashier
        users_to_seed = [
            ("admin", "admin@smritibooks.com", "Admin@123", UserRole.SYSADMIN, "role-sysadmin", None, None),
            ("manager", "manager@smritibooks.com", "Password@123", UserRole.MANAGER, "role-manager", "COMP-001", "BR-MAIN-001"),
            ("cashier", "cashier@smritibooks.com", "Cashier@123", UserRole.CASHIER, "role-cashier", "COMP-001", "BR-MAIN-001"),
        ]

        for uname, email, pwd, role_enum, role_id, comp_id, branch_id in users_to_seed:
            res = await db.execute(select(User).where(User.username == uname))
            u = res.scalars().first()
            if not u:
                u = User(
                    id=f"usr-{uname}",
                    username=uname,
                    email=email,
                    hashed_password=hash_password(pwd),
                    role=role_enum,
                    role_id=role_id,
                    is_active=True,
                    is_deleted=False,
                    company_id=comp_id,
                    branch_id=branch_id,
                    status="Active",
                )
                db.add(u)
                await db.flush()
            else:
                u.hashed_password = hash_password(pwd)
                u.role = role_enum
                u.role_id = role_id
                u.is_active = True
                u.is_deleted = False
                u.status = "Active"

            # Assign all 3 companies to admin, and COMP-001 to manager and cashier
            target_comps = ["COMP-001", "COMP-002", "COMP-003"] if role_enum == UserRole.SYSADMIN else ["COMP-001"]
            for target_c in target_comps:
                res_uca = await db.execute(
                    select(UserCompanyAssignment).where(
                        UserCompanyAssignment.user_id == u.id,
                        UserCompanyAssignment.company_id == target_c,
                    )
                )
                if not res_uca.scalars().first():
                    db.add(
                        UserCompanyAssignment(
                            id=f"uca-{u.id}-{target_c.lower()}",
                            user_id=u.id,
                            company_id=target_c,
                            is_default=(target_c == "COMP-001"),
                            is_active=True,
                            is_deleted=False,
                        )
                    )

        await db.commit()
        print("SUCCESS: Seeded 3 Enterprise Companies with READY database registries and full SYSADMIN access!")


if __name__ == "__main__":
    asyncio.run(seed())
