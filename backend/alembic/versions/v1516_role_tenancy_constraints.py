"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.1
Created      : 2026-10-04
Modified     : 2026-10-04
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

v1516 — Role Tenancy Constraints.

Replaces the global role-name unique index with two partial indexes that
correctly model the dual-tenancy requirement:

1. System role templates (is_system=TRUE, company_id=NULL):
   Globally unique by name.
   Index: uq_roles_system_name ON roles(name) WHERE is_system=TRUE AND is_deleted=FALSE

2. Tenant custom roles (is_system=FALSE, company_id SET):
   Unique per company — two different companies may have a role named "Store Manager"
   Index: uq_roles_company_name ON roles(company_id, name) WHERE is_system=FALSE AND is_deleted=FALSE

Phase 1C Live DB Verification confirmed:
  - Current uniqueness: UNIQUE INDEX ix_roles_name (global, non-partial)
  - 15 existing system roles, all company_id=NULL, all is_system=TRUE
  - 0 custom roles — no data migration required
  - All 15 names are distinct — both new indexes apply without conflicts

Revision ID: v1516_role_tenancy_constraints
Revises    : v1515_sales_schema_tenant_hardening
Create Date: 2026-10-04
"""

from alembic import op
from sqlalchemy import text

revision = "v1516_role_tenancy_constraints"
down_revision = "v1515_sales_schema_tenant_hardening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ──────────────────────────────────────────────────────────────────────────
    # Step 1 — Drop the existing global unique index on roles.name
    # Phase 1C confirmed: this is a UNIQUE INDEX named 'ix_roles_name',
    # NOT a named constraint. op.drop_constraint() would fail here.
    # ──────────────────────────────────────────────────────────────────────────
    op.drop_index("ix_roles_name", table_name="roles")

    # ──────────────────────────────────────────────────────────────────────────
    # Step 2 — Add partial index for tenant-scoped custom roles.
    # Covers: is_system=FALSE rows only.
    # Enforces: (company_id, name) uniqueness per tenant, ignoring deleted rows.
    # PostgreSQL NULL behaviour: two rows with company_id=NULL and same name
    # would NOT conflict under a standard UNIQUE index (NULL != NULL).
    # For custom roles this is acceptable — custom roles with no company_id
    # would be a data integrity error caught at the API layer.
    # ──────────────────────────────────────────────────────────────────────────
    op.create_index(
        "uq_roles_company_name",
        "roles",
        ["company_id", "name"],
        unique=True,
        postgresql_where=text("is_system = FALSE AND is_deleted = FALSE"),
    )

    # ──────────────────────────────────────────────────────────────────────────
    # Step 3 — Add partial index for global system role templates.
    # Covers: is_system=TRUE rows only (all current 15 system roles).
    # Enforces: name uniqueness globally for templates, ignoring deleted rows.
    # ──────────────────────────────────────────────────────────────────────────
    op.create_index(
        "uq_roles_system_name",
        "roles",
        ["name"],
        unique=True,
        postgresql_where=text("is_system = TRUE AND is_deleted = FALSE"),
    )


def downgrade() -> None:
    # Reverse: drop partial indexes, restore global unique index
    op.drop_index("uq_roles_system_name", table_name="roles")
    op.drop_index("uq_roles_company_name", table_name="roles")
    op.create_index(
        "ix_roles_name",
        "roles",
        ["name"],
        unique=True,
    )
