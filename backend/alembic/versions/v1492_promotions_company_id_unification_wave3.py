"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-25
Modified     : 2026-09-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: SMRITI Phase 1 Schema Remediation — Wave 3

Phase 1 Schema Remediation Wave 3 — Promotions Tenant Column Unification (Expand Phase).

This migration unifies tenant discrimination across all 18 canonical sales promotion tables
by adding company_id (referencing companies.id), backfilling from tenant_id, and creating
company-scoped unique and lookup indexes. This resolves the split-identity tenant model
between promotions (tenant_id) and the rest of SMRITI Retail OS (company_id).

Audit Source: SMRITI_Phase1_Schema_Audit_v1.0.0.md
Findings: A-001 (CRITICAL), H-002 (MEDIUM)

Revision ID: v1492_promotions_company_id_unification_wave3
Revises: v1491_additive_check_constraints_wave2
Create Date: 2026-09-25
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "v1492_promotions_company_id_unification_wave3"
down_revision: str | Sequence[str] | None = "v1491_additive_check_constraints_wave2"
branch_labels = None
depends_on = None

# All 18 canonical promotions tables that receive company_id
_PROMO_TABLES = [
    "smriti_promotions",
    "smriti_promotion_versions",
    "smriti_promotion_rules",
    "smriti_promotion_conditions",
    "smriti_promotion_rewards",
    "smriti_promotion_scopes",
    "smriti_promotion_scope_items",
    "smriti_promotion_qualifications",
    "smriti_promotion_redemptions",
    "smriti_promotion_redemption_items",
    "smriti_promotion_declines",
    "smriti_promotion_overrides",
    "smriti_promotion_audit",
    "smriti_promotion_imports",
    "smriti_promotion_import_rows",
    "smriti_promotion_simulations",
    "smriti_promotion_simulation_items",
    "smriti_promotion_conflicts",
]


def upgrade() -> None:
    """
    Expand phase: Add company_id, backfill from tenant_id, and create company-scoped indexes.
    Zero-downtime: existing tenant_id column and constraints remain active.
    """
    # 1. Add company_id and index to all 18 tables
    for table in _PROMO_TABLES:
        op.add_column(
            table,
            sa.Column(
                "company_id",
                sa.String(50),
                sa.ForeignKey("companies.id", ondelete="RESTRICT"),
                nullable=True,
            ),
        )
        # Backfill company_id = tenant_id for any existing data
        op.execute(
            f"UPDATE {table} SET company_id = tenant_id WHERE company_id IS NULL AND tenant_id IS NOT NULL;"
        )
        # Add index on company_id
        op.create_index(f"ix_{table}_company_id", table, ["company_id"])

    # 2. Add company-scoped unique constraints and composite indexes
    op.create_unique_constraint(
        "uq_smriti_promotions_company_code",
        "smriti_promotions",
        ["company_id", "promotion_code"],
    )
    op.create_index(
        "idx_smriti_promotions_company_active_lookup",
        "smriti_promotions",
        ["company_id", "status", "is_active", "start_at", "end_at"],
    )

    op.create_unique_constraint(
        "uq_smriti_promo_versions_company_ver",
        "smriti_promotion_versions",
        ["company_id", "promotion_id", "version_no"],
    )
    op.create_index(
        "idx_smriti_promo_versions_company_lookup",
        "smriti_promotion_versions",
        ["company_id", "promotion_id", "status", "effective_from", "effective_to"],
    )

    op.create_unique_constraint(
        "uq_smriti_promo_rules_company_seq",
        "smriti_promotion_rules",
        ["company_id", "promotion_version_id", "rule_no"],
    )

    op.create_unique_constraint(
        "uq_smriti_promo_conditions_company_seq",
        "smriti_promotion_conditions",
        ["company_id", "promotion_rule_id", "sequence_no"],
    )

    op.create_unique_constraint(
        "uq_smriti_scope_items_company_barcode",
        "smriti_promotion_scope_items",
        ["company_id", "promotion_scope_id", "barcode"],
    )

    op.create_unique_constraint(
        "uq_smriti_import_rows_company_seq",
        "smriti_promotion_import_rows",
        ["company_id", "import_id", "row_number"],
    )


def downgrade() -> None:
    """
    Rollback: Drop all company-scoped constraints and indexes, then drop company_id columns.
    """
    # 1. Drop company-scoped unique constraints and composite indexes
    op.drop_constraint("uq_smriti_import_rows_company_seq", "smriti_promotion_import_rows", type_="unique")
    op.drop_constraint("uq_smriti_scope_items_company_barcode", "smriti_promotion_scope_items", type_="unique")
    op.drop_constraint("uq_smriti_promo_conditions_company_seq", "smriti_promotion_conditions", type_="unique")
    op.drop_constraint("uq_smriti_promo_rules_company_seq", "smriti_promotion_rules", type_="unique")

    op.drop_index("idx_smriti_promo_versions_company_lookup", table_name="smriti_promotion_versions")
    op.drop_constraint("uq_smriti_promo_versions_company_ver", "smriti_promotion_versions", type_="unique")

    op.drop_index("idx_smriti_promotions_company_active_lookup", table_name="smriti_promotions")
    op.drop_constraint("uq_smriti_promotions_company_code", "smriti_promotions", type_="unique")

    # 2. Drop company_id indexes and columns from all 18 tables
    for table in reversed(_PROMO_TABLES):
        op.drop_index(f"ix_{table}_company_id", table_name=table)
        op.drop_column(table, "company_id")
