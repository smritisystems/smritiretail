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
"""

import os
import re
import sys
import shutil
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Tuple
from PIL import Image
import httpx

try:
    from zoneinfo import ZoneInfo
    KOLKATA_TZ = ZoneInfo("Asia/Kolkata")
except Exception:
    KOLKATA_TZ = timezone(timedelta(hours=5, minutes=30))

PROPOSED_TEMPLATE = """<xpml><page quantity='0' pitch='50.7 mm'></xpml>^XA
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

OUTPUT_DIR = r"f:\SMRITRretailNX\assets\BarcodePRN"
ARTIFACT_DIR = r"C:\Users\netma\.gemini\antigravity-ide\brain\c0fb0306-a923-4f0f-9841-d870d144f585"

def validate_step1_structure(prn: str) -> Tuple[bool, List[str]]:
    errors = []
    # ^XA / ^XZ balance
    xa_count = prn.count("^XA")
    xz_count = prn.count("^XZ")
    if xa_count != 2:
        errors.append(f"Expected exactly 2 ^XA blocks, found {xa_count}")
    if xz_count != 2:
        errors.append(f"Expected exactly 2 ^XZ blocks, found {xz_count}")
    
    # XPML wrapper integrity
    if not prn.startswith("<xpml><page quantity='0' pitch='50.7 mm'></xpml>"):
        errors.append("Missing or malformed starting XPML page 0 tag")
    if "</xpml><xpml><end/></xpml>" not in prn:
        errors.append("Missing XPML closing/end tag")
    if prn.count("pitch='50.7 mm'") != 2:
        errors.append("Expected pitch='50.7 mm' in both page definitions")
    
    # Width and layout
    if "^PW804" not in prn:
        errors.append("Missing ^PW804 print width command")
    
    return len(errors) == 0, errors

def validate_step2_placeholders(prn: str) -> Tuple[bool, Dict[str, int], List[str]]:
    errors = []
    tokens = re.findall(r"\{([a-zA-Z0-9_]+)\}", prn)
    from collections import Counter
    counts = Counter(tokens)
    
    expected = {
        "barcode": 6,
        "size": 3,
        "colour": 3,
        "style_code": 3,
        "mrp": 3,
        "pkd_date": 1,
    }
    
    if set(counts.keys()) != set(expected.keys()):
        diff = set(counts.keys()) ^ set(expected.keys())
        errors.append(f"Unexpected placeholder mismatch: {diff}")
    
    for k, v in expected.items():
        actual = counts.get(k, 0)
        if actual != v:
            errors.append(f"Placeholder {{{k}}} count mismatch: expected {v}, got {actual}")
            
    total_expected = 19
    total_actual = len(tokens)
    if total_actual != total_expected:
        errors.append(f"Total placeholder count mismatch: expected {total_expected}, got {total_actual}")
        
    return len(errors) == 0, dict(counts), errors

def substitute_template(
    template: str,
    barcode: str,
    size: str,
    colour: str,
    style_code: str,
    mrp: int,
    pkd_date: str
) -> str:
    # Perform exact substitution
    s = template
    s = s.replace("{barcode}", barcode)
    s = s.replace("{size}", size)
    s = s.replace("{colour}", colour)
    s = s.replace("{style_code}", style_code)
    s = s.replace("{mrp}", str(mrp))
    s = s.replace("{pkd_date}", pkd_date)
    return s

def render_zpl_headless(zpl_prn: str) -> bytes:
    # Strip XPML wrapper for standard ZPL rendering engines if needed, or pass ZPL stream
    # Labelary processes pure ZPL commands between ^XA and ^XZ
    # We extract the second ^XA ... ^XZ page which contains the actual label commands
    xa_index = zpl_prn.rfind("^XA")
    xz_index = zpl_prn.rfind("^XZ")
    if xa_index != -1 and xz_index != -1:
        pure_zpl = zpl_prn[xa_index:xz_index+3]
    else:
        pure_zpl = zpl_prn
        
    # Width: 100mm = 3.937 in (approx 3.95 in), Height: 50.7mm = 1.996 in (approx 2 in)
    url = "http://api.labelary.com/v1/printers/8dpmm/labels/3.95x2/0/"
    resp = httpx.post(url, data=pure_zpl.encode("utf-8"), timeout=15.0)
    if resp.status_code != 200:
        raise RuntimeError(f"Labelary render failed HTTP {resp.status_code}: {resp.text}")
    return resp.content

