"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.49.0
Created      : 2026-10-09
Modified     : 2026-10-09
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
Source Module: Default ZPL Template Registration and Safety Check Script
"""

import asyncio
import json
import os
import sys
import uuid
from datetime import datetime, timezone

sys.path.insert(0, r"f:\SMRITRretailNX\backend")
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

RAW_TEMPLATE_PATH = r"f:\SMRITRretailNX\assets\BarcodePRN\TattlyThreads.prn"

SUPPLIED_SOURCE = """<xpml><page quantity='0' pitch='50.7 mm'></xpml>^XA
^SZ2^JMA
^MCY^PMN
^PW804
^JZY
^LH0,0^LRN
^XZ
<xpml></page></xpml><xpml><page quantity='1' pitch='50.7 mm'></xpml>^XA
^FO346,305
^BY2^BCN,66,N,N^FD{barcode}^FS
^FT390,385
^CI0
^AAN,27,15^FD{barcode}^FS
^FT772,357
^A0B,34,46^FDTATTLY THREADS^FS
^FT355,271
^ADN,18,10^FD81,Umerkhadi,Mumbai,400003^FS
^FT355,289
^ADN,18,10^FDcare@tattlythreads.com^FS
^FO627,62
^GB70,67,67^FS
^FT627,116
^A0N,65,72^FR^FD{size}^FS
^FT405,111
^A0N,37,49^FD{colour}^FS
^FO416,15
^GB284,47,47^FS
^FT416,54
^A0N,45,44^FR^FD{style_code}     ^FS
^FO332,13
^GB367,117,3^FS
^FO334,57
^GB337,0,3^FS
^FT490,199
^A0N,17,23^FD |(Incl of all taxes)^FS
^FT488,175
^A0N,42,56^FD{mrp}/-^FS
^FT408,170
^A0N,28,38^FDMRP:^FS
^FT355,199
^A0N,17,23^FDMFG.Dt.:{pkd_date}^FS
^FT355,215
^ABN,11,7^FDNET CONTENTS:1 Pair Footwear^FS
^FT340,41
^A0N,17,23^FDArt.No.^FS
^FT340,103
^A0N,17,23^FDColor:^FS
^FO34,112
^BY1^BCN,30,N,N^FD{barcode}^FS
^FT26,165
^A0N,25,34^FD{barcode}^FS
^FO37,47
^GB70,67,67^FS
^FT37,101
^A0N,65,72^FR^FD{size}^FS
^FT116,63
^A0N,28,38^FD{colour}^FS
^FT37,34
^A0N,28,27^FD{style_code}^FS
^FT17,146
^ABB,11,7^FDTATTLY THREADS^FS
^FT116,84
^A0N,20,27^FDMRP:{mrp}/-^FS
^FT116,101
^A0N,17,23^FD(Incl of all taxes)^FS
^FO33,338
^BY1^BCN,30,N,N^FD{barcode}^FS
^FT26,394
^A0N,25,34^FD{barcode}^FS
^FO33,274
^GB70,67,67^FS
^FT33,328
^A0N,65,72^FR^FD{size}^FS
^FT116,289
^A0N,28,38^FD{colour}^FS
^FT33,260
^A0N,28,27^FD{style_code}^FS
^FT16,372
^ABB,11,7^FDTATTLY THREADS^FS
^FT116,310
^A0N,20,27^FDMRP:{mrp}/-^FS
^FT116,327
^A0N,17,23^FD(Incl of all taxes)^FS
^FO731,0
^GB0,405,3^FS
^FO324,236
^GB407,0,3^FS
^FT355,261
^A0N,20,27^FDMKTD.By:Tattly Threads^FS
^PQ1,0,1,Y
^XZ
<xpml></page></xpml><xpml><end/></xpml>"""


async def main():
    print("=" * 60)
    print("STEP 9, 10 & 11: REGISTRATION & SAFETY CHECK PIPELINE")
    print("=" * 60)

    # 1. Verify supplied source match
    with open(RAW_TEMPLATE_PATH, "r", encoding="utf-8") as f:
        file_prn = f.read()

    if file_prn.strip() != SUPPLIED_SOURCE.strip():
        print("[FAIL] File PRN at assets/BarcodePRN/TattlyThreads.prn does not match supplied source!")
        sys.exit(1)

    raw_prn = file_prn.strip()

    # STEP 11 SAFETY CHECK PRE-REGISTRATION
    print("\n--- STEP 11: PRE-REGISTRATION CHARACTER-BY-CHARACTER CHECK ---")
    if raw_prn != SUPPLIED_SOURCE.strip():
        print("[FAIL] Raw PRN differs character-by-character from supplied source!")
        sys.exit(1)
    print("[PASS] Character-by-character check against supplied source: 100% IDENTICAL.")

    # 2. Connect to operational database smriti001
    url = settings.DATABASE_URL.replace("/smritisys", "/smriti001")
    engine = create_async_engine(url)

    async with engine.begin() as conn:
        # Fetch company_id
        res_comp = await conn.execute(text("SELECT id FROM companies LIMIT 1"))
        comp_row = res_comp.fetchone()
        company_id = comp_row[0] if comp_row else "cmp-001"

        print(f"Operational Company ID: {company_id}")

        # A. Register in print_templates
        print("\n--- Registering in print_templates ---")
        tmpl_id = "tmpl-tt-footwear-100x50.7-zpl"
        
        # Check existing version
        q_ver = text("SELECT version FROM print_templates WHERE id = :id")
        ver_row = (await conn.execute(q_ver, {"id": tmpl_id})).fetchone()
        current_version = ver_row[0] if ver_row else 0
        new_version = current_version + 1

        # Reset other default print_templates
        await conn.execute(
            text("UPDATE print_templates SET is_default_size = FALSE WHERE company_id = :comp"),
            {"comp": company_id}
        )

        field_mappings = json.dumps({
            "barcode": "barcode",
            "size": "size",
            "colour": "colour",
            "style_code": "style_code",
            "mrp": "mrp",
            "pkd_date": "pkd_date",
        })

        if ver_row:
            # Update existing
            await conn.execute(
                text("""
                    UPDATE print_templates
                    SET title = :title,
                        label_size = :label_size,
                        printer_language = :lang,
                        printer_family = :family,
                        is_default_size = TRUE,
                        raw_prn = :raw_prn,
                        field_mappings = :mappings,
                        is_active = TRUE,
                        is_deleted = FALSE,
                        version = :version,
                        modified_at = NOW(),
                        updated_by = 'system'
                    WHERE id = :id
                """),
                {
                    "id": tmpl_id,
                    "title": "Tattly Threads Footwear — 100x50.7mm",
                    "label_size": "100 × 50.7 mm",
                    "lang": "ZPL",
                    "family": "Zebra / ZPL-II",
                    "raw_prn": raw_prn,
                    "mappings": field_mappings,
                    "version": new_version,
                }
            )
            print(f"Updated print_templates record {tmpl_id} (Version {new_version})")
        else:
            # Insert new
            await conn.execute(
                text("""
                    INSERT INTO print_templates (
                        id, uuid, company_id, title, label_size, printer_language,
                        printer_family, is_default_size, raw_prn, field_mappings,
                        is_active, is_deleted, created_at, modified_at, created_by,
                        updated_by, version
                    ) VALUES (
                        :id, :uuid, :comp, :title, :label_size, :lang,
                        :family, TRUE, :raw_prn, :mappings,
                        TRUE, FALSE, NOW(), NOW(), 'system',
                        'system', :version
                    )
                """),
                {
                    "id": tmpl_id,
                    "uuid": str(uuid.uuid4()),
                    "comp": company_id,
                    "title": "Tattly Threads Footwear — 100x50.7mm",
                    "label_size": "100 × 50.7 mm",
                    "lang": "ZPL",
                    "family": "Zebra / ZPL-II",
                    "raw_prn": raw_prn,
                    "mappings": field_mappings,
                    "version": new_version,
                }
            )
            print(f"Inserted new print_templates record {tmpl_id} (Version {new_version})")

        # B. Register in barcode_layouts
        print("\n--- Registering in barcode_layouts ---")
        layout_id = "lay-footwear-100x50-3stub"

        # Reset other default barcode_layouts
        await conn.execute(
            text("UPDATE barcode_layouts SET is_default = FALSE WHERE company_id = :comp"),
            {"comp": company_id}
        )

        elements_data = json.dumps({
            "category": "Footwear",
            "language": "ZPL",
            "elements": [],
            "prn_template": raw_prn
        })

        q_lay = text("SELECT id, version FROM barcode_layouts WHERE id = :id")
        lay_row = (await conn.execute(q_lay, {"id": layout_id})).fetchone()
        lay_version = (lay_row[1] if lay_row and lay_row[1] else 0) + 1

        if lay_row:
            await conn.execute(
                text("""
                    UPDATE barcode_layouts
                    SET name = :name,
                        width_mm = 100.00,
                        height_mm = 50.70,
                        columns = 1,
                        is_default = TRUE,
                        elements_json = :elements,
                        is_active = TRUE,
                        is_deleted = FALSE,
                        version = :version,
                        modified_at = NOW(),
                        updated_by = 'system'
                    WHERE id = :id
                """),
                {
                    "id": layout_id,
                    "name": "Tattly Threads Footwear — 100x50.7mm",
                    "elements": elements_data,
                    "version": lay_version,
                }
            )
            print(f"Updated barcode_layouts record {layout_id} (Version {lay_version})")
        else:
            await conn.execute(
                text("""
                    INSERT INTO barcode_layouts (
                        id, uuid, company_id, name, width_mm, height_mm,
                        columns, is_default, elements_json, is_active,
                        is_deleted, created_at, modified_at, created_by,
                        updated_by, version
                    ) VALUES (
                        :id, :uuid, :comp, :name, 100.00, 50.70,
                        1, TRUE, :elements, TRUE,
                        FALSE, NOW(), NOW(), 'system',
                        'system', :version
                    )
                """),
                {
                    "id": layout_id,
                    "uuid": str(uuid.uuid4()),
                    "comp": company_id,
                    "name": "Tattly Threads Footwear — 100x50.7mm",
                    "elements": elements_data,
                    "version": lay_version,
                }
            )
            print(f"Inserted new barcode_layouts record {layout_id} (Version {lay_version})")

    # STEP 11 SAFETY CHECK POST-REGISTRATION
    print("\n--- STEP 11: POST-REGISTRATION DATABASE VERIFICATION ---")
    async with engine.connect() as conn:
        # Verify print_templates
        q_pt = text("SELECT raw_prn, is_default_size, version FROM print_templates WHERE id = :id")
        pt_res = (await conn.execute(q_pt, {"id": tmpl_id})).fetchone()
        assert pt_res is not None, "print_templates record missing"
        db_raw_prn = pt_res[0].strip()
        is_default = pt_res[1]
        registered_version = pt_res[2]

        if db_raw_prn != SUPPLIED_SOURCE.strip():
            print("[FAIL] Stored raw_prn in print_templates does not match supplied source character-by-character!")
            sys.exit(1)
        assert is_default is True, "print_templates is_default_size must be True"

        # Verify barcode_layouts
        q_bl = text("SELECT elements_json, is_default, version FROM barcode_layouts WHERE id = :id")
        bl_res = (await conn.execute(q_bl, {"id": layout_id})).fetchone()
        assert bl_res is not None, "barcode_layouts record missing"
        bl_elements = json.loads(bl_res[0])
        bl_prn = bl_elements.get("prn_template", "").strip()
        bl_default = bl_res[1]
        bl_version = bl_res[2]

        if bl_prn != SUPPLIED_SOURCE.strip():
            print("[FAIL] Stored prn_template in barcode_layouts does not match supplied source character-by-character!")
            sys.exit(1)
        assert bl_default is True, "barcode_layouts is_default must be True"

    print("[PASS] Post-registration safety check: 100% character-by-character parity confirmed!")
    print(f"Registration Details:")
    print(f"  Template ID:      {tmpl_id}")
    print(f"  Layout ID:        {layout_id}")
    print(f"  Template Version: {registered_version}")
    print(f"  Layout Version:   {bl_version}")
    print(f"  Default Status:   TRUE")
    print(f"  Language:         ZPL")
    print(f"  Label Size:       100 × 50.7 mm")
    print(f"  Status:           ACTIVE")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
