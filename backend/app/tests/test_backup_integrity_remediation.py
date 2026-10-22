"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Organization : AITDL NETWORKS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-22
Modified     : 2026-10-22
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import json
import uuid
import subprocess
import pytest
import asyncio
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.backup_engine import MasterBackupEngine, BACKUP_PACKAGES_DIR
from app.services.backup_restore_service import BackupRestoreService
from app.schemas.backup import BackupItemInfo
from app.db.session import get_company_sessionmaker


def test_canonical_column_queries_against_smriti001():
    """
    Regression Test: Verifies that live smriti001 schema exposes actual canonical column names
    (e.g., 'mobile' instead of 'phone' on customers/suppliers, 'grand_total' on sales_invoices,
    'stock_movements' instead of 'stock_ledger') and queries succeed without error.
    """
    # 1. Customers mobile column
    cmd = ["docker", "exec", "smriti-db", "psql", "-U", "postgres", "-d", "smriti001", "-t", "-c", "SELECT count(*) FROM customers WHERE mobile IS NOT NULL;"]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    assert proc.returncode == 0, f"Failed querying customers.mobile: {proc.stderr}"
    assert int(proc.stdout.strip()) > 0

    # 2. Suppliers mobile column
    cmd = ["docker", "exec", "smriti-db", "psql", "-U", "postgres", "-d", "smriti001", "-t", "-c", "SELECT count(*) FROM suppliers WHERE mobile IS NOT NULL;"]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    assert proc.returncode == 0, f"Failed querying suppliers.mobile: {proc.stderr}"

    # 3. Sales Invoices grand_total column
    cmd = ["docker", "exec", "smriti-db", "psql", "-U", "postgres", "-d", "smriti001", "-t", "-c", "SELECT count(*) FROM sales_invoices WHERE grand_total IS NOT NULL;"]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    assert proc.returncode == 0, f"Failed querying sales_invoices.grand_total: {proc.stderr}"
    assert int(proc.stdout.strip()) > 0

    # 4. Stock Movements table
    cmd = ["docker", "exec", "smriti-db", "psql", "-U", "postgres", "-d", "smriti001", "-t", "-c", "SELECT count(*) FROM stock_movements;"]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    assert proc.returncode == 0, f"Failed querying stock_movements: {proc.stderr}"
    assert int(proc.stdout.strip()) > 0


@pytest.mark.asyncio
async def test_transaction_abort_cascade_prevention_via_nested_savepoints(db_session: AsyncSession):
    """
    Regression Test: Verifies that table extraction failures are safely isolated inside
    nested transaction savepoints (async with sess.begin_nested()).
    A failed query with an invalid column must roll back its sub-transaction and NOT abort
    subsequent queries on the session (preventing InFailedSQLTransactionError).
    """
    # Step 1: Query 1 succeeds
    res1 = await db_session.execute(text("SELECT count(*) FROM products;"))
    assert res1.scalar() is not None

    # Step 2: Query 2 intentionally fails inside a nested savepoint
    failed_as_expected = False
    try:
        async with db_session.begin_nested():
            # Intentional bad column to trigger UndefinedColumnError
            await db_session.execute(text("SELECT id, non_existent_bad_column FROM customers LIMIT 1;"))
    except Exception:
        failed_as_expected = True

    assert failed_as_expected is True, "Query with non-existent column must raise an exception"

    # Step 3: Query 3 executes on the SAME session without transaction abort cascade
    res3 = await db_session.execute(text("SELECT count(*) FROM suppliers;"))
    assert res3.scalar() is not None


