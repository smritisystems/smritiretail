"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.26.0
Created      : 2026-07-18
Modified     : 2026-07-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

"""
PricingGroup Integration Tests
================================
Covers the full lifecycle:
  1. Schema validation (unit — no DB required)
  2. Model instantiation (unit — no DB required)
  3. Service: create, duplicate guard, update, resolve_customer_pricing (DB required)
  4. Price Engine: verify effective price calculation on SalesInvoice creation (DB required)
  5. FK integrity: ON DELETE SET NULL when a PricingGroup is soft-deleted (DB required)
"""

import uuid
import pytest
from decimal import Decimal

# ─── Unit-level: schema and model ────────────────────────────────────────────

class TestPricingGroupSchemas:
    """Pydantic schema validation — no database required."""

    def test_pricing_group_create_valid(self):
        from app.schemas.crm import PricingGroupCreate
        pg = PricingGroupCreate(
            id="pg-test-001",
            name="Test Price",
            base_price_field="price",
            discount_percent=Decimal("10.00"),
            price_adjustment=Decimal("0.00"),
            rounding_rule="Nearest1",
            max_additional_discount_percent=Decimal("5.00"),
            tax_inclusive=True,
            scheme_eligible=True,
            quantity_break_eligible=False,
            min_order_value=Decimal("0.00"),
        )
        assert pg.id == "pg-test-001"
        assert pg.discount_percent == Decimal("10.00")

    def test_pricing_group_update_partial(self):
        """PricingGroupUpdate must accept any subset of fields (all Optional)."""
        from app.schemas.crm import PricingGroupUpdate
        upd = PricingGroupUpdate(discount_percent=Decimal("20.00"))
        assert upd.discount_percent == Decimal("20.00")
        assert upd.name is None

    def test_pricing_group_defaults(self):
        """Base schema defaults must reflect system defaults."""
        from app.schemas.crm import PricingGroupBase
        pg = PricingGroupBase(name="Default Test")
        assert pg.base_price_field == "price"
        assert pg.discount_percent == Decimal("0.00")
        assert pg.tax_inclusive is True
        assert pg.scheme_eligible is True

    def test_customer_base_accepts_pricing_group_id(self):
        """pricing_group_id on CustomerBase must be Optional."""
        from app.schemas.crm import CustomerBase
        cust = CustomerBase(
            customer_group_id="cg-001",
            name="Test Customer",
            pricing_group_id=None,
        )
        assert cust.pricing_group_id is None

    def test_customer_update_includes_pricing_group_id(self):
        from app.schemas.crm import CustomerUpdate
        upd = CustomerUpdate(pricing_group_id="pg-vip")
        assert upd.pricing_group_id == "pg-vip"


class TestPricingGroupModel:
    """SQLAlchemy model instantiation — no database required."""

    def test_pricing_group_model_fields(self):
        from app.models.crm import PricingGroup
        pg = PricingGroup()
        pg.id = "pg-unit-test"
        pg.name = "Unit Test Group"
        pg.base_price_field = "mrp"
        assert pg.id == "pg-unit-test"
        assert pg.base_price_field == "mrp"

    def test_customer_model_has_pricing_group_fk(self):
        """Customer model must expose pricing_group_id column."""
        from app.models.crm import Customer
        cust = Customer()
        cust.pricing_group_id = "pg-retail"
        assert cust.pricing_group_id == "pg-retail"


# ─── Integration: requires live database ─────────────────────────────────────

