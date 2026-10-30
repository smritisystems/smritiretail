"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-29
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

ORM-DB Parity Test Suite — items table
=======================================
Asserts that every column present in the live database `items` table is
mapped in the Item ORM model, preventing silent schema drift of the kind
that caused `hsn_sac_code` and `uom` to be unmapped for multiple releases.

This test class of bug must never need manual discovery again.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
import psycopg2
from sqlalchemy import inspect as sa_inspect
from sqlalchemy import create_engine


# ── ORM Model Column Set ──────────────────────────────────────────────────────

def get_orm_columns() -> set:
    """Returns all column names mapped by the Item ORM model."""
    from app.models.item_master import Item
    mapper = sa_inspect(Item)
    return {col.key for col in mapper.mapper.column_attrs}


# ── Live DB Column Set ─────────────────────────────────────────────────────────

def get_db_columns(port: int = 2781) -> set:
    """Returns all column names present in the live `items` table."""
    conn = psycopg2.connect(
        host="localhost", port=port,
        user="postgres", password="postgres",
        dbname="smriti001"
    )
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'items'
        ORDER BY ordinal_position
    """)
    cols = {r[0] for r in cur.fetchall()}
    cur.close()
    conn.close()
    return cols


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestItemOrmDbParity:
    """
    ORM–DB parity contract for the `items` table.

    Purpose: Any column added to the `items` table via Alembic migration
    that is NOT mapped in the Item ORM model will cause this test to fail,
    making schema drift a CI failure rather than a silent runtime issue.
    """

    def test_known_v1469_columns_are_now_orm_mapped(self):
        """
        Regression: hsn_sac_code and uom were added by v1469 but were NOT mapped
        in the Item ORM model. This test pins that both are now mapped.
        Part 2 fix verification — must never regress.
        """
        orm_cols = get_orm_columns()
        assert "hsn_sac_code" in orm_cols, (
            "items.hsn_sac_code (added by v1469) MUST be mapped in Item ORM model. "
            "It coexists with hsn_code for the HSN/SAC (goods/services) distinction."
        )
        assert "uom" in orm_cols, (
            "items.uom (added by v1469 for cross-DB parity) MUST be mapped in Item ORM model. "
            "primary_uom remains the authoritative UOM field."
        )

    def test_orm_maps_all_v1495_columns(self):
        """
        Verify all 12 columns added by v1495 (item master v2.2) are ORM-mapped.
        These were the source of the CFOC guard failures fixed in Part 1.
        """
        orm_cols = get_orm_columns()
        v1495_columns = [
            "gender", "purchase_class", "product_type", "design_attribute",
            "heel_type", "upper_material", "outsole_material", "collection_type",
            "is_inventory_yn", "is_billable_yn", "is_service_yn",
            "validation_status", "validation_message",
        ]
        missing = [c for c in v1495_columns if c not in orm_cols]
        assert not missing, (
            f"v1495 columns not mapped in Item ORM: {missing}. "
            "Every Alembic-added column must be mapped in the ORM model."
        )

    @pytest.mark.integration
    def test_all_db_columns_are_orm_mapped(self):
        """
        Full parity check: every column in the live DB `items` table must be
        mapped in the Item SQLAlchemy ORM model.

        This test requires a live PostgreSQL connection to smriti001 (port 2781).
        It is the permanent guard against silent ORM-DB drift.
        """
        try:
            db_cols = get_db_columns(port=2781)
        except Exception as e:
            pytest.skip(f"smriti001 not reachable at port 2781: {e}")

        orm_cols = get_orm_columns()

        # Columns that exist in DB but are NOT in the ORM model
        unmapped = db_cols - orm_cols
        assert not unmapped, (
            f"\n\nORM-DB PARITY FAILURE — {len(unmapped)} column(s) in `items` table "
            f"are NOT mapped in the Item ORM model:\n"
            + "\n".join(f"  - items.{c}" for c in sorted(unmapped))
            + "\n\nAction: Add these columns to backend/app/models/item_master.py, "
            "then classify them in field_registry.py or column_classification.py."
        )

    @pytest.mark.integration
    def test_no_orm_columns_missing_from_db(self):
        """
        Inverse check: every column mapped in the Item ORM must exist in the live DB.
        Prevents the ORM mapping phantom columns that don't exist in the DB.
        """
        try:
            db_cols = get_db_columns(port=2781)
        except Exception as e:
            pytest.skip(f"smriti001 not reachable at port 2781: {e}")

        orm_cols = get_orm_columns()

        # Known ORM-only virtual attributes that don't map to a single DB column
        orm_only_virtual = {"variants", "barcodes", "batches", "serials", "locations"}
        phantom = (orm_cols - db_cols) - orm_only_virtual
        assert not phantom, (
            f"\n\nORM-PHANTOM COLUMN FAILURE — {len(phantom)} column(s) mapped in "
            f"the Item ORM do NOT exist in the `items` live DB table:\n"
            + "\n".join(f"  - items.{c}" for c in sorted(phantom))
            + "\n\nAction: Either add the column via Alembic migration, or remove the "
            "phantom mapping from item_master.py."
        )

    @pytest.mark.integration
    def test_hsn_sac_code_is_nullable_in_db(self):
        """
        Verify hsn_sac_code has no NOT NULL constraint (it was added without a default).
        A NOT NULL constraint would break existing rows.
        """
        try:
            conn = psycopg2.connect(
                host="localhost", port=2781,
                user="postgres", password="postgres",
                dbname="smriti001"
            )
            cur = conn.cursor()
            cur.execute("""
                SELECT is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema='public' AND table_name='items'
                AND column_name='hsn_sac_code'
            """)
            row = cur.fetchone()
            cur.close(); conn.close()
        except Exception as e:
            pytest.skip(f"smriti001 not reachable: {e}")

        assert row is not None, "items.hsn_sac_code must exist in live DB"
        assert row[0] == "YES", "items.hsn_sac_code must be NULLABLE (no server-side NOT NULL)"

    @pytest.mark.integration
    def test_uom_is_nullable_and_no_default(self):
        """
        Verify items.uom is nullable and has no default (primary_uom has default='PCS').
        This ensures the two columns remain distinguishable in purpose.
        """
        try:
            conn = psycopg2.connect(
                host="localhost", port=2781,
                user="postgres", password="postgres",
                dbname="smriti001"
            )
            cur = conn.cursor()
            cur.execute("""
                SELECT is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema='public' AND table_name='items'
                AND column_name='uom'
            """)
            row = cur.fetchone()
            cur.close(); conn.close()
        except Exception as e:
            pytest.skip(f"smriti001 not reachable: {e}")

        assert row is not None, "items.uom must exist in live DB"
        assert row[0] == "YES", "items.uom must be NULLABLE"
        assert row[1] is None, (
            "items.uom must have NO default — primary_uom carries the 'PCS' default. "
            f"Got default: {row[1]}"
        )
