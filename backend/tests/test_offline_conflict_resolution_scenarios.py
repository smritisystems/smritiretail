"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.24.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import sys
import uuid
import pytest
import asyncio
from decimal import Decimal
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import select

sys.path.insert(0, "backend")
from app.main import app
from app.db.session import get_company_sessionmaker
from app.models.inventory import Product, StockMovement
from app.models.sales import SalesInvoice
from app.models.crm import Customer, CustomerGroup
from app.models.sync import POSOfflineSyncQueue
from app.models.auth import UserRole
from app.core.security import create_access_token
from app.schemas.sync import (
    SyncBatchRequest,
    SyncOperationItem,
    SyncResolutionStatus,
    SyncConflictCategory,
    SyncConflictResolutionStrategy
)
from app.services.offline_conflict_resolution_engine import OfflineConflictResolutionEngine


def get_auth_headers(role: str = "SYSADMIN", company_id: str = "COMP-001", branch_id: str = "BR-001") -> dict:
    """Helper to generate JWT auth headers with tenant claims."""
    token = create_access_token(
        data={
            "sub": "usr-super",
            "role": UserRole.SYSADMIN.value,
            "company_id": company_id,
            "branch_id": branch_id,
            "tenant_id": "smriti001",
            "db_name": "smriti001",
            "is_active": True,
        }
    )
    return {"Authorization": f"Bearer {token}", "x-company-id": "001"}


