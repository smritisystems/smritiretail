"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.25.3
Created      : 2026-07-18
Modified     : 2026-07-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import asyncio
import json
import sys
import uuid

sys.path.insert(0, ".")

from app.core.config import settings
from app.core.security import hash_password


async def seed_default_users():
    """
    Seeds default database users, dynamic roles, permissions, policies, dynamic menus,
    and generalized master lookup types to PostgreSQL.
    """
    import asyncpg
    url = settings.DATABASE_URL.replace("postgresql+asyncpg", "postgresql")
    conn = await asyncpg.connect(url)
    
    try:
        # 1. Ensure default company exists
        company_exists = await conn.fetchval("SELECT COUNT(*) FROM companies WHERE id = 'comp-default'")
        if not company_exists:
            print("[SMRITI DB SEED] Seeding default company...")
            await conn.execute(
                "INSERT INTO companies (id, uuid, name, gst_number, is_active, is_deleted, created_at, modified_at) "
                "VALUES ('comp-default', $1, 'Default Company', '27ABCDE1234F1Z5', true, false, now(), now())",
                str(uuid.uuid4())
            )

        # 2. Ensure default branch exists
        branch_exists = await conn.fetchval("SELECT COUNT(*) FROM branches WHERE id = 'br-default'")
        if not branch_exists:
            print("[SMRITI DB SEED] Seeding default branch...")
            await conn.execute(
                "INSERT INTO branches (id, uuid, company_id, name, code, is_active, is_deleted, created_at, modified_at) "
                "VALUES ('br-default', $1, 'comp-default', 'Default Branch', 'BR-DFT', true, false, now(), now())",
                str(uuid.uuid4())
            )

        # 3. Seed setup_completed configuration
        setup_config_exists = await conn.fetchval("SELECT COUNT(*) FROM system_configs WHERE key = 'setup_completed'")
        if not setup_config_exists:
            print("[SMRITI DB SEED] Seeding setup_completed system configuration...")
            await conn.execute(
                "INSERT INTO system_configs (id, uuid, key, value, category, is_active, is_deleted, created_at, modified_at) "
                "VALUES ('sys-setup-completed', $1, 'setup_completed', 'true', 'Setup', true, false, now(), now())",
                str(uuid.uuid4())
            )
        else:
            # Clean up existing NULL values if they exist
            await conn.execute(
                "UPDATE system_configs SET is_active = true, is_deleted = false "
                "WHERE key = 'setup_completed' AND (is_active IS NULL OR is_deleted IS NULL)"
            )

        # 4. Seed Generalized Master Lookup Types
        master_types_to_seed = [
            {"code": "department", "label": "Company Department", "field_schema": {"type": "object", "properties": {"description": {"type": "string"}}, "additionalProperties": False}},
            {"code": "designation", "label": "Employee Designation", "field_schema": {"type": "object", "properties": {"level": {"type": "integer"}}, "additionalProperties": False}},
            {"code": "gender", "label": "Gender", "field_schema": {"type": "object", "properties": {}, "additionalProperties": False}},
            {"code": "country", "label": "Country", "field_schema": {"type": "object", "properties": {"iso_code": {"type": "string"}}, "additionalProperties": False}},
            {"code": "state", "label": "State", "field_schema": {"type": "object", "properties": {"state_code": {"type": "string"}}, "additionalProperties": False}},
            {"code": "city", "label": "City", "field_schema": {"type": "object", "properties": {"district": {"type": "string"}}, "additionalProperties": False}},
            {"code": "blood_group", "label": "Blood Group", "field_schema": {"type": "object", "properties": {}, "additionalProperties": False}},
            {"code": "gst_category", "label": "GST Category", "field_schema": {"type": "object", "properties": {}, "additionalProperties": False}},
            {"code": "tax_class", "label": "Tax Class", "field_schema": {"type": "object", "properties": {"rate": {"type": "number"}}, "additionalProperties": False}},
            {"code": "currency", "label": "Currency", "field_schema": {"type": "object", "properties": {"symbol": {"type": "string"}}, "additionalProperties": False}},
            {"code": "unit", "label": "Unit of Measure", "field_schema": {"type": "object", "properties": {"abbr": {"type": "string"}}, "additionalProperties": False}},
            {"code": "payment_mode", "label": "Payment Mode", "field_schema": {"type": "object", "properties": {"requires_reference": {"type": "boolean"}}, "additionalProperties": False}},
            {"code": "reason_code", "label": "Reason Code", "field_schema": {"type": "object", "properties": {"category": {"type": "string"}}, "additionalProperties": False}}
        ]

        for mt in master_types_to_seed:
            mt_exists = await conn.fetchval("SELECT COUNT(*) FROM master_types WHERE code = $1", mt["code"])
            if not mt_exists:
                print(f"[SMRITI DB SEED] Seeding master lookup type '{mt['code']}'...")
                await conn.execute(
                    "INSERT INTO master_types (id, code, label, field_schema, ui_schema, version, evidence_level, created_at) "
                    "VALUES ($1, $2, $3, cast($4 as jsonb), cast($5 as jsonb), 1, 'D', now())",
                    str(uuid.uuid4()), mt["code"], mt["label"],
                    json.dumps(mt["field_schema"]), json.dumps({})
                )

        # 5. Seed Default Master Values (Department and Designation)
        # Fetch Master Type UUIDs
        dept_type_id = await conn.fetchval("SELECT id FROM master_types WHERE code = 'department'")
        desig_type_id = await conn.fetchval("SELECT id FROM master_types WHERE code = 'designation'")

        default_departments = [
            {"code": "DEPT-SALES", "name": "POS Sales", "data": {"description": "Retail point-of-sale checkout operations"}},
            {"code": "DEPT-OPS", "name": "Retail Operations", "data": {"description": "General store management and floorspace"}},
            {"code": "DEPT-FIN", "name": "Finance", "data": {"description": "Accounting, taxation, and billing verification"}},
            {"code": "DEPT-LOG", "name": "Logistics", "data": {"description": "Warehouse and stock receipt management"}}
        ]
        
        for dept in default_departments:
            exists = await conn.fetchval("SELECT COUNT(*) FROM master_values WHERE master_type_id = $1 AND code = $2", dept_type_id, dept["code"])
            if not exists:
                print(f"[SMRITI DB SEED] Seeding department value '{dept['name']}'...")
                await conn.execute(
                    "INSERT INTO master_values (id, master_type_id, code, name, data, active, sort_order, updated_at, is_deleted) "
                    "VALUES ($1, $2, $3, $4, cast($5 as jsonb), true, 0, now(), false)",
                    str(uuid.uuid4()), dept_type_id, dept["code"], dept["name"], json.dumps(dept["data"])
                )

        default_designations = [
            {"code": "DESIG-SR-CASHIER", "name": "Senior Cashier", "data": {"level": 2}},
            {"code": "DESIG-MGR", "name": "Store Manager", "data": {"level": 5}},
            {"code": "DESIG-CASHIER", "name": "Cashier Operator", "data": {"level": 1}},
            {"code": "DESIG-CLERK", "name": "Inventory Clerk", "data": {"level": 1}}
        ]

        for desig in default_designations:
            exists = await conn.fetchval("SELECT COUNT(*) FROM master_values WHERE master_type_id = $1 AND code = $2", desig_type_id, desig["code"])
            if not exists:
                print(f"[SMRITI DB SEED] Seeding designation value '{desig['name']}'...")
                await conn.execute(
                    "INSERT INTO master_values (id, master_type_id, code, name, data, active, sort_order, updated_at, is_deleted) "
                    "VALUES ($1, $2, $3, $4, cast($5 as jsonb), true, 0, now(), false)",
                    str(uuid.uuid4()), desig_type_id, desig["code"], desig["name"], json.dumps(desig["data"])
                )

        # 6. Seed Dynamic Roles (SSACF)
        roles_to_seed = [
            {"id": "role-sysadmin", "code": "SYSADMIN", "name": "System Administrator", "description": "Global administrator with root system access", "is_system_role": True},
            {"id": "role-administrator", "code": "ADMINISTRATOR", "name": "Platform Administrator", "description": "Platform admin managing system, security and roles", "is_system_role": True},
            {"id": "role-owner", "code": "OWNER", "name": "Business Owner", "description": "Ultimate business owner with full company rights", "is_system_role": True},
            {"id": "role-company-admin", "code": "COMPANY_ADMIN", "name": "Company Administrator", "description": "Administrator scoped to entire company operations", "is_system_role": True},
            {"id": "role-branch-admin", "code": "BRANCH_ADMIN", "name": "Branch Administrator", "description": "Administrator scoped to branch level operations", "is_system_role": True},
            {"id": "role-manager", "code": "MANAGER", "name": "Store Manager", "description": "Full business manager role scoped to company and branch", "is_system_role": True},
            {"id": "role-supervisor", "code": "SUPERVISOR", "name": "Shift Supervisor", "description": "Supervisor managing shift and cashier operations", "is_system_role": True},
            {"id": "role-staff", "code": "STAFF", "name": "General Staff", "description": "General store staff with catalog and sales view access", "is_system_role": True},
            {"id": "role-cashier", "code": "CASHIER", "name": "Cashier Operator", "description": "Point-of-Sale checkout terminal operator", "is_system_role": True},
            {"id": "role-reporter", "code": "REPORT_USER", "name": "Report Viewer", "description": "Read-only auditor with report generation access", "is_system_role": True},
            {"id": "role-viewer", "code": "VIEWER", "name": "System Viewer", "description": "Read-only guest viewer", "is_system_role": True}
        ]

        for role in roles_to_seed:
            exists = await conn.fetchval("SELECT COUNT(*) FROM smriti_roles WHERE code = $1", role["code"])
            if not exists:
                print(f"[SMRITI DB SEED] Seeding dynamic role '{role['code']}'...")
                await conn.execute(
                    "INSERT INTO smriti_roles (id, uuid, code, name, description, parent_role_id, is_system_role, is_active, is_deleted, created_at, modified_at) "
                    "VALUES ($1, $2, $3, $4, $5, NULL, $6, true, false, now(), now())",
                    role["id"], str(uuid.uuid4()), role["code"], role["name"], role["description"], role["is_system_role"]
                )

        # 7. Seed Dynamic Permissions from Manifest
        from app.core.permissions import MANIFEST
        for perm in MANIFEST:
            exists = await conn.fetchval("SELECT COUNT(*) FROM smriti_permissions WHERE code = $1", perm.code)
            if not exists:
                print(f"[SMRITI DB SEED] Seeding dynamic permission '{perm.code}'...")
                await conn.execute(
                    "INSERT INTO smriti_permissions (id, uuid, code, resource, action, scope, module, description, is_active, is_deleted, created_at, modified_at) "
                    "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, false, now(), now())",
                    f"perm-{perm.code.lower().replace('.', '-')}", str(uuid.uuid4()), perm.code, perm.resource, perm.action, perm.scope, perm.module, perm.description
                )

        # 7.5 Seed Decoupled Functional Permission Sets
        permission_sets_to_seed = [
            {"id": "pol-sales-mgmt", "code": "POL-SALES-MGMT", "name": "Sales Management Policy"},
            {"id": "pol-inventory-mgmt", "code": "POL-INVENTORY-MGMT", "name": "Inventory Management Policy"},
            {"id": "pol-crm-mgmt", "code": "POL-CRM-MGMT", "name": "CRM Management Policy"},
            {"id": "pol-purchase-mgmt", "code": "POL-PURCHASE-MGMT", "name": "Purchase Management Policy"},
            {"id": "pol-reporting", "code": "POL-REPORTING", "name": "Reporting Policy"},
            {"id": "pol-security-admin", "code": "POL-SECURITY-ADMIN", "name": "Security Administration Policy"},
            {"id": "pol-core-view", "code": "POL-CORE-VIEW", "name": "Core View Policy"}
        ]
        for pol in permission_sets_to_seed:
            exists = await conn.fetchval("SELECT COUNT(*) FROM smriti_permission_sets WHERE code = $1", pol["code"])
            if not exists:
                print(f"[SMRITI DB SEED] Seeding permission set '{pol['code']}'...")
                await conn.execute(
                    "INSERT INTO smriti_permission_sets (id, uuid, code, name, description, is_active, is_deleted, created_at, modified_at) "
                    "VALUES ($1, $2, $3, $4, $5, true, false, now(), now())",
                    pol["id"], str(uuid.uuid4()), pol["code"], pol["name"], pol["name"]
                )

        # 7.6 Map Permissions to Permission Sets
        permission_set_perm_mappings = {
            "POL-SALES-MGMT": [
                "SALES.CREATE", "SALES.UPDATE", "SALES.APPROVE", "SALES.VIEW", "SALES.DELETE", 
                "POS.CHECKOUT", "POS.OPEN_SHIFT", "POS.CLOSE_SHIFT",
                "billing.pos", "billing.tax", "billing.return", "billing.void", 
                "billing.import", "billing.recall", "billing.discount", "billing.override", 
                "billing.reprint", "billing.salesperson.view", "billing.salesperson.assign", 
                "billing.salesperson.override"
            ],
            "POL-INVENTORY-MGMT": ["ITEM.CREATE", "ITEM.VIEW", "ITEM.UPDATE", "ITEM.DELETE"],
            "POL-CRM-MGMT": ["CRM.MANAGE_CUSTOMERS", "CRM.VIEW_LOYALTY"],
            "POL-PURCHASE-MGMT": ["PURCHASE.CREATE", "PURCHASE.UPDATE", "PURCHASE.APPROVE", "PURCHASE.VIEW", "PURCHASE.DELETE", "SUPPLIER.MANAGE"],
            "POL-REPORTING": ["REPORT.VIEW", "REPORT.EXPORT"],
            "POL-SECURITY-ADMIN": ["SECURITY.MANAGE_ROLES", "SECURITY.MANAGE_POLICIES", "SECURITY.VIEW_SETTINGS", "SYSTEM.CONFIG"],
            "POL-CORE-VIEW": ["SALES.VIEW", "ITEM.VIEW", "REPORT.VIEW"]
        }

        for perm_set_code, perm_codes in permission_set_perm_mappings.items():
            permission_set_id = await conn.fetchval("SELECT id FROM smriti_permission_sets WHERE code = $1", perm_set_code)
            if not permission_set_id:
                continue
            for p_code in perm_codes:
                perm_id = await conn.fetchval("SELECT id FROM smriti_permissions WHERE code = $1", p_code)
                if not perm_id:
                    continue
                mapping_exists = await conn.fetchval(
                    "SELECT COUNT(*) FROM smriti_permission_set_permissions WHERE permission_set_id = $1 AND permission_id = $2",
                    permission_set_id, perm_id
                )
                if not mapping_exists:
                    await conn.execute(
                        "INSERT INTO smriti_permission_set_permissions (id, uuid, permission_set_id, permission_id, permission_type, created_at, modified_at) "
                        "VALUES ($1, $2, $3, $4, 'ALLOW', now(), now())",
                        str(uuid.uuid4()), str(uuid.uuid4()), permission_set_id, perm_id
                    )

        # 7.7 Map Permission Sets to Roles
        role_permission_set_mappings = {
            "ADMINISTRATOR": ["POL-SALES-MGMT", "POL-INVENTORY-MGMT", "POL-CRM-MGMT", "POL-PURCHASE-MGMT", "POL-REPORTING", "POL-SECURITY-ADMIN"],
            "OWNER": ["POL-SALES-MGMT", "POL-INVENTORY-MGMT", "POL-CRM-MGMT", "POL-PURCHASE-MGMT", "POL-REPORTING"],
            "COMPANY_ADMIN": ["POL-SALES-MGMT", "POL-INVENTORY-MGMT", "POL-CRM-MGMT", "POL-PURCHASE-MGMT", "POL-REPORTING"],
            "BRANCH_ADMIN": ["POL-SALES-MGMT", "POL-INVENTORY-MGMT", "POL-CRM-MGMT", "POL-PURCHASE-MGMT", "POL-REPORTING"],
            "MANAGER": ["POL-SALES-MGMT", "POL-INVENTORY-MGMT", "POL-CRM-MGMT", "POL-PURCHASE-MGMT", "POL-REPORTING"],
            "SUPERVISOR": ["POL-SALES-MGMT", "POL-INVENTORY-MGMT"],
            "STAFF": ["POL-CORE-VIEW"],
            "CASHIER": ["POL-SALES-MGMT", "POL-CRM-MGMT"],
            "REPORT_USER": ["POL-REPORTING"],
            "VIEWER": ["POL-CORE-VIEW"]
        }

        for role_code, perm_set_codes in role_permission_set_mappings.items():
            role_id = await conn.fetchval("SELECT id FROM smriti_roles WHERE code = $1", role_code)
            if not role_id:
                continue
            for pol_code in perm_set_codes:
                permission_set_id = await conn.fetchval("SELECT id FROM smriti_permission_sets WHERE code = $1", pol_code)
                if not permission_set_id:
                    continue
                mapping_exists = await conn.fetchval(
                    "SELECT COUNT(*) FROM smriti_role_permission_sets WHERE role_id = $1 AND permission_set_id = $2",
                    role_id, permission_set_id
                )
                if not mapping_exists:
                    await conn.execute(
                        "INSERT INTO smriti_role_permission_sets (id, uuid, role_id, permission_set_id, created_at, modified_at) "
                        "VALUES ($1, $2, $3, $4, now(), now())",
                        str(uuid.uuid4()), str(uuid.uuid4()), role_id, permission_set_id
                    )


        # 8. Seed Default Dynamic Menus
        menus_to_seed = [
            {"id": "menu-dashboard", "title": "Dashboard", "route": "/dashboard", "icon": "dashboard", "module": "Core", "permission": None, "seq": 1},
            {"id": "menu-inventory", "title": "Inventory", "route": "/inventory", "icon": "inventory_2", "module": "Inventory", "permission": "ITEM.CREATE", "seq": 2},
            {"id": "menu-sales", "title": "Sales Desk", "route": "/sales", "icon": "point_of_sale", "module": "Sales", "permission": "SALES.CREATE", "seq": 3},
            {"id": "menu-reports", "title": "Reports Portal", "route": "/reports", "icon": "bar_chart", "module": "Reports", "permission": "REPORT.VIEW", "seq": 4}
        ]

        for menu in menus_to_seed:
            exists = await conn.fetchval("SELECT COUNT(*) FROM smriti_menus WHERE id = $1", menu["id"])
            if not exists:
                print(f"[SMRITI DB SEED] Seeding dynamic menu '{menu['title']}'...")
                await conn.execute(
                    "INSERT INTO smriti_menus (id, uuid, parent_id, title, route, icon, module, permission, sequence, feature_flag, badge, is_active, is_deleted, created_at, modified_at) "
                    "VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, NULL, NULL, true, false, now(), now())",
                    menu["id"], str(uuid.uuid4()), menu["title"], menu["route"], menu["icon"], menu["module"], menu["permission"], menu["seq"]
                )

        # 9. Seed Default Users
        users_to_seed = [
            {
                "id": "usr-super",
                "username": "super",
                "email": "super@smritibooks.com",
                "mobile": "9999999999",
                "plain_password": "Smriti@1234",
                "role": "SYSADMIN",
                "company_id": None,
                "branch_id": None,
                "full_name": "SYSTEM ADMINISTRATOR",
                "display_name": "Super",
                "is_platform_admin": True
            },
            {
                "id": "usr-manager",
                "username": "manager",
                "email": "manager@smritibooks.com",
                "mobile": "9876543210",
                "plain_password": "Password@123",
                "role": "MANAGER",
                "company_id": "comp-default",
                "branch_id": "br-default",
                "full_name": "STORE MANAGER",
                "display_name": "Manager",
                "is_platform_admin": False
            },
            {
                "id": "usr-cashier",
                "username": "cashier",
                "email": "cashier@smritibooks.com",
                "mobile": "9876543211",
                "plain_password": "Cashier@1234",
                "role": "CASHIER",
                "company_id": "comp-default",
                "branch_id": "br-default",
                "full_name": "CASHIER OPERATOR",
                "display_name": "Cashier",
                "is_platform_admin": False
            }
        ]

        for user in users_to_seed:
            user_exists = await conn.fetchval("SELECT COUNT(*) FROM users WHERE username = $1", user["username"])
            if not user_exists:
                print(f"[SMRITI DB SEED] Seeding user '{user['username']}'...")
                hashed = hash_password(user["plain_password"])
                await conn.execute(
                    """
                    INSERT INTO users (
                        id, uuid, username, email, mobile, hashed_password, role, is_active, is_deleted,
                        is_platform_admin,
                        full_name, display_name, status, country, employment_type,
                        company_id, branch_id, created_at, modified_at
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, true, false,
                        $8,
                        $9, $10, 'Active', 'India', 'Permanent',
                        $11, $12, now(), now()
                    )
                    """,
                    user["id"], str(uuid.uuid4()), user["username"], user["email"], user["mobile"],
                    hashed, user["role"], user.get("is_platform_admin", False), user["full_name"], user["display_name"],
                    user["company_id"], user["branch_id"]
                )
            else:
                print(f"[SMRITI DB SEED] User '{user['username']}' already exists, skipping.")
                # Resilient update for is_platform_admin for existing seed users
                await conn.execute(
                    "UPDATE users SET is_platform_admin = $1 WHERE username = $2",
                    user.get("is_platform_admin", False), user["username"]
                )

            # Map user to dynamic SMRITI Role
            mapped_exists = await conn.fetchval("SELECT COUNT(*) FROM smriti_user_roles WHERE user_id = $1", user["id"])
            if not mapped_exists:
                role_code = user["role"]
                role_id = await conn.fetchval("SELECT id FROM smriti_roles WHERE code = $1", role_code)
                if role_id:
                    print(f"[SMRITI DB SEED] Mapping user '{user['username']}' to role '{role_code}'...")
                    await conn.execute(
                        "INSERT INTO smriti_user_roles (id, uuid, user_id, role_id, is_active, is_deleted, created_at, modified_at) "
                        "VALUES ($1, $2, $3, $4, true, false, now(), now())",
                        str(uuid.uuid4()), str(uuid.uuid4()), user["id"], role_id
                    )

        print("[SMRITI DB SEED] Default database seeding completed successfully.")

        # ── PricingGroups ──────────────────────────────────────────────────────
        # Five canonical groups that cover the most common Indian retail pricing
        # strategies. All are idempotent (skip if already present).
        pricing_groups = [
            {
                "id": "pg-retail",
                "name": "Retail Price",
                "description": "Standard MRP-based retail selling price. No additional discount.",
                "base_price_field": "price",
                "discount_percent": "0.00",
                "price_adjustment": "0.00",
                "rounding_rule": "Nearest1",
                "max_additional_discount_percent": "5.00",
                "tax_inclusive": True,
                "scheme_eligible": True,
                "quantity_break_eligible": False,
                "min_order_value": "0.00",
            },
            {
                "id": "pg-distributor",
                "name": "Distributor Price",
                "description": "Wholesale distributor rate. Typically 15-20% below retail.",
                "base_price_field": "price",
                "discount_percent": "15.00",
                "price_adjustment": "0.00",
                "rounding_rule": "Nearest1",
                "max_additional_discount_percent": "5.00",
                "tax_inclusive": True,
                "scheme_eligible": True,
                "quantity_break_eligible": True,
                "min_order_value": "5000.00",
            },
            {
                "id": "pg-vip",
                "name": "VIP Price",
                "description": "Premium loyalty customer rate. Fixed discount over retail.",
                "base_price_field": "price",
                "discount_percent": "10.00",
                "price_adjustment": "0.00",
                "rounding_rule": "Nearest1",
                "max_additional_discount_percent": "3.00",
                "tax_inclusive": True,
                "scheme_eligible": True,
                "quantity_break_eligible": False,
                "min_order_value": "0.00",
            },
            {
                "id": "pg-employee",
                "name": "Employee Price",
                "description": "Internal employee purchase rate. Cost-price based with no markup.",
                "base_price_field": "cost_price",
                "discount_percent": "0.00",
                "price_adjustment": "0.00",
                "rounding_rule": "Nearest1",
                "max_additional_discount_percent": "0.00",
                "tax_inclusive": True,
                "scheme_eligible": False,
                "quantity_break_eligible": False,
                "min_order_value": "0.00",
            },
            {
                "id": "pg-festival",
                "name": "Festival Price",
                "description": "Promotional seasonal pricing. Active during festive campaigns.",
                "base_price_field": "price",
                "discount_percent": "20.00",
                "price_adjustment": "0.00",
                "rounding_rule": "Nearest5",
                "max_additional_discount_percent": "0.00",
                "tax_inclusive": True,
                "scheme_eligible": True,
                "quantity_break_eligible": True,
                "min_order_value": "0.00",
            },
        ]

        for pg in pricing_groups:
            exists = await conn.fetchval(
                "SELECT COUNT(*) FROM pricing_groups WHERE id = $1", pg["id"]
            )
            if not exists:
                print(f"[SMRITI DB SEED] Seeding PricingGroup '{pg['name']}'...")
                await conn.execute(
                    """
                    INSERT INTO pricing_groups (
                        id, uuid, name, description,
                        base_price_field, discount_percent, price_adjustment,
                        rounding_rule, max_additional_discount_percent,
                        tax_inclusive, scheme_eligible, quantity_break_eligible,
                        min_order_value,
                        company_id, branch_id,
                        is_active, is_deleted, created_at, modified_at, version
                    ) VALUES (
                        $1, $2, $3, $4,
                        $5, $6, $7,
                        $8, $9,
                        $10, $11, $12,
                        $13,
                        'comp-default', 'br-default',
                        true, false, now(), now(), 1
                    )
                    """,
                    pg["id"], str(uuid.uuid4()), pg["name"], pg["description"],
                    pg["base_price_field"], pg["discount_percent"], pg["price_adjustment"],
                    pg["rounding_rule"], pg["max_additional_discount_percent"],
                    pg["tax_inclusive"], pg["scheme_eligible"], pg["quantity_break_eligible"],
                    pg["min_order_value"],
                )
            else:
                print(f"[SMRITI DB SEED] PricingGroup '{pg['name']}' already exists, skipping.")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed_default_users())