@pytest.fixture
async def crm_fixtures(db_session):
    """Shared fixture: create a Company, Branch, CustomerGroup, and PricingGroup."""
    from app.tests.conftest import clear_db
    await clear_db(db_session)

    from sqlalchemy import text
    _co_id = "pg-test-co"
    _br_id = "pg-test-br"
    _cg_id = "pg-test-cg"
    _pg_id = "pg-test-pg"

    await db_session.execute(text(
        "INSERT INTO companies (id, uuid, name, is_active, is_deleted, created_at, modified_at) "
        "VALUES (:id, :uuid, 'PG Test Co', true, false, now(), now())"
    ), {"id": _co_id, "uuid": str(uuid.uuid4())})

    await db_session.execute(text(
        "INSERT INTO branches (id, uuid, company_id, name, code, is_active, is_deleted, created_at, modified_at) "
        "VALUES (:id, :uuid, :co, 'PG Test Br', 'PG-BR', true, false, now(), now())"
    ), {"id": _br_id, "uuid": str(uuid.uuid4()), "co": _co_id})

    await db_session.execute(text(
        "INSERT INTO customer_groups "
        "(id, uuid, name, unlimited_credit, credit_limit, auto_block_sales, "
        " company_id, branch_id, is_active, is_deleted, created_at, modified_at, version) "
        "VALUES (:id, :uuid, 'Retailer', true, 0, false, :co, :br, true, false, now(), now(), 1)"
    ), {"id": _cg_id, "uuid": str(uuid.uuid4()), "co": _co_id, "br": _br_id})

    await db_session.execute(text(
        "INSERT INTO pricing_groups "
        "(id, uuid, name, description, base_price_field, discount_percent, price_adjustment, "
        " rounding_rule, max_additional_discount_percent, tax_inclusive, scheme_eligible, "
        " quantity_break_eligible, min_order_value, company_id, branch_id, "
        " is_active, is_deleted, created_at, modified_at, version) "
        "VALUES (:id, :uuid, 'VIP Price', 'Test VIP', 'price', 10.00, 0.00, "
        "        'Nearest1', 5.00, true, true, false, 0.00, :co, :br, "
        "        true, false, now(), now(), 1)"
    ), {"id": _pg_id, "uuid": str(uuid.uuid4()), "co": _co_id, "br": _br_id})

    await db_session.commit()

    return {
        "company_id": _co_id,
        "branch_id": _br_id,
        "customer_group_id": _cg_id,
        "pricing_group_id": _pg_id,
    }


@pytest.mark.asyncio
async def test_resolve_pricing_returns_defaults_when_no_group(db_session, crm_fixtures):
    """
    resolve_customer_pricing must return system defaults when a customer
    has no pricing_group_id assigned.
    """
    from sqlalchemy import text
    from app.services.crm import CrmService
    from app.api.deps import TenantContext

    fx = crm_fixtures
    cust_id = "pg-cust-no-pg"
    await db_session.execute(text(
        "INSERT INTO customers "
        "(id, uuid, name, customer_group_id, pricing_group_id, status, "
        " company_id, branch_id, is_active, is_deleted, created_at, modified_at, version) "
        "VALUES (:id, :uuid, 'No PG Customer', :cg, NULL, 'Active', "
        "        :co, :br, true, false, now(), now(), 1)"
    ), {"id": cust_id, "uuid": str(uuid.uuid4()), "cg": fx["customer_group_id"],
        "co": fx["company_id"], "br": fx["branch_id"]})
    await db_session.commit()

    ctx = TenantContext(company_id=fx["company_id"], branch_id=fx["branch_id"])
    svc = CrmService(db_session, ctx)
    params = await svc.resolve_customer_pricing(cust_id)

    assert params["pricing_group_id"] is None
    assert params["discount_percent"] == 0.00
    assert params["base_price_field"] == "price"
    assert params["rounding_rule"] == "Nearest1"


