"""
v1477 — Seed PO cross-vendor approval reason master type and default reason values.

Uses existing master_types / master_values architecture (Execution Command Rule 21).
Does NOT create a new lookup framework.
"""
from typing import Sequence, Union
import uuid as _uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

revision: str = "v1477_po_cross_vendor_reason_master"
down_revision: Union[str, Sequence[str], None] = "v1476_po_product_decision_log"
branch_labels = None
depends_on = None

_TYPE_CODE = "PO_CROSS_VENDOR_REASON"

_REASONS = [
    ("BETTER_PRICE",            "Better Price Available"),
    ("STOCK_AVAILABILITY",      "Stock Not Available from Registered Vendor"),
    ("REGISTERED_VENDOR_OOS",   "Registered Vendor is Out of Stock"),
    ("URGENT_REQUIREMENT",      "Urgent Requirement"),
    ("BETTER_CREDIT_TERMS",     "Better Credit Terms Offered"),
    ("DELIVERY_REQUIREMENT",    "Delivery Timeline Requirement"),
    ("TERRITORY_REQUIREMENT",   "Territory or Location Requirement"),
    ("NEW_VENDOR_TRIAL",        "New Vendor Trial / Evaluation"),
    ("MANAGEMENT_INSTRUCTION",  "Management Instruction"),
    ("OTHER",                   "Other (please specify)"),
]


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if "master_types" not in tables or "master_values" not in tables:
        # Master lookup tables not yet present — skip silently
        return

    # Ensure the master_type exists
    mt = conn.execute(
        text("SELECT id FROM master_types WHERE code = :code LIMIT 1"),
        {"code": _TYPE_CODE},
    ).fetchone()

    if not mt:
        mt_id = str(_uuid.uuid4())
        # Introspect actual columns to handle schema differences between smritisys
        # and tenant databases (smriti001, smriti002, etc.).
        inspector_cols = {c["name"] for c in inspector.get_columns("master_types")}
        has_created_at = "created_at" in inspector_cols
        has_modified_at = "modified_at" in inspector_cols
        if has_created_at and has_modified_at:
            conn.execute(
                text(
                    "INSERT INTO master_types (id, code, label, field_schema, ui_schema, "
                    "version, evidence_level, created_at, modified_at) "
                    "VALUES (:id, :code, :label, CAST(:fs AS jsonb), NULL, 1, 'A', NOW(), NOW())"
                ),
                {
                    "id": mt_id,
                    "code": _TYPE_CODE,
                    "label": "PO Cross-Vendor Approval Reason",
                    "fs": '{"type": "object", "properties": {"code": {"type": "string"}, "name": {"type": "string"}}}',
                },
            )
        elif has_created_at:
            conn.execute(
                text(
                    "INSERT INTO master_types (id, code, label, field_schema, ui_schema, "
                    "version, evidence_level, created_at) "
                    "VALUES (:id, :code, :label, CAST(:fs AS jsonb), NULL, 1, 'A', NOW())"
                ),
                {
                    "id": mt_id,
                    "code": _TYPE_CODE,
                    "label": "PO Cross-Vendor Approval Reason",
                    "fs": '{"type": "object", "properties": {"code": {"type": "string"}, "name": {"type": "string"}}}',
                },
            )
        else:
            conn.execute(
                text(
                    "INSERT INTO master_types (id, code, label, field_schema, ui_schema, "
                    "version, evidence_level) "
                    "VALUES (:id, :code, :label, CAST(:fs AS jsonb), NULL, 1, 'A')"
                ),
                {
                    "id": mt_id,
                    "code": _TYPE_CODE,
                    "label": "PO Cross-Vendor Approval Reason",
                    "fs": '{"type": "object", "properties": {"code": {"type": "string"}, "name": {"type": "string"}}}',
                },
            )
    else:
        mt_id = str(mt[0])

    # Seed each reason value if not already present
    mv_cols = {c["name"] for c in inspector.get_columns("master_values")}
    mv_has_updated_at = "updated_at" in mv_cols
    for sort_order, (code, name) in enumerate(_REASONS):
        existing = conn.execute(
            text(
                "SELECT id FROM master_values WHERE master_type_id = :mt AND code = :code LIMIT 1"
            ),
            {"mt": mt_id, "code": code},
        ).fetchone()
        if existing:
            continue
        if mv_has_updated_at:
            conn.execute(
                text(
                    "INSERT INTO master_values (id, master_type_id, code, name, active, sort_order, data, updated_at) "
                    "VALUES (:id, :mt, :code, :name, TRUE, :sort, '{}'::jsonb, NOW())"
                ),
                {
                    "id": str(_uuid.uuid4()),
                    "mt": mt_id,
                    "code": code,
                    "name": name,
                    "sort": sort_order,
                },
            )
        else:
            conn.execute(
                text(
                    "INSERT INTO master_values (id, master_type_id, code, name, active, sort_order, data) "
                    "VALUES (:id, :mt, :code, :name, TRUE, :sort, '{}'::jsonb)"
                ),
                {
                    "id": str(_uuid.uuid4()),
                    "mt": mt_id,
                    "code": code,
                    "name": name,
                    "sort": sort_order,
                },
            )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()
    if "master_types" not in tables:
        return

    mt = conn.execute(
        text("SELECT id FROM master_types WHERE code = :code LIMIT 1"),
        {"code": _TYPE_CODE},
    ).fetchone()
    if mt:
        conn.execute(
            text("DELETE FROM master_values WHERE master_type_id = :mt"), {"mt": str(mt[0])}
        )
        conn.execute(
            text("DELETE FROM master_types WHERE code = :code"), {"code": _TYPE_CODE}
        )
