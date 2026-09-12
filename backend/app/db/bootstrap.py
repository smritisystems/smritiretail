"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-09-08
Modified     : 2026-09-08
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import logging
from typing import Any, Dict, Optional
import sqlalchemy as sa
from sqlalchemy.engine import Connection

logger = logging.getLogger("smriti.db.bootstrap")


def is_company_database_target(db_name: str) -> bool:
    """
    Validates whether the database name corresponds to an isolated Company DB.
    Explicitly rejects smritisys Control Plane and system databases.
    """
    if not db_name:
        return False
    lower = db_name.strip().lower()
    if lower in ("smritisys", "postgres", "template0", "template1"):
        return False
    # Allowed company databases must not be control plane or system
    return True


def bootstrap_company_database_prerequisites(
    connection: Connection,
    db_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Track 1: Fresh-Install Company DB Bootstrap Prerequisite.
    
    Guarantees:
    - Verifies target is an isolated Company DB (NEVER smritisys Control Plane).
    - Verifies each target table exists before attempting schema changes.
    - Adds only missing historical prerequisites required by v1403-v1407.
    - Uses nullable definitions so existing values and fresh migration semantics are preserved.
    - Never performs data backfill.
    - Is retry-safe and idempotent.
    """
    # 1. Determine active database name
    if not db_name:
        try:
            current_db = connection.execute(sa.text("SELECT current_database();")).scalar()
        except Exception as e:
            logger.error("Failed to query current_database(): %s", e)
            raise RuntimeError(f"Unable to determine current database name: {e}") from e
    else:
        current_db = db_name

    # 2. Strict Control Plane Guard: Block smritisys & system databases
    if not is_company_database_target(current_db):
        raise ValueError(
            f"Security Guard: Target database '{current_db}' is not a valid Company DB. "
            f"Bootstrap prerequisite must NEVER execute against smritisys Control Plane or system databases."
        )

    prerequisite_columns = {
        "sales_invoices": {
            "is_deleted": "BOOLEAN",
        },
        "stock_movements": {
            "variant_id": "VARCHAR(50)",
        },
        "product_batch_stocks": {
            "variant_id": "VARCHAR(50)",
        },
        "sales_invoice_items": {
            "variant_id": "VARCHAR(50)",
        },
        "sales_order_items": {
            "variant_id": "VARCHAR(50)",
            "vendor_style": "VARCHAR(100)",
            "color": "VARCHAR(50)",
            "size": "VARCHAR(50)",
        },
        "sales_order_invoice_allocations": {
            "uuid": "VARCHAR(36)",
            "company_id": "VARCHAR(50)",
            "branch_id": "VARCHAR(50)",
        },
        "sales_orders": {
            "po_number": "VARCHAR(100)",
            "total_qty": "NUMERIC(15, 4)",
            "billed_qty": "NUMERIC(15, 4)",
            "billed_value": "NUMERIC(15, 2)",
            "pending_qty": "NUMERIC(15, 4)",
            "pending_value": "NUMERIC(15, 2)",
            "fulfillment_status": "VARCHAR(50)",
            "is_deleted": "BOOLEAN",
        },
    }
    prerequisite_indexes = {
        "sales_orders": ("ix_sales_orders_po_number", "po_number"),
        "sales_invoice_items": ("ix_sales_invoice_items_variant_id", "variant_id"),
        "sales_order_items": ("ix_sales_order_items_variant_id", "variant_id"),
        "stock_movements": ("ix_stock_movements_variant_id", "variant_id"),
        "product_batch_stocks": ("ix_product_batch_stocks_variant_id", "variant_id"),
    }

    existing_tables = {
        row[0]
        for row in connection.execute(sa.text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
        """)).fetchall()
    }
    if not any(table in existing_tables for table in prerequisite_columns):
        logger.debug("Database '%s': prerequisite tables absent. Safely skipped.", current_db)
        return {
            "status": "SKIPPED_TABLE_NOT_FOUND",
            "database": current_db,
            "applied": False,
            "message": "Company transaction tables do not exist yet. Prerequisite safely skipped."
        }

    changed_columns = []
    for table_name, columns in prerequisite_columns.items():
        if table_name not in existing_tables:
            continue
        existing_columns = {
            row[0]
            for row in connection.execute(
                sa.text("""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = :table_name
                """),
                {"table_name": table_name},
            ).fetchall()
        }
        for column_name, column_type in columns.items():
            if column_name in existing_columns:
                continue
            logger.info("Database '%s': adding missing prerequisite %s.%s", current_db, table_name, column_name)
            connection.execute(sa.text(
                f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type};"
            ))
            changed_columns.append(f"{table_name}.{column_name}")

    for table_name, (index_name, column_name) in prerequisite_indexes.items():
        if table_name in existing_tables:
            connection.execute(sa.text(
                f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({column_name});"
            ))

    if not changed_columns:
        logger.debug("Database '%s': all bootstrap prerequisites already exist.", current_db)
        return {
            "status": "NOOP_ALREADY_EXISTS",
            "database": current_db,
            "applied": False,
            "message": "All Company DB bootstrap prerequisites already exist."
        }

    return {
        "status": "APPLIED",
        "database": current_db,
        "applied": True,
        "columns_added": changed_columns,
        "message": "Added missing Company DB bootstrap prerequisites without backfill."
    }