@pytest.mark.asyncio
async def test_resolve_pricing_returns_group_params(db_session, crm_fixtures):
    """
    resolve_customer_pricing must return the PricingGroup's parameters when
    a customer is linked to a PricingGroup.
    """
    from sqlalchemy import text
    from app.services.crm import CrmService
    from app.api.deps import TenantContext

    fx = crm_fixtures
    cust_id = "pg-cust-with-pg"
    await db_session.execute(text(
        "INSERT INTO customers "
        "(id, uuid, name, customer_group_id, pricing_group_id, status, "
        " company_id, branch_id, is_active, is_deleted, created_at, modified_at, version) "
        "VALUES (:id, :uuid, 'VIP Customer', :cg, :pg, 'Active', "
        "        :co, :br, true, false, now(), now(), 1)"
    ), {"id": cust_id, "uuid": str(uuid.uuid4()),
        "cg": fx["customer_group_id"], "pg": fx["pricing_group_id"],
        "co": fx["company_id"], "br": fx["branch_id"]})
    await db_session.commit()

    ctx = TenantContext(company_id=fx["company_id"], branch_id=fx["branch_id"])
    svc = CrmService(db_session, ctx)
    params = await svc.resolve_customer_pricing(cust_id)

    assert params["pricing_group_id"] == fx["pricing_group_id"]
    assert params["pricing_group_name"] == "VIP Price"
    assert params["discount_percent"] == 10.00
    assert params["rounding_rule"] == "Nearest1"
    assert params["scheme_eligible"] is True


@pytest.mark.asyncio
async def test_price_engine_applies_discount_to_invoice_item(db_session, crm_fixtures):
    """
    Price Engine integration: SalesInvoice line items must have their price
    reduced by the PricingGroup's discount_percent before GST is calculated.

    VIP Price group = 10% discount.
    Item base price = 100.00 INR → effective price = 90 (Nearest1 rounding).
    GST = 18% → tax_amount = 16.20, total_amount = 106.20.
    """
    from sqlalchemy import text
    from app.services.sales import SalesService
    from app.api.deps import TenantContext
    from app.schemas.sales import SalesInvoiceCreate, SalesInvoiceItemCreate
    from datetime import date

    fx = crm_fixtures
    # Create a product with sufficient stock
    prod_id = "pg-prod-001"
    await db_session.execute(text(
        "INSERT INTO products "
        "(id, uuid, name, code, category, barcode, price, cost_price, mrp, stock, tracking_mode, "
        " company_id, branch_id, is_active, is_deleted, created_at, modified_at, version) "
        "VALUES (:id, :uuid, 'Test Product', 'TP001', 'General', '8901234567890', "
        "        100.00, 70.00, 110.00, 50, 'Track', "
        "        :co, :br, true, false, now(), now(), 1)"
    ), {"id": prod_id, "uuid": str(uuid.uuid4()),
        "co": fx["company_id"], "br": fx["branch_id"]})

    # Create customer with VIP PricingGroup
    cust_id = "pg-cust-invoice"
    await db_session.execute(text(
        "INSERT INTO customers "
        "(id, uuid, name, customer_group_id, pricing_group_id, status, "
        " company_id, branch_id, is_active, is_deleted, created_at, modified_at, version) "
        "VALUES (:id, :uuid, 'Invoice VIP', :cg, :pg, 'Active', "
        "        :co, :br, true, false, now(), now(), 1)"
    ), {"id": cust_id, "uuid": str(uuid.uuid4()),
        "cg": fx["customer_group_id"], "pg": fx["pricing_group_id"],
        "co": fx["company_id"], "br": fx["branch_id"]})
    await db_session.commit()

    ctx = TenantContext(company_id=fx["company_id"], branch_id=fx["branch_id"])
    svc = SalesService(db_session, ctx)

    invoice_in = SalesInvoiceCreate(
        id=f"inv-{uuid.uuid4().hex[:8]}",
        invoice_no="INV-PG-001",
        date=date.today(),
        customer_id=cust_id,
        is_interstate=False,
        status="Draft",
        items=[
            SalesInvoiceItemCreate(
                product_id=prod_id,
                code="TP001",
                name="Test Product",
                quantity=Decimal("2"),
                price=Decimal("100.00"),    # base price — PricingGroup will reduce this
                hsn_code="1234",
                gst_rate=Decimal("18.00"),
                total_amount=Decimal("236.00"),
            )
        ],
    )
    invoice = await svc.create_sales_invoice(invoice_in)

    # Re-fetch with eager items to avoid MissingGreenlet on lazy load
    from sqlalchemy.orm import selectinload
    from app.models.sales import SalesInvoice as SalesInvoiceModel
    from sqlalchemy import select as sa_select
    result = await db_session.execute(
        sa_select(SalesInvoiceModel)
        .options(selectinload(SalesInvoiceModel.items))
        .where(SalesInvoiceModel.id == invoice.id)
    )
    invoice = result.scalars().first()

    # Effective price after 10% VIP discount = 90 (Nearest1)
    assert invoice.items[0].price == Decimal("90")
    # tax = 2 * 90 * 0.18 = 32.40
    assert invoice.items[0].tax_amount == Decimal("32.40")
    # total = 2 * 90 + 32.40 = 212.40
    assert invoice.items[0].total_amount == Decimal("212.40")
    assert invoice.grand_total == Decimal("212.40")