@pytest.mark.asyncio
async def test_simultaneous_last_unit_sale_oversell_conflict():
    """
    Scenario 1: Sequential scenario — two offline POS terminals sell the last remaining unit (Stock=1).
    Each terminal syncs one at a time via sequential awaits (not concurrent). This verifies the
    conflict-resolution *decision logic* for oversell: Terminal 1 is ACCEPTED, Terminal 2 is
    ACCEPTED_WARN (allow_negative_stock=True), Terminal 3 is NEEDS_REVIEW (allow_negative_stock=False).

    NOTE: This test does NOT verify behavior under genuine concurrent drift (asyncio.gather /
    simultaneous writes to the same record). That requires a physical soak test.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as db:
        company_id = "COMP-001"
        prod_id = f"prod_soak_{uuid.uuid4().hex[:8]}"

        # Seed product with stock = 1
        prod = Product(
            id=prod_id,
            company_id=company_id,
            code=f"SKU-LAST-{uuid.uuid4().hex[:4]}",
            name="Limited Edition Sneaker",
            barcode=f"BC-SOAK-{uuid.uuid4().hex[:6]}",
            price=Decimal("1000.00"),
            stock=1,
            category="Footwear",
            sku=f"SKU-SOAK-{uuid.uuid4().hex[:6]}",
            is_active=True,
            is_deleted=False
        )
        db.add(prod)
        await db.commit()

        # Terminal 1 syncs Sale 1 (Qty = 1) -> Stock decreases to 0
        item1 = SyncOperationItem(
            client_id=f"tx_term1_{uuid.uuid4().hex[:8]}",
            invoice_no=f"POS1-INV-{uuid.uuid4().hex[:6]}",
            customer_id="CUST-WALKIN",
            items=[{"product_id": prod_id, "name": prod.name, "qty": 1, "price": 1000.00}],
            payment_mode="CASH"
        )
        batch1 = SyncBatchRequest(batch_id=f"batch_{uuid.uuid4().hex[:6]}", terminal_id="POS-01", transactions=[item1])
        res1 = await OfflineConflictResolutionEngine.resolve_sync_batch(db, company_id, "BR-001", batch1)
        await db.commit()

        assert res1.accepted_count == 1
        assert res1.results[0].status == SyncResolutionStatus.ACCEPTED

        # Verify stock decreased to 0 after Sale 1
        await db.refresh(prod)
        assert prod.stock == 0

        # Terminal 2 syncs Sale 2 (Qty = 1) with allow_negative_stock=True (Tier 1 + 4 Warning) -> Stock becomes -1
        item2 = SyncOperationItem(
            client_id=f"tx_term2_{uuid.uuid4().hex[:8]}",
            invoice_no=f"POS2-INV-{uuid.uuid4().hex[:6]}",
            customer_id="CUST-WALKIN",
            items=[{"product_id": prod_id, "name": prod.name, "qty": 1, "price": 1000.00}],
            payment_mode="CASH"
        )
        batch2 = SyncBatchRequest(batch_id=f"batch_{uuid.uuid4().hex[:6]}", terminal_id="POS-02", allow_negative_stock=True, transactions=[item2])
        res2 = await OfflineConflictResolutionEngine.resolve_sync_batch(db, company_id, "BR-001", batch2)
        await db.commit()

        assert res2.accepted_warn_count == 1
        assert res2.results[0].status == SyncResolutionStatus.ACCEPTED_WARN
        assert res2.results[0].conflict_category == SyncConflictCategory.INVENTORY_STOCK

        await db.refresh(prod)
        assert prod.stock == -1

        # Terminal 3 syncs Sale 3 with allow_negative_stock=False (Escalation to Reconciliation Queue)
        item3 = SyncOperationItem(
            client_id=f"tx_term3_{uuid.uuid4().hex[:8]}",
            invoice_no=f"POS3-INV-{uuid.uuid4().hex[:6]}",
            customer_id="CUST-WALKIN",
            items=[{"product_id": prod_id, "name": prod.name, "qty": 1, "price": 1000.00}],
            payment_mode="CASH"
        )
        batch3 = SyncBatchRequest(batch_id=f"batch_{uuid.uuid4().hex[:6]}", terminal_id="POS-03", allow_negative_stock=False, transactions=[item3])
        res3 = await OfflineConflictResolutionEngine.resolve_sync_batch(db, company_id, "BR-001", batch3)
        await db.commit()

        assert res3.needs_review_count == 1
        assert res3.results[0].status == SyncResolutionStatus.NEEDS_REVIEW
        assert res3.results[0].resolution_strategy == SyncConflictResolutionStrategy.RECONCILIATION_QUEUE


@pytest.mark.asyncio
async def test_price_book_drift_preservation():
    """
    Scenario 2: Price Book Drift — HQ changed item price on server to 600.00,
    but terminal checked out offline at 500.00.
    Server MUST honor the client price (Price-at-Sale Preservation) and record diagnostic.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as db:
        company_id = "COMP-001"
        prod_id = f"prod_pdrift_{uuid.uuid4().hex[:8]}"

        prod = Product(
            id=prod_id,
            company_id=company_id,
            code=f"SKU-DRIFT-{uuid.uuid4().hex[:4]}",
            name="Organic Almonds 500g",
            barcode=f"BC-PDRIFT-{uuid.uuid4().hex[:6]}",
            price=Decimal("600.00"),  # Current server price
            stock=50,
            category="Grocery",
            sku=f"SKU-DRIFT-{uuid.uuid4().hex[:6]}",
            is_active=True,
            is_deleted=False
        )
        db.add(prod)
        await db.commit()

        # Offline sale checked out at 500.00
        item = SyncOperationItem(
            client_id=f"tx_drift_{uuid.uuid4().hex[:8]}",
            invoice_no=f"POS1-INV-{uuid.uuid4().hex[:6]}",
            customer_id="CUST-WALKIN",
            items=[{"product_id": prod_id, "name": prod.name, "qty": 1, "price": 500.00}],
            payment_mode="CASH"
        )
        batch = SyncBatchRequest(batch_id=f"batch_{uuid.uuid4().hex[:6]}", transactions=[item])
        res = await OfflineConflictResolutionEngine.resolve_sync_batch(db, company_id, "BR-001", batch)
        await db.commit()

        assert res.accepted_count == 1
        result_item = res.results[0]
        assert result_item.status == SyncResolutionStatus.ACCEPTED
        # Grand total includes 18% GST on 500.00 = 590.00
        assert result_item.grand_total == 590.00
        
        # Verify diagnostic recorded price difference
        diag_price = [d for d in result_item.diagnostics if "selling_price" in d.field]
        assert len(diag_price) == 1
        assert diag_price[0].client_assumption == 500.00
        assert diag_price[0].server_truth == 600.00


