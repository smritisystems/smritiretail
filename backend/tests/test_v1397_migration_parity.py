"""Schema parity checks for the Phase 2F Alembic migration."""

import os

import pytest
from sqlalchemy import create_engine, inspect, text

from app.models.crm import CustomerBillingLocation, CustomerExternalIdentity


DATABASE_URL = os.getenv(
    "MIGRATION_TEST_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/smriti_test_empty",
)


def _inspector_or_skip():
    try:
        engine = create_engine(DATABASE_URL)
        inspector = inspect(engine)
        inspector.get_table_names()
        return engine, inspector
    except Exception as exc:
        pytest.skip(f"Migration test database is unavailable: {exc}")


def test_alembic_head_is_v1397():
    engine, _ = _inspector_or_skip()
    with engine.connect() as connection:
        revision = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    assert revision == "v1397_cust_identity_protection"


@pytest.mark.parametrize("model", [CustomerBillingLocation, CustomerExternalIdentity])
def test_phase2f_tables_match_orm_columns(model):
    engine, inspector = _inspector_or_skip()
    expected = set(model.__table__.columns.keys())
    actual = {column["name"] for column in inspector.get_columns(model.__tablename__)}
    assert actual == expected


def test_phase2f_critical_indexes_exist():
    engine, inspector = _inspector_or_skip()
    gst_indexes = {index["name"] for index in inspector.get_indexes("customer_gst_registrations")}
    billing_indexes = {index["name"] for index in inspector.get_indexes("customer_billing_locations")}
    invoice_indexes = {index["name"] for index in inspector.get_indexes("sales_invoices")}

    assert "uq_cgr_company_gstin_active" in gst_indexes
    assert "uq_cbl_customer_store_code_active" in billing_indexes
    assert "uq_cbl_customer_default" in billing_indexes
    assert "ix_sales_invoices_billing_store_code" in invoice_indexes
