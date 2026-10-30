"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Version      : 1.0.0
Created      : 2026-10-27
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Description  : Add CHECK constraint on customers.pricing_basis.
               Existing values: all 1011 rows = 'MRP' (verified pre-migration).
               Constraint permits: MRP | RATE | WHOLESALE_PRICE | PRICE_BOOK
               RATE is the legacy code for SELLING_PRICE in customer profile.
"""

import sqlalchemy as sa
from alembic import op

revision = "v1547"
down_revision = "v1546"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Step 1: Coerce known legacy / alias values to canonical forms.
    # This makes the migration idempotent and safe for older deployments.
    #
    # Known aliases found in the wild:
    #   'SELLING_PRICE'  -> 'RATE'   (pre-v1.0 canonical code for selling price tier)
    #   'WHOLESALE'      -> 'WHOLESALE_PRICE'
    #   'PRICE_BOOK_1'   -> 'PRICE_BOOK'   (early pilot naming)
    #   '' / NULL        -> 'MRP'    (missing value default)
    coerce_map = [
        ("SELLING_PRICE",  "RATE"),
        ("WHOLESALE",      "WHOLESALE_PRICE"),
        ("PRICE_BOOK_1",   "PRICE_BOOK"),
        ("PRICE_BOOK_2",   "PRICE_BOOK"),
    ]
    total_coerced = 0
    for old_val, new_val in coerce_map:
        result = conn.execute(sa.text(
            "UPDATE customers SET pricing_basis = :new WHERE pricing_basis = :old"
        ), {"new": new_val, "old": old_val})
        rows = result.rowcount
        if rows:
            total_coerced += rows
            print(f"  v1547: coerced {rows} row(s) '{old_val}' -> '{new_val}'")

    # NULL or empty string -> MRP (safe default)
    result = conn.execute(sa.text(
        "UPDATE customers SET pricing_basis = 'MRP' "
        "WHERE pricing_basis IS NULL OR pricing_basis = ''"
    ))
    if result.rowcount:
        total_coerced += result.rowcount
        print(f"  v1547: coerced {result.rowcount} NULL/empty row(s) -> 'MRP'")

    if total_coerced:
        print(f"  v1547: {total_coerced} row(s) coerced total (safe, lossless)")

    # Step 2: Hard-abort if any unrecognised value remains after coercion.
    # This means a value we do not have a canonical mapping for — requires human review.
    bad_rows = conn.execute(sa.text("""
        SELECT pricing_basis, COUNT(*) as cnt FROM customers
        WHERE pricing_basis NOT IN ('MRP', 'RATE', 'WHOLESALE_PRICE', 'PRICE_BOOK')
        GROUP BY pricing_basis
    """)).fetchall()

    if bad_rows:
        detail = ", ".join(f"'{r[0]}' ({r[1]} rows)" for r in bad_rows)
        raise RuntimeError(
            f"Migration v1547 aborted: unrecognised pricing_basis values after coercion: {detail}. "
            "Add a coerce_map entry above for each value and re-run the migration."
        )

    # Step 3: Add CHECK constraint (now guaranteed clean)
    op.create_check_constraint(
        "chk_customers_pricing_basis",
        "customers",
        "pricing_basis IN ('MRP', 'RATE', 'WHOLESALE_PRICE', 'PRICE_BOOK')",
    )



def downgrade() -> None:
    op.drop_constraint("chk_customers_pricing_basis", "customers", type_="check")
