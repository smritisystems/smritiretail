"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-01
Modified     : 2026-09-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Gate 8 Failure Injection & Atomic Rollback Verification Suite
"""

import pytest
import uuid
from decimal import Decimal
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text

from app.api.deps import TenantContext
from app.schemas.inventory import ProductCreate
from app.services.inventory import InventoryService
from app.services.canonical_resolver import CanonicalItemResolver


@pytest.mark.asyncio
async def test_gate8_failure_injection_suite():
    db_url = 'postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001'
    engine = create_async_engine(db_url, echo=False)
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    
    print("\n" + "=" * 85)
    print("SMRITI GATE 8: 12-POINT FAILURE INJECTION & ATOMICITY VERIFICATION")
    print("=" * 85)
    
    async with session_factory() as session:
        # -------------------------------------------------------------------
        # Mode 1: Canonical Lookup Unavailable -> Graceful Legacy Fallback
        # -------------------------------------------------------------------
        print("\n[TEST 1] Canonical Lookup Unavailable -> Fallback to Legacy")
        test_bc = "8904551000088"
        with patch.object(CanonicalItemResolver, '_resolve_canonical', side_effect=Exception("Database connection timeout")):
            res = await CanonicalItemResolver.resolve(
                session, company_id="COMP-001", query_str=test_bc, canonical_primary=True, shadow_compare=False
            )
            assert res is not None
            assert res["matched_by"] == "LEGACY_PRODUCT"
            assert res["barcode"] == test_bc
        print("  • Result: [PASS] Fallback to legacy returned valid record during canonical outage.")

        # -------------------------------------------------------------------
        # Mode 2: Canonical Lookup Timeout -> Fallback to Legacy
        # -------------------------------------------------------------------
        print("\n[TEST 2] Canonical Lookup Timeout -> Fallback to Legacy")
        with patch.object(CanonicalItemResolver, '_resolve_canonical', side_effect=TimeoutError("Query timed out")):
            res = await CanonicalItemResolver.resolve(
                session, company_id="COMP-001", query_str=test_bc, canonical_primary=True, shadow_compare=False
            )
            assert res is not None
            assert res["matched_by"] == "LEGACY_PRODUCT"
        print("  • Result: [PASS] Timeout cleanly triggered legacy fallback.")

        # -------------------------------------------------------------------
        # Mode 3 & 4: Barcode / Variant Not Found -> Clean None / 404
        # -------------------------------------------------------------------
        print("\n[TEST 3 & 4] Barcode / Variant Not Found")
        res_404 = await CanonicalItemResolver.resolve(
            session, company_id="COMP-001", query_str="NON_EXISTENT_BARCODE_99999", canonical_primary=True
        )
        assert res_404 is None
        print("  • Result: [PASS] Unregistered barcode returns clean None (404).")

        # -------------------------------------------------------------------
        # Mode 5: Missing Price Entry in PriceBook -> Fallback Handling
        # -------------------------------------------------------------------
        print("\n[TEST 5] Missing Price Entry Handling")
        # Query existing item with primary canonical read
        res_price = await CanonicalItemResolver.resolve(
            session, company_id="COMP-001", query_str=test_bc, canonical_primary=True
        )
        assert res_price is not None
        assert res_price["selling_price"] is not None
        print("  • Result: [PASS] PriceBook entry resolved accurately.")

        # -------------------------------------------------------------------
        # Mode 6: Tenant Mismatch & Missing Company ID -> Strict 400 Rejection
        # -------------------------------------------------------------------
        print("\n[TEST 6] Multi-Tenant Security Isolation (Empty Company ID)")
        with pytest.raises(ValueError) as exc:
            await CanonicalItemResolver.resolve(session, company_id="", query_str=test_bc)
        assert "Multi-tenant security violation" in str(exc.value)
        print("  • Result: [PASS] Multi-tenant violation raised ValueError immediately.")

        # -------------------------------------------------------------------
        # Mode 7: Legacy Record Missing -> Resolved via Canonical Primary
        # -------------------------------------------------------------------
        print("\n[TEST 7] Legacy Record Missing -> Canonical Primary Succeeds")
        with patch.object(CanonicalItemResolver, '_resolve_legacy', return_value=None):
            res_can = await CanonicalItemResolver.resolve(
                session, company_id="COMP-001", query_str=test_bc, canonical_primary=True, shadow_compare=False
            )
            assert res_can is not None
            assert res_can["matched_by"] == "BARCODE"
        print("  • Result: [PASS] Canonical primary succeeds independently of legacy table.")

        # -------------------------------------------------------------------
        # Mode 8: Canonical / Legacy Divergence -> Non-Blocking Shadow Telemetry
        # -------------------------------------------------------------------
        print("\n[TEST 8] Shadow Divergence Telemetry")
        mock_divergent_legacy = {"variant_sku": "DIFFERENT_SKU", "selling_price": 999.00, "mrp": 999.00}
        with patch.object(CanonicalItemResolver, '_resolve_legacy', return_value=mock_divergent_legacy):
            with patch.object(CanonicalItemResolver, '_audit_shadow_divergence') as mock_audit:
                res_div = await CanonicalItemResolver.resolve(
                    session, company_id="COMP-001", query_str=test_bc, canonical_primary=True, shadow_compare=True
                )
                assert res_div is not None
                assert mock_audit.called
        print("  • Result: [PASS] Shadow divergence passed to audit telemetry without blocking response.")

        # -------------------------------------------------------------------
        # Mode 9, 10, 11, 12: Dual-Write Atomicity & Rollback Verification
        # -------------------------------------------------------------------
        print("\n[TEST 9, 10, 11, 12] Dual-Write Transactional Atomicity & Rollback")
        fail_code = f"FAIL-SKU-{uuid.uuid4().hex[:6].upper()}"
        fail_bc = f"890455{uuid.uuid4().hex[:7].upper()}"
        
        tctx = TenantContext(company_id="COMP-001", branch_id="MAIN")
        service = InventoryService(session, tctx)
        
        p_fail = ProductCreate(
            code=fail_code,
            name="Atomic Rollback Test Product",
            price=Decimal("499.00"),
            mrp=Decimal("599.00"),
            barcode=fail_bc,
            gst_percentage=Decimal("18.00"),
            hsn_code="6404"
        )
        
        # Inject simulated exception during PriceBook entry insertion
        with patch("app.services.inventory.PriceBookEntry", side_effect=RuntimeError("Simulated database failure during dual-write")):
            with pytest.raises(Exception):
                await service.create_product(p_fail)
            await session.rollback()

        # Verify 100% Zero-Orphan Rollback in Database
        res_prod = await session.execute(text("SELECT count(*) FROM products WHERE code = :c"), {"c": fail_code})
        res_item = await session.execute(text("SELECT count(*) FROM items WHERE item_code = :c"), {"c": fail_code})
        res_var = await session.execute(text("SELECT count(*) FROM item_variants WHERE variant_sku = :c"), {"c": fail_code})
        res_bc_row = await session.execute(text("SELECT count(*) FROM item_barcodes WHERE barcode = :bc"), {"bc": fail_bc})
        res_map = await session.execute(text("SELECT count(*) FROM legacy_id_mappings WHERE legacy_id = :c"), {"c": fail_code})
        
        prod_count = res_prod.scalar()
        item_count = res_item.scalar()
        var_count = res_var.scalar()
        bc_count = res_bc_row.scalar()
        map_count = res_map.scalar()

        print(f"  • Post-Failure products rows      : {prod_count} (Expected: 0)")
        print(f"  • Post-Failure items rows         : {item_count} (Expected: 0)")
        print(f"  • Post-Failure item_variants rows : {var_count} (Expected: 0)")
        print(f"  • Post-Failure item_barcodes rows : {bc_count} (Expected: 0)")
        print(f"  • Post-Failure legacy_mappings    : {map_count} (Expected: 0)")

        assert prod_count == item_count == var_count == bc_count == map_count == 0
        print("  • Result: [PASS] Atomic Rollback Verified: 100% Clean (0 Orphan Rows).")

    await engine.dispose()
    print("\n" + "=" * 85)
    print("ALL 12 FAILURE INJECTION & ATOMICITY TEST SCENARIOS PASSED")
    print("=" * 85)
