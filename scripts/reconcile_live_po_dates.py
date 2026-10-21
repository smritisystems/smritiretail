"""
Project      : SMRITI Retail OS
Repository   : SMRITIRetailNX
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.99.4
Created      : 2026-10-21
Modified     : 2026-10-21
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Headless Purchase Order Date Remediation Runner
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone
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


def load_authoritative_pos_from_excel() -> Dict[str, Dict[str, Any]]:
    """Loads the 28 vendor bills and generates matching PO target timestamps (1 hour prior to GRN)."""
    excel_path = None
    for p in EXCEL_CANDIDATE_PATHS:
        if os.path.exists(p):
            excel_path = p
            break

    if not excel_path:
        raise FileNotFoundError(f"None of the candidate Excel paths were found: {EXCEL_CANDIDATE_PATHS}")

    wb = openpyxl.load_workbook(excel_path, data_only=True)
    ws = wb["Sheet1"]

    pos: Dict[str, Dict[str, Any]] = {}
    for r in list(ws.iter_rows(values_only=True))[2:]:
        v_code = str(r[6]).strip() if r[6] else ""
        b_no = str(r[10]).strip() if r[10] else ""
        raw_bdate = r[11]

        if not v_code:
            continue

        # Handle specific continuation / missing bill numbers
        if not b_no or b_no == "None":
            style_code = str(r[1] or "")
            if "CH-20" in style_code:
                b_no = "707"
                raw_bdate = "2026-09-07"
            elif "CH-22" in style_code:
                b_no = "704"
                raw_bdate = "2026-08-10"
            elif "CH-23" in style_code:
                b_no = "706"
                raw_bdate = "2026-08-22"
            else:
                continue

        # Normalize date
        if isinstance(raw_bdate, datetime):
            bdate_val = raw_bdate.date()
        elif hasattr(raw_bdate, "date"):
            bdate_val = raw_bdate.date()
        else:
            s_date = str(raw_bdate).strip().split(" ")[0]
            if s_date.startswith("2036"):
                s_date = "2026" + s_date[4:]
            try:
                bdate_val = datetime.strptime(s_date, "%Y-%m-%d").date()
            except ValueError:
                continue

        if bdate_val.year == 2036:
            bdate_val = bdate_val.replace(year=2026)

        norm_bno = clean_doc_no(b_no)
        po_no = f"PO-{v_code}-{norm_bno}"
        grn_no = f"GRN-{v_code}-{norm_bno}"

        if po_no not in pos:
            # Set PO timestamp to 10:00:00 UTC (1 hour prior to GRN at 11:00:00 UTC)
            target_ts = datetime(
                bdate_val.year, bdate_val.month, bdate_val.day, 10, 0, 0, tzinfo=timezone.utc
            )
            pos[po_no] = {
                "po_no": po_no,
                "grn_no": grn_no,
                "vendor_code": v_code,
                "bill_no": b_no,
                "bill_date": bdate_val,
                "target_timestamp": target_ts.isoformat(),
                "target_datetime": target_ts,
            }

    return pos


async def run_direct_db_po_remediation(db_url: str, pos: Dict[str, Dict[str, Any]], execute: bool):
    """Executes atomic PO remediation directly against PostgreSQL."""
    mode = "EXECUTE (MUTATION COMMITTED)" if execute else "DRY-RUN (AUDIT ONLY)"
    print("=" * 105)
    print(f"SMRITI RETAIL OS: HEADLESS PURCHASE ORDER DATE REMEDIATION [DIRECT DATABASE ENGINE]")
    print(f"Mode          : {mode}")
    print(f"Target DB     : {db_url}")
    print(f"Total POs     : {len(pos)}")
    print("=" * 105)

    engine = create_async_engine(db_url, echo=False)
    try:
        if not execute:
            async with engine.connect() as conn:
                print(f"\n{'#':<3} | {'PO NUMBER':<22} | {'BILL NO':<14} | {'BILL DATE':<10} | {'CURRENT CREATED_AT':<28} | {'STATUS'}")
                print("-" * 105)
                idx = 0
                for ono, pinfo in sorted(pos.items(), key=lambda x: (x[1]["bill_date"], x[0])):
                    idx += 1
                    res = await conn.execute(
                        text("SELECT id, order_no, status, created_at FROM purchase_orders WHERE order_no = :ono"),
                        {"ono": ono}
                    )
                    row = res.fetchone()
                    if not row:
                        print(f"{idx:<3} | {ono:<22} | {pinfo['bill_no']:<14} | {str(pinfo['bill_date']):<10} | {'NOT FOUND':<28} | MISSING")
                        continue

                    cur_ts = row[3]
                    cur_str = cur_ts.isoformat() if cur_ts else "NULL"
                    print(f"{idx:<3} | {ono:<22} | {pinfo['bill_no']:<14} | {str(pinfo['bill_date']):<10} | {cur_str:<28} | READY")

                print("-" * 105)
                print(f"Summary: {len(pos)} POs audited.")
                print("Run with '--execute' to perform the live atomic migration with table backups.")
        else:
            async with engine.begin() as conn:
                # 1. Ensure backup table exists
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS _backup_purchase_orders_date (
                        backup_id serial PRIMARY KEY,
                        backup_at timestamptz DEFAULT NOW(),
                        po_id varchar(64),
                        order_no varchar(128),
                        status varchar(32),
                        grand_total numeric(15, 2),
                        old_created_at timestamptz,
                        new_created_at timestamptz
                    );
                """))

                print(f"\n{'#':<3} | {'PO NUMBER':<22} | {'BILL NO':<14} | {'NEW CREATED_AT':<28} | {'STATUS'}")
                print("-" * 105)
                idx = 0
                for ono, pinfo in sorted(pos.items(), key=lambda x: (x[1]["bill_date"], x[0])):
                    idx += 1
                    res = await conn.execute(
                        text("SELECT id, order_no, status, created_at, grand_total FROM purchase_orders WHERE order_no = :ono FOR UPDATE"),
                        {"ono": ono}
                    )
                    row = res.fetchone()
                    if not row:
                        print(f"{idx:<3} | {ono:<22} | {pinfo['bill_no']:<14} | {'SKIPPED - NOT FOUND':<28} | MISSING")
                        continue

                    raw_pid = row[0]
                    actual_ono = row[1]
                    cur_st = row[2]
                    old_ts = row[3]
                    gt = row[4]
                    new_ts = pinfo["target_datetime"]
                    str_pid = str(raw_pid)

                    # Backup
                    await conn.execute(text("""
                        INSERT INTO _backup_purchase_orders_date (po_id, order_no, status, grand_total, old_created_at, new_created_at)
                        VALUES (:pid, :ono, :st, :gt, :old_ts, :new_ts);
                    """), {"pid": str_pid, "ono": actual_ono, "st": cur_st, "gt": gt, "old_ts": old_ts, "new_ts": new_ts})

                    # Update purchase_orders
                    await conn.execute(text("""
                        UPDATE purchase_orders
                        SET created_at = :new_ts,
                            submitted_at = :new_ts,
                            confirmed_at = :new_ts,
                            modified_at = NOW()
                        WHERE id = :raw_pid;
                    """), {"new_ts": new_ts, "raw_pid": raw_pid})

                    print(f"{idx:<3} | {actual_ono:<22} | {pinfo['bill_no']:<14} | {new_ts.isoformat():<28} | REMEDIATED")

                print("-" * 105)
                print(f"SUCCESS: Remediated {len(pos)} Purchase Orders.")
    finally:
        await engine.dispose()


