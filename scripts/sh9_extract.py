"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Sprint 0 — Phase 0: Legacy vaMenu Extractor
Extracts all INSERT INTO vaMenu records from all S9Q files in the Shoper9 ini directory.
Produces:
  SH9_MENU_CATALOG.csv   — every vaMenu row (INSERT-derived canonical set)
  SH9_MENU_TREE.csv      — hierarchical MnuNo -> MenuOpt tree
  SH9_MENU_EXEC.csv      — ExeName catalog with classification
  SH9_TXN_TYPES.csv      — TrnType/pgmopt registry
  SH9_EXTRACT_LOG.md     — extraction audit log
"""

import re
import csv
import os
import zipfile
import sys
from pathlib import Path
from collections import defaultdict
from datetime import datetime

# ─── Paths ────────────────────────────────────────────────────────────────────
INI_DIR   = Path(r"D:\Shoper9\Backup\A_CSW_250814_1846_C\Shoper9\ini")
ZIP_PATH  = INI_DIR / "SH9_013_EE_0_12.zip"
OUT_DIR   = Path(r"F:\SMRITRretailNX\docs\legacy\shoper")
OUT_DIR.mkdir(parents=True, exist_ok=True)

LOG_LINES = []

def log(msg):
    print(msg)
    LOG_LINES.append(msg)

log(f"[{datetime.now().isoformat()}] Sprint 0 — vaMenu Extraction Started")
log(f"INI_DIR : {INI_DIR}")
log(f"OUT_DIR : {OUT_DIR}")

# ─── Step 1: Collect all SQL text from S9Q files + ZIP entries ────────────────
all_sql_blocks = []  # list of (source_name, sql_text)

# From individual .S9Q files on disk
s9q_files = sorted(INI_DIR.glob("*.S9Q"))
log(f"\nFound {len(s9q_files)} .S9Q files on disk")

for fpath in s9q_files:
    try:
        text = fpath.read_text(encoding="cp1252", errors="replace")
        all_sql_blocks.append((fpath.name, text))
    except Exception as e:
        log(f"  WARN: Cannot read {fpath.name}: {e}")

# From ZIP entries
if ZIP_PATH.exists():
    log(f"\nReading ZIP: {ZIP_PATH.name}")
    with zipfile.ZipFile(ZIP_PATH, "r") as zf:
        for entry in zf.namelist():
            try:
                raw = zf.read(entry)
                text = raw.decode("cp1252", errors="replace")
                all_sql_blocks.append((f"ZIP:{entry}", text))
                log(f"  ZIP entry: {entry} [{len(raw)} bytes]")
            except Exception as e:
                log(f"  WARN: Cannot read ZIP entry {entry}: {e}")
else:
    log(f"WARN: ZIP not found at {ZIP_PATH}")

# ─── Step 2: Parse all INSERT INTO vaMenu statements ─────────────────────────
# vaMenu columns (from DDL):
# MnuNo, MenuOPt, MnuName, MnuCap, MnuPgm, ExeName, MnuWght,
# AllowWhenTrnClosed, pgmopt, DbInfo, MenuIcon, Menusep, MenuBold, MultiInstance

COLS = ["MnuNo","MenuOpt","MnuName","MnuCap","MnuPgm","ExeName",
        "MnuWght","AllowWhenTrnClosed","pgmopt","DbInfo",
        "MenuIcon","Menusep","MenuBold","MultiInstance"]

# Regex to capture INSERT INTO vaMenu VALUES or INSERT INTO vaMenu (col,...) VALUES
INSERT_RE = re.compile(
    r"INSERT\s+(?:INTO\s+)?(?:\[dbo\]\.)?\[?(?:va|VA|Va)Menu\]?"
    r"(?:\s*\(([^)]+)\))?\s*VALUES\s*\(([^;]+?)\)",
    re.IGNORECASE | re.DOTALL
)

def parse_value_list(vlist: str) -> list:
    """Parse a SQL VALUES (...) list into Python values."""
    results = []
    i = 0
    current = ""
    in_str = False
    quote_char = None

    while i < len(vlist):
        ch = vlist[i]
        if in_str:
            if ch == quote_char:
                if i+1 < len(vlist) and vlist[i+1] == quote_char:
                    current += ch
                    i += 2
                    continue
                in_str = False
                current += ch
            else:
                current += ch
        elif ch in ("'", '"'):
            in_str = True
            quote_char = ch
            current += ch
        elif ch == "," and not in_str:
            results.append(current.strip())
            current = ""
        else:
            current += ch
        i += 1

    if current.strip():
        results.append(current.strip())

    cleaned = []
    for v in results:
        v = v.strip()
        if v.upper() == "NULL":
            cleaned.append("")
        elif v.startswith("N'") and v.endswith("'"):
            cleaned.append(v[2:-1].replace("''", "'"))
        elif v.startswith("'") and v.endswith("'"):
            cleaned.append(v[1:-1].replace("''", "'"))
        else:
            cleaned.append(v)
    return cleaned


rows = {}          # (MnuNo, MenuOpt) -> row dict (last INSERT wins)
sources = {}       # (MnuNo, MenuOpt) -> source file
insert_count = 0
parse_errors = 0

for source_name, sql_text in all_sql_blocks:
    for match in INSERT_RE.finditer(sql_text):
        col_spec_raw = match.group(1)
        values_raw   = match.group(2)

        try:
            vals = parse_value_list(values_raw.strip())
        except Exception as e:
            parse_errors += 1
            log(f"  PARSE_ERR in {source_name}: {e} -- raw: {values_raw[:80]}")
            continue

        if col_spec_raw:
            # Named columns specified
            col_names = [c.strip().strip("[]").strip() for c in col_spec_raw.split(",")]
        else:
            # Positional — use DDL order
            col_names = COLS[:len(vals)]

        row = dict(zip(col_names, vals))

        # Normalize key names
        mnu_no  = row.get("MnuNo")  or row.get("mnuno")  or ""
        mnu_opt = row.get("MenuOPt") or row.get("MenuOpt") or row.get("menuopt") or ""

        try:
            key = (int(mnu_no), int(mnu_opt))
        except (ValueError, TypeError):
            log(f"  SKIP non-int key MnuNo={mnu_no!r} MenuOpt={mnu_opt!r} in {source_name}")
            continue

        # Build canonical row
        canonical = {
            "MnuNo":              str(key[0]),
            "MenuOpt":            str(key[1]),
            "MnuName":            row.get("MnuName", "").strip(),
            "MnuCap":             row.get("MnuCap", "").strip(),
            "MnuPgm":             row.get("MnuPgm", row.get("mnupgm", "")).strip(),
            "ExeName":            row.get("ExeName", row.get("exename", "")).strip(),
            "MnuWght":            row.get("MnuWght", "0"),
            "AllowWhenTrnClosed": row.get("AllowWhenTrnClosed", "0"),
            "pgmopt":             row.get("pgmopt", row.get("Pgmopt", "0")),
            "DbInfo":             row.get("DbInfo", "").strip(),
            "MenuIcon":           row.get("MenuIcon", "").strip(),
            "Menusep":            row.get("Menusep", "0"),
            "MenuBold":           row.get("MenuBold", "0"),
            "MultiInstance":      row.get("MultiInstance", "0"),
            "SourceFile":         source_name,
        }

        rows[key] = canonical
        sources[key] = source_name
        insert_count += 1

log(f"\nRaw INSERT matches found : {insert_count}")
log(f"Parse errors             : {parse_errors}")
log(f"Unique (MnuNo,MenuOpt)   : {len(rows)}")

# ─── Step 3: Also capture UPDATE statements that modify ExeName ───────────────
UPDATE_EXE_RE = re.compile(
    r"UPDATE\s+(?:\[dbo\]\.)?\[?(?:va|VA|Va)Menu\]?\s+SET\s+(?:ExeName|EXENAME|Exename)\s*=\s*'([^']+)'"
    r".*?WHERE.*?(?:MnuNo|MNUNO)\s*=\s*(\d+).*?(?:MenuOPt|MenuOpt|MENUOPT)\s*=\s*(\d+)",
    re.IGNORECASE | re.DOTALL
)

update_count = 0
for source_name, sql_text in all_sql_blocks:
    for m in UPDATE_EXE_RE.finditer(sql_text):
        exe = m.group(1).strip()
        mno = int(m.group(2))
        mopt = int(m.group(3))
        key = (mno, mopt)
        if key in rows:
            rows[key]["ExeName"] = exe
            rows[key]["SourceFile"] += f"|UPDATE:{source_name}"
            update_count += 1

log(f"ExeName UPDATE patches applied: {update_count}")

# ─── Step 4: Write SH9_MENU_CATALOG.csv ──────────────────────────────────────
catalog_path = OUT_DIR / "SH9_MENU_CATALOG.csv"
all_rows = sorted(rows.values(), key=lambda r: (int(r["MnuNo"]), int(r["MenuOpt"])))

catalog_cols = ["MnuNo","MenuOpt","MnuName","MnuCap","MnuPgm","ExeName",
                "MnuWght","AllowWhenTrnClosed","pgmopt","DbInfo",
                "MenuIcon","Menusep","MenuBold","MultiInstance","SourceFile"]

with open(catalog_path, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=catalog_cols)
    w.writeheader()
    for r in all_rows:
        w.writerow({k: r.get(k,"") for k in catalog_cols})

log(f"\nWrote: {catalog_path} ({len(all_rows)} rows)")

# ─── Step 5: Write SH9_MENU_TREE.csv — hierarchical view ────────────────────
tree_path = OUT_DIR / "SH9_MENU_TREE.csv"

# MnuName is the parent group; MenuOpt/MnuCap are children
# Group: rows where MnuPgm == 'M' (Menu/parent) or MnuNo == MenuOpt (self-referential root)
# Leaf:  rows where MnuPgm == 'P' (Program/executable)

parents = {}  # MnuNo -> MnuName
for r in all_rows:
    mn = int(r["MnuNo"])
    if r["MnuPgm"].upper() == "M" and mn not in parents:
        parents[mn] = r["MnuName"]

with open(tree_path, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["MnuNo","MnuName_Parent","MenuOpt","MnuCap","MnuPgm","ExeName","pgmopt","AllowWhenTrnClosed","MultiInstance"])
    for r in all_rows:
        mn = int(r["MnuNo"])
        parent_name = parents.get(mn, r["MnuName"])
        w.writerow([
            r["MnuNo"], parent_name, r["MenuOpt"],
            r["MnuCap"], r["MnuPgm"], r["ExeName"],
            r["pgmopt"], r["AllowWhenTrnClosed"], r["MultiInstance"]
        ])

log(f"Wrote: {tree_path} ({len(all_rows)} rows)")

# ─── Step 6: Write SH9_MENU_EXEC.csv — ExeName catalog ───────────────────────
exec_path = OUT_DIR / "SH9_MENU_EXEC.csv"

# Classify executables by name pattern
def classify_exe(exe: str, cap: str, pgm: str) -> str:
    if not exe or pgm.upper() == "M":
        return "MENU_GROUP"
    e = exe.upper()
    c = cap.upper()
    if "REPORT" in c or "REGISTER" in c or "LEDGER" in c or "ANALYSIS" in c or "MIS" in c:
        return "REPORT"
    if "BACKUP" in c or "RESTORE" in c or "COMPACT" in c or "PURGE" in c or "SYNC" in c:
        return "UTILITY"
    if "IMPORT" in c or "EXPORT" in c:
        return "IMPORT_EXPORT"
    if "MASTER" in c or "CATALOGUE" in c or "CATALOG" in c or "ITEM" in c:
        return "MASTER"
    if "SECUR" in c or "PASSWORD" in c or "USER" in c or "AUTH" in c:
        return "SECURITY"
    if "BILLING" in c or "SALE" in c or "INVOICE" in c or "RETURN" in c or "ORDER" in c:
        return "TRANSACTION"
    if "CASH" in c or "PAYMENT" in c or "TENDER" in c or "SETTLE" in c:
        return "FINANCIAL"
    if "STOCK" in c or "INVENTORY" in c or "INWARD" in c or "OUTWARD" in c or "PHYSICAL" in c:
        return "INVENTORY"
    if "PRINT" in c or "LABEL" in c or "BARCODE" in c:
        return "PRINT"
    if "CONFIG" in c or "SETUP" in c or "PARAM" in c or "SETTING" in c:
        return "CONFIGURATION"
    if e.endswith(".EXE") or e.endswith(".DLL"):
        return "EXECUTABLE"
    return "UNKNOWN"

exe_map = {}  # ExeName.upper() -> {exe, classification, caps, mnunos}
for r in all_rows:
    exe = r["ExeName"].strip()
    if not exe:
        continue
    key = exe.upper()
    if key not in exe_map:
        exe_map[key] = {
            "ExeName": exe,
            "Classification": classify_exe(exe, r["MnuCap"], r["MnuPgm"]),
            "Capabilities": [],
            "MnuNos": [],
        }
    exe_map[key]["Capabilities"].append(r["MnuCap"])
    exe_map[key]["MnuNos"].append(f"{r['MnuNo']}/{r['MenuOpt']}")

with open(exec_path, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["ExeName","Classification","MenuCount","Capabilities","MnuNos"])
    for key, v in sorted(exe_map.items()):
        w.writerow([
            v["ExeName"],
            v["Classification"],
            len(v["Capabilities"]),
            " | ".join(v["Capabilities"][:5]),
            " | ".join(v["MnuNos"][:5]),
        ])

log(f"Wrote: {exec_path} ({len(exe_map)} unique executables)")

# ─── Step 7: Write SH9_TXN_TYPES.csv — pgmopt / TrnType registry ─────────────
txn_path = OUT_DIR / "SH9_TXN_TYPES.csv"

# pgmopt in vaMenu often maps to a transaction type code
pgmopt_map = defaultdict(list)
for r in all_rows:
    po = r["pgmopt"].strip()
    if po and po != "0":
        pgmopt_map[po].append(f"{r['MnuCap']} ({r['ExeName']})")

# Known TrnType mappings (from industry knowledge of Shoper 9)
KNOWN_TRN = {
    "1":   "Sales (Retail/POS)",
    "2":   "Sales Return",
    "3":   "Cancellation / Void",
    "4":   "Sales Order",
    "5":   "Service Order",
    "6":   "Walk-in",
    "7":   "Sales Advice Slip",
    "101": "Purchase Order",
    "102": "Goods Inwards (GRN)",
    "103": "Purchase Return",
    "201": "Stock Transfer",
    "202": "Physical Verification",
    "203": "Goods Outwards",
    "204": "Delivery Challan",
    "205": "Report: Tender",
    "206": "Report: Slips",
    "301": "Cash Receipt",
    "302": "Cash Payment",
    "303": "Credit Sale Collection",
}

with open(txn_path, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["pgmopt","KnownMeaning","Status","LinkedMenuCaps"])
    for po, caps in sorted(pgmopt_map.items(), key=lambda x: (len(x[0]), x[0])):
        known = KNOWN_TRN.get(po, "")
        status = "KNOWN" if known else "CONTEXT_REQUIRED"
        w.writerow([po, known, status, " | ".join(caps[:3])])

log(f"Wrote: {txn_path} ({len(pgmopt_map)} pgmopt values)")

# ─── Step 8: Print Summary ────────────────────────────────────────────────────
log("\n" + "="*70)
log("EXTRACTION SUMMARY")
log("="*70)

# Count by MnuName (parent group)
by_group = defaultdict(int)
for r in all_rows:
    by_group[r["MnuName"]].append if False else None
    by_group[r["MnuName"]] = by_group[r["MnuName"]] + 1

log(f"\nTotal vaMenu entries   : {len(all_rows)}")
log(f"Unique MnuNo values    : {len(set(r['MnuNo'] for r in all_rows))}")
log(f"Unique ExecutableNames : {len(exe_map)}")
log(f"Unique pgmopt codes    : {len(pgmopt_map)}")
log(f"\nMenu Groups (MnuName -> count):")
for name, cnt in sorted(by_group.items(), key=lambda x: -x[1]):
    log(f"  {name:<30} {cnt:>3} entries")

# ─── Step 9: Write Extraction Log ────────────────────────────────────────────
log_path = OUT_DIR / "SH9_EXTRACT_LOG.md"
with open(log_path, "w", encoding="utf-8") as f:
    f.write("# SH9 vaMenu Extraction Log\n\n")
    f.write(f"**Date:** {datetime.now().isoformat()}\n")
    f.write(f"**Source:** `{INI_DIR}`\n")
    f.write(f"**Output:** `{OUT_DIR}`\n\n")
    f.write("## Log\n\n```\n")
    f.write("\n".join(LOG_LINES))
    f.write("\n```\n")

print(f"\nExtraction log: {log_path}")
print("\nSprint 0 — Phase 0: COMPLETE")
print("Next: Review SH9_MENU_CATALOG.csv and proceed to Phase 1 (ID Registry)")
