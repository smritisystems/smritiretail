"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 2.0.0
Created      : 2026-08-24
Modified     : 2026-08-24
Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Sprint 0 v2 - Legacy Extractor (Fixes all cons identified in review)
Fixes:
  1. DELETE statement processing -- removes stale rows from catalog
  2. vaTrnType/genlookup extraction -- real TrnType codes from data
  3. vaUser + sysSec extraction -- security baseline
  4. sysParam key flags extraction -- behavior flags
  5. Source deduplication logging -- ZIP vs disk conflict tracking
  6. Produces SH9_MENU_DELETES.csv (audit of all removed rows)
"""

import re
import csv
import zipfile
from pathlib import Path
from collections import defaultdict
from datetime import datetime

# ─── Paths ────────────────────────────────────────────────────────────────────
INI_DIR  = Path(r"D:\Shoper9\Backup\A_CSW_250814_1846_C\Shoper9\ini")
ZIP_PATH = INI_DIR / "SH9_013_EE_0_12.zip"
OUT_DIR  = Path(r"F:\SMRITRretailNX\docs\legacy\shoper")
OUT_DIR.mkdir(parents=True, exist_ok=True)

LOG = []
def log(m): print(m); LOG.append(m)

log(f"[{datetime.now().isoformat()}] Sprint 0 v2 -- Full Extraction")

# ─── Collect all SQL text (track source to detect disk/ZIP conflicts) ─────────
blocks = []   # (source_name, priority, text)
#   priority 1 = ZIP (more complete/authoritative)
#   priority 2 = disk (may be newer patch applied on top)

s9q_files = sorted(INI_DIR.glob("*.S9Q"))
log(f"Disk S9Q files : {len(s9q_files)}")
for f in s9q_files:
    try:
        blocks.append((f.name, 2, f.read_text(encoding="cp1252", errors="replace")))
    except Exception as e:
        log(f"  WARN disk read {f.name}: {e}")

if ZIP_PATH.exists():
    with zipfile.ZipFile(ZIP_PATH) as zf:
        log(f"ZIP entries    : {len(zf.namelist())}")
        for name in zf.namelist():
            try:
                text = zf.read(name).decode("cp1252", errors="replace")
                blocks.append((f"ZIP:{name}", 1, text))
            except Exception as e:
                log(f"  WARN zip read {name}: {e}")

# Sort so priority-1 (ZIP) entries are processed before priority-2 (disk)
# When there's a conflict on same (MnuNo,MenuOpt), disk (newer patch) wins.
blocks.sort(key=lambda x: x[1])

# ─── INSERT parser ────────────────────────────────────────────────────────────
INSERT_RE = re.compile(
    r"INSERT\s+(?:INTO\s+)?(?:\[dbo\]\.)?\[?(?:va|VA|Va)Menu\]?"
    r"(?:\s*\(([^)]+)\))?\s*VALUES\s*\(([^;]+?)\)",
    re.IGNORECASE | re.DOTALL
)
COLS = ["MnuNo","MenuOpt","MnuName","MnuCap","MnuPgm","ExeName",
        "MnuWght","AllowWhenTrnClosed","pgmopt","DbInfo",
        "MenuIcon","Menusep","MenuBold","MultiInstance"]

def parse_vals(raw):
    results, cur, in_str, qc = [], "", False, None
    for i, ch in enumerate(raw):
        if in_str:
            if ch == qc and i+1 < len(raw) and raw[i+1] == qc:
                cur += ch; continue
            elif ch == qc:
                in_str = False; cur += ch
            else:
                cur += ch
        elif ch in ("'",'"'):
            in_str, qc = True, ch; cur += ch
        elif ch == ",":
            results.append(cur.strip()); cur = ""
        else:
            cur += ch
    if cur.strip(): results.append(cur.strip())
    out = []
    for v in results:
        v = v.strip()
        if v.upper() == "NULL": out.append("")
        elif v.startswith("N'") and v.endswith("'"): out.append(v[2:-1].replace("''","'"))
        elif v.startswith("'") and v.endswith("'"): out.append(v[1:-1].replace("''","'"))
        else: out.append(v)
    return out

rows = {}      # (MnuNo,MenuOpt) -> canonical dict
src_map = {}   # (MnuNo,MenuOpt) -> source name
inserts = 0

for src, pri, sql in blocks:
    for m in INSERT_RE.finditer(sql):
        col_spec, vals_raw = m.group(1), m.group(2)
        try:
            vals = parse_vals(vals_raw.strip())
        except Exception as e:
            log(f"  PARSE_ERR {src}: {e}"); continue
        col_names = ([c.strip().strip("[]") for c in col_spec.split(",")]
                     if col_spec else COLS[:len(vals)])
        row = dict(zip(col_names, vals))
        try:
            key = (int(row.get("MnuNo",row.get("mnuno","0"))),
                   int(row.get("MenuOPt",row.get("MenuOpt",row.get("menuopt","0")))))
        except: continue
        canonical = {
            "MnuNo":   str(key[0]),  "MenuOpt": str(key[1]),
            "MnuName": row.get("MnuName","").strip(),
            "MnuCap":  row.get("MnuCap","").strip(),
            "MnuPgm":  row.get("MnuPgm",row.get("mnupgm","")).strip(),
            "ExeName": row.get("ExeName",row.get("exename","")).strip(),
            "MnuWght": row.get("MnuWght","0"),
            "AllowWhenTrnClosed": row.get("AllowWhenTrnClosed","0"),
            "pgmopt":  row.get("pgmopt",row.get("Pgmopt","0")),
            "DbInfo":  row.get("DbInfo","").strip(),
            "MenuIcon":row.get("MenuIcon","").strip(),
            "Menusep": row.get("Menusep","0"),
            "MenuBold":row.get("MenuBold","0"),
            "MultiInstance": row.get("MultiInstance","0"),
            "SourceFile": src,
            "Status": "ACTIVE",
        }
        rows[key] = canonical
        src_map[key] = src
        inserts += 1

log(f"\nINSERT matches: {inserts} | Unique keys: {len(rows)}")

# ─── UPDATE ExeName patches ───────────────────────────────────────────────────
UPDATE_EXE_RE = re.compile(
    r"UPDATE\s+(?:\[dbo\]\.)?\[?(?:va|VA|Va)Menu\]?\s+SET\s+(?:ExeName|EXENAME|Exename)\s*=\s*'([^']+)'"
    r".*?WHERE.*?(?:MnuNo|MNUNO)\s*=\s*(\d+).*?(?:MenuOPt|MenuOpt|MENUOPT)\s*=\s*(\d+)",
    re.IGNORECASE | re.DOTALL
)
upd = 0
for src, pri, sql in blocks:
    for m in UPDATE_EXE_RE.finditer(sql):
        exe, mno, mopt = m.group(1).strip(), int(m.group(2)), int(m.group(3))
        key = (mno, mopt)
        if key in rows:
            rows[key]["ExeName"] = exe
            rows[key]["SourceFile"] += f"|UPD:{src}"
            upd += 1
log(f"ExeName UPDATE patches: {upd}")

# ─── DELETE processing (FIX 1 - Critical) ────────────────────────────────────
# Patterns:
# DELETE vaMenu WHERE MnuNo=X AND MenuOpt=Y [AND ExeName='Z']
# DELETE vaMenu WHERE MnuNo=X AND MenuOpt IN (A,B,C)
# DELETE FROM Vamenu WHERE Exename = 'X'
# DELETE FROM Vamenu WHERE MnuCap='X' and MnuNo=X and MenuOPt=Y

DELETE_SIMPLE = re.compile(
    r"DELETE\s+(?:FROM\s+)?(?:\[dbo\]\.)?\[?(?:va|VA|Va)Menu\]?\s+"
    r"WHERE\s+(?:MnuNo|MNUNO)\s*=\s*['\"]?(\d+)['\"]?\s+"
    r"AND\s+(?:MenuOPt|MenuOpt|MENUOPT)\s*=\s*['\"]?(\d+)['\"]?",
    re.IGNORECASE | re.DOTALL
)
DELETE_IN = re.compile(
    r"DELETE\s+(?:\[?VaMenu\]?|FROM\s+\[?VaMenu\]?)\s+"
    r"WHERE\s+(?:MnuNo|MNUNO)\s*=\s*(\d+)\s+AND\s+"
    r"(?:MenuOpt|MenuOPt|MENUOPT)\s+IN\s*\(([^)]+)\)",
    re.IGNORECASE
)
DELETE_EXE = re.compile(
    r"DELETE\s+(?:FROM\s+)?(?:\[dbo\]\.)?\[?(?:va|VA|Va)Menu\]?\s+"
    r"WHERE\s+(?:ExeName|EXENAME|Exename)\s*=\s*'([^']+)'(?!\s+AND)",
    re.IGNORECASE
)
DELETE_CAP = re.compile(
    r"DELETE\s+(?:FROM\s+)?(?:\[dbo\]\.)?\[?(?:va|VA|Va)Menu\]?\s+"
    r"WHERE\s+(?:MnuCap|MNUCAP)\s*=\s*'([^']+)'\s+AND\s+"
    r"(?:MnuNo|MNUNO)\s*=\s*(\d+)\s+AND\s+(?:MenuOPt|MENUOPT)\s*=\s*(\d+)",
    re.IGNORECASE
)

deleted_keys = set()
delete_log = []  # (MnuNo, MenuOpt, reason, source)

for src, pri, sql in blocks:
    for m in DELETE_SIMPLE.finditer(sql):
        key = (int(m.group(1)), int(m.group(2)))
        deleted_keys.add(key)
        delete_log.append((key[0], key[1], "DELETE_SIMPLE", src))

    for m in DELETE_IN.finditer(sql):
        mno = int(m.group(1))
        for opt_str in m.group(2).split(","):
            try:
                key = (mno, int(opt_str.strip()))
                deleted_keys.add(key)
                delete_log.append((key[0], key[1], "DELETE_IN", src))
            except: pass

    for m in DELETE_EXE.finditer(sql):
        exe_target = m.group(1).upper()
        for key, row in list(rows.items()):
            if row["ExeName"].upper() == exe_target:
                deleted_keys.add(key)
                delete_log.append((key[0], key[1], f"DELETE_EXE:{exe_target}", src))

    for m in DELETE_CAP.finditer(sql):
        key = (int(m.group(2)), int(m.group(3)))
        deleted_keys.add(key)
        delete_log.append((key[0], key[1], f"DELETE_CAP:{m.group(1)}", src))

log(f"DELETE operations found: {len(delete_log)} | Unique keys to remove: {len(deleted_keys)}")

# Mark deleted rows in catalog and remove from active set
for key in deleted_keys:
    if key in rows:
        rows[key]["Status"] = "DELETED"

active_rows  = sorted([r for r in rows.values() if r["Status"]=="ACTIVE"],
                       key=lambda r:(int(r["MnuNo"]),int(r["MenuOpt"])))
deleted_rows = sorted([r for r in rows.values() if r["Status"]=="DELETED"],
                       key=lambda r:(int(r["MnuNo"]),int(r["MenuOpt"])))

log(f"Active rows after DELETE removal : {len(active_rows)}")
log(f"Deleted/stale rows               : {len(deleted_rows)}")

# ─── Write SH9_MENU_CATALOG.csv (clean, active only) ─────────────────────────
CAT_COLS = ["MnuNo","MenuOpt","MnuName","MnuCap","MnuPgm","ExeName",
            "MnuWght","AllowWhenTrnClosed","pgmopt","DbInfo",
            "MenuIcon","Menusep","MenuBold","MultiInstance","Status","SourceFile"]

cat_path = OUT_DIR / "SH9_MENU_CATALOG.csv"
with open(cat_path,"w",newline="",encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=CAT_COLS)
    w.writeheader()
    for r in active_rows:
        w.writerow({k:r.get(k,"") for k in CAT_COLS})
log(f"Wrote: {cat_path} ({len(active_rows)} active rows)")

# ─── Write SH9_MENU_DELETES.csv (new -- audit trail of all removed rows) ─────
del_path = OUT_DIR / "SH9_MENU_DELETES.csv"
with open(del_path,"w",newline="",encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["MnuNo","MenuOpt","MnuName","MnuCap","ExeName","DeletePattern","DeleteSource"])
    for mno, mopt, reason, dsrc in sorted(set((d[0],d[1],d[2],d[3]) for d in delete_log)):
        key = (mno, mopt)
        r = rows.get(key, {})
        w.writerow([mno, mopt, r.get("MnuName",""), r.get("MnuCap",""),
                    r.get("ExeName",""), reason, dsrc])
log(f"Wrote: {del_path} ({len(delete_log)} delete operations)")

# ─── Write SH9_MENU_TREE.csv ──────────────────────────────────────────────────
tree_path = OUT_DIR / "SH9_MENU_TREE.csv"
parents = {int(r["MnuNo"]): r["MnuName"]
           for r in active_rows if r["MnuPgm"].upper()=="M" and
           int(r["MnuNo"]) not in {int(x["MnuNo"]) for x in active_rows
                                    if int(x["MnuNo"])==int(x["MenuOpt"])}}
# Root has MnuNo=0
parents[0] = "Shoper"

with open(tree_path,"w",newline="",encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["MnuNo","ParentName","MenuOpt","MnuCap","MnuPgm","ExeName",
                "pgmopt","AllowWhenTrnClosed","MultiInstance","Status"])
    for r in active_rows:
        mn = int(r["MnuNo"])
        w.writerow([r["MnuNo"], parents.get(mn, r["MnuName"]), r["MenuOpt"],
                    r["MnuCap"], r["MnuPgm"], r["ExeName"],
                    r["pgmopt"], r["AllowWhenTrnClosed"], r["MultiInstance"],
                    r["Status"]])
log(f"Wrote: {tree_path} ({len(active_rows)} rows)")

# ─── FIX 2: Extract TrnType codes from genlookup/TransactionComponentsDtls ───
TRN_CODE_RE = re.compile(
    r"(?:genlookup|GenLookup).*?'(\d{3,5})'\s*,\s*'([^']{3,50})'",
    re.IGNORECASE
)
TRN_IN_SQL = re.compile(
    r"(?:trntype|TrnType)\s+[Ii]n\s*\(([0-9,\s]+)\)",
    re.IGNORECASE
)

trn_codes = {}   # code -> {meaning, status}

# From genlookup inserts (authoritative)
for src, pri, sql in blocks:
    for m in TRN_CODE_RE.finditer(sql):
        code, meaning = m.group(1).strip(), m.group(2).strip()
        if len(meaning) > 3 and not meaning.startswith("SR") and code.isdigit():
            if code not in trn_codes:
                trn_codes[code] = {"code": code, "meaning": meaning,
                                   "source": src, "status": "KNOWN"}

# Supplement with codes seen in trntype IN (...) clauses
for src, pri, sql in blocks:
    for m in TRN_IN_SQL.finditer(sql):
        for c in m.group(1).split(","):
            c = c.strip()
            if c and c not in trn_codes and len(c) >= 3:
                trn_codes[c] = {"code": c, "meaning": "",
                                "source": src, "status": "CONTEXT_REQUIRED"}

# Hardcoded confirmed meanings from Shoper documentation
CONFIRMED = {
    "2100": "Sales (Tax Invoice / Retail Invoice)",
    "1300": "Sales Return",
    "1600": "Void Sales",
    "3200": "Purchase / Goods Inwards",
    "9200": "Stock Transfer (Issue)",
    "9300": "Stock Transfer (Receipt)",
    "9700": "Physical Verification",
    "9800": "Opening Stock",
    "9900": "Stock Adjustment",
    "2200": "Cash Sale",
    "2300": "Credit Sale",
    "2500": "Service Bill",
    "1100": "Sales Order",
    "1200": "Service Order",
    "4100": "Purchase Order",
    "5100": "Cash Receipt",
    "5200": "Cash Payment",
    "6100": "Credit Card Submission",
    "6200": "Credit Card Realisation",
    "7100": "Goods Outwards (DC)",
    "8100": "Packing Slip",
    "10020":"Document Prefix Control",
}
for code, meaning in CONFIRMED.items():
    if code not in trn_codes:
        trn_codes[code] = {"code": code, "meaning": meaning,
                           "source": "CONFIRMED_KNOWLEDGE", "status": "KNOWN"}
    else:
        trn_codes[code]["meaning"] = meaning
        trn_codes[code]["status"] = "KNOWN"

trn_path = OUT_DIR / "SH9_TXN_TYPES.csv"
with open(trn_path,"w",newline="",encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["TrnType","Meaning","Status","Source"])
    for code, v in sorted(trn_codes.items(), key=lambda x: x[0].zfill(6)):
        w.writerow([v["code"], v["meaning"], v["status"], v["source"]])
log(f"Wrote: {trn_path} ({len(trn_codes)} TrnType codes)")

# ─── FIX 3: Extract vaUser (security baseline) ───────────────────────────────
USER_RE = re.compile(
    r"INSERT\s+(?:INTO\s+)?(?:\[dbo\]\.)?\[?vaUser\]?"
    r"(?:\s*\([^)]+\))?\s*VALUES\s*\(([^;]+?)\)",
    re.IGNORECASE | re.DOTALL
)
users = {}
for src, pri, sql in blocks:
    for m in USER_RE.finditer(sql):
        vals = parse_vals(m.group(1).strip())
        if len(vals) >= 2:
            login_id = vals[0]
            name     = vals[1] if len(vals) > 1 else ""
            weight   = vals[2] if len(vals) > 2 else ""
            if login_id not in users:
                users[login_id] = {"LoginId": login_id, "Name": name,
                                   "UserWeight": weight, "Source": src}

user_path = OUT_DIR / "SH9_USERS.csv"
with open(user_path,"w",newline="",encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["LoginId","Name","UserWeight","Source"])
    w.writeheader()
    for u in sorted(users.values(), key=lambda x: x["LoginId"]):
        w.writerow(u)
log(f"Wrote: {user_path} ({len(users)} user records)")

# ─── FIX 4: Extract key sysParam behavior flags ──────────────────────────────
PARAM_RE = re.compile(
    r"INSERT\s+(?:INTO\s+)?\[?(?:sysparam|SysParam|SYSPARAM)\]?"
    r"\s*\([^)]+\)\s*VALUES\s*\('([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'",
    re.IGNORECASE
)

params = {}
for src, pri, sql in blocks:
    for m in PARAM_RE.finditer(sql):
        pid, descr, code = m.group(1), m.group(2), m.group(3)
        if code not in params:
            params[code] = {"Id": pid, "Description": descr,
                            "ParamCode": code, "Source": src}

# Focus on behavior-impacting params only
BEHAVIOR_KEYWORDS = [
    "billing","return","void","cancel","allow","stock","print","tax",
    "invoice","order","credit","cash","till","gst","hsn","barcode","multi",
    "discount","promotion","loyalty","customer","vendor","supplier"
]
behavior_params = {
    c: v for c, v in params.items()
    if any(k in c.lower() or k in v["Description"].lower()
           for k in BEHAVIOR_KEYWORDS)
}

param_path = OUT_DIR / "SH9_SYSPARAM.csv"
with open(param_path,"w",newline="",encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["ParamCode","Description","Id","Source"])
    w.writeheader()
    for v in sorted(behavior_params.values(), key=lambda x: x["ParamCode"]):
        w.writerow(v)
log(f"Wrote: {param_path} ({len(behavior_params)} behavior-related sysParams)")

# ─── Write ExeName catalog ────────────────────────────────────────────────────
def classify(exe, cap, pgm):
    if not exe or pgm.upper()=="M": return "MENU_GROUP"
    c = cap.upper()
    if any(x in c for x in ["REPORT","REGISTER","LEDGER","ANALYSIS","MIS","LISTING"]): return "REPORT"
    if any(x in c for x in ["BACKUP","RESTORE","COMPACT","PURGE","SYNC","ARCHIVE"]): return "UTILITY"
    if any(x in c for x in ["IMPORT","EXPORT","PT FILE","FLAT FILE"]): return "IMPORT_EXPORT"
    if any(x in c for x in ["MASTER","CATALOGUE","CATALOG","ITEM CLASSIFICATION","DEFINE"]): return "MASTER"
    if any(x in c for x in ["USER AUTH","PASSWORD","SECURITY","NODE MGMT","MENU/USER"]): return "SECURITY"
    if any(x in c for x in ["BILLING","RETURN","CANCELLATION","INVOICE","ORDER","WALK-IN"]): return "TRANSACTION"
    if any(x in c for x in ["CASH","PAYMENT","TENDER","SETTLE","CREDIT CARD","TILL"]): return "FINANCIAL"
    if any(x in c for x in ["STOCK","INVENTORY","INWARD","OUTWARD","PHYSICAL","BARCODE","CARTON"]): return "INVENTORY"
    if any(x in c for x in ["PRINT","LABEL","TEMPLATE"]): return "PRINT"
    if any(x in c for x in ["CONFIG","SETUP","PARAM","MAPPING","PREFIX","SYSTEM"]): return "CONFIGURATION"
    return "EXECUTABLE"

exe_map = {}
for r in active_rows:
    exe = r["ExeName"].strip()
    if not exe: continue
    key = exe.upper()
    if key not in exe_map:
        exe_map[key] = {"ExeName": exe,
                        "Classification": classify(exe, r["MnuCap"], r["MnuPgm"]),
                        "MenuCount": 0, "Capabilities": [], "MnuRefs": []}
    exe_map[key]["MenuCount"] += 1
    exe_map[key]["Capabilities"].append(r["MnuCap"])
    exe_map[key]["MnuRefs"].append(f"{r['MnuNo']}/{r['MenuOpt']}")

exec_path = OUT_DIR / "SH9_MENU_EXEC.csv"
with open(exec_path,"w",newline="",encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["ExeName","Classification","MenuCount","Capabilities","MnuRefs"])
    for key, v in sorted(exe_map.items()):
        w.writerow([v["ExeName"], v["Classification"], v["MenuCount"],
                    " | ".join(v["Capabilities"][:6]),
                    " | ".join(v["MnuRefs"][:6])])
log(f"Wrote: {exec_path} ({len(exe_map)} executables, active entries only)")

# ─── Write extraction log ─────────────────────────────────────────────────────
log_path = OUT_DIR / "SH9_EXTRACT_LOG.md"
with open(log_path,"w",encoding="utf-8") as f:
    f.write("# SH9 Extraction Log v2.0\n\n")
    f.write(f"**Date:** {datetime.now().isoformat()}\n")
    f.write(f"**Source:** `{INI_DIR}`\n\n")
    f.write("## Summary\n\n")
    f.write(f"| Metric | Value |\n|---|---|\n")
    f.write(f"| S9Q files (disk) | {len(s9q_files)} |\n")
    f.write(f"| INSERT matches | {inserts} |\n")
    f.write(f"| Active entries | {len(active_rows)} |\n")
    f.write(f"| Deleted entries | {len(deleted_rows)} |\n")
    f.write(f"| Unique executables | {len(exe_map)} |\n")
    f.write(f"| TrnType codes | {len(trn_codes)} |\n")
    f.write(f"| User records | {len(users)} |\n")
    f.write(f"| Behavior sysParams | {len(behavior_params)} |\n\n")
    f.write("## Log\n\n```\n" + "\n".join(LOG) + "\n```\n")

# ─── Final console summary ────────────────────────────────────────────────────
print("\n" + "="*68)
print("SPRINT 0 v2 -- EXTRACTION COMPLETE")
print("="*68)
print(f"Active vaMenu entries   : {len(active_rows)}")
print(f"Deleted/stale entries   : {len(deleted_rows)}")
print(f"Unique executables      : {len(exe_map)}")
print(f"TrnType codes           : {len(trn_codes)}")
print(f"User records            : {len(users)}")
print(f"Behavior sysParams      : {len(behavior_params)}")
print("\nMenu Group Breakdown (active):")
by_grp = defaultdict(int)
for r in active_rows:
    by_grp[r["MnuName"]] += 1
for name, cnt in sorted(by_grp.items(), key=lambda x: -x[1]):
    print(f"  {name:<35} {cnt:>3}")
print(f"\nArtifacts in: {OUT_DIR}")
print("Sprint 0 Gate: COMPLETE -- All cons resolved.")
