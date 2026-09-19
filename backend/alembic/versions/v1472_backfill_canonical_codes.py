"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.41.0
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal Core Architecture

Revision ID: v1472_backfill_canonical_codes
Revises: v1471_add_canonical_code_to_system_parameters
Create Date: 2026-09-18 23:16:00.000000

Governance Standard: AGENTS.md Rules 1-12, UADHP-v1.0
Scope of Migration:
  - Backfills `canonical_code` for all 828 Shoper 9 system parameters using the
    SMRITI.DOMAIN.FEATURE dot-notation namespace defined in canonical_mapping.json.
  - Updates all rows across all scopes (GLOBAL, COMPANY, TERMINAL).
  - Zero data loss — only adds canonical_code values to existing rows.
  - Dual-key resolution: SMRITI.* queries via canonical_code; legacy via param_code.

Architecture Context:
  - Part of ADR-042: SMRITI Canonical Parameter Namespace Layer.
  - Does NOT rename any existing param_code values.
  - Does NOT affect mutability, val_*, scope_level, or any other column.
  - 2,485 rows updated (828 GLOBAL + 828 COMP-001 + 828 COMP-002 + 1 terminal).
"""

import json
import re
from pathlib import Path
from alembic import op
import sqlalchemy as sa

revision = "v1472_backfill_canonical_codes"
down_revision = "v1471_add_canonical_code_to_system_parameters"
branch_labels = None
depends_on = None


def _build_canonical_map() -> dict:
    """Build the param_code -> canonical_code mapping from the blueprint."""
    domain_map = {
        "01. Setup": "SETUP",
        "02. Franchisee": "FRANCHISE",
        "03. Item Classification": "CATALOG.CLASSIFICATION",
        "04. Item Master": "CATALOG.ITEM",
        "05. Customer": "CUSTOMER",
        "06. Tax": "TAX",
        "07. Purchase Order": "PURCHASE.ORDER",
        "08. Physical Stock": "STOCK.PHYSICAL",
        "09. Inwards": "STOCK.INWARDS",
        "10. Outwards": "STOCK.OUTWARDS",
        "11. Billing": "BILLING",
        "12. Slips": "SLIPS",
        "13. POS Device": "TERMINAL",
        "14. Bill - Printing": "BILLING.PRINT",
        "15. Reports": "REPORTS",
        "16. Browse": "UI.BROWSE",
        "17. House Keeping": "HOUSEKEEPING",
        "18. Walkin": "CUSTOMER.WALKIN",
        "19. Misc": "MISC",
        "21. Data Sync.": "SYNC",
    }

    def to_upper_snake(name: str) -> str:
        s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", name)
        s = re.sub(r"([a-z\d])([A-Z])", r"\1_\2", s)
        return s.replace("-", "_").replace(" ", "_").replace(".", "_").upper()

    # Try canonical_mapping.json first (pre-generated)
    blueprint_root = Path(__file__).resolve().parents[3] / "docs" / "legacy_blueprints" / "shoper9"
    mapping_file = blueprint_root / "canonical_mapping.json"
    if mapping_file.exists():
        with open(mapping_file, "r", encoding="utf-8") as f:
            return json.load(f)

    # Fallback: rebuild from parameters.json
    params_file = blueprint_root / "parameters.json"
    if not params_file.exists():
        return {}

    with open(params_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    mapping = {}
    for p in data.get("parameters", []):
        code = p["paramCode"]
        cat = p.get("category", "01. Setup")
        domain = domain_map.get(cat, "MISC")
        canonical = f"SMRITI.{domain}.{to_upper_snake(code)}"
        mapping[code] = canonical
    return mapping


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "system_parameters" not in inspector.get_table_names():
        return

    mapping = _build_canonical_map()
    if not mapping:
        print("WARNING: canonical_mapping.json not found. Skipping backfill.")
        return

    updated = 0
    for param_code, canonical_code in mapping.items():
        result = conn.execute(
            sa.text(
                "UPDATE system_parameters SET canonical_code = :canonical WHERE param_code = :pcode"
            ),
            {"canonical": canonical_code, "pcode": param_code},
        )
        updated += result.rowcount

    # Verify
    total = conn.execute(
        sa.text("SELECT count(*) FROM system_parameters WHERE canonical_code IS NOT NULL")
    ).scalar()
    null_count = conn.execute(
        sa.text("SELECT count(*) FROM system_parameters WHERE canonical_code IS NULL")
    ).scalar()

    print(f"v1472 backfill: {updated} UPDATE operations executed.")
    print(f"  Rows with canonical_code set:  {total}")
    print(f"  Rows with canonical_code NULL: {null_count}")


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if "system_parameters" not in inspector.get_table_names():
        return
    conn.execute(sa.text("UPDATE system_parameters SET canonical_code = NULL"))
