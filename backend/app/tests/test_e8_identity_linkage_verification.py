"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 5.1.0
Created      : 2026-08-08
Description  : Identity Linkage Verification Test for E8 Gate.
               Proves empirically whether Product table persists MasterValue FK / identity linkage.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_e8_identity_linkage_empirical_proof(db_session: AsyncSession):
    """
    Empirically verifies whether Product table contains MasterValue FKs or persistent identity linkage.
    """
    # 1. Inspect physical columns of products table
    res_cols = await db_session.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'products' AND table_schema = 'public'
    """))
    cols = [r[0] for r in res_cols.fetchall()]

    # Empirically check for master_value_id columns
    assert "master_value_id" not in cols, "Product table must not contain master_value_id column without schema unfreeze."
    assert "color_master_value_id" not in cols, "Product table must not contain color_master_value_id."
    assert "size_master_value_id" not in cols, "Product table must not contain size_master_value_id."
    assert "brand_master_value_id" not in cols, "Product table must not contain brand_master_value_id."
    assert "category_master_value_id" not in cols, "Product table must not contain category_master_value_id."

    # 2. Inspect foreign keys on products table pointing to master_values
    res_fks = await db_session.execute(text("""
        SELECT ccu.table_name AS foreign_table_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'products'
    """))
    foreign_tables = [r[0] for r in res_fks.fetchall()]

    assert "master_values" not in foreign_tables, "Product table must not have physical FK pointing to master_values."
    assert "master_types" not in foreign_tables, "Product table must not have physical FK pointing to master_types."

    # 3. Confirm E8 decision is BLOCKED due to absence of persistent MasterValue identity linkage
    print("\nE8 IDENTITY LINKAGE EMPIRICAL PROOF: CONFIRMED ABSENT -> E8 IS GOVERNED AS BLOCKED")