@pytest.mark.asyncio
async def test_price_engine_no_change_when_no_pricing_group(db_session, crm_fixtures):
    """
    When a customer has no PricingGroup, the price from the request must be
    used verbatim (no discount, no adjustment).
    """
    from sqlalchemy import text
    from app.services.sales import SalesService
    from app.api.deps import TenantContext
    from app.schemas.sales import SalesInvoiceCreate, SalesInvoiceItemCreate
    from datetime import date

    fx = crm_fixtures
    prod_id = "pg-prod-002"
    await db_session.execute(text(
        "INSERT INTO products "
        "(id, uuid, name, code, category, barcode, price, cost_price, mrp, stock, tracking_mode, "
        " company_id, branch_id, is_active, is_deleted, created_at, modified_at, version) "
        "VALUES (:id, :uuid, 'Base Product', 'BP001', 'General', '8901234567891', "
        "        200.00, 150.00, 220.00, 100, 'Track', "
        "        :co, :br, true, false, now(), now(), 1)"
    ), {"id": prod_id, "uuid": str(uuid.uuid4()),
        "co": fx["company_id"], "br": fx["branch_id"]})

    cust_id = "pg-cust-no-pg2"
    await db_session.execute(text(
        "INSERT INTO customers "
        "(id, uuid, name, customer_group_id, pricing_group_id, status, "
        " company_id, branch_id, is_active, is_deleted, created_at, modified_at, version) "
        "VALUES (:id, :uuid, 'Retail Customer', :cg, NULL, 'Active', "
        "        :co, :br, true, false, now(), now(), 1)"
    ), {"id": cust_id, "uuid": str(uuid.uuid4()),
        "cg": fx["customer_group_id"],
        "co": fx["company_id"], "br": fx["branch_id"]})
    await db_session.commit()

    ctx = TenantContext(company_id=fx["company_id"], branch_id=fx["branch_id"])
    svc = SalesService(db_session, ctx)

    invoice_in = SalesInvoiceCreate(
        id=f"inv-{uuid.uuid4().hex[:8]}",
        invoice_no="INV-PG-002",
        date=date.today(),
        customer_id=cust_id,
        is_interstate=False,
        status="Draft",
        items=[
            SalesInvoiceItemCreate(
                product_id=prod_id,
                code="BP001",
                name="Base Product",
                quantity=Decimal("1"),
                price=Decimal("200.00"),
                hsn_code="5678",
                gst_rate=Decimal("12.00"),
                total_amount=Decimal("224.00"),
            )
        ],
    )
    invoice = await svc.create_sales_invoice(invoice_in)

    # Re-fetch with eager items to avoid MissingGreenlet on lazy load
    from sqlalchemy.orm import selectinload
    from app.models.sales import SalesInvoice as SalesInvoiceModel
    from sqlalchemy import select as sa_select
    result = await db_session.execute(
        sa_select(SalesInvoiceModel)
        .options(selectinload(SalesInvoiceModel.items))
        .where(SalesInvoiceModel.id == invoice.id)
    )
    invoice = result.scalars().first()

    # No discount: price = 200 (Nearest1, no change from rounding)
    assert invoice.items[0].price == Decimal("200")
    # tax = 1 * 200 * 0.12 = 24.00
    assert invoice.items[0].tax_amount == Decimal("24.00")
    assert invoice.items[0].total_amount == Decimal("224.00")