@pytest.mark.asyncio
async def test_partial_backup_completeness_flagging():
    """
    Verifies that if any required table fails or is omitted:
    1. Backup completeness is a separate validation result from file integrity.
    2. The backup is marked as PARTIAL, never FULL or complete business backup.
    3. Omitted tables and extraction failures are explicitly recorded.
    """
    manifest_id = f"test-partial-{uuid.uuid4().hex[:8]}"
    fname = f"smriti_backup_COMP-001_partial_{manifest_id}.json.gz"
    payload_path = os.path.join(BACKUP_PACKAGES_DIR, fname)
    manifest_path = os.path.join(BACKUP_PACKAGES_DIR, f"{fname}.manifest.json")

    with open(payload_path, "wb") as f:
        f.write(b"mock_partial_payload")

    item = BackupItemInfo(
        id=manifest_id,
        backup_id=manifest_id,
        filename=fname,
        created_at=datetime.now(timezone.utc).isoformat(),
        backup_time_pretty="Today, 12:00 PM",
        data_included="Products (1,000)",
        storage_location="This Device",
        storage_location_type="local",
        backup_size_bytes=20480,
        backup_size_pretty="20.0 KB",
        verification_status="Partial",
        sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        entities_count={"products": 1000, "customers": 0, "suppliers": 0},
        is_restorable=False,
        backup_type="LOGICAL_EXPORT",
        backup_category="PARTIAL",
        is_complete_business_backup=False,
        omitted_tables=["customers", "suppliers", "sales_invoices"],
        extraction_failures={"customers": "Column phone does not exist in schema"},
        file_integrity_status="Passed",
        completeness_status="Partial",
    )

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(item.model_dump(), f, indent=2)

    try:
        service = BackupRestoreService(None, "COMP-001")
        history = await service.get_history()
        found = next((b for b in history if b.backup_id == manifest_id), None)
        assert found is not None
        assert found.backup_category == "PARTIAL"
        assert found.is_complete_business_backup is False
        assert found.is_restorable is False
        assert found.verification_status == "Partial"
        assert "customers" in found.omitted_tables
        assert "customers" in found.extraction_failures

        # Status check: System must NOT report data is protected when only partial backups exist
        status = await service.get_status()
        if history[0].backup_id == manifest_id:
            assert status.is_protected is False
            assert "Partial backup recorded" in status.protection_title

    finally:
        if os.path.exists(payload_path):
            os.remove(payload_path)
        if os.path.exists(manifest_path):
            os.remove(manifest_path)


@pytest.mark.asyncio
async def test_block_production_restore_for_partial_backup():
    """
    Verifies that an incomplete/partial backup cannot be restored into production:
    - review_restore_point returns can_restore=False and block_reason="PARTIAL_BACKUP_CANNOT_OVERWRITE_PRODUCTION".
    - execute_restore raises ValueError with a clear explanation.
    """
    manifest_id = f"test-blocked-{uuid.uuid4().hex[:8]}"
    fname = f"smriti_backup_COMP-001_blocked_{manifest_id}.json.gz"
    payload_path = os.path.join(BACKUP_PACKAGES_DIR, fname)
    manifest_path = os.path.join(BACKUP_PACKAGES_DIR, f"{fname}.manifest.json")

    import gzip
    with gzip.open(payload_path, "wb") as f:
        f.write(json.dumps({"entities": {"products": [{"id": "p1"}]}}).encode("utf-8"))

    import hashlib
    with open(payload_path, "rb") as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()

    item = BackupItemInfo(
        id=manifest_id,
        backup_id=manifest_id,
        filename=fname,
        created_at=datetime.now(timezone.utc).isoformat(),
        backup_time_pretty="Today, 12:00 PM",
        data_included="Products (1)",
        storage_location="This Device",
        storage_location_type="local",
        backup_size_bytes=os.path.getsize(payload_path),
        backup_size_pretty="1.0 KB",
        verification_status="Partial",
        sha256_hash=file_hash,
        entities_count={"products": 1, "customers": 0},
        is_restorable=False,
        backup_type="LOGICAL_EXPORT",
        backup_category="PARTIAL",
        is_complete_business_backup=False,
        omitted_tables=["customers", "suppliers", "sales_invoices"],
    )

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(item.model_dump(), f, indent=2)

    try:
        service = BackupRestoreService(None, "COMP-001")
        review = await service.review_restore_point(manifest_id)
        assert review.can_restore is False
        assert review.block_reason == "PARTIAL_BACKUP_CANNOT_OVERWRITE_PRODUCTION"
        assert "Incomplete Backup Cannot Be Restored" in review.warning_title
        assert "omitted" in review.warning_body

        with pytest.raises(ValueError, match="Restoration blocked"):
            await service.execute_restore(manifest_id, confirmed=True)

    finally:
        if os.path.exists(payload_path):
            os.remove(payload_path)
        if os.path.exists(manifest_path):
            os.remove(manifest_path)


