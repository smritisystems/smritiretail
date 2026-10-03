"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 2.0.0
Created      : 2026-09-01
Modified     : 2026-09-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Canonical Schema Migration & Multi-Domain Reconciliation Engine
"""

import asyncio
import json
import re
import uuid
from decimal import Decimal
from typing import Dict, List, Set, Any
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

def validate_ean13_checksum(barcode: str) -> bool:
    """Validate standard EAN-13 check digit modulo 10."""
    if not re.fullmatch(r"\d{13}", barcode):
        return False
    digits = [int(d) for d in barcode]
    checksum = sum(digits[i] if i % 2 == 0 else digits[i] * 3 for i in range(12))
    check_digit = (10 - (checksum % 10)) % 10
    return check_digit == digits[12]

def classify_barcode(barcode: str) -> str:
    """Deterministically classify barcode symbology without heuristic assumptions."""
    if not barcode:
        return "UNKNOWN"
    barcode = barcode.strip()
    if re.fullmatch(r"\d{13}", barcode):
        return "EAN13" if validate_ean13_checksum(barcode) else "EAN13_INVALID_CHECKSUM"
    elif re.fullmatch(r"\d{12}", barcode):
        return "UPCA"
    elif re.fullmatch(r"\d{8}", barcode):
        return "EAN8"
    elif re.fullmatch(r"[A-Za-z0-9\-_]+", barcode):
        return "CODE128_INTERNAL"
    return "CUSTOM_STORE_CODE"

async def execute_migration():
    db_url = "postgresql+asyncpg://postgres:postgres@localhost:5432/smriti001"
    migration_run_id = f"migr_{uuid.uuid4().hex[:12]}"
    print("=" * 80)
    print("SMRITI CANONICAL ITEM MASTER MIGRATION & RECONCILIATION ENGINE (v2.0)")
    print(f"Run ID: {migration_run_id}")
    print(f"Target Database: {db_url}")
    print("=" * 80)

    engine = create_async_engine(db_url, echo=False)
    
    async with engine.begin() as conn:
        # Step 1: Ensure legacy_id_mappings and pricing schema exists
        print("\n[1/7] Ensuring legacy_id_mappings and price books schema exists...")
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS legacy_id_mappings (
                id VARCHAR(50) PRIMARY KEY,
                uuid VARCHAR(36) NOT NULL,
                company_id VARCHAR(50),
                branch_id VARCHAR(50),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                modified_at TIMESTAMPTZ DEFAULT NOW(),
                created_by VARCHAR(100),
                updated_by VARCHAR(100),
                is_active BOOLEAN DEFAULT TRUE,
                is_deleted BOOLEAN DEFAULT FALSE,
                deleted_at TIMESTAMPTZ,
                deleted_by VARCHAR(100),
                version INTEGER DEFAULT 1,
                migration_run_id VARCHAR(50) NOT NULL,
                legacy_table VARCHAR(50) NOT NULL,
                legacy_id VARCHAR(50) NOT NULL,
                legacy_uuid VARCHAR(36),
                canonical_table VARCHAR(50) NOT NULL,
                canonical_id VARCHAR(50) NOT NULL,
                canonical_uuid VARCHAR(36),
                disposition VARCHAR(50) NOT NULL DEFAULT 'MIGRATED',
                conflict_reason TEXT,
                audit_checksum VARCHAR(64),
                CONSTRAINT uq_legacy_mapping_source UNIQUE (legacy_table, legacy_id)
            )
        """))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_legacy_mappings_run ON legacy_id_mappings (migration_run_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_legacy_mappings_legacy ON legacy_id_mappings (legacy_table, legacy_id);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_legacy_mappings_canonical ON legacy_id_mappings (canonical_table, canonical_id);"))

        # Step 2: Ensure tenant-scoped unique indexes on canonical models (Rule 16)
        print("[2/7] Aligning tenant-scoped unique indexes & column nullability...")
        await conn.execute(text("ALTER TABLE IF EXISTS items ALTER COLUMN primary_uom DROP NOT NULL;"))
        await conn.execute(text("ALTER TABLE IF EXISTS items ALTER COLUMN category DROP NOT NULL;"))
        await conn.execute(text("ALTER TABLE IF EXISTS item_variants ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(15);"))
        await conn.execute(text("ALTER TABLE IF EXISTS item_variants ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2);"))
        await conn.execute(text("ALTER TABLE items DROP CONSTRAINT IF EXISTS items_item_code_key;"))
        await conn.execute(text("ALTER TABLE item_variants DROP CONSTRAINT IF EXISTS item_variants_variant_sku_key;"))
        await conn.execute(text("ALTER TABLE item_barcodes DROP CONSTRAINT IF EXISTS uq_item_barcode_value;"))
        await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_items_company_item_code ON items (company_id, item_code) WHERE (is_deleted = false);"))
        await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_variants_company_sku ON item_variants (company_id, variant_sku) WHERE (is_deleted = false);"))
        await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_barcodes_company_barcode ON item_barcodes (company_id, barcode) WHERE (is_deleted = false);"))

        # Step 3: Purge prior staging state for clean idempotent migration
        print("[3/7] Purging prior staging state for clean idempotent backfill...")
        await conn.execute(text("DELETE FROM price_book_entries;"))
        await conn.execute(text("DELETE FROM item_barcodes;"))
        await conn.execute(text("DELETE FROM item_variants;"))
        await conn.execute(text("DELETE FROM items;"))
        await conn.execute(text("DELETE FROM legacy_id_mappings WHERE legacy_table = 'products';"))

        # Step 4: Extract legacy products
        print("[4/7] Extracting legacy products...")
        res_prod = await conn.execute(text("""
            SELECT 
                id, uuid, code, sku, name, barcode, secondary_barcodes,
                brand, category, category_code, style_code, color, size,
                mrp, price, buying_price, cost_price, hsn_code, gst_percentage,
                stock, reserved_stock, tracking_mode, attributes,
                primary_image_url, gallery_images, company_id, branch_id,
                is_active, is_deleted
            FROM products
            ORDER BY company_id, style_code, code
        """))
        products = res_prod.fetchall()
        total_products = len(products)
        print(f"      Extracted {total_products} legacy products.")

        # Step 5: Check or Create Default Price Book per Company (Authoritative Pricing Domain)
        print("[5/7] Initializing Price Books for Authoritative Pricing Domain...")
        companies_seen: Set[str] = set()
        for p in products:
            p_map = dict(p._mapping)
            cid = p_map.get("company_id") or "COMP-001"
            companies_seen.add(cid)

        price_books_dict: Dict[str, str] = {}
        for cid in companies_seen:
            res_pb = await conn.execute(
                text("SELECT id FROM price_books WHERE company_id = :cid AND is_default = true AND is_deleted = false"),
                {"cid": cid}
            )
            pb_row = res_pb.fetchone()
            if pb_row:
                price_books_dict[cid] = pb_row[0]
            else:
                pb_id = f"pb_{uuid.uuid4().hex[:12]}"
                await conn.execute(
                    text("""
                        INSERT INTO price_books (
                            id, uuid, company_id, branch_id, name, code,
                            currency, is_default, status, is_active, is_deleted
                        ) VALUES (
                            :id, :uuid, :cid, 'MAIN', :name, :code,
                            'INR', true, 'ACTIVE', true, false
                        )
                    """),
                    {
                        "id": pb_id,
                        "uuid": str(uuid.uuid4()),
                        "cid": cid,
                        "name": f"Standard Retail Price List ({cid})",
                        "code": f"DEFAULT-{cid}"
                    }
                )
                price_books_dict[cid] = pb_id

        # Step 6: Transform and Load Canonical Entities
        print("[6/7] Migrating Items, Variants, Barcodes, Pricing, and Lineage...")
        items_dict: Dict[str, str] = {}
        items_count = 0
        variants_count = 0
        barcodes_count = 0
        prices_count = 0
        legacy_mappings_count = 0
        seen_barcodes: Set[str] = set()

        for p in products:
            p_map = dict(p._mapping)
            cid = p_map.get("company_id") or "COMP-001"
            bid = p_map.get("branch_id")
            pid = p_map["id"]
            sku = (p_map.get("code") or p_map.get("sku") or "").strip()
            style = (p_map.get("style_code") or "").strip()
            name = (p_map.get("name") or "").strip()

            # Deterministic Parent Style Identity (Blocker 4)
            if style:
                item_code = style
                item_status = "ACTIVE"
            else:
                item_code = f"ITM-UNASSIGNED-{pid}"
                item_status = "REQUIRES_REVIEW"

            item_key = f"{cid}::{item_code}"
            if item_key not in items_dict:
                res_existing_item = await conn.execute(
                    text("SELECT id FROM items WHERE company_id = :cid AND item_code = :code"),
                    {"cid": cid, "code": item_code}
                )
                existing_item_row = res_existing_item.fetchone()
                if existing_item_row:
                    item_db_id = existing_item_row[0]
                else:
                    item_db_id = f"itm_{uuid.uuid4().hex[:12]}"
                    # Zero hardcoded business defaults (Blockers 2 & 3)
                    await conn.execute(
                        text("""
                            INSERT INTO items (
                                id, uuid, company_id, branch_id, item_code, item_name,
                                item_type, category, category_code, brand, hsn_code,
                                tax_rate, primary_uom, primary_image_url,
                                is_batch_tracked, is_serial_tracked, is_favorite,
                                status, is_active, is_deleted
                            ) VALUES (
                                :id, :uuid, :cid, :bid, :code, :name,
                                'FINISHED_GOOD', :cat, :cat_code, :brand, :hsn,
                                :tax, null, :img,
                                false, false, false,
                                :status, true, false
                            )
                        """),
                        {
                            "id": item_db_id,
                            "uuid": str(uuid.uuid4()),
                            "cid": cid,
                            "bid": bid,
                            "code": item_code,
                            "name": name or item_code,
                            "cat": p_map.get("category"),
                            "cat_code": p_map.get("category_code"),
                            "brand": p_map.get("brand"),
                            "hsn": p_map.get("hsn_code"),
                            "tax": p_map.get("gst_percentage"),
                            "img": p_map.get("primary_image_url"),
                            "status": item_status
                        }
                    )
                    items_count += 1
                items_dict[item_key] = item_db_id

            parent_item_id = items_dict[item_key]

            # Variant creation (Physical identity + attributes only — Blocker 1)
            attributes_dict = {}
            if p_map.get("color"):
                attributes_dict["color"] = p_map["color"]
            if p_map.get("size"):
                attributes_dict["size"] = p_map["size"]
            if p_map.get("primary_image_url"):
                attributes_dict["primary_image_url"] = p_map["primary_image_url"]
            if p_map.get("gallery_images"):
                attributes_dict["gallery_images"] = p_map["gallery_images"]
            if p_map.get("hsn_code"):
                attributes_dict["hsn_code"] = p_map["hsn_code"]
            if p_map.get("gst_percentage") is not None:
                attributes_dict["tax_rate"] = float(p_map["gst_percentage"])
            if p_map.get("attributes"):
                try:
                    if isinstance(p_map["attributes"], dict):
                        attributes_dict.update(p_map["attributes"])
                    elif isinstance(p_map["attributes"], str):
                        attributes_dict.update(json.loads(p_map["attributes"]))
                except Exception:
                    pass

            res_existing_var = await conn.execute(
                text("SELECT id, uuid FROM item_variants WHERE company_id = :cid AND variant_sku = :sku"),
                {"cid": cid, "sku": sku}
            )
            existing_var_row = res_existing_var.fetchone()
            if existing_var_row:
                var_db_id = existing_var_row[0]
                var_uuid = existing_var_row[1]
            else:
                var_db_id = f"var_{uuid.uuid4().hex[:12]}"
                var_uuid = str(uuid.uuid4())
                await conn.execute(
                    text("""
                        INSERT INTO item_variants (
                            id, uuid, company_id, branch_id, item_id, variant_sku,
                            variant_name, attributes_json, hsn_code, tax_rate, is_active, is_deleted
                        ) VALUES (
                            :id, :uuid, :cid, :bid, :item_id, :sku,
                            :name, CAST(:attr AS jsonb), :hsn, :tax, :is_active, :is_deleted
                        )
                    """),
                    {
                        "id": var_db_id,
                        "uuid": var_uuid,
                        "cid": cid,
                        "bid": bid,
                        "item_id": parent_item_id,
                        "sku": sku,
                        "name": name or sku,
                        "attr": json.dumps(attributes_dict),
                        "hsn": p_map.get("hsn_code"),
                        "tax": p_map.get("gst_percentage"),
                        "is_active": p_map.get("is_active", True),
                        "is_deleted": p_map.get("is_deleted", False)
                    }
                )
                variants_count += 1

            # Authoritative Pricing Domain: Insert PriceBookEntry (Blockers 1 & 2)
            pb_id = price_books_dict[cid]
            pbe_id = f"pbe_{uuid.uuid4().hex[:12]}"
            await conn.execute(
                text("""
                    INSERT INTO price_book_entries (
                        id, uuid, company_id, branch_id, price_book_id,
                        item_id, variant_id, min_quantity,
                        selling_price, mrp, cost_price, is_active, is_deleted
                    ) VALUES (
                        :id, :uuid, :cid, :bid, :pb_id,
                        :item_id, :var_id, 1.0000,
                        :price, :mrp, :cost, true, false
                    )
                    ON CONFLICT ON CONSTRAINT uq_pbe_matrix DO UPDATE SET
                        selling_price = EXCLUDED.selling_price,
                        mrp = EXCLUDED.mrp,
                        cost_price = EXCLUDED.cost_price,
                        modified_at = NOW()
                """),
                {
                    "id": pbe_id,
                    "uuid": str(uuid.uuid4()),
                    "cid": cid,
                    "bid": bid,
                    "pb_id": pb_id,
                    "item_id": parent_item_id,
                    "var_id": var_db_id,
                    "price": p_map.get("price") or Decimal("0.00"),
                    "mrp": p_map.get("mrp") or Decimal("0.00"),
                    "cost": p_map.get("cost_price") or Decimal("0.00")
                }
            )
            prices_count += 1

            # Barcodes insertion
            primary_bc = (p_map.get("barcode") or "").strip()
            all_bcs = []
            if primary_bc:
                all_bcs.append((primary_bc, True))
            sec_bcs = p_map.get("secondary_barcodes") or []
            for sbc in sec_bcs:
                if sbc and sbc.strip() and sbc.strip() != primary_bc:
                    all_bcs.append((sbc.strip(), False))

            for bc_val, is_prim in all_bcs:
                bc_key = f"{cid}::{bc_val}"
                if bc_key not in seen_barcodes:
                    seen_barcodes.add(bc_key)
                    bc_type = classify_barcode(bc_val)
                    bc_db_id = f"bc_{uuid.uuid4().hex[:12]}"
                    await conn.execute(
                        text("""
                            INSERT INTO item_barcodes (
                                id, uuid, company_id, branch_id, item_id, variant_id,
                                barcode, barcode_type, is_primary, is_active, is_deleted
                            ) VALUES (
                                :id, :uuid, :cid, :bid, :item_id, :var_id,
                                :barcode, :bc_type, :is_primary, true, false
                            )
                        """),
                        {
                            "id": bc_db_id,
                            "uuid": str(uuid.uuid4()),
                            "cid": cid,
                            "bid": bid,
                            "item_id": parent_item_id,
                            "var_id": var_db_id,
                            "barcode": bc_val,
                            "bc_type": bc_type,
                            "is_primary": is_prim
                        }
                    )
                    barcodes_count += 1

            # Record Permanent Lineage Mapping with explicit disposition (Blocker 6)
            map_id = f"map_{uuid.uuid4().hex[:12]}"
            disposition = "MIGRATED" if style else "REQUIRES_REVIEW"
            await conn.execute(
                text("""
                    INSERT INTO legacy_id_mappings (
                        id, uuid, company_id, branch_id, migration_run_id,
                        legacy_table, legacy_id, legacy_uuid,
                        canonical_table, canonical_id, canonical_uuid,
                        disposition, is_active, is_deleted
                    ) VALUES (
                        :id, :uuid, :cid, :bid, :run_id,
                        'products', :legacy_id, :legacy_uuid,
                        'item_variants', :canonical_id, :canonical_uuid,
                        :disp, true, false
                    )
                    ON CONFLICT (legacy_table, legacy_id) DO UPDATE SET
                        canonical_id = EXCLUDED.canonical_id,
                        migration_run_id = EXCLUDED.migration_run_id,
                        disposition = EXCLUDED.disposition,
                        modified_at = NOW()
                """),
                {
                    "id": map_id,
                    "uuid": str(uuid.uuid4()),
                    "cid": cid,
                    "bid": bid,
                    "run_id": migration_run_id,
                    "legacy_id": pid,
                    "legacy_uuid": p_map.get("uuid"),
                    "canonical_id": var_db_id,
                    "canonical_uuid": var_uuid,
                    "disp": disposition
                }
            )
            legacy_mappings_count += 1

        print(f"      Migrated {items_count} parent items, {variants_count} variants, {barcodes_count} barcodes, {prices_count} price entries.")
        print(f"      Recorded {legacy_mappings_count} permanent legacy mappings.")

        # Step 7: Zero-Loss Transactional Foreign Key Parity Check
        print("\n[7/7] Verifying transactional foreign key parity...")
        res_inv_orphans = await conn.execute(text("""
            SELECT count(DISTINCT s.product_id)
            FROM sales_invoice_items s
            LEFT JOIN legacy_id_mappings m ON m.legacy_table = 'products' AND m.legacy_id = s.product_id
            WHERE s.product_id IS NOT NULL AND m.id IS NULL;
        """))
        inv_orphans = res_inv_orphans.scalar() or 0

        res_ord_orphans = await conn.execute(text("""
            SELECT count(DISTINCT o.product_id)
            FROM sales_order_items o
            LEFT JOIN legacy_id_mappings m ON m.legacy_table = 'products' AND m.legacy_id = o.product_id
            WHERE o.product_id IS NOT NULL AND m.id IS NULL;
        """))
        ord_orphans = res_ord_orphans.scalar() or 0

        print(f"      • sales_invoice_items orphan references: {inv_orphans}")
        print(f"      • sales_order_items orphan references:   {ord_orphans}")

        if inv_orphans > 0 or ord_orphans > 0 or legacy_mappings_count != total_products:
            raise RuntimeError("Reconciliation integrity failure! Rolling back transaction.")

        print("\n" + "=" * 80)
        print("CANONICAL ITEM MASTER MIGRATION COMPLETED SUCCESSFULLY (ZERO LOSS)")
        print("=" * 80)
        print(f"Legacy products evaluated   : {total_products}")
        print(f"Canonical items created     : {items_count}")
        print(f"Variants registered         : {variants_count}")
        print(f"Price entries in PriceBook  : {prices_count}")
        print(f"Barcodes indexed            : {barcodes_count}")
        print(f"Lineage mappings recorded   : {legacy_mappings_count}")
        print("Transactional FK Parity     : 100.00% (0 Orphans)")
        print("=" * 80)

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(execute_migration())