@pytest.mark.asyncio
async def test_customer_credit_limit_race():
    """
    Scenario 3: Credit Limit Race — Offline sale pushes customer account beyond credit limit.
    Sale is accepted, but flagged with CREDIT_LIMIT warning diagnostic.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as db:
        company_id = "COMP-001"
        group_id = f"cg_{uuid.uuid4().hex[:8]}"
        cust_id = f"cust_credit_{uuid.uuid4().hex[:8]}"

        cg = CustomerGroup(
            id=group_id,
            company_id=company_id,
            name=f"Wholesale Tier {uuid.uuid4().hex[:4]}",
            credit_limit=Decimal("5000.00"),
            is_active=True,
            is_deleted=False
        )
        db.add(cg)
        await db.flush()

        cust = Customer(
            id=cust_id,
            company_id=company_id,
            customer_group_id=group_id,
            name="Apex Retailers Ltd",
            outstanding=Decimal("5500.00"),  # Already above credit limit
            is_active=True,
            is_deleted=False
        )
        db.add(cust)

        prod_id = f"prod_credit_{uuid.uuid4().hex[:8]}"
        prod = Product(
            id=prod_id,
            company_id=company_id,
            code=f"SKU-CR-{uuid.uuid4().hex[:4]}",
            name="Wholesale Cotton Rolls",
            barcode=f"BC-CR-{uuid.uuid4().hex[:6]}",
            price=Decimal("500.00"),
            stock=100,
            category="Textiles",
            sku=f"SKU-CR-{uuid.uuid4().hex[:6]}",
            is_active=True,
            is_deleted=False
        )
        db.add(prod)
        await db.commit()

        # Offline sale for 500.00 on credit
        item = SyncOperationItem(
            client_id=f"tx_credit_{uuid.uuid4().hex[:8]}",
            invoice_no=f"POS1-INV-{uuid.uuid4().hex[:6]}",
            customer_id=cust_id,
            items=[{"product_id": prod_id, "name": prod.name, "qty": 1, "price": 500.00}],
            payment_mode="CREDIT"
        )
        batch = SyncBatchRequest(batch_id=f"batch_{uuid.uuid4().hex[:6]}", transactions=[item])
        res = await OfflineConflictResolutionEngine.resolve_sync_batch(db, company_id, "BR-001", batch)
        await db.commit()

        # Outstanding was 5500 > 5000
        assert res.accepted_warn_count == 1
        assert res.results[0].status == SyncResolutionStatus.ACCEPTED_WARN
        assert res.results[0].conflict_category == SyncConflictCategory.CREDIT_LIMIT


@pytest.mark.asyncio
async def test_idempotent_retry_storm_deduplication():
    """
    Scenario 4: Idempotent Retry Storm — 5 offline transactions submitted 3 consecutive times.
    Pass 1: 5 ACCEPTED.
    Pass 2–3: 5 DEDUPLICATED on each run.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as db:
        company_id = "COMP-001"
        prod_id = f"prod_storm_{uuid.uuid4().hex[:8]}"
        prod = Product(
            id=prod_id,
            company_id=company_id,
            code=f"SKU-STORM-{uuid.uuid4().hex[:4]}",
            name="Reusable Shopping Bag",
            barcode=f"BC-STORM-{uuid.uuid4().hex[:6]}",
            price=Decimal("20.00"),
            stock=1000,
            category="General",
            sku=f"SKU-STORM-{uuid.uuid4().hex[:6]}",
            is_active=True,
            is_deleted=False
        )
        db.add(prod)
        await db.commit()

        items = [
            SyncOperationItem(
                client_id=f"tx_storm_item_{i}_{uuid.uuid4().hex[:6]}",
                invoice_no=f"POS1-STORM-{i}-{uuid.uuid4().hex[:6]}",
                customer_id="CUST-WALKIN",
                items=[{"product_id": prod_id, "name": prod.name, "qty": 1, "price": 20.00}],
                payment_mode="CASH"
            )
            for i in range(5)
        ]

        # Pass 1: Initial ingest
        batch1 = SyncBatchRequest(batch_id="storm_batch_1", transactions=items)
        res1 = await OfflineConflictResolutionEngine.resolve_sync_batch(db, company_id, "BR-001", batch1)
        await db.commit()
        assert res1.accepted_count == 5
        assert res1.deduplicated_count == 0

        # Pass 2: Identical payload re-sync
        batch2 = SyncBatchRequest(batch_id="storm_batch_2", transactions=items)
        res2 = await OfflineConflictResolutionEngine.resolve_sync_batch(db, company_id, "BR-001", batch2)
        await db.commit()
        assert res2.accepted_count == 0
        assert res2.deduplicated_count == 5

        # Pass 3: Identical payload re-sync
        batch3 = SyncBatchRequest(batch_id="storm_batch_3", transactions=items)
        res3 = await OfflineConflictResolutionEngine.resolve_sync_batch(db, company_id, "BR-001", batch3)
        await db.commit()
        assert res3.accepted_count == 0
        assert res3.deduplicated_count == 5


