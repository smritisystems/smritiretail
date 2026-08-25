"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.0
Created      : 2026-08-18
Modified     : 2026-08-23
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
    import app.models.company_registry
    from app.models.auth import User, UserRole
    from app.models.role import Role
    from app.models.tenant import Company, Branch
    from app.models.company_registry import CompanyDatabaseRegistry
    from app.models.user_assignment import UserCompanyAssignment, UserBranchAssignment
    from app.core.security import hash_password
except ImportError:
    from backend.app.db.session import async_session
    import backend.app.models.role
    import backend.app.models.auth
    import backend.app.models.tenant
    import backend.app.models.user_assignment
    import backend.app.models.company_registry
    from backend.app.models.auth import User, UserRole
    from backend.app.models.role import Role
    from backend.app.models.tenant import Company, Branch
    from backend.app.models.company_registry import CompanyDatabaseRegistry
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
                res_br = await db.execute(
                    select(Branch).where(
                        (Branch.id == br_def["id"]) | (Branch.code == br_def["code"])
                    )
                )
                br = res_br.scalars().first()
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

        # 2. Users: admin, sysadmin, manager, cashier with standard hashes
        users_to_seed = [
            ("admin", "usr-admin", "admin@smritibooks.com", "Admin@123", UserRole.SYSADMIN, "role-sysadmin", None, None),
            ("sysadmin", "usr-sysadmin-direct", "sysadmin_direct@smritibooks.com", "Admin@123", UserRole.SYSADMIN, "role-sysadmin", None, None),
            ("usr_sysadmin", "usr-sysadmin", "sysadmin@smritibooks.com", "Admin@123", UserRole.SYSADMIN, "role-sysadmin", None, None),
            ("usr_super", "usr-super", "super@smritibooks.com", "Admin@123", UserRole.SYSADMIN, "role-sysadmin", None, None),
            ("manager", "usr-manager-direct", "manager@smritibooks.com", "Manager@123", UserRole.MANAGER, "role-manager", "COMP-001", "BR-MAIN-001"),
            ("usr_manager", "usr-manager", "usr_manager@smritibooks.com", "Manager@123", UserRole.MANAGER, "role-manager", "COMP-001", "BR-MAIN-001"),
            ("usr_store_manager_a", "usr-store-manager-a", "store_mgr_a@smritibooks.com", "Manager@123", UserRole.MANAGER, "role-manager", "COMP-001", "BR-MAIN-001"),
            ("cashier", "usr-cashier-direct", "cashier@smritibooks.com", "Cashier@123", UserRole.CASHIER, "role-cashier", "COMP-001", "BR-MAIN-001"),
            ("usr_cashier", "usr-cashier", "usr_cashier@smritibooks.com", "Cashier@123", UserRole.CASHIER, "role-cashier", "COMP-001", "BR-MAIN-001"),
        ]

        for uname, target_id, email, pwd, role_enum, role_id, comp_id, target_branch_code in users_to_seed:
            
            # Resolve actual branch ID in database
            actual_branch_id = None
            if comp_id:
                res_b = await db.execute(
                    select(Branch).where(
                        (Branch.company_id == comp_id) & 
                        ((Branch.id == target_branch_code) | (Branch.code == target_branch_code) | (Branch.code == "MAIN") | (Branch.id == "MAIN"))
                    )
                )
                b_match = res_b.scalars().first()
                if b_match:
                    actual_branch_id = b_match.id

            res = await db.execute(
                select(User).where((User.username == uname) | (User.id == target_id))
            )
            u = res.scalars().first()
            if not u:
                u = User(
                    id=target_id,
                    username=uname,
                    email=email,
                    hashed_password=hash_password(pwd),
                    role=role_enum,
                    role_id=role_id,
                    is_active=True,
                    is_deleted=False,
                    company_id=comp_id,
                    branch_id=actual_branch_id,
                    status="Active",
                )
                db.add(u)
                await db.flush()
            else:
                u.username = uname
                u.email = email
                u.hashed_password = hash_password(pwd)
                u.role = role_enum
                u.role_id = role_id
                u.is_active = True
                u.is_deleted = False
                u.status = "Active"
                if comp_id:
                    u.company_id = comp_id
                u.branch_id = actual_branch_id

            # Assign all 3 companies to sysadmin roles, and COMP-001 to manager and cashier
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

        # 3. Seed baseline customer groups and active customers for billing
        try:
            from app.models.crm import CustomerGroup, Customer
        except ImportError:
            from backend.app.models.crm import CustomerGroup, Customer

        # 3. Seed baseline customer groups and active customers for billing
        try:
            from app.models.crm import CustomerGroup, Customer
            from app.db.session import get_company_sessionmaker
        except ImportError:
            from backend.app.models.crm import CustomerGroup, Customer
            from backend.app.db.session import get_company_sessionmaker

        async def _seed_crm_data(target_session, comp_id="COMP-001"):
            cg_retail = await target_session.get(CustomerGroup, "CG-Retail")
            if not cg_retail:
                cg_retail = CustomerGroup(
                    id="CG-Retail",
                    name="Retail Clients",
                    credit_limit=100000.00,
                    credit_days=30,
                    company_id=comp_id,
                    branch_id=None
                )
                target_session.add(cg_retail)

            cg_corp = await target_session.get(CustomerGroup, "CG-Corporate")
            if not cg_corp:
                cg_corp = CustomerGroup(
                    id="CG-Corporate",
                    name="Corporate Clients",
                    credit_limit=500000.00,
                    credit_days=60,
                    company_id=comp_id,
                    branch_id=None
                )
                target_session.add(cg_corp)

            cg_large = await target_session.get(CustomerGroup, "CG-LargeRetail")
            if not cg_large:
                cg_large = CustomerGroup(
                    id="CG-LargeRetail",
                    name="Large-Format Retail",
                    credit_limit=1000000.00,
                    credit_days=90,
                    company_id=comp_id,
                    branch_id=None
                )
                target_session.add(cg_large)
            await target_session.flush()

            baseline_customers = [
                {
                    "id": "CUST-001",
                    "code": "CUST-001",
                    "name": "Reliance Retail Limited",
                    "mobile": "9822334455",
                    "email": "operations@relianceretail.com",
                    "gst_number": "29AABCR1718E1ZL",
                    "customer_group_id": "CG-LargeRetail",
                    "outstanding": 180000.00,
                    "company_id": comp_id,
                    "branch_id": None
                },
                {
                    "id": "CUST-002",
                    "code": "CUST-002",
                    "name": "Shoppers Stop Ltd",
                    "mobile": "9833445566",
                    "email": "billing@shoppersstop.com",
                    "gst_number": "27AAACS4321E1Z2",
                    "customer_group_id": "CG-LargeRetail",
                    "outstanding": 250000.00,
                    "company_id": comp_id,
                    "branch_id": None
                },
                {
                    "id": "CUST-003",
                    "code": "CUST-003",
                    "name": "Lifestyle International",
                    "mobile": "9844556677",
                    "email": "accounts@lifestylestores.com",
                    "gst_number": "27AAACL5678A1Z3",
                    "customer_group_id": "CG-Corporate",
                    "outstanding": 120000.00,
                    "company_id": comp_id,
                    "branch_id": None
                },
                {
                    "id": "CUST-WALKIN",
                    "code": "WALK-IN",
                    "name": "Walk-In / Cash Customer",
                    "mobile": "9999999999",
                    "customer_group_id": "CG-Retail",
                    "outstanding": 0.00,
                    "company_id": comp_id,
                    "branch_id": None
                }
            ]

            for cust_data in baseline_customers:
                c = await target_session.get(Customer, cust_data["id"])
                if not c:
                    c = Customer(**cust_data)
                    target_session.add(c)
                else:
                    for k, v in cust_data.items():
                        setattr(c, k, v)
            await target_session.commit()

        # Seed into control DB
        await _seed_crm_data(db, "COMP-001")

        # Seed into tenant company DBs
        for comp_db in ["smriti001", "smriti002", "smriti003"]:
            try:
                comp_sm = get_company_sessionmaker(comp_db)
                async with comp_sm() as cdb:
                    await _seed_crm_data(cdb, "COMP-001")
            except Exception as e:
                print(f"Notice: seeding into company db {comp_db}: {e}")

        print("SUCCESS: Seeded Enterprise Companies with READY database registries, authenticated users, and CRM customers across all databases!")


if __name__ == "__main__":
    asyncio.run(seed())