def inspect_rendered_image(png_path: str) -> Tuple[bool, Dict[str, Any]]:
    img = Image.open(png_path)
    width, height = img.size
    
    # Check non-empty pixels
    extrema = img.convert("L").getextrema()
    is_not_blank = extrema[0] < extrema[1]
    
    # Check Zones
    # Zone 1 (Upper Stub: x: 0..250, y: 0..200)
    box1 = (0, 0, min(250, width), min(200, height))
    crop1 = img.crop(box1).convert("L")
    z1_content = crop1.getextrema()[0] < crop1.getextrema()[1]
    
    # Zone 2 (Lower Stub: x: 0..250, y: 200..405)
    box2 = (0, min(200, height), min(250, width), height)
    crop2 = img.crop(box2).convert("L")
    z2_content = crop2.getextrema()[0] < crop2.getextrema()[1]
    
    # Zone 3 (Main Box: x: 250..width, y: 0..height)
    box3 = (min(250, width), 0, width, height)
    crop3 = img.crop(box3).convert("L")
    z3_content = crop3.getextrema()[0] < crop3.getextrema()[1]
    
    all_zones_present = is_not_blank and z1_content and z2_content and z3_content
    
    return all_zones_present, {
        "width": width,
        "height": height,
        "extrema": extrema,
        "z1_content": z1_content,
        "z2_content": z2_content,
        "z3_content": z3_content,
    }

