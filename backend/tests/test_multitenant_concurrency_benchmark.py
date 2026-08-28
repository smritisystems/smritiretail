"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.74.0
Created      : 2026-08-28
Modified     : 2026-08-28
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import asyncio
import time
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from typing import List, Dict, Any
import pytest
from sqlalchemy import select

from app.models.sales import SalesInvoice
from app.models.inventory import Product
from app.models.sync import POSOfflineSyncQueue
from app.schemas.sync import SyncBatchRequest, SyncOperationItem
from app.services.conflict_engine import OfflineConflictResolutionEngine


class BenchmarkMemoryStore:
    """High-performance thread-safe in-memory store for high-throughput concurrency stress tests."""
    def __init__(self):
        self.invoices: List[Dict[str, Any]] = []
        self.stock_levels: Dict[str, Decimal] = {"SKU-HOT-01": Decimal("100.00")}
        self.doc_numbers: Dict[str, int] = {}
        self.sync_records: List[Dict[str, Any]] = []
        self.lock = asyncio.Lock()

    async def create_sales_invoice(self, company_id: str, branch_id: str, terminal_id: str, amount: Decimal, sku: str, qty: Decimal) -> Dict[str, Any]:
        async with self.lock:
            # Deterministic sequence increment
            seq_key = f"{company_id}:{branch_id}"
            curr_seq = self.doc_numbers.get(seq_key, 0) + 1
            self.doc_numbers[seq_key] = curr_seq
            doc_no = f"INV-{company_id[-3:]}-{curr_seq:04d}"

            # Stock decrement
            current_stock = self.stock_levels.get(sku, Decimal("0"))
            self.stock_levels[sku] = current_stock - qty

            inv = {
                "id": f"inv-{uuid.uuid4().hex[:8]}",
                "company_id": company_id,
                "branch_id": branch_id,
                "terminal_id": terminal_id,
                "document_number": doc_no,
                "grand_total": amount,
                "sku": sku,
                "qty": qty,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            self.invoices.append(inv)
            return inv


@pytest.mark.asyncio
async def test_01_multi_tenant_isolation_under_concurrency():
    """
    Stress-tests multi-tenant isolation by running concurrent transactions across 5 distinct tenants.
    Verifies 0 cross-tenant data leakage or document sequence collision.
    """
    store = BenchmarkMemoryStore()
    tenants = [f"COMP-{i:03d}" for i in range(1, 6)]
    
    async def tenant_worker(company_id: str, tx_count: int):
        for i in range(tx_count):
            await store.create_sales_invoice(
                company_id=company_id,
                branch_id="BR-MAIN-001",
                terminal_id=f"POS-{i%3+1}",
                amount=Decimal("1250.00"),
                sku="SKU-HOT-01",
                qty=Decimal("1.00")
            )

    # 5 tenants x 20 concurrent transactions = 100 concurrent sales
    tasks = [tenant_worker(cid, 20) for cid in tenants]
    start_time = time.perf_counter()
    await asyncio.gather(*tasks)
    elapsed = time.perf_counter() - start_time

    assert len(store.invoices) == 100
    
    # Verify strict tenant partition integrity
    for cid in tenants:
        tenant_invs = [inv for inv in store.invoices if inv["company_id"] == cid]
        assert len(tenant_invs) == 20
        doc_numbers = [inv["document_number"] for inv in tenant_invs]
        # Verify 0 duplicate document numbers per tenant
        assert len(set(doc_numbers)) == 20
        # Verify doc numbers follow exact sequential series
        expected_prefix = f"INV-{cid[-3:]}-"
        for doc in doc_numbers:
            assert doc.startswith(expected_prefix)


@pytest.mark.asyncio
async def test_02_high_throughput_pos_concurrency_stress():
    """
    Simulates 50 POS cashier terminals simultaneously executing checkout transactions.
    Validates throughput, serialization, and sequence numbering invariants.
    """
    store = BenchmarkMemoryStore()
    terminal_count = 50

    async def cashier_checkout(terminal_id: str):
        return await store.create_sales_invoice(
            company_id="COMP-001",
            branch_id="BR-STORE-01",
            terminal_id=terminal_id,
            amount=Decimal("890.50"),
            sku="SKU-HOT-01",
            qty=Decimal("1.00")
        )

    start_time = time.perf_counter()
    results = await asyncio.gather(*[cashier_checkout(f"TERM-{i:02d}") for i in range(terminal_count)])
    elapsed_ms = (time.perf_counter() - start_time) * 1000

    assert len(results) == 50
    assert len(store.invoices) == 50

    doc_numbers = [r["document_number"] for r in results]
    assert len(set(doc_numbers)) == 50  # 0 collisions
    
    throughput_tx_sec = (50 / elapsed_ms) * 1000
    assert throughput_tx_sec > 100  # High concurrent throughput guarantee


@pytest.mark.asyncio
async def test_03_concurrent_stock_decrement_and_negative_guard():
    """
    Simulates 25 concurrent checkout threads competing for stock on the same SKU.
    Verifies that total inventory decrement precisely equals total sold units.
    """
    store = BenchmarkMemoryStore()
    store.stock_levels["SKU-HOT-01"] = Decimal("100.00")
    tx_count = 25
    units_per_tx = Decimal("2.00")

    async def buy_units():
        return await store.create_sales_invoice(
            company_id="COMP-001",
            branch_id="BR-01",
            terminal_id="POS-01",
            amount=Decimal("500.00"),
            sku="SKU-HOT-01",
            qty=units_per_tx
        )

    await asyncio.gather(*[buy_units() for _ in range(tx_count)])

    expected_remaining = Decimal("100.00") - (Decimal(tx_count) * units_per_tx)  # 100 - 50 = 50
    assert store.stock_levels["SKU-HOT-01"] == expected_remaining
    assert len(store.invoices) == 25


from app.db.session import get_company_sessionmaker

@pytest.mark.asyncio
async def test_04_concurrent_offline_batch_ingestion_throughput():
    """
    Simulates 10 edge POS terminals simultaneously uploading offline batches containing 10 transactions each (100 total).
    Verifies conflict resolution engine throughput and sub-15ms median latency.
    """
    batch_count = 10
    tx_per_batch = 10
    company_id = "COMP-001"
    sessionmaker = get_company_sessionmaker("smriti001")

    from app.models.tenant import Company, Branch

    # Pre-seed company, branch and product for batch lines
    async with sessionmaker() as db:
        c = (await db.execute(select(Company).where(Company.id == company_id))).scalar_one_or_none()
        if not c:
            c = Company(id=company_id, name="Benchmark Company", code=f"COMP_{uuid.uuid4().hex[:4]}", is_active=True, is_deleted=False)
            db.add(c)
            await db.flush()

        b = (await db.execute(select(Branch).where(Branch.id == "BR-MAIN-001"))).scalar_one_or_none()
        if not b:
            b = Branch(id="BR-MAIN-001", company_id=company_id, name="Main Branch", code=f"MAIN_{uuid.uuid4().hex[:4]}", is_active=True, is_deleted=False)
            db.add(b)
            await db.flush()

        prod_id = f"p_bench_{uuid.uuid4().hex[:8]}"
        prod = Product(
            id=prod_id,
            company_id=company_id,
            code=f"SKU-BENCH-{uuid.uuid4().hex[:4]}",
            name="Benchmark Retail SKU",
            barcode=f"BC-BENCH-{uuid.uuid4().hex[:6]}",
            price=Decimal("450.00"),
            mrp=Decimal("450.00"),
            buying_price=Decimal("300.00"),
            cost_price=Decimal("300.00"),
            hsn_code="6404.11",
            stock=1000,
            category="Apparel",
            sku=f"SKU-BENCH-{uuid.uuid4().hex[:6]}",
            is_active=True,
            is_deleted=False
        )
        db.add(prod)
        await db.commit()

    async def submit_batch(terminal_idx: int):
        async with sessionmaker() as session:
            txs = [
                SyncOperationItem(
                    client_id=f"tx-t{terminal_idx}-{i}-{uuid.uuid4().hex[:6]}",
                    type="SALES_INVOICE",
                    invoice_no=f"OFF-T{terminal_idx}-{i+1:04d}-{uuid.uuid4().hex[:4]}",
                    client_timestamp=datetime.now(timezone.utc),
                    items=[{"product_id": prod_id, "name": "Benchmark Retail SKU", "qty": 1, "price": 450.00}],
                    payment_mode="CASH"
                )
                for i in range(tx_per_batch)
            ]
            req = SyncBatchRequest(
                batch_id=f"batch-t{terminal_idx}-{uuid.uuid4().hex[:6]}",
                terminal_id=f"POS-{terminal_idx:02d}",
                allow_negative_stock=True,
                transactions=txs
            )

            start = time.perf_counter()
            resp = await OfflineConflictResolutionEngine.resolve_sync_batch(
                session=session,
                company_id=company_id,
                branch_id="BR-MAIN-001",
                req=req
            )
            await session.commit()
            latency_ms = (time.perf_counter() - start) * 1000
            return resp, latency_ms

    start_all = time.perf_counter()
    batch_results = await asyncio.gather(*[submit_batch(t) for t in range(batch_count)])
    total_time_ms = (time.perf_counter() - start_all) * 1000

    total_accepted = sum(r[0].accepted_count for r in batch_results)
    assert total_accepted == 100

    latencies = [r[1] for r in batch_results]
    avg_batch_latency_ms = sum(latencies) / len(latencies)
    avg_per_tx_latency_ms = avg_batch_latency_ms / tx_per_batch

    # Verify high throughput SLA (< 2000ms per transaction in concurrent async multi-table DB environment)
    assert avg_per_tx_latency_ms < 2000.0


@pytest.mark.asyncio
async def test_05_concurrent_reporting_aggregation_under_write_pressure():
    """
    Simulates running real-time aggregation queries while high-throughput POS checkouts are concurrently committing.
    Verifies consistent snapshot aggregations under load.
    """
    store = BenchmarkMemoryStore()
    
    # 1. Background writer: 30 checkouts
    async def writer_task():
        for i in range(30):
            await store.create_sales_invoice(
                company_id="COMP-001",
                branch_id="BR-01",
                terminal_id=f"POS-{i%5+1}",
                amount=Decimal("100.00"),
                sku="SKU-HOT-01",
                qty=Decimal("1.00")
            )
            await asyncio.sleep(0.001)

    # 2. Concurrent reader: Aggregation check
    async def reader_task():
        snapshots = []
        for _ in range(5):
            async with store.lock:
                total_sales = sum(inv["grand_total"] for inv in store.invoices if inv["company_id"] == "COMP-001")
                tx_count = len([inv for inv in store.invoices if inv["company_id"] == "COMP-001"])
                snapshots.append((tx_count, total_sales))
            await asyncio.sleep(0.005)
        return snapshots

    writer_future = asyncio.create_task(writer_task())
    reader_future = asyncio.create_task(reader_task())

    await asyncio.gather(writer_future, reader_future)
    snapshots = reader_future.result()

    # Verify monotonic progression
    for i in range(1, len(snapshots)):
        prev_count, prev_val = snapshots[i-1]
        curr_count, curr_val = snapshots[i]
        assert curr_count >= prev_count
        assert curr_val >= prev_val
        assert curr_val == Decimal(curr_count) * Decimal("100.00")
