"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.21.0
Created      : 2026-07-11
Modified     : 2026-07-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import asyncio
import os
import sys

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Pre-seed required env vars for the test process before settings loads.
# These are safe test-only values; real credentials must be set in CI secrets or .env.
os.environ.setdefault("JWT_SECRET_KEY", "smriti_test_jwt_key_do_not_use_in_production")
os.environ.setdefault("SGIP_VAULT_MASTER_KEY", "smriti_test_vault_key_do_not_use_in_production")
os.environ.setdefault("INTERNAL_SERVICE_KEY", "smriti_test_internal_key_do_not_use_in_production")

from app.core.config import settings

# Force SelectorEventLoop on Windows to avoid proactor loop lifecycle race conditions in tests
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

@pytest.fixture(scope="session")
def event_loop():
    """Create a session-scoped event loop to prevent event loop mismatch errors."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
async def db_engine():
    engine = create_async_engine(settings.DATABASE_URL)
    yield engine
    await engine.dispose()

@pytest.fixture
async def db_session(db_engine) -> AsyncSession:
    async_session = sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:  # type: ignore[attr-defined]  # SQLAlchemy async sessionmaker known limitation
        yield session
        await session.rollback()

async def clear_db(db_session: AsyncSession):
    """
    Cleans up all database tables in a strictly safe foreign-key order.
    Ensures that test runs across different modules do not conflict or cause integrity errors.
    """
    from sqlalchemy import delete

    from app.models.auth import RefreshTokenBlacklist, User
    from app.models.crm import Customer, CustomerGroup
    from app.models.exchange import DataExchangeTask, DataExchangeFieldMapping
    from app.models.inventory import Product, StockMovement, Store, Warehouse
    from app.models.pos import CashRegister, Shift
    from app.models.purchase import PurchaseOrder, PurchaseOrderItem, PurchaseReceipt, PurchaseReceiptItem, Supplier
    from app.models.sales import (
        SalesInvoice, SalesInvoiceItem,
        SalesQuotation, SalesQuotationItem,
        SalesOrder, SalesOrderItem,
        SalesReturn, SalesReturnItem,
    )
    from app.models.supplier_payment import SupplierPayment
    from app.models.tenant import Branch, Company
    from app.models.barcode import BarcodeLayout, PrintHistory
    from app.models.product_identity import BarcodeProvider, IdentityRule, ProductIdentity
    from app.models.system import SystemConfig
    from app.models.master_lookup import MasterType, MasterValue
    from app.models.workflow import WorkflowEvent
    from app.models.report_schedule import ReportSchedule

    await db_session.execute(delete(SalesReturnItem))
    await db_session.execute(delete(SalesReturn))
    await db_session.execute(delete(ProductIdentity))
    await db_session.execute(delete(BarcodeProvider))
    await db_session.execute(delete(IdentityRule))
    await db_session.execute(delete(SalesOrderItem))
    await db_session.execute(delete(SalesOrder))
    await db_session.execute(delete(SalesQuotationItem))
    await db_session.execute(delete(SalesQuotation))
    await db_session.execute(delete(SalesInvoiceItem))
    await db_session.execute(delete(SalesInvoice))
    await db_session.execute(delete(Shift))
    await db_session.execute(delete(CashRegister))
    await db_session.execute(delete(PurchaseOrderItem))
    await db_session.execute(delete(PurchaseOrder))
    await db_session.execute(delete(PurchaseReceiptItem))
    await db_session.execute(delete(PurchaseReceipt))
    await db_session.execute(delete(SupplierPayment))
    await db_session.execute(delete(Supplier))
    await db_session.execute(delete(StockMovement))
    await db_session.execute(delete(Product))
    await db_session.execute(delete(Customer))
    await db_session.execute(delete(CustomerGroup))
    await db_session.execute(delete(WorkflowEvent))
    await db_session.execute(delete(RefreshTokenBlacklist))
    await db_session.execute(delete(PrintHistory))
    await db_session.execute(delete(BarcodeLayout))
    await db_session.execute(delete(SystemConfig))
    await db_session.execute(delete(DataExchangeTask))
    await db_session.execute(delete(DataExchangeFieldMapping))
    await db_session.execute(delete(User))
    await db_session.execute(delete(Store))
    await db_session.execute(delete(Warehouse))
    await db_session.execute(delete(MasterValue))
    await db_session.execute(delete(MasterType))
    await db_session.execute(delete(ReportSchedule))
    await db_session.execute(delete(Branch))
    await db_session.execute(delete(Company))
    await db_session.commit()

