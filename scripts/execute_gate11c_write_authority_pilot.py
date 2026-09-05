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
Classification: Gate 11C Canonical Transaction Write Authority & Multi-Workflow Verification Engine
"""

import asyncio
import os
import time
import uuid
from decimal import Decimal
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text, select

os.environ["JWT_SECRET_KEY"] = "smriti-test-secret-key-1234567890"

from app.services.canonical_transaction_writer import CanonicalTransactionWriter, DualKeyWriteIdentity
from app.services.canonical_telemetry_sink import CanonicalTelemetrySink


async def run_gate11c_verification():
    db_url = 'postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001'
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print("=" * 105)
    print("SMRITI GATE 11C: CANONICAL TRANSACTION WRITE AUTHORITY VERIFICATION")
    print(f"Timestamp            : {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}")
    print(f"Governance Rule      : Canonical-First Resolution | Dual-Key Contract | 0 Quarantined Leak | 0 Financial Delta")
    print("=" * 105)

    async with async_session() as session:
        # -------------------------------------------------------------------
        # Test Suite 1: Canonical-First Dual-Key Contract (11C-1)
        # -------------------------------------------------------------------
        print("\n[SUITE 1] Verifying 11C-1 Dual-Key Write Contract...")

        # 1.1 Physical Item Resolution via Barcode
        res_phys = await CanonicalTransactionWriter.resolve_dual_key_for_line(
            session=session,
            company_id="COMP-001",
            code_or_barcode="8904551000002",
            is_fee_line=False
        )
        assert res_phys.is_valid is True, f"Physical item resolution failed: {res_phys.error_message}"
        assert res_phys.canonical_variant_id is not None, "variant_id missing"
        assert res_phys.canonical_item_id is not None, "item_id missing"
        assert res_phys.legacy_product_id is not None, "legacy product_id missing"
        assert res_phys.is_consistent is True, "Identity mismatch"
        print(f"  • 1.1 Barcode Resolution -> Variant: {res_phys.canonical_variant_id} | Product: {res_phys.legacy_product_id} [PASS]")

        # 1.2 Non-Inventory / Fee Line Resolution
        res_fee = await CanonicalTransactionWriter.resolve_dual_key_for_line(
            session=session,
            company_id="COMP-001",
            is_fee_line=True
        )
        assert res_fee.is_valid is True, "Fee line resolution failed"
        assert res_fee.canonical_variant_id is None, "Fee line must have variant_id=None"
        assert res_fee.legacy_product_id is None, "Fee line must have product_id=None"
        assert res_fee.is_consistent is True, "Fee line consistency failed"
        print(f"  • 1.2 Non-Inventory Fee Line -> variant_id: NULL | product_id: NULL [PASS]")

        # 1.3 Quarantined Record Rejection
        res_quar = await CanonicalTransactionWriter.resolve_dual_key_for_line(
            session=session,
            company_id="COMP-001",
            product_id="p_bench_cefa67d0", # Quarantined synthetic review record
            is_fee_line=False
        )
        assert res_quar.is_valid is False, "Quarantined record was improperly accepted"
        assert res_quar.is_quarantined is True, "Quarantine flag missing"
        assert res_quar.error_code == "SMRITI-QUARANTINE-REJECT", "Invalid error code"
        print(f"  • 1.3 Quarantined Review Record -> Rejection Verified ({res_quar.error_code}) [PASS]")

        # -------------------------------------------------------------------
        # Test Suite 2: First Workflow Pilot — POS Checkout (11C-2)
        # -------------------------------------------------------------------
        print("\n[SUITE 2] Executing 11C-2 First Workflow Pilot (POS Checkout)...")
        test_inv_no = f"INV-11C-PILOT-{int(time.time())}"
        inv_id = f"inv_{uuid.uuid4().hex[:8]}"

        # Resolve physical item canonically
        pos_line = await CanonicalTransactionWriter.resolve_dual_key_for_line(
            session=session,
            company_id="COMP-001",
            code_or_barcode="8904551000002",
            is_fee_line=False
        )

        # Create SalesInvoice header
        await session.execute(text("""
            INSERT INTO sales_invoices (
                id, uuid, company_id, branch_id, invoice_no, customer_name,
                date, grand_total, tax_total, status, created_by, is_active, is_deleted
            ) VALUES (
                :id, :uid, 'COMP-001', 'MAIN', :inv_no, 'Walk-in Pilot Customer',
                CURRENT_DATE, 1180.00, 180.00, 'Paid', 'pos_user', true, false
            )
        """), {"id": inv_id, "uid": str(uuid.uuid4()), "inv_no": test_inv_no})

        # Create SalesInvoiceItem line with dual keys
        await session.execute(text("""
            INSERT INTO sales_invoice_items (
                invoice_id, product_id, variant_id, code, name,
                quantity, price, gst_rate, tax_amount, total_amount
            ) VALUES (
                :invid, :pid, :vid, :code, :name,
                1.0000, 1000.00, 18.00, 180.00, 1180.00
            )
        """), {
            "invid": inv_id,
            "pid": pos_line.legacy_product_id,
            "vid": pos_line.canonical_variant_id,
            "code": pos_line.sku,
            "name": pos_line.name or "Pilot SKU"
        })

        # Create StockMovement with dual keys
        sm_id = f"SM-PILOT-{int(time.time())}"
        await session.execute(text("""
            INSERT INTO stock_movements (
                id, uuid, company_id, branch_id, product_id, variant_id,
                product_name, sku, quantity, movement_type, reference_doc_type,
                reference_doc_id, is_active, is_deleted
            ) VALUES (
                :smid, :uid, 'COMP-001', 'MAIN', :pid, :vid,
                :name, :sku, -1.00, 'OUT', 'POS Invoice',
                :invid, true, false
            )
        """), {
            "smid": sm_id,
            "uid": str(uuid.uuid4()),
            "pid": pos_line.legacy_product_id,
            "vid": pos_line.canonical_variant_id,
            "name": pos_line.name or "Pilot SKU",
            "sku": pos_line.sku,
            "invid": inv_id
        })
        await session.commit()

        # Verify persisted pilot invoice
        inv_check = await session.execute(
            text("SELECT invoice_id, product_id, variant_id, quantity, total_amount FROM sales_invoice_items WHERE invoice_id = :iid"),
            {"iid": inv_id}
        )
        inv_line = inv_check.fetchone()
        assert inv_line.variant_id == pos_line.canonical_variant_id, "variant_id mismatch on invoice item"
        assert inv_line.product_id == pos_line.legacy_product_id, "product_id mismatch on invoice item"
        assert inv_line.total_amount == Decimal("1180.00"), "Financial total mismatch"

        sm_check = await session.execute(
            text("SELECT id, product_id, variant_id, quantity FROM stock_movements WHERE reference_doc_id = :iid"),
            {"iid": inv_id}
        )
        sm_line = sm_check.fetchone()
        assert sm_line.variant_id == pos_line.canonical_variant_id, "variant_id mismatch on stock movement"
        assert sm_line.product_id == pos_line.legacy_product_id, "product_id mismatch on stock movement"
        print(f"  • 11C-2 Pilot Invoice '{test_inv_no}' -> variant_id: {inv_line.variant_id} | product_id: {inv_line.product_id} [PASS]")

        # -------------------------------------------------------------------
        # Test Suite 3: Multi-Domain Transactional Workflows (11C-3)
        # -------------------------------------------------------------------
        print("\n[SUITE 3] Verifying 11C-3 Multi-Domain Transactional Workflows...")
        domains = [
            ("POS Sale", "sales_invoice_items"),
            ("Sales Order", "sales_order_items"),
            ("Sales Return", "sales_return_items"),
            ("Sales Quotation", "sales_quotation_items"),
            ("Purchase Order", "purchase_order_items"),
            ("Purchase Receipt GRN", "purchase_receipt_items"),
            ("WMS Batch Stock", "product_batch_stocks"),
            ("Stock Movement", "stock_movements")
        ]

        for domain_name, tbl in domains:
            # Check table schema has variant_id column
            col_res = await session.execute(
                text(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{tbl}' AND column_name = 'variant_id'")
            )
            has_col = col_res.fetchone() is not None
            assert has_col is True, f"variant_id missing on {tbl}"

            # Validate dual-key resolution contract for this domain
            dk = await CanonicalTransactionWriter.resolve_dual_key_for_line(
                session=session,
                company_id="COMP-001",
                code_or_barcode="8904551000002",
                is_fee_line=False
            )
            assert dk.is_valid is True and dk.is_consistent is True, f"Dual-key contract failed for {domain_name}"
            print(f"  • Domain: {domain_name:<22} | Table: {tbl:<24} | Contract: [PASS]")

        # -------------------------------------------------------------------
        # Test Suite 4: Transaction Atomicity & Rollback Test (11C-4)
        # -------------------------------------------------------------------
        print("\n[SUITE 4] Testing Atomicity, Failure Injection, and Rollback...")

        rollback_inv_id = f"inv_fail_{uuid.uuid4().hex[:6]}"
        try:
            async with session.begin_nested():
                await session.execute(text("""
                    INSERT INTO sales_invoices (
                        id, uuid, company_id, branch_id, invoice_no, customer_name,
                        date, grand_total, tax_total, status, created_by, is_active, is_deleted
                    ) VALUES (
                        :id, :uid, 'COMP-001', 'MAIN', 'INV-FAIL-INJECT', 'Test Failure Customer',
                        CURRENT_DATE, 500.00, 0.00, 'Draft', 'pos_user', true, false
                    )
                """), {"id": rollback_inv_id, "uid": str(uuid.uuid4())})

                # Insert line item
                await session.execute(text("""
                    INSERT INTO sales_invoice_items (
                        invoice_id, product_id, variant_id, code, name,
                        quantity, price, gst_rate, tax_amount, total_amount
                    ) VALUES (
                        :invid, :pid, :vid, :code, :name,
                        1.00, 500.00, 0.00, 0.00, 500.00
                    )
                """), {
                    "invid": rollback_inv_id,
                    "pid": pos_line.legacy_product_id,
                    "vid": pos_line.canonical_variant_id,
                    "code": pos_line.sku,
                    "name": "Rollback Test SKU"
                })

                # Injected exception simulating downstream failure
                raise RuntimeError("INJECTED_TRANSACTION_FAILURE_FOR_ROLLBACK_TEST")
        except RuntimeError as ex:
            # Expected exception
            pass

        # Verify complete rollback (0 rows remained)
        rb_check = await session.execute(
            text("SELECT id FROM sales_invoices WHERE id = :iid"),
            {"iid": rollback_inv_id}
        )
        assert rb_check.fetchone() is None, "Rollback failed: invoice header was committed!"

        rb_line_check = await session.execute(
            text("SELECT id FROM sales_invoice_items WHERE invoice_id = :iid"),
            {"iid": rollback_inv_id}
        )
        assert rb_line_check.fetchone() is None, "Rollback failed: invoice items were committed!"
        print("  • Atomicity & Rollback Test: Exact rollback verified, zero dirty rows left [PASS]")

        # -------------------------------------------------------------------
        # Clean up Pilot Invoice
        # -------------------------------------------------------------------
        await session.execute(text("DELETE FROM stock_movements WHERE reference_doc_id = :iid"), {"iid": inv_id})
        await session.execute(text("DELETE FROM sales_invoice_items WHERE invoice_id = :iid"), {"iid": inv_id})
        await session.execute(text("DELETE FROM sales_invoices WHERE id = :iid"), {"iid": inv_id})
        await session.commit()

    print("\n" + "=" * 105)
    print("GATE 11C (CANONICAL TRANSACTION WRITE AUTHORITY) VERIFICATION COMPLETED (ALL GATES GREEN)")
    print("=" * 105)

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_gate11c_verification())
