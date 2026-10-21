"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.3
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Production Data Integrity Remediation Engine
"""

import argparse
import asyncio
import datetime
import os
import sys
from decimal import Decimal
from typing import Any, Dict, List, Optional

import httpx
import openpyxl
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

EXCEL_CANDIDATE_PATHS = [
    r"F:\Smriti-Clients Data\Tattly Threads\Purchase\ALL VENDOR PURCHASE FOR SOFTWARE.xlsx",
    r"F:\Smriti-Clients Data\15-10-2026\ALL VENDOR PURCHASE FOR SOFTWARE.xlsx",
]

DEFAULT_API_URL = "https://tattlythreads.smritisys.com"
DEFAULT_DB_URL = "postgresql+asyncpg://postgres:postgres@localhost:2781/smriti001"


def clean_doc_no(val: str) -> str:
    """Normalize bill numbers into clean document reference identifiers."""
    return "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in str(val)).strip("_")


def load_authoritative_bills_from_excel() -> Dict[str, Dict[str, Any]]:
    """Loads and compiles the 28 authoritative vendor bills and their actual transaction dates."""
    excel_path = None
    for p in EXCEL_CANDIDATE_PATHS:
        if os.path.exists(p):
            excel_path = p
            break

    if not excel_path:
        raise FileNotFoundError(f"None of the candidate Excel paths were found: {EXCEL_CANDIDATE_PATHS}")

    wb = openpyxl.load_workbook(excel_path, data_only=True)
    ws = wb["Sheet1"]

    bills: Dict[str, Dict[str, Any]] = {}
    for r in list(ws.iter_rows(values_only=True))[2:]:
        v_code = str(r[6]).strip() if r[6] else ""
        b_no = str(r[10]).strip() if r[10] else ""
        b_date = r[11]
        art = str(r[1]).strip() if r[1] else ""
        color = str(r[2]).strip().upper() if r[2] else ""

        # Handle items where vendor bill column is missing/blank in spreadsheet
        if not b_no:
            if art == "CH-20" and color == "BEIGE":
                b_no = "707"
                b_date = datetime.date(2026, 9, 7)
            elif art == "CH-22":
                b_no = "704"
                b_date = datetime.date(2026, 8, 10)
            elif art == "CH-23":
                b_no = "706"
                b_date = datetime.date(2026, 8, 22)

        if v_code and b_no and b_no not in ("None", "BNA") and b_date is not None:
            if isinstance(b_date, datetime.datetime):
                b_date = b_date.date()
            if b_date and b_date.year == 2036:
                # Correct inadvertent spreadsheet typo
                b_date = datetime.date(2026, b_date.month, b_date.day)

            clean_b = clean_doc_no(b_no)
            grn_num = f"GRN-{v_code}-{clean_b}"
            target_ts = f"{b_date.isoformat()}T11:00:00+00:00"

            if grn_num not in bills:
                bills[grn_num] = {
                    "receipt_no": grn_num,
                    "vendor_code": v_code,
                    "bill_no": b_no,
                    "bill_date": b_date,
                    "target_timestamp": target_ts,
                }

    return bills


async def run_direct_db_remediation(db_url: str, bills: Dict[str, Dict[str, Any]], execute: bool):
    """Executes atomic remediation directly against PostgreSQL."""
    mode = "EXECUTE (MUTATION COMMITTED)" if execute else "DRY-RUN (AUDIT ONLY)"
    print("=" * 105)
    print(f"SMRITI RETAIL OS: HEADLESS GRN DATE REMEDIATION [DIRECT DATABASE ENGINE]")
    print(f"Mode          : {mode}")
    print(f"Target DB     : {db_url}")
    print(f"Total GRNs    : {len(bills)}")
    print("=" * 105)

    engine = create_async_engine(db_url, echo=False)
    try:
        if not execute:
            async with engine.connect() as conn:
                print(f"\n{'#':<3} | {'RECEIPT NO':<22} | {'BILL NO':<14} | {'BILL DATE':<10} | {'CURRENT CREATED_AT':<28} | {'MOVEMENTS':<9} | {'STATUS'}")
                print("-" * 105)
                idx = 0
                total_movements = 0
                for rno, binfo in sorted(bills.items(), key=lambda x: (x[1]["bill_date"], x[0])):
                    idx += 1
                    res = await conn.execute(
                        text("SELECT id, receipt_no, status, created_at FROM purchase_receipts WHERE receipt_no = :rno"),
                        {"rno": rno}
                    )
                    row = res.fetchone()
                    if not row:
                        print(f"{idx:<3} | {rno:<22} | {binfo['bill_no']:<14} | {str(binfo['bill_date']):<10} | {'NOT FOUND':<28} | {'-':<9} | MISSING")
                        continue

                    gid = str(row[0])
                    cur_ts = row[3]
                    sm_res = await conn.execute(
                        text("SELECT count(*) FROM stock_movements WHERE reference_doc_id::text = :gid OR reference_doc_id::text = :rno"),
                        {"gid": gid, "rno": rno}
                    )
                    sm_cnt = sm_res.scalar() or 0
                    total_movements += sm_cnt
                    cur_str = cur_ts.isoformat() if cur_ts else "NULL"
                    print(f"{idx:<3} | {rno:<22} | {binfo['bill_no']:<14} | {str(binfo['bill_date']):<10} | {cur_str:<28} | {sm_cnt:<9} | READY")

                print("-" * 105)
                print(f"Summary: {len(bills)} GRNs audited across {total_movements} stock movement records.")
                print("Run with '--execute' to perform the live atomic migration with table backups.")
        else:
            async with engine.begin() as conn:
                # 1. Ensure backup tables exist
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS _backup_purchase_receipts_grn_date (
                        backup_id serial PRIMARY KEY,
                        backup_at timestamptz DEFAULT NOW(),
                        grn_id varchar(64),
                        receipt_no varchar(128),
                        old_created_at timestamptz,
                        new_created_at timestamptz
                    );
                """))
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS _backup_stock_movements_grn_date (
                        backup_id serial PRIMARY KEY,
                        backup_at timestamptz DEFAULT NOW(),
                        movement_id varchar(64),
                        reference_doc_id varchar(64),
                        old_created_at timestamptz,
                        new_created_at timestamptz
                    );
                """))

                print(f"\n{'#':<3} | {'RECEIPT NO':<22} | {'BILL NO':<14} | {'NEW TIMESTAMP':<28} | {'SM UPDATED':<10} | {'STATUS'}")
                print("-" * 105)
                idx = 0
                total_sm_updated = 0
                for rno, binfo in sorted(bills.items(), key=lambda x: (x[1]["bill_date"], x[0])):
                    idx += 1
                    res = await conn.execute(
                        text("SELECT id, receipt_no, status, created_at FROM purchase_receipts WHERE receipt_no = :rno FOR UPDATE"),
                        {"rno": rno}
                    )
                    row = res.fetchone()
                    if not row:
                        print(f"{idx:<3} | {rno:<22} | {binfo['bill_no']:<14} | {'-':<28} | {'0':<10} | NOT_FOUND")
                        continue

                    raw_gid = row[0]
                    actual_rno = row[1]
                    old_ts = row[3]
                    str_gid = str(raw_gid)
                    new_ts = datetime.datetime.fromisoformat(binfo["target_timestamp"])

                    # Backups
                    await conn.execute(text("""
                        INSERT INTO _backup_purchase_receipts_grn_date (grn_id, receipt_no, old_created_at, new_created_at)
                        VALUES (:gid, :rno, :old_ts, :new_ts);
                    """), {"gid": str_gid, "rno": actual_rno, "old_ts": old_ts, "new_ts": new_ts})

                    await conn.execute(text("""
                        INSERT INTO _backup_stock_movements_grn_date (movement_id, reference_doc_id, old_created_at, new_created_at)
                        SELECT id::text, reference_doc_id::text, created_at, :new_ts
                        FROM stock_movements
                        WHERE reference_doc_id::text = :gid OR reference_doc_id::text = :rno;
                    """), {"gid": str_gid, "rno": actual_rno, "new_ts": new_ts})

                    # Update purchase_receipts
                    await conn.execute(text("""
                        UPDATE purchase_receipts
                        SET created_at = :new_ts, modified_at = NOW()
                        WHERE id = :raw_gid;
                    """), {"new_ts": new_ts, "raw_gid": raw_gid})

                    # Update stock_movements
                    upd_sm = await conn.execute(text("""
                        UPDATE stock_movements
                        SET created_at = :new_ts, modified_at = NOW()
                        WHERE reference_doc_id::text = :gid OR reference_doc_id::text = :rno;
                    """), {"new_ts": new_ts, "gid": str_gid, "rno": actual_rno})

                    sm_cnt = upd_sm.rowcount
                    total_sm_updated += sm_cnt
                    print(f"{idx:<3} | {actual_rno:<22} | {binfo['bill_no']:<14} | {new_ts.isoformat():<28} | {sm_cnt:<10} | REMEDIATED")

                print("-" * 105)
                print(f"SUCCESS: Remediated {len(bills)} GRNs and {total_sm_updated} stock movement timestamps.")
    finally:
        await engine.dispose()


async def run_remote_api_remediation(api_url: str, bills: Dict[str, Dict[str, Any]], execute: bool):
    """Executes remediation via the live FastAPI backend."""
    mode = "EXECUTE (MUTATION COMMITTED)" if execute else "DRY-RUN (AUDIT ONLY)"
    print("=" * 105)
    print(f"SMRITI RETAIL OS: HEADLESS GRN DATE REMEDIATION [REMOTE REST API ENGINE]")
    print(f"Mode          : {mode}")
    print(f"Target API    : {api_url}")
    print(f"Total GRNs    : {len(bills)}")
    print("=" * 105)

    corrections_payload = [
        {
            "receipt_no": rno,
            "target_date": binfo["target_timestamp"],
            "bill_no": binfo["bill_no"],
        }
        for rno, binfo in bills.items()
    ]

    async with httpx.AsyncClient(timeout=120.0) as client:
        # 1. Login
        print("\n[1/3] Authenticating with SYSADMIN credentials...")
        login_resp = await client.post(
            f"{api_url}/api/v1/auth/login",
            json={"username": "admin", "password": "Admin@123"}
        )
        if login_resp.status_code != 200:
            print(f"[FATAL] Authentication failed ({login_resp.status_code}): {login_resp.text}")
            return

        token = login_resp.json().get("access_token") or login_resp.json().get("data", {}).get("access_token")
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        print("  [OK] SYSADMIN JWT Token acquired.")

        # 2. Invoke Remediation Endpoint
        print(f"\n[2/3] Calling POST /api/v1/database-manager/admin-remediate-grn-dates (dry_run={not execute})...")
        endpoint_url = f"{api_url}/api/v1/database-manager/admin-remediate-grn-dates"
        payload = {
            "database": "smriti001",
            "dry_run": not execute,
            "corrections": corrections_payload,
        }

        resp = await client.post(endpoint_url, json=payload, headers=headers)
        if resp.status_code != 200:
            print(f"[FAIL] Endpoint returned {resp.status_code}: {resp.text}")
            return

        data = resp.json()
        print(f"  [OK] Server responded with success={data.get('success')}: {data.get('message')}")

        items = data.get("planned_items") or data.get("remediated_items") or []
        print(f"\n{'#':<3} | {'RECEIPT NO':<22} | {'CURRENT / OLD TS':<28} | {'TARGET / NEW TS':<28} | {'MOVEMENTS':<9} | {'STATUS'}")
        print("-" * 115)
        for idx, itm in enumerate(items, 1):
            cur_ts = itm.get("current_created_at") or itm.get("old_created_at") or "NULL"
            new_ts = itm.get("target_created_at") or itm.get("new_created_at") or "NULL"
            sm_cnt = itm.get("stock_movements_count") or itm.get("stock_movements_updated") or 0
            st = itm.get("status")
            print(f"{idx:<3} | {itm['receipt_no']:<22} | {cur_ts:<28} | {new_ts:<28} | {sm_cnt:<9} | {st}")
        print("-" * 115)


async def main():
    parser = argparse.ArgumentParser(description="Headless GRN Date Correction & Data Integrity Repair.")
    parser.add_argument(
        "--mode",
        choices=["api", "db"],
        default="api",
        help="Execution transport mode ('api' via FastAPI endpoint or 'db' direct SQLAlchemy)",
    )
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="Target REST API base URL")
    parser.add_argument("--db-url", default=DEFAULT_DB_URL, help="Direct PostgreSQL asyncpg URL")
    parser.add_argument("--execute", action="store_true", help="Apply live mutations (default is dry-run)")

    args = parser.parse_args()

    bills = load_authoritative_bills_from_excel()
    print(f"Successfully compiled {len(bills)} authoritative GRN bill dates from client Excel source.")

    if args.mode == "db":
        await run_direct_db_remediation(args.db_url, bills, execute=args.execute)
    else:
        await run_remote_api_remediation(args.api_url, bills, execute=args.execute)


if __name__ == "__main__":
    asyncio.run(main())