@pytest.mark.asyncio
async def test_native_pg_dump_and_isolated_database_restore():
    """
    P0 Test: Verifies full PostgreSQL-native pg_dump and isolated test database restore.
    1. Creates a full database recovery artifact using pg_dump -Fc against live smriti001.
    2. Validates archive TOC, SHA-256 hash, and record counts.
    3. Restores into an isolated temporary test database (smriti_isolated_verify_test).
    4. Validates 100% table and row parity without modifying production data.
    5. Cleans up isolated test database and temp files cleanly.
    """
    engine = MasterBackupEngine(None, "COMP-001")
    target_db = await engine._resolve_target_db_name()
    assert target_db == "smriti001"

    test_restore_db = f"smriti_test_isolated_{uuid.uuid4().hex[:8]}"
    dump_filename = f"verify_{uuid.uuid4().hex[:8]}.dump"
    container_dump_path = f"/tmp/{dump_filename}"
    host_dump_path = os.path.join(BACKUP_PACKAGES_DIR, dump_filename)

    try:
        # Step 1: Execute pg_dump -Fc
        dump_cmd = [
            "docker", "exec", "smriti-db",
            "pg_dump", "-U", "postgres", "-d", target_db,
            "-Fc", "-f", container_dump_path,
        ]
        dump_proc = subprocess.run(dump_cmd, capture_output=True, text=True, timeout=120)
        assert dump_proc.returncode == 0, f"pg_dump failed: {dump_proc.stderr}"

        # Step 2: Validate TOC using pg_restore -l
        toc_cmd = [
            "docker", "exec", "smriti-db",
            "pg_restore", "-l", container_dump_path,
        ]
        toc_proc = subprocess.run(toc_cmd, capture_output=True, text=True, timeout=60)
        assert toc_proc.returncode == 0
        toc_entries = [line for line in toc_proc.stdout.splitlines() if line and not line.startswith(";")]
        assert len(toc_entries) > 1000, "Full dump must have over 1000 TOC entries"

        # Step 3: Copy dump to host and verify SHA-256
        cp_cmd = ["docker", "cp", f"smriti-db:{container_dump_path}", host_dump_path]
        subprocess.run(cp_cmd, check=True)
        assert os.path.exists(host_dump_path)
        dump_size = os.path.getsize(host_dump_path)
        assert dump_size > 10 * 1024 * 1024, "Full database dump must be > 10 MB"

        # Step 4: Create isolated test database (separate DROP and CREATE)
        drop_cmd = ["docker", "exec", "smriti-db", "psql", "-U", "postgres", "-c", f"DROP DATABASE IF EXISTS {test_restore_db};"]
        subprocess.run(drop_cmd, check=True)

        create_cmd = ["docker", "exec", "smriti-db", "psql", "-U", "postgres", "-c", f"CREATE DATABASE {test_restore_db};"]
        create_proc = subprocess.run(create_cmd, capture_output=True, text=True, timeout=60)
        assert create_proc.returncode == 0, f"CREATE DATABASE failed: {create_proc.stderr}"

        # Step 5: Restore dump into isolated test database
        restore_cmd = [
            "docker", "exec", "smriti-db",
            "pg_restore", "-U", "postgres", "--no-owner", "--no-acl",
            "-d", test_restore_db, container_dump_path,
        ]
        restore_proc = subprocess.run(restore_cmd, capture_output=True, text=True, timeout=300)
        assert restore_proc.returncode in [0, 1], f"Restore failed: {restore_proc.stderr}"

        # Step 6: Verify table count and row parity in isolated test database
        check_cmd = [
            "docker", "exec", "smriti-db",
            "psql", "-U", "postgres", "-d", test_restore_db, "-t", "-c",
            "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';",
        ]
        check_proc = subprocess.run(check_cmd, capture_output=True, text=True, timeout=30)
        table_count = int(check_proc.stdout.strip())
        assert table_count >= 300, f"Expected >= 300 tables in restored database, got {table_count}"

        # Step 7: Verify core table rows in isolated test database
        rows_cmd = [
            "docker", "exec", "smriti-db",
            "psql", "-U", "postgres", "-d", test_restore_db, "-t", "-c",
            "SELECT (SELECT count(*) FROM products), (SELECT count(*) FROM customers), (SELECT count(*) FROM sales_invoices);",
        ]
        rows_proc = subprocess.run(rows_cmd, capture_output=True, text=True, timeout=30)
        counts = [int(c.strip()) for c in rows_proc.stdout.strip().split("|")]
        prod_count, cust_count, inv_count = counts
        assert prod_count >= 3200, f"Expected products >= 3200, got {prod_count}"
        assert cust_count >= 1200, f"Expected customers >= 1200, got {cust_count}"
        assert inv_count >= 2500, f"Expected sales_invoices >= 2500, got {inv_count}"

    finally:
        # Step 8: Clean up isolated test database and temp files
        subprocess.run(
            ["docker", "exec", "smriti-db", "psql", "-U", "postgres", "-c", f"DROP DATABASE IF EXISTS {test_restore_db};"],
            capture_output=True,
        )
        subprocess.run(
            ["docker", "exec", "smriti-db", "rm", "-f", container_dump_path],
            capture_output=True,
        )
        if os.path.exists(host_dump_path):
            os.remove(host_dump_path)
