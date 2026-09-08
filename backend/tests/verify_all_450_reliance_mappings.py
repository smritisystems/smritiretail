"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.18.0
Created      : 2026-09-09
Modified     : 2026-09-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: 450 Reliance Customer Article Mappings Dataset & Resolution Verifier
"""

import sys
import os
import asyncio
from pathlib import Path

# Configure UTF-8 encoding for Windows console
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from dotenv import dotenv_values
root_env = backend_dir.parent / ".env"
if root_env.exists():
    for k, v in dotenv_values(root_env).items():
        if v is not None and k not in os.environ:
            os.environ[k] = v

import psycopg2
from app.db.session import get_company_sessionmaker
from app.services.item_master_svc import UniversalItemMasterService


async def verify_450_reliance_mappings(db_name: str = "smriti001") -> bool:
    print("================================================================================")
    print(f"=== 450 RELIANCE B2B CUSTOMER ARTICLE MAPPINGS AUDIT: {db_name} ===")
    print("================================================================================")

    # 1. SQL Direct Audit
    conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db_name}")
    cur = conn.cursor()

    # Total and customer scoping
    cur.execute("SELECT id, name FROM customers WHERE id = 'CUST-001';")
    cust_row = cur.fetchone()
    print(f"[Phase 1: Target Customer Identification]")
    print(f"  • Customer ID   : {cust_row[0]}")
    print(f"  • Customer Name : {cust_row[1]}")
    assert cust_row is not None, "Customer CUST-001 not found"

    cur.execute("""
        SELECT 
            COUNT(*) as total_count,
            COUNT(DISTINCT customer_article) as distinct_articles,
            COUNT(DISTINCT barcode) as distinct_barcodes,
            COUNT(DISTINCT variant_id) as distinct_variants,
            COUNT(CASE WHEN is_active = true AND is_deleted = false THEN 1 END) as active_count,
            COUNT(CASE WHEN contract_rate IS NOT NULL AND contract_rate > 0 THEN 1 END) as valid_rates,
            COUNT(CASE WHEN barcode LIKE '8904551%' THEN 1 END) as gs1_ean_count,
            MIN(contract_rate) as min_rate,
            MAX(contract_rate) as max_rate,
            AVG(contract_rate) as avg_rate
        FROM customer_article_mappings
        WHERE customer_id = 'CUST-001';
    """)
    stats = cur.fetchone()
    print(f"\n[Phase 2: Dataset Metrics for CUST-001]")
    print(f"  • Total Seeded Mappings     : {stats[0]} (Target: 450)")
    print(f"  • Distinct Buyer Articles   : {stats[1]}")
    print(f"  • Distinct GS1 Barcodes     : {stats[2]}")
    print(f"  • Distinct SMRITI Variants  : {stats[3]}")
    print(f"  • Active & Non-Deleted      : {stats[4]}")
    print(f"  • With Contract Rate > 0    : {stats[5]}")
    print(f"  • GS1-13 EANs ('8904551%')  : {stats[6]}")
    print(f"  • Rate Range (Min / Max)    : ₹{stats[7]} / ₹{stats[8]}")
    print(f"  • Average Contract Rate     : ₹{float(stats[9]):.2f}")

    assert stats[0] == 450, f"Expected exactly 450 Reliance mappings, found {stats[0]}"
    assert stats[1] == 450, f"Expected 450 distinct buyer articles, found {stats[1]}"
    assert stats[2] == 450, f"Expected 450 distinct barcodes, found {stats[2]}"
    assert stats[4] == 450, f"Expected 450 active mappings, found {stats[4]}"
    assert stats[5] == 450, f"Expected 450 valid contract rates, found {stats[5]}"
    assert stats[6] == 450, f"Expected 450 GS1 EAN barcodes, found {stats[6]}"
    print("  ✅ All 450 Reliance mappings validated with 100% data completeness.")

    # 2. Referential Integrity Check
    print(f"\n[Phase 3: Referential Integrity Against Canonical Items & Barcodes]")
    cur.execute("""
        SELECT 
            COUNT(CASE WHEN i.id IS NULL THEN 1 END) as orphan_items,
            COUNT(CASE WHEN v.id IS NULL THEN 1 END) as orphan_variants,
            COUNT(CASE WHEN b.id IS NULL THEN 1 END) as orphan_barcodes
        FROM customer_article_mappings cam
        LEFT JOIN items i ON cam.item_id = i.id
        LEFT JOIN item_variants v ON cam.variant_id = v.id
        LEFT JOIN item_barcodes b ON cam.barcode_id = b.id
        WHERE cam.customer_id = 'CUST-001';
    """)
    orphans = cur.fetchone()
    print(f"  • Orphan Item FKs    : {orphans[0]}")
    print(f"  • Orphan Variant FKs : {orphans[1]}")
    print(f"  • Orphan Barcode FKs : {orphans[2]}")
    assert orphans[0] == 0, f"Found {orphans[0]} orphan items in customer_article_mappings"
    assert orphans[1] == 0, f"Found {orphans[1]} orphan variants in customer_article_mappings"
    assert orphans[2] == 0, f"Found {orphans[2]} orphan barcodes in customer_article_mappings"
    print("  ✅ 100% Referential Integrity: Zero orphan foreign keys across all 450 records.")

    # 3. Live 5-Tier Universal Resolution across all 450 Mappings
    print(f"\n[Phase 4: Exhaustive Live 5-Tier Resolution across ALL 450 Records (900 Total Lookups)]")
    cur.execute("""
        SELECT customer_article, barcode, vendor_article, contract_rate
        FROM customer_article_mappings
        WHERE customer_id = 'CUST-001'
        ORDER BY id;
    """)
    all_rows = cur.fetchall()
    cur.close()
    conn.close()

    total_mappings = len(all_rows)
    print(f"  • Starting exhaustive resolution loop for {total_mappings} records...")
    assert total_mappings == 450, f"Expected 450 rows, got {total_mappings}"

    buyer_success = 0
    barcode_success = 0
    contract_rate_matches = 0

    import time
    t_start = time.perf_counter()

    maker = get_company_sessionmaker(db_name)
    async with maker() as session:
        for idx, (buyer_code, barcode, vendor_style, expected_rate) in enumerate(all_rows, 1):
            # Test Tier 3: Resolve by Buyer Article Code
            res_buyer = await UniversalItemMasterService.resolve_item_by_barcode_or_sku(
                session=session,
                query_str=buyer_code,
                customer_id="CUST-001",
            )
            assert res_buyer is not None, f"Failed to resolve buyer code {buyer_code}"
            assert res_buyer.matched_by == "BUYER_CODE", f"Expected BUYER_CODE match, got {res_buyer.matched_by}"
            assert float(res_buyer.effective_price) == float(expected_rate), f"Rate mismatch for {buyer_code}"
            assert res_buyer.pricing_audit["contract_status"] == "ACTIVE"
            assert res_buyer.pricing_audit["pricing_rule_applied"] == "CUSTOMER_CONTRACT_RATE"
            buyer_success += 1

            # Test Tier 1: Resolve by EAN Barcode
            res_bc = await UniversalItemMasterService.resolve_item_by_barcode_or_sku(
                session=session,
                query_str=barcode,
                customer_id="CUST-001",
            )
            assert res_bc is not None, f"Failed to resolve barcode {barcode}"
            assert res_bc.matched_by == "BARCODE", f"Expected BARCODE match, got {res_bc.matched_by}"
            assert float(res_bc.effective_price) == float(expected_rate), f"Rate mismatch for {barcode}"
            barcode_success += 1
            contract_rate_matches += 1

            if idx % 50 == 0 or idx == total_mappings:
                print(f"  ✓ Verified [{idx:03d}/450] mappings | Buyer Codes: {buyer_success}/450 | Barcodes: {barcode_success}/450")

    total_time = time.perf_counter() - t_start
    avg_per_resolution = (total_time / (total_mappings * 2)) * 1000.0

    print(f"\n[Exhaustive Resolution Performance Metrics]")
    print(f"  • Total Individual Resolutions Executed : {buyer_success + barcode_success} (450 Buyer + 450 Barcode)")
    print(f"  • Buyer Code (Tier 3) Pass Rate          : {buyer_success}/{total_mappings} (100.00%)")
    print(f"  • Barcode (Tier 1) Pass Rate             : {barcode_success}/{total_mappings} (100.00%)")
    print(f"  • Contract Rate Exact Match Rate         : {contract_rate_matches}/{total_mappings} (100.00%)")
    print(f"  • Total Resolution Duration              : {total_time:.2f} s ({avg_per_resolution:.2f} ms/lookup)")

    assert buyer_success == 450, f"Expected 450 buyer code successes, got {buyer_success}"
    assert barcode_success == 450, f"Expected 450 barcode successes, got {barcode_success}"

    print("\n--------------------------------------------------------------------------------")
    print("✅ PROVED: All 450 Reliance mappings are physically seeded, relational-linked,")
    print("   and demonstrated 100% resolvable via 900 individual live lookups.")
    print("================================================================================")
    return True


if __name__ == "__main__":
    success = asyncio.run(verify_450_reliance_mappings("smriti001"))
    sys.exit(0 if success else 1)
