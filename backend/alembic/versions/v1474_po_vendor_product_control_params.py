"""
v1474 — PO Vendor Product Control: Seed 8 canonical SystemParameters.

Migration Safety (Execution Command Rule 28-29):
- Uses inspector to check existing param_code before INSERT.
- Never overwrites an existing company's configured value.
- Seeds GLOBAL-scope defaults only (company_id IS NULL).
- Idempotent: safe to run multiple times.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

revision: str = "v1474_po_vendor_product_control_params"
down_revision: Union[str, Sequence[str], None] = "v1473_scope_purchase_order_unique_constraint"
branch_labels = None
depends_on = None

# The 8 canonical PO vendor-control parameters (Execution Command Rule 15)
_PARAMS = [
    {
        "param_code": "SMRITI_PO_VENDOR_VISIBILITY",
        "canonical_code": "SMRITI.PURCHASE.ORDER.VENDOR_ITEM_VISIBILITY_MODE",
        "description": "What products should buyers see when creating a Purchase Order?",
        "category": "07. Purchase Order",
        "category_name": "Purchase Order",
        "data_type": "Text",
        "text_value": "ASSIGNED_PLUS_ALL",
        "mutability": "Variable",
        "profile_type": "COMMON",
    },
    {
        "param_code": "SMRITI_PO_CROSS_VENDOR_POLICY",
        "canonical_code": "SMRITI.PURCHASE.ORDER.CROSS_VENDOR_ITEM_POLICY",
        "description": "What happens when a buyer selects a product registered to a different vendor?",
        "category": "07. Purchase Order",
        "category_name": "Purchase Order",
        "data_type": "Text",
        "text_value": "ALLOW_WITH_APPROVAL",
        "mutability": "Variable",
        "profile_type": "COMMON",
    },
    {
        "param_code": "SMRITI_PO_UNASSIGNED_POLICY",
        "canonical_code": "SMRITI.PURCHASE.ORDER.UNASSIGNED_ITEM_POLICY",
        "description": "What happens when the selected product has no vendor assignment?",
        "category": "07. Purchase Order",
        "category_name": "Purchase Order",
        "data_type": "Text",
        "text_value": "ALLOW_WITH_APPROVAL",
        "mutability": "Variable",
        "profile_type": "COMMON",
    },
    {
        "param_code": "SMRITI_PO_RESTRICTED_POLICY",
        "canonical_code": "SMRITI.PURCHASE.ORDER.RESTRICTED_ITEM_POLICY",
        "description": "What happens when the product is explicitly restricted for this vendor?",
        "category": "07. Purchase Order",
        "category_name": "Purchase Order",
        "data_type": "Text",
        "text_value": "BLOCK",
        "mutability": "Variable",
        "profile_type": "COMMON",
    },
    {
        "param_code": "SMRITI_PO_SHOW_VENDOR_STATUS",
        "canonical_code": "SMRITI.PURCHASE.ORDER.SHOW_VENDOR_STATUS",
        "description": "Show vendor assignment status (Assigned/Cross-Vendor/Unassigned/Restricted) to the buyer?",
        "category": "07. Purchase Order",
        "category_name": "Purchase Order",
        "data_type": "Boolean",
        "bool_value": True,
        "mutability": "Variable",
        "profile_type": "COMMON",
    },
    {
        "param_code": "SMRITI_PO_SHOW_EXPLANATION",
        "canonical_code": "SMRITI.PURCHASE.ORDER.SHOW_EXPLANATION",
        "description": "Show business explanation when a product is not freely purchasable?",
        "category": "07. Purchase Order",
        "category_name": "Purchase Order",
        "data_type": "Boolean",
        "bool_value": True,
        "mutability": "Variable",
        "profile_type": "COMMON",
    },
    {
        "param_code": "SMRITI_PO_APPROVAL_REASON_REQUIRED",
        "canonical_code": "SMRITI.PURCHASE.ORDER.APPROVAL_REASON_REQUIRED",
        "description": "Require the buyer to provide a reason when approval is needed for a product?",
        "category": "07. Purchase Order",
        "category_name": "Purchase Order",
        "data_type": "Boolean",
        "bool_value": True,
        "mutability": "Variable",
        "profile_type": "COMMON",
    },
    {
        "param_code": "SMRITI_PO_AUDIT_APPROVAL_DECISION",
        "canonical_code": "SMRITI.PURCHASE.ORDER.AUDIT_APPROVAL_DECISION",
        "description": "Log every cross-vendor or unassigned product approval decision for audit?",
        "category": "07. Purchase Order",
        "category_name": "Purchase Order",
        "data_type": "Boolean",
        "bool_value": True,
        "mutability": "Variable",
        "profile_type": "COMMON",
    },
]


def upgrade() -> None:
    conn = op.get_bind()

    # Verify system_parameters table exists (migration safety Rule 28)
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    if "system_parameters" not in tables:
        raise RuntimeError(
            "v1474: system_parameters table not found. "
            "Ensure baseline migration has run before this migration."
        )

    cols = {c["name"] for c in inspector.get_columns("system_parameters")}
    has_canonical = "canonical_code" in cols

    for p in _PARAMS:
        # Check if this param_code already exists at GLOBAL scope
        existing = conn.execute(
            text(
                "SELECT id FROM system_parameters "
                "WHERE param_code = :pc AND company_id IS NULL LIMIT 1"
            ),
            {"pc": p["param_code"]},
        ).fetchone()

        if existing:
            # Backfill canonical_code if missing (idempotent)
            if has_canonical and p.get("canonical_code"):
                conn.execute(
                    text(
                        "UPDATE system_parameters SET canonical_code = :cc "
                        "WHERE param_code = :pc AND company_id IS NULL "
                        "AND (canonical_code IS NULL OR canonical_code = '')"
                    ),
                    {"cc": p["canonical_code"], "pc": p["param_code"]},
                )
            continue  # Never overwrite existing configured values

        # Determine the value columns present in this schema
        rec_id = f"SP-GLOBAL-{p['param_code']}"[:50]
        bool_val = p.get("bool_value")
        text_val = p.get("text_value", "")

        if has_canonical:
            conn.execute(
                text(
                    "INSERT INTO system_parameters "
                    "(id, company_id, branch_id, param_code, canonical_code, "
                    " description, category, category_name, data_type, "
                    " text_value, bool_value, integer_value, decimal_value, "
                    " mutability, profile_type, scope_level, terminal_id, is_locked) "
                    "VALUES "
                    "(:id, NULL, NULL, :pc, :cc, "
                    " :desc, :cat, :cat_name, :dt, "
                    " :tv, :bv, NULL, NULL, "
                    " :mut, :pt, 'GLOBAL', 'COMMON', FALSE)"
                ),
                {
                    "id": rec_id,
                    "pc": p["param_code"],
                    "cc": p.get("canonical_code"),
                    "desc": p["description"],
                    "cat": p["category"],
                    "cat_name": p["category_name"],
                    "dt": p["data_type"],
                    "tv": text_val,
                    "bv": bool_val,
                    "mut": p["mutability"],
                    "pt": p["profile_type"],
                },
            )
        else:
            conn.execute(
                text(
                    "INSERT INTO system_parameters "
                    "(id, company_id, branch_id, param_code, "
                    " description, category, category_name, data_type, "
                    " text_value, bool_value, integer_value, decimal_value, "
                    " mutability, profile_type, scope_level, terminal_id, is_locked) "
                    "VALUES "
                    "(:id, NULL, NULL, :pc, "
                    " :desc, :cat, :cat_name, :dt, "
                    " :tv, :bv, NULL, NULL, "
                    " :mut, :pt, 'GLOBAL', 'COMMON', FALSE)"
                ),
                {
                    "id": rec_id,
                    "pc": p["param_code"],
                    "desc": p["description"],
                    "cat": p["category"],
                    "cat_name": p["category_name"],
                    "dt": p["data_type"],
                    "tv": text_val,
                    "bv": bool_val,
                    "mut": p["mutability"],
                    "pt": p["profile_type"],
                },
            )


def downgrade() -> None:
    conn = op.get_bind()
    param_codes = [p["param_code"] for p in _PARAMS]
    conn.execute(
        text(
            "DELETE FROM system_parameters "
            "WHERE param_code = ANY(:codes) AND company_id IS NULL"
        ),
        {"codes": param_codes},
    )