async def run_remote_api_po_remediation(api_url: str, pos: Dict[str, Dict[str, Any]], execute: bool, database: str = "smriti001"):
    """Executes PO remediation via the live FastAPI backend."""
    mode = "EXECUTE (MUTATION COMMITTED)" if execute else "DRY-RUN (AUDIT ONLY)"
    print("=" * 105)
    print(f"SMRITI RETAIL OS: HEADLESS PURCHASE ORDER DATE REMEDIATION [REMOTE REST API ENGINE]")
    print(f"Mode          : {mode}")
    print(f"Target API    : {api_url}")
    print(f"Target DB     : {database}")
    print(f"Total POs     : {len(pos)}")
    print("=" * 105)

    corrections_payload = [
        {
            "order_no": ono,
            "target_date": pinfo["target_timestamp"],
            "bill_no": pinfo["bill_no"],
        }
        for ono, pinfo in pos.items()
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
        print(f"\n[2/3] Calling POST /api/v1/database-manager/admin-remediate-po-dates (dry_run={not execute}, db={database})...")
        endpoint_url = f"{api_url}/api/v1/database-manager/admin-remediate-po-dates"
        payload = {
            "database": database,
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
        print(f"\n{'#':<3} | {'PO NUMBER':<22} | {'CURRENT / OLD TS':<28} | {'TARGET / NEW TS':<28} | {'STATUS'}")
        print("-" * 95)
        for idx, itm in enumerate(items, 1):
            cur_ts = itm.get("current_created_at") or itm.get("old_created_at") or "NULL"
            new_ts = itm.get("target_created_at") or itm.get("new_created_at") or "NULL"
            st = itm.get("status")
            print(f"{idx:<3} | {itm['order_no']:<22} | {cur_ts:<28} | {new_ts:<28} | {st}")
        print("-" * 95)


async def main():
    parser = argparse.ArgumentParser(description="Headless Purchase Order Date Alignment.")
    parser.add_argument(
        "--mode",
        choices=["api", "db"],
        default="api",
        help="Execution transport mode ('api' via FastAPI endpoint or 'db' direct SQLAlchemy)",
    )
    parser.add_argument("--api-url", default=DEFAULT_API_URL, help="Target REST API base URL")
    parser.add_argument("--db-url", default=DEFAULT_DB_URL, help="Direct PostgreSQL asyncpg URL")
    parser.add_argument("--database", default="smriti001", help="Target database name (default: smriti001)")
    parser.add_argument("--execute", action="store_true", help="Apply live mutations (default is dry-run)")

    args = parser.parse_args()

    pos = load_authoritative_pos_from_excel()
    print(f"Successfully compiled {len(pos)} authoritative Purchase Orders from client Excel source.")

    if args.mode == "db":
        db_url = args.db_url
        if args.database != "smriti001" and "smriti001" in db_url:
            db_url = db_url.replace("smriti001", args.database)
        await run_direct_db_po_remediation(db_url, pos, execute=args.execute)
    else:
        await run_remote_api_po_remediation(args.api_url, pos, execute=args.execute, database=args.database)


if __name__ == "__main__":
    asyncio.run(main())