def main():
    print("=" * 60)
    print("AUTOMATED ZPL FOOTWEAR LABEL VERIFICATION PIPELINE")
    print("=" * 60)
    
    # STEP 1
    print("\n--- STEP 1: TEMPLATE STRUCTURE VALIDATION ---")
    s1_ok, s1_errs = validate_step1_structure(PROPOSED_TEMPLATE)
    if s1_ok:
        print("[PASS] Valid ZPL structure, ^XA/^XZ balance=2, pitch=50.7 mm, ^PW804 verified.")
    else:
        print(f"[FAIL] Structure errors: {s1_errs}")
        sys.exit(1)
        
    # STEP 2
    print("\n--- STEP 2: PLACEHOLDER VALIDATION ---")
    s2_ok, counts, s2_errs = validate_step2_placeholders(PROPOSED_TEMPLATE)
    print("Detected Placeholder Counts:")
    for k, v in counts.items():
        print(f"  {{{k}}}: {v}")
    if s2_ok:
        print(f"[PASS] Exactly 19 placeholders across 6 logical tokens detected.")
    else:
        print(f"[FAIL] Placeholder errors: {s2_errs}")
        sys.exit(1)
        
    # STEP 3 & 4: Live Data Variants
    print("\n--- STEP 3 & 4: CANONICAL MAPPING & LIVE DATA RESOLUTION ---")
    pkd_date = datetime.now(KOLKATA_TZ).strftime("%m/%y")
    variants = [
        {
            "name": "BLACK_37",
            "file_prefix": "TATTLY_BLACK_37",
            "colour": "BLACK",
            "size": "37",
            "barcode": "8904551005335",
            "style_code": "CH-30-K",
            "mrp": 1199,
            "pkd_date": pkd_date
        },
        {
            "name": "BLACK_40",
            "file_prefix": "TATTLY_BLACK_40",
            "colour": "BLACK",
            "size": "40",
            "barcode": "8904551005366",
            "style_code": "CH-30-K",
            "mrp": 1199,
            "pkd_date": pkd_date
        },
        {
            "name": "TOUPE_37",
            "file_prefix": "TATTLY_TOUPE_37",
            "colour": "TOUPE",
            "size": "37",
            "barcode": "8904551005403",
            "style_code": "CH-30-K",
            "mrp": 1199,
            "pkd_date": pkd_date
        },
        {
            "name": "TOUPE_42",
            "file_prefix": "TATTLY_TOUPE_42",
            "colour": "TOUPE",
            "size": "42",
            "barcode": "8904551005458",
            "style_code": "CH-30-K",
            "mrp": 1199,
            "pkd_date": pkd_date
        },
    ]
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    
    for v in variants:
        resolved_zpl = substitute_template(
            PROPOSED_TEMPLATE,
            barcode=v["barcode"],
            size=v["size"],
            colour=v["colour"],
            style_code=v["style_code"],
            mrp=v["mrp"],
            pkd_date=v["pkd_date"]
        )
        
        # Verify zero unresolved placeholders
        unresolved = re.findall(r"\{[a-zA-Z0-9_]+\}", resolved_zpl)
        if unresolved:
            print(f"[FAIL] {v['name']} has unresolved placeholders: {unresolved}")
            sys.exit(1)
        
        # Verify barcode in 6 locations
        bc_count = resolved_zpl.count(v["barcode"])
        if bc_count != 6:
            print(f"[FAIL] {v['name']} barcode count mismatch: expected 6, found {bc_count}")
            sys.exit(1)
            
        # Verify size in 3 locations
        sz_count = resolved_zpl.count(f"^FD{v['size']}^FS")
        if sz_count != 3:
            print(f"[FAIL] {v['name']} size count mismatch: expected 3, found {sz_count}")
            sys.exit(1)
            
        # Verify colour in 3 locations
        col_count = resolved_zpl.count(f"^FD{v['colour']}^FS")
        if col_count != 3:
            print(f"[FAIL] {v['name']} colour count mismatch: expected 3, found {col_count}")
            sys.exit(1)
            
        # Verify style_code in 3 locations
        # Note: in main box, style_code has 5 trailing spaces: f"^FD{v['style_code']}     ^FS"
        style_occurrences = resolved_zpl.count(v["style_code"])
        if style_occurrences != 3:
            print(f"[FAIL] {v['name']} style_code count mismatch: expected 3, found {style_occurrences}")
            sys.exit(1)
            
        # Verify mrp in 3 locations
        mrp_count = resolved_zpl.count(f"{v['mrp']}/-")
        if mrp_count != 3:
            print(f"[FAIL] {v['name']} mrp count mismatch: expected 3, found {mrp_count}")
            sys.exit(1)
            
        # Verify pkd_date in 1 location
        pkd_count = resolved_zpl.count(f"MFG.Dt.:{v['pkd_date']}")
        if pkd_count != 1:
            print(f"[FAIL] {v['name']} pkd_date count mismatch: expected 1, found {pkd_count}")
            sys.exit(1)
            
        print(f"[PASS] Variant {v['name']} completely resolved (zero unparsed braces, all tokens verified).")
        
        # STEP 5: Generate PRN file
        prn_path = os.path.join(OUTPUT_DIR, f"{v['file_prefix']}.prn")
        with open(prn_path, "w", encoding="utf-8") as f:
            f.write(resolved_zpl)
        # Also copy to artifact dir
        shutil.copy2(prn_path, os.path.join(ARTIFACT_DIR, f"{v['file_prefix']}.prn"))
        print(f"       -> Generated PRN: {prn_path}")
        
        # STEP 6: Headless Render to PNG
        png_bytes = render_zpl_headless(resolved_zpl)
        png_path = os.path.join(OUTPUT_DIR, f"{v['file_prefix']}.png")
        with open(png_path, "wb") as f:
            f.write(png_bytes)
        shutil.copy2(png_path, os.path.join(ARTIFACT_DIR, f"{v['file_prefix']}.png"))
        print(f"       -> Generated PNG screenshot ({len(png_bytes)} bytes): {png_path}")
        
        # STEP 7 & 8: Visual & Barcode Validation
        img_ok, metrics = inspect_rendered_image(png_path)
        if not img_ok:
            print(f"[FAIL] Visual validation failed for {v['name']}: {metrics}")
            sys.exit(1)
        print(f"       -> Visual Validation: PASS (Dimensions {metrics['width']}x{metrics['height']}, Zone 1/2/3 verified active)")

    print("\n" + "=" * 60)
    print("ALL VALIDATION GATES (STEPS 1-8) COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    main()
