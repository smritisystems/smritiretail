import pytest
from sqlalchemy import text


@pytest.mark.asyncio
async def test_bootstrap_registers_canonical_company_metadata(db_session):
    """Verify the canonical Company metadata is present in the live Postgres schema."""
    table_result = await db_session.execute(text("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('companies', 'control_psv_configs', 'products')
    """))
    tables = {row[0] for row in table_result.all()}

    assert 'companies' in tables
    assert 'control_psv_configs' in tables
    assert 'products' in tables

    product_columns = await db_session.execute(text("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'products'
    """))
    product_column_names = {row[0] for row in product_columns.all()}
    assert 'buying_price' in product_column_names
    assert 'cost_price' in product_column_names

    exists_result = await db_session.execute(text("""
        SELECT
            to_regclass('public.companies') AS companies_exists,
            to_regclass('public.control_psv_configs') AS psv_exists
    """))
    row = exists_result.one()
    assert row.companies_exists == 'companies'
    assert row.psv_exists == 'control_psv_configs'

    fk_result = await db_session.execute(text("""
        SELECT
            tc.table_name,
            ccu.table_name AS referenced_table,
            ccu.column_name AS referenced_column
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'control_psv_configs'
          AND tc.constraint_type = 'FOREIGN KEY'
    """))
    fk_rows = fk_result.all()
    assert any(r.referenced_table == 'companies' and r.referenced_column == 'id' for r in fk_rows)
