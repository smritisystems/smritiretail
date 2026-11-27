"""Add role_id to users table and seed 12 industry-standard roles.

Revision ID: v1335_add_user_role_id_and_seed_roles
Revises: v1334_add_v325_enterprise_tables
Create Date: 2026-08-16 19:10:00.000000

"""
import json
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'v1335_seed_roles'
down_revision = 'v1334_add_v325_enterprise'
branch_labels = None
depends_on = None

ROLES_SEED = [
    {
        "id": "role-store-manager",
        "name": "Store Manager",
        "description": "Full operational access to store POS, inventory, reports, staff, and purchase orders.",
        "permissions_json": json.dumps(["pos.sell", "inventory.view", "inventory.manage", "reports.view", "staff.manage", "settings.manage", "purchase.write", "roles.manage"]),
        "is_system": True
    },
    {
        "id": "role-cashier",
        "name": "Cashier",
        "description": "Front-desk POS sales billing, customer lookup, and basic inventory viewing.",
        "permissions_json": json.dumps(["pos.sell", "inventory.view", "reports.view"]),
        "is_system": True
    },
    {
        "id": "role-inventory-manager",
        "name": "Inventory Manager",
        "description": "Stock balance management, stock movements, product master edits, and warehouse operations.",
        "permissions_json": json.dumps(["inventory.view", "inventory.manage", "inventory.transfer", "products.manage", "reports.view"]),
        "is_system": True
    },
    {
        "id": "role-sales-executive",
        "name": "Sales Executive",
        "description": "Sales quotations, sales orders, customer CRM interaction, and POS billing.",
        "permissions_json": json.dumps(["pos.sell", "sales.quote", "sales.order", "customers.manage", "reports.view"]),
        "is_system": True
    },
    {
        "id": "role-purchase-executive",
        "name": "Purchase Executive",
        "description": "Purchase order creation, GRN entry, supplier management, and purchase studio operations.",
        "permissions_json": json.dumps(["purchase.read", "purchase.write", "suppliers.manage", "grn.manage", "reports.view"]),
        "is_system": True
    },
    {
        "id": "role-accountant",
        "name": "Accountant",
        "description": "Financial ledger review, supplier payment entries, tax reporting, and audit logs.",
        "permissions_json": json.dumps(["accounting.view", "accounting.manage", "payments.manage", "reports.view", "reports.print", "reports.export"]),
        "is_system": True
    },
    {
        "id": "role-report-user",
        "name": "Report User",
        "description": "Analytical report viewing, scheduled report exports, printing, and email distribution.",
        "permissions_json": json.dumps(["reports.view", "reports.print", "reports.export", "reports.email", "reports.schedule"]),
        "is_system": True
    },
    {
        "id": "role-viewer",
        "name": "Viewer",
        "description": "Read-only access across standard business modules without modification rights.",
        "permissions_json": json.dumps(["inventory.view", "reports.view", "sales.view", "purchase.read"]),
        "is_system": True
    },
    {
        "id": "role-branch-admin",
        "name": "Branch Admin",
        "description": "Branch-scoped administrative control over users, POS profiles, and local settings.",
        "permissions_json": json.dumps(["pos.sell", "inventory.manage", "reports.view", "reports.export", "staff.manage", "settings.manage"]),
        "is_system": True
    },
    {
        "id": "role-hr-executive",
        "name": "HR Executive",
        "description": "Staff profile management, attendance monitoring, payroll processing, and onboarding.",
        "permissions_json": json.dumps(["staff.manage", "attendance.manage", "payroll.view", "reports.view"]),
        "is_system": True
    },
    {
        "id": "role-auditor",
        "name": "Auditor",
        "description": "Compliance auditing, stock verification audit logs, and read-only financial review.",
        "permissions_json": json.dumps(["audit.view", "reports.view", "reports.export", "inventory.view", "accounting.view"]),
        "is_system": True
    },
    {
        "id": "role-sysadmin",
        "name": "Sysadmin",
        "description": "Global system administrator with unrestricted access across all tenants, roles, and settings.",
        "permissions_json": json.dumps(["*"]),
        "is_system": True
    }
]


def upgrade():
    # 1. Add role_id column to users table if missing
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('users')]
    
    if 'role_id' not in columns:
        op.add_column('users', sa.Column('role_id', sa.String(length=50), nullable=True))
        op.create_foreign_key('fk_users_role_id', 'users', 'roles', ['role_id'], ['id'], ondelete='SET NULL')
        op.create_index(op.f('ix_users_role_id'), 'users', ['role_id'], unique=False)

    # 2. Seed 12 industry-standard roles into roles table
    for r in ROLES_SEED:
        op.execute(
            sa.text(
                """
                INSERT INTO roles (id, uuid, name, description, permissions_json, is_system, is_deleted, created_at, modified_at)
                VALUES (:id, :id, :name, :description, :permissions_json, :is_system, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (name) DO UPDATE SET
                    description = EXCLUDED.description,
                    permissions_json = EXCLUDED.permissions_json,
                    modified_at = CURRENT_TIMESTAMP
                """
            ).bindparams(
                id=r["id"],
                name=r["name"],
                description=r["description"],
                permissions_json=r["permissions_json"],
                is_system=r["is_system"]
            )
        )


def downgrade():
    op.drop_constraint('fk_users_role_id', 'users', type_='foreignkey')
    op.drop_index(op.f('ix_users_role_id'), table_name='users')
    op.drop_column('users', 'role_id')
