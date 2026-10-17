"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.92.0
 * Created      : 2026-10-18
 * Modified     : 2026-10-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Seller Resolver Unit & Integration Test Suite
"""

from types import SimpleNamespace

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.services.invoice_errors import InvoiceRenderError
from app.services.seller_resolver import (
    SellerContext,
    resolve_seller_context,
    resolve_seller_context_async,
)

TEST_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:2781/smriti001"
test_engine = create_async_engine(TEST_DB_URL, echo=False, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)


def test_01_resolve_seller_context_unit_success():
    """Verify resolve_seller_context correctly maps attributes from Company and BankAccount objects."""
    bank1 = SimpleNamespace(
        bank_name="HDFC BANK",
        account_no="50200012345678",
        ifsc="HDFC0001234",
        branch="FORT MUMBAI",
        is_default=False,
    )
    bank2 = SimpleNamespace(
        bank_name="STATE BANK OF INDIA",
        account_no="43976711765",
        ifsc="SBIN0030425",
        branch="WARDHMAN NAGAR",
        is_default=True,
    )

    company = SimpleNamespace(
        legal_name="Tattly Threads Private Limited",
        trade_name="Tattly Threads",
        name="Tattly Threads",
        gst_number="27AAXFT2508H1ZR",
        pan="AAXFT2508H",
        cin="U74999MH2021PTC123456",
        address=None,
        address_line1="123 Fashion Street",
        address_line2="Near Gateway",
        city="Mumbai",
        state="Maharashtra",
        state_code="27",
        pincode="400001",
        phone="+91 98200 12345",
        email="info@tattlythreads.com",
        website="https://www.tattlythreads.com",
        dispatch_email="dispatch@tattlythreads.com",
        accounts_email="accounts@tattlythreads.com",
        contact_person="Priya Sharma",
        print_logo_url="/static/logo.png",
        signature_url="/static/sig.png",
        stamp_url="/static/stamp.png",
        currency_code="INR",
        upi_id="tattly@upi",
        bank_accounts=[bank1, bank2],
    )

    ctx = resolve_seller_context(company=company)

    assert isinstance(ctx, SellerContext)
    assert ctx.company_name == "Tattly Threads Private Limited"
    assert ctx.company_gstin == "27AAXFT2508H1ZR"
    assert "123 Fashion Street, Near Gateway, Mumbai, Maharashtra 400001" in ctx.company_address
    assert ctx.bank_name == "STATE BANK OF INDIA"
    assert ctx.account_no == "43976711765"
    assert ctx.ifsc_code == "SBIN0030425"
    assert ctx.bank_branch == "WARDHMAN NAGAR"
    assert ctx.company_pan == "AAXFT2508H"
    assert ctx.currency_code == "INR"
    assert ctx.website == "https://www.tattlythreads.com"


def test_02_resolve_seller_context_fail_closed_missing_company():
    """Verify InvoiceRenderError is raised when company name is absent."""
    with pytest.raises(InvoiceRenderError) as exc_info:
        resolve_seller_context(company=None, invoice=None, extra_meta={})
    assert exc_info.value.code == "MISSING_COMPANY"


def test_03_resolve_seller_context_fail_closed_missing_gstin():
    """Verify InvoiceRenderError is raised when seller GSTIN is absent."""
    company = SimpleNamespace(
        legal_name="Test Corp",
        name="Test Corp",
        gst_number=None,
    )
    with pytest.raises(InvoiceRenderError) as exc_info:
        resolve_seller_context(company=company, invoice=None, extra_meta={})
    assert exc_info.value.code == "MISSING_SELLER_GSTIN"


def test_04_resolve_seller_context_fail_closed_missing_address():
    """Verify InvoiceRenderError is raised when seller address is absent."""
    company = SimpleNamespace(
        legal_name="Test Corp",
        name="Test Corp",
        gst_number="27AAXFT2508H1ZR",
        address=None,
        address_line1=None,
        address_line2=None,
        city=None,
        state=None,
        pincode=None,
    )
    with pytest.raises(InvoiceRenderError) as exc_info:
        resolve_seller_context(company=company, invoice=None, extra_meta={})
    assert exc_info.value.code == "MISSING_COMPANY"


def test_05_resolve_seller_context_fail_closed_missing_bank():
    """Verify InvoiceRenderError is raised when seller bank coordinates are absent."""
    company = SimpleNamespace(
        legal_name="Test Corp",
        name="Test Corp",
        gst_number="27AAXFT2508H1ZR",
        address_line1="123 Street",
        address_line2=None,
        city="Mumbai",
        state="Maharashtra",
        pincode="400001",
        bank_accounts=[],
        bank_name=None,
        account_no=None,
        ifsc_code=None,
        bank_branch=None,
    )
    with pytest.raises(InvoiceRenderError) as exc_info:
        resolve_seller_context(company=company, invoice=None, extra_meta={})
    assert exc_info.value.code == "MISSING_BANK_DETAILS"


@pytest.mark.asyncio
async def test_06_resolve_seller_context_async_db_integration():
    """Verify resolve_seller_context_async resolves from live PostgreSQL database."""
    async with TestSessionLocal() as session:
        ctx = await resolve_seller_context_async(
            db=session,
            company_id="COMP-001",
        )
        assert isinstance(ctx, SellerContext)
        assert ctx.company_name in ("Tattly Threads", "Tattly Threads Private Limited")
        assert ctx.company_gstin == "27AAXFT2508H1ZR"
        assert ctx.bank_name is not None
        assert ctx.account_no is not None
        assert ctx.ifsc_code is not None
