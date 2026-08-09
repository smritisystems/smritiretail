"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Version      : 2.0.0
Created      : 2026-08-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software

Database Safety Verification Script — P0 Concurrency + Tenant Identity Hardening
================================================================================
Verifies pre-migration and post-migration database safety conditions:

  1. Table count verification (baseline: 269 physical PostgreSQL tables)
  2. Duplicate (company_id, code) pairs in products
  3. Duplicate (company_id, barcode) pairs in products
  4. Duplicate (company_id, sku) pairs in products
  5. NULL company_id rows in products
  6. NULL branch_id rows in products (informational)
  7. Post-migration: confirms composite constraints exist

Run:
    cd f:\\SMRITRretailNXmgrt
    python scratch/verify_database_safety.py

DATABASE_URL env var must be set or backend/.env must contain it.
"""

import asyncio
import os
import sys
import urllib.parse
from datetime import datetime, timezone

# ── Resolve DATABASE_URL ──────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    for candidate in [
        os.path.join(os.path.dirname(__file__), "..", "backend", ".env"),
        os.path.join(os.path.dirname(__file__), "backend", ".env"),
    ]:
        if os.path.exists(candidate):
            with open(candidate) as f:
                for line in f:
                    stripped = line.strip()
                    if stripped.startswith("DATABASE_URL="):
                        DATABASE_URL = stripped.split("=", 1)[1].strip().strip('"').strip("'")
                        break
            if DATABASE_URL:
                break

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set. Export it or add it to backend/.env")
    sys.exit(1)

# Build asyncpg-compatible URL
conn_url = DATABASE_URL
for prefix in ("postgresql+asyncpg://", "postgresql://", "postgres://"):
    if conn_url.startswith(prefix):
        conn_url = "postgresql://" + conn_url[len(prefix):]
        break

BASELINE_TABLE_COUNT = 269
SEP = "=" * 70


def hdr(title: str):
    print(f"\n{SEP}\n  {title}\n{SEP}")


def chk(label: str, passed: bool, detail: str = "") -> bool:
    icon = "✓ PASS" if passed else "✗ FAIL"
    print(f"  [{icon}] {label}")
    if detail:
        for line in detail.split("\n"):
            print(f"         {line}")
    return passed


async def run():
    try:
        import asyncpg
    except ImportError:
        print("ERROR: asyncpg not installed.  pip install asyncpg")
        sys.exit(1)

    parsed = urllib.parse.urlparse(conn_url)
    kwargs = dict(
        host=parsed.hostname,
        port=parsed.port or 5432,
        user=parsed.username,
        password=parsed.password,
        database=parsed.path.lstrip("/"),
    )
    print(f"\n  Target   : {parsed.hostname}:{kwargs['port']}/{kwargs['database']}")
    print(f"  Timestamp: {datetime.now(timezone.utc).isoformat()}")

    try:
        conn = await asyncpg.connect(**kwargs)
    except Exception as exc:
        print(f"\nERROR: Connection failed — {exc}")
        sys.exit(1)

    all_ok = True
    try:
        # ── 1. Table count ─────────────────────────────────────────────────
        hdr("CHECK 1 — Physical Table Count")
        n = await conn.fetchval(
            "SELECT COUNT(*) FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
        )
        all_ok &= chk(
            f"Table count: {n} (baseline ≥ {BASELINE_TABLE_COUNT})",
            n >= BASELINE_TABLE_COUNT,
            f"Expected ≥ {BASELINE_TABLE_COUNT}, got {n}" if n < BASELINE_TABLE_COUNT else "",
        )

        # ── 2. Duplicate (company_id, code) ────────────────────────────────
        hdr("CHECK 2 — Duplicate (company_id, code) in products")
        rows = await conn.fetch(
            "SELECT company_id, code, COUNT(*) AS cnt "
            "FROM products WHERE is_deleted = FALSE "
            "GROUP BY company_id, code HAVING COUNT(*) > 1 "
            "ORDER BY cnt DESC LIMIT 10"
        )
        all_ok &= chk(
            f"Duplicate (company_id, code) pairs found: {len(rows)}",
            len(rows) == 0,
            "\n".join(f"company_id={r['company_id']}  code={r['code']}  count={r['cnt']}" for r in rows),
        )

        # ── 3. Duplicate (company_id, barcode) ─────────────────────────────
        hdr("CHECK 3 — Duplicate (company_id, barcode) in products")
        rows = await conn.fetch(
            "SELECT company_id, barcode, COUNT(*) AS cnt "
            "FROM products WHERE is_deleted = FALSE AND barcode IS NOT NULL "
            "GROUP BY company_id, barcode HAVING COUNT(*) > 1 "
            "ORDER BY cnt DESC LIMIT 10"
        )
        all_ok &= chk(
            f"Duplicate (company_id, barcode) pairs found: {len(rows)}",
            len(rows) == 0,
            "\n".join(f"company_id={r['company_id']}  barcode={r['barcode']}  count={r['cnt']}" for r in rows),
        )

        # ── 4. Duplicate (company_id, sku) ─────────────────────────────────
        hdr("CHECK 4 — Duplicate (company_id, sku) in products")
        rows = await conn.fetch(
            "SELECT company_id, sku, COUNT(*) AS cnt "
            "FROM products "
            "WHERE is_deleted = FALSE AND sku IS NOT NULL AND sku <> '' "
            "GROUP BY company_id, sku HAVING COUNT(*) > 1 "
            "ORDER BY cnt DESC LIMIT 10"
        )
        all_ok &= chk(
            f"Duplicate (company_id, sku) pairs found: {len(rows)}",
            len(rows) == 0,
            "\n".join(f"company_id={r['company_id']}  sku={r['sku']}  count={r['cnt']}" for r in rows),
        )

        # ── 5. NULL company_id ──────────────────────────────────────────────
        hdr("CHECK 5 — NULL company_id in products")
        n = await conn.fetchval(
            "SELECT COUNT(*) FROM products WHERE company_id IS NULL AND is_deleted = FALSE"
        )
        all_ok &= chk(
            f"Products with NULL company_id: {n}",
            n == 0,
            "All products must have company_id before migration v1502 can apply." if n else "",
        )

        # ── 6. NULL branch_id (informational) ──────────────────────────────
        hdr("CHECK 6 — NULL branch_id in products (informational)")
        n = await conn.fetchval(
            "SELECT COUNT(*) FROM products WHERE branch_id IS NULL AND is_deleted = FALSE"
        )
        chk(
            f"Products with NULL branch_id: {n} (informational — acceptable for company-wide products)",
            True,
        )

        # ── 7. Composite constraint presence (post-migration) ───────────────
        hdr("CHECK 7 — Composite Constraint Presence (post-migration v1502)")
        code_c = await conn.fetchval(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE table_name='products' AND constraint_name='uq_products_company_code'"
        )
        sku_c = await conn.fetchval(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE table_name='products' AND constraint_name='uq_products_company_sku'"
        )
        old_c = await conn.fetchval(
            "SELECT 1 FROM information_schema.table_constraints "
            "WHERE table_name='products' AND constraint_name='products_code_key'"
        )
        chk("uq_products_company_code exists", bool(code_c),
            "" if code_c else "Migration v1502 not yet applied — run: alembic upgrade v1502_tenant_scoped_product_code_sku")
        chk("uq_products_company_sku exists", bool(sku_c),
            "" if sku_c else "Migration v1502 not yet applied.")
        chk("Old global products_code_key REMOVED", not bool(old_c),
            "Old constraint still present — migration v1502 pending." if old_c else "")

        # ── 8. Product stats ────────────────────────────────────────────────
        hdr("CHECK 8 — Product Inventory Stats")
        total = await conn.fetchval("SELECT COUNT(*) FROM products WHERE is_deleted = FALSE")
        variants = await conn.fetchval(
            "SELECT COUNT(*) FROM products WHERE is_deleted = FALSE AND variant_template_id IS NOT NULL"
        )
        print(f"  Active products  : {total}")
        print(f"  Variant products : {variants}")
        print(f"  Standalone       : {total - variants}")

    finally:
        await conn.close()

    print(f"\n{SEP}")
    if all_ok:
        print("  FINAL VERDICT: ✓ SAFE — Database passes all P0 safety checks")
        print("                  Migration v1502 may be applied safely.")
    else:
        print("  FINAL VERDICT: ✗ UNSAFE — Resolve the FAIL items above first.")
        print("                  DO NOT apply migration v1502 until all checks pass.")
    print(SEP)
    return all_ok


if __name__ == "__main__":
    ok = asyncio.run(run())
    sys.exit(0 if ok else 1)