@pytest.mark.asyncio
async def test_governance_rule_version_drift_binding():
    """
    Scenario 5: Governance Rule Snapshot Binding — Offline transaction created under
    governance snapshot 'gov_snap_v1.2' binds permanently to the Sales Invoice.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as db:
        company_id = "COMP-001"
        prod_id = f"prod_gov_{uuid.uuid4().hex[:8]}"
        prod = Product(
            id=prod_id,
            company_id=company_id,
            code=f"SKU-GOV-{uuid.uuid4().hex[:4]}",
            name="Governed Premium Shirt",
            barcode=f"BC-GOV-{uuid.uuid4().hex[:6]}",
            price=Decimal("1200.00"),
            stock=10,
            category="Apparel",
            sku=f"SKU-GOV-{uuid.uuid4().hex[:6]}",
            is_active=True,
            is_deleted=False
        )
        db.add(prod)
        await db.commit()

        snapshot_id = f"gov_snap_v1.2_{uuid.uuid4().hex[:6]}"
        item = SyncOperationItem(
            client_id=f"tx_gov_{uuid.uuid4().hex[:8]}",
            invoice_no=f"POS1-GOV-{uuid.uuid4().hex[:6]}",
            customer_id="CUST-WALKIN",
            items=[{"product_id": prod_id, "name": prod.name, "qty": 1, "price": 1200.00}],
            payment_mode="CASH",
            governance_snapshot_id=snapshot_id
        )
        batch = SyncBatchRequest(batch_id=f"batch_{uuid.uuid4().hex[:6]}", transactions=[item])
        res = await OfflineConflictResolutionEngine.resolve_sync_batch(db, company_id, "BR-001", batch)
        await db.commit()

        assert res.accepted_count == 1
        server_id = res.results[0].server_entity_id

        # Verify saved invoice carries the exact snapshot ID
        inv = (await db.execute(select(SalesInvoice).where(SalesInvoice.id == server_id))).scalar_one_or_none()
        assert inv is not None
        assert inv.governance_snapshot_id == snapshot_id


@pytest.mark.asyncio
async def test_sync_reconciliation_queue_api_endpoint():
    """
    Scenario 6: REST API Verification — Test /api/v1/sync/push and /api/v1/sync/reconciliation-queue.
    """
    sessionmaker = get_company_sessionmaker("smriti001")
    async with sessionmaker() as db:
        prod_id = f"prod_api_{uuid.uuid4().hex[:8]}"
        prod = Product(
            id=prod_id,
            company_id="COMP-001",
            code=f"SKU-API-{uuid.uuid4().hex[:4]}",
            name="API Test Item",
            barcode=f"BC-API-{uuid.uuid4().hex[:6]}",
            price=Decimal("150.00"),
            stock=10,
            category="General",
            sku=f"SKU-API-{uuid.uuid4().hex[:6]}",
            is_active=True,
            is_deleted=False
        )
        db.add(prod)
        await db.commit()

    client = TestClient(app)
    headers = get_auth_headers()

    payload = {
        "batch_id": f"api_batch_{uuid.uuid4().hex[:6]}",
        "terminal_id": "POS-01",
        "allow_negative_stock": True,
        "transactions": [
            {
                "client_id": f"api_tx_{uuid.uuid4().hex[:8]}",
                "type": "SALES_INVOICE",
                "invoice_no": f"API-POS-{uuid.uuid4().hex[:6]}",
                "customer_id": "CUST-WALKIN",
                "items": [
                    {"product_id": prod_id, "name": "API Test Item", "qty": 1, "price": 150.00}
                ],
                "payment_mode": "CASH"
            }
        ]
    }

    # 1. POST /api/v1/sync/push
    push_res = client.post("/api/v1/sync/push", json=payload, headers=headers)
    assert push_res.status_code == 200
    push_data = push_res.json()
    assert push_data["total_received"] == 1
    assert push_data["accepted_count"] == 1

    # 2. GET /api/v1/sync/reconciliation-queue
    q_res = client.get("/api/v1/sync/reconciliation-queue", headers=headers)
    assert q_res.status_code == 200
    q_data = q_res.json()
    assert "items" in q_data
    assert q_data["company_id"] == "COMP-001"
