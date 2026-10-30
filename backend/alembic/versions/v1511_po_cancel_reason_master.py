"""
v1511 — Seed PO cancellation reason master type and default reason values.

Phase C: Cancellation Policy Picker
─────────────────────────────────────
Mirrors the v1477 pattern for PO_CROSS_VENDOR_REASON.
Uses existing master_types / master_values architecture.
Does NOT create a new lookup framework.

Master type code : PO_CANCEL_REASON
Seeded reasons   : 8 business-language cancellation reasons

Author  : Jawahar Ramkripal Mallah <support@smritibooks.com>
Created : 2026-10-01
"""
from typing import Sequence, Union
import uuid as _uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

revision: str = "v1511_po_cancel_reason_master"
down_revision: Union[str, Sequence[str], None] = "v1509"
branch_labels = None
depends_on = None

_TYPE_CODE = "PO_CANCEL_REASON"

_REASONS = [
    ("DUPLICATE_ORDER",       "Duplicate Purchase Order"),
    ("BUDGET_CONSTRAINT",     "Budget Constraint / Funds Not Available"),
    ("VENDOR_UNAVAILABLE",    "Vendor Unavailable or Unresponsive"),
    ("PRICE_CHANGED",         "Price Changed or Not Agreed"),
    ("REQUIREMENT_CANCELLED", "Requirement Cancelled"),
    ("WRONG_ITEMS",           "Wrong Items or Specification"),
    ("MANAGEMENT_DECISION",   "Management Decision"),
    ("OTHER",                 "Other (please specify)"),
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
                    "label": "PO Cancellation Reason",
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
                    "label": "PO Cancellation Reason",
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
                    "label": "PO Cancellation Reason",
                    "fs": '{"type": "object", "properties": {"code": {"type": "string"}, "name": {"type": "string"}}}',
                },
            )
    else:
        mt_id = str(mt[0])

    # Seed each reason value if not already present
    mv_cols = {c["name"] for c in inspector.get_columns("master_values")}
    mv_has_updated_at = "updated_at" in mv_cols

    for sort_order, (code, name) in enumerate(_REASONS, start=1):
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
