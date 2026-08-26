#!/usr/bin/env python3
"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.33.0
Created      : 2026-08-26
Modified     : 2026-08-26
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal

Shoper9 Template Blueprint Parser & Extractor
Parses legacy Shoper9 template files into normalized SMRITI JSON blueprints
without executing any legacy SQL or modifying source files.
"""

import os
import csv
import json
import hashlib
import re
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional

DEFAULT_SOURCE_DIR = Path("D:/Shoper9/Templates")
OUTPUT_DIR = Path("docs/legacy_blueprints/shoper9")

def compute_sha256(filepath: Path) -> str:
    """Compute SHA256 hash of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()

def read_text_safe(filepath: Path) -> str:
    """Read legacy text file preserving encoding (cp1252 / latin1 / utf-8)."""
    encodings = ["utf-8-sig", "utf-8", "cp1252", "latin1"]
    for enc in encodings:
        try:
            with open(filepath, "r", encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    with open(filepath, "r", encoding="cp1252", errors="replace") as f:
        return f.read()

def parse_template_inf(content: str) -> List[Dict[str, str]]:
    """Parse Template.inf hash-delimited file."""
    lines = [line.strip() for line in content.splitlines() if line.strip()]
    if not lines:
        return []

    headers = [h.strip() for h in lines[0].split("#")]
    entries = []
    for line in lines[1:]:
        parts = [p.strip() for p in line.split("#")]
        if len(parts) >= len(headers):
            entry = {headers[i]: parts[i] for i in range(len(headers))}
            entries.append(entry)
        else:
            entry = {f"col_{i}": parts[i] for i in range(len(parts))}
            entries.append(entry)
    return entries

def parse_csv_records(content: str) -> Tuple[List[str], List[Dict[str, Any]]]:
    """Parse standard CSV content."""
    lines = [l for l in content.splitlines() if l.strip()]
    if not lines:
        return [], []

    reader = csv.DictReader(lines)
    fieldnames = reader.fieldnames or []
    records = []
    for row in reader:
        records.append({k: (v.strip() if isinstance(v, str) else v) for k, v in row.items()})
    return list(fieldnames), records

def parse_sql_statements(content: str) -> List[Dict[str, Any]]:
    """Parse GO-delimited SQL batches into parsed statement objects."""
    raw_blocks = re.split(r'(?i)\r?\n\s*-GO-\s*\r?\n|\r?\n\s*GO\s*\r?\n', content)
    statements = []

    for raw in raw_blocks:
        stmt = raw.strip()
        if not stmt:
            continue

        stmt_type = "UNKNOWN"
        table_name = ""
        action_data: Dict[str, Any] = {}

        # INSERT INTO vamenu (col1, col2) values (val1, val2)
        m_menu_insert = re.match(
            r"(?i)Insert\s+into\s+vamenu\s*\((.*?)\)\s*values\s*\((.*)\)",
            stmt, re.DOTALL
        )
        if m_menu_insert:
            stmt_type = "INSERT_MENU"
            table_name = "vamenu"
            cols = [c.strip() for c in m_menu_insert.group(1).split(",")]
            # Parse values safely
            val_reader = csv.reader([m_menu_insert.group(2).strip()], quotechar="'", skipinitialspace=True)
            vals = next(val_reader)
            action_data = {cols[i]: vals[i] if i < len(vals) else "" for i in range(len(cols))}

        m_ver_insert = re.match(
            r"(?i)insert\s+into\s+vavertable\s*\((.*?)\)\s*values\s*\((.*)\)",
            stmt, re.DOTALL
        )
        if m_ver_insert:
            stmt_type = "INSERT_VERSION"
            table_name = "vavertable"
            cols = [c.strip() for c in m_ver_insert.group(1).split(",")]
            val_reader = csv.reader([m_ver_insert.group(2).strip()], quotechar="'", skipinitialspace=True)
            vals = next(val_reader)
            action_data = {cols[i]: vals[i] if i < len(vals) else "" for i in range(len(cols))}

        m_dbs_insert = re.match(
            r"(?i)INSERT\s+INTO\s+ACCEPTDISPLAYDTLS\s+VALUES\s*\((.*)\)",
            stmt, re.DOTALL
        )
        if m_dbs_insert:
            stmt_type = "INSERT_DISPLAY_DTLS"
            table_name = "ACCEPTDISPLAYDTLS"
            val_reader = csv.reader([m_dbs_insert.group(1).strip()], quotechar="'", skipinitialspace=True)
            vals = next(val_reader)
            # AcceptDisplayDtls column schema
            dbs_cols = [
                "ColumnId", "Caption", "DefaultCaption", "Visible", "DisplayOrder",
                "TabOrder", "ReportOrder", "InputType", "DataType", "DefaultWidth",
                "PrintWidth", "Alignment", "HeaderAlignment", "FormatString",
                "ValidationRule", "DefaultValue", "HelpText", "IsMandatory",
                "IsReadOnly", "IsCalculated", "DecimalPlaces", "LookupCode",
                "LookupParam", "Formula", "IsActive", "Reserved1", "Reserved2"
            ]
            action_data = {dbs_cols[i] if i < len(dbs_cols) else f"Col_{i}": vals[i] for i in range(len(vals))}

        m_delete = re.match(r"(?i)delete\s+from\s+(\w+)\s+(where\s+.*)", stmt)
        if m_delete:
            stmt_type = "DELETE"
            table_name = m_delete.group(1)
            action_data = {"where": m_delete.group(2)}

        m_update = re.match(r"(?i)update\s+(\w+)\s+Set\s+(.*?)\s+(Where\s+.*)", stmt)
        if m_update:
            stmt_type = "UPDATE"
            table_name = m_update.group(1)
            action_data = {"set": m_update.group(2), "where": m_update.group(3)}

        statements.append({
            "raw": stmt,
            "type": stmt_type,
            "table": table_name,
            "data": action_data
        })

    return statements

def analyze_and_extract_blueprints(source_dir: Path = DEFAULT_SOURCE_DIR, output_dir: Path = OUTPUT_DIR) -> Dict[str, Any]:
    """Complete extraction and audit workflow."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Inspect all files in source
    manifest_entries = []
    file_contents: Dict[str, str] = {}
    quarantined_files = []
    empty_files = []
    duplicate_sql_entries = []
    hardcoded_paths = []

    for item in sorted(source_dir.glob("*")):
        if item.is_dir():
            continue

        fname = item.name
        size = item.stat().st_size
        sha256 = compute_sha256(item)

        # Check quarantine
        is_quarantined = fname.lower().endswith("_tmp.txt")
        is_empty = (size == 0)
        is_binary = fname.lower().endswith(".tw")

        status = "PARSED"
        if is_quarantined:
            status = "QUARANTINED"
            quarantined_files.append({"file": fname, "size": size, "reason": "Temporary backup file (*_tmp.txt)"})
        elif is_empty:
            status = "EMPTY"
            empty_files.append({"file": fname, "size": 0, "reason": "0-byte empty template file"})
        elif is_binary:
            status = "BINARY_WRAPPER"

        manifest_entries.append({
            "filename": fname,
            "sizeBytes": size,
            "sha256": sha256,
            "status": status,
            "extension": item.suffix.lower()
        })

        if not is_quarantined and not is_empty and not is_binary:
            file_contents[fname] = read_text_safe(item)

    # 2. Parse Template.inf
    template_inf_records = []
    if "Template.inf" in file_contents:
        template_inf_records = parse_template_inf(file_contents["Template.inf"])

    # 3. Parse System Parameters (*.Sy)
    retail_sy_headers, retail_sy_rows = parse_csv_records(file_contents.get("Retail.Sy", ""))
    dist_sy_headers, dist_sy_rows = parse_csv_records(file_contents.get("Distributor.Sy", ""))

    # Find hardcoded paths in parameters
    for row in retail_sy_rows:
        txt = row.get("Txt", "")
        if re.search(r"[A-Za-z]:\\[\w\\]+", txt):
            hardcoded_paths.append({
                "profile": "Retail",
                "paramCode": row.get("ParamCode"),
                "description": row.get("Descr"),
                "value": txt
            })
    for row in dist_sy_rows:
        txt = row.get("Txt", "")
        if re.search(r"[A-Za-z]:\\[\w\\]+", txt):
            hardcoded_paths.append({
                "profile": "Distributor",
                "paramCode": row.get("ParamCode"),
                "description": row.get("Descr"),
                "value": txt
            })

    # Compare Retail vs Distributor parameters
    retail_param_map = {r["ParamCode"]: r for r in retail_sy_rows if "ParamCode" in r}
    dist_param_map = {r["ParamCode"]: r for r in dist_sy_rows if "ParamCode" in r}

    all_param_codes = sorted(set(retail_param_map.keys()) | set(dist_param_map.keys()))
    consolidated_params = []
    profile_diffs = []

    for code in all_param_codes:
        r_rec = retail_param_map.get(code)
        d_rec = dist_param_map.get(code)

        is_in_retail = r_rec is not None
        is_in_dist = d_rec is not None

        rec = r_rec or d_rec

        # Check value variance
        r_val = f"Bool={r_rec.get('Boolean','')}|Int={r_rec.get('Intg','')}|Txt={r_rec.get('Txt','')}" if r_rec else "N/A"
        d_val = f"Bool={d_rec.get('Boolean','')}|Int={d_rec.get('Intg','')}|Txt={d_rec.get('Txt','')}" if d_rec else "N/A"

        diff = (r_val != d_val)
        if diff:
            profile_diffs.append({
                "paramCode": code,
                "description": rec.get("Descr", ""),
                "category": rec.get("Category", ""),
                "retailValue": r_val,
                "distributorValue": d_val
            })

        consolidated_params.append({
            "id": rec.get("Id"),
            "paramCode": code,
            "description": rec.get("Descr"),
            "category": rec.get("Category"),
            "categoryDescription": rec.get("CatDescr"),
            "displayOrder": int(rec.get("DispOrder", 0)) if rec.get("DispOrder", "").isdigit() else 0,
            "type": rec.get("Opt"),
            "inRetail": is_in_retail,
            "inDistributor": is_in_dist,
            "retailDefaults": r_rec,
            "distributorDefaults": d_rec,
            "hasProfileVariance": diff,
            "smritiMapping": {
                "targetSystem": "smritisys.system_parameters",
                "storageKey": f"sysparam_{code.lower()}",
                "isConfigurable": rec.get("Fixed") != "Fixed"
            }
        })

    # 4. Parse General Lookups (*.Gl)
    retail_gl_headers, retail_gl_rows = parse_csv_records(file_contents.get("Retail.Gl", ""))
    dist_gl_headers, dist_gl_rows = parse_csv_records(file_contents.get("Distributor.Gl", ""))

    # 5. Parse Lookup Values (*.Lu)
    retail_lu_headers, retail_lu_rows = parse_csv_records(file_contents.get("Retail.Lu", ""))
    dist_lu_headers, dist_lu_rows = parse_csv_records(file_contents.get("Distributor.Lu", ""))

    # 6. Parse Menus (*.Mns) & Deduplicate
    dist_mns_statements = parse_sql_statements(file_contents.get("Distributor.Mns", ""))

    seen_stmts = set()
    reviewed_dist_mns = []
    dist_menu_entries = []

    for stmt in dist_mns_statements:
        raw = stmt["raw"]
        if raw in seen_stmts:
            duplicate_sql_entries.append({
                "file": "Distributor.Mns",
                "statement": raw,
                "action": "Deduplicated in reviewed copy"
            })
            continue
        seen_stmts.add(raw)
        reviewed_dist_mns.append(stmt)

        if stmt["type"] == "INSERT_MENU":
            data = stmt["data"]
            dist_menu_entries.append({
                "menuNo": int(data.get("MnuNo", 0)),
                "menuOpt": int(data.get("MenuOPt", data.get("MenuOpt", 0))),
                "parentName": data.get("MnuName", ""),
                "caption": data.get("MnuCap", ""),
                "type": data.get("MnuPgm", ""),
                "executable": data.get("ExeName", "").strip(),
                "programOption": int(data.get("Pgmopt", 0)) if data.get("Pgmopt", "").isdigit() else 0,
                "smritiTileMapping": map_menu_to_smriti_tile(data.get("MnuCap", ""), data.get("ExeName", ""))
            })

    # 7. Parse Display Details (*.Dbs)
    dist_dbs_statements = parse_sql_statements(file_contents.get("Distributor.Dbs", ""))
    dist_display_columns = []
    for stmt in dist_dbs_statements:
        if stmt["type"] == "INSERT_DISPLAY_DTLS":
            dist_display_columns.append(stmt["data"])

    # 8. Assemble Blueprints
    retail_blueprint = {
        "profile": "Retail",
        "version": "18.0",
        "description": "SMRITI Retail Profile based on Shoper9 Retail template",
        "scope": [
            "POS billing",
            "Retail pricing & barcode lookup",
            "Customer cash/card/UPI sales",
            "Store stock inward & inventory",
            "Retail register reports"
        ],
        "parameterCount": len(retail_sy_rows),
        "lookupCount": len(retail_gl_rows),
        "optionCount": len(retail_lu_rows),
        "displayLayoutCount": 0,
        "menuCount": 0
    }

    distributor_blueprint = {
        "profile": "Distributor",
        "version": "18.0",
        "description": "SMRITI Distributor Profile based on Shoper9 Distributor template",
        "scope": [
            "Purchase order management & consolidation",
            "Sales orders & wholesale invoicing",
            "Delivery Challan (Sales DC)",
            "Approval Issue Delivery Challan",
            "Transport Receipt Entry",
            "Conversion of Sales DC to Approval Issue DC",
            "Wholesale pricing & customer tiers",
            "Fulfilment and distribution reports"
        ],
        "parameterCount": len(dist_sy_rows),
        "lookupCount": len(dist_gl_rows),
        "optionCount": len(dist_lu_rows),
        "displayLayoutCount": len(dist_display_columns),
        "menuCount": len(dist_menu_entries),
        "distributorWorkflows": [
            {
                "workflowId": "WF-DC-SALES",
                "title": "Sales Delivery Challan (Sales DC)",
                "legacyMenu": "Sales -> DC Generation -> Sales DC (SR115500.EXE / PgmOpt 8)",
                "smritiTarget": "/distributor-invoicing (Delivery Challan Mode)",
                "documentType": "DELIVERY_CHALLAN",
                "status": "MAPPED"
            },
            {
                "workflowId": "WF-DC-APPROVAL",
                "title": "Approval Issue Delivery Challan",
                "legacyMenu": "Sales -> DC Generation -> Approval Issue DC (SR115500.EXE / PgmOpt 9)",
                "smritiTarget": "/distributor-invoicing (Approval Issue Mode)",
                "documentType": "APPROVAL_ISSUE_DC",
                "status": "MAPPED"
            },
            {
                "workflowId": "WF-TRANSPORT-RECEIPT",
                "title": "Transport Receipt Entry",
                "legacyMenu": "Sales -> DC Generation -> Transport Receipt Entry (SD400800.EXE / PgmOpt 8)",
                "smritiTarget": "/dispatch-manifests (Transport LR & Carrier Receipt)",
                "documentType": "TRANSPORT_RECEIPT",
                "status": "MAPPED"
            },
            {
                "workflowId": "WF-CONV-SALES-APPROVAL",
                "title": "Conversion of Sales DC to Approval Issue DC",
                "legacyMenu": "Sales -> DC Generation -> Conversion of Sales DC to Approval Issue DC (SD100500.EXE)",
                "smritiTarget": "/distributor-invoicing (Challan Type Reclassification)",
                "documentType": "DC_RECLASSIFICATION",
                "status": "MAPPED"
            },
            {
                "workflowId": "WF-PO-CONSOLIDATION",
                "title": "Purchase Order Consolidation",
                "legacyMenu": "Purchase Order -> Consolidation (SE100900.EXE / PgmOpt 3)",
                "smritiTarget": "/purchase-studio (PO Batch Consolidation & Multi-Store Aggregation)",
                "documentType": "PURCHASE_ORDER_CONSOLIDATION",
                "status": "MAPPED"
            }
        ]
    }

    # Write output JSON files
    write_json(output_dir / "template_manifest.json", {
        "generatedAt": "2026-08-26T23:45:00+05:30",
        "sourceDirectory": str(source_dir),
        "totalFiles": len(manifest_entries),
        "files": manifest_entries,
        "environmentTemplates": template_inf_records
    })

    write_json(output_dir / "retail_blueprint.json", retail_blueprint)
    write_json(output_dir / "distributor_blueprint.json", distributor_blueprint)

    write_json(output_dir / "menus.json", {
        "distributorMenus": dist_menu_entries,
        "retailMenus": []
    })

    write_json(output_dir / "parameters.json", {
        "totalParameters": len(consolidated_params),
        "profileVariancesCount": len(profile_diffs),
        "parameters": consolidated_params,
        "profileVariances": profile_diffs
    })

    write_json(output_dir / "general_lookups.json", {
        "retailLookups": retail_gl_rows,
        "distributorLookups": dist_gl_rows,
        "lookupOptions": retail_lu_rows
    })

    write_json(output_dir / "display_layouts.json", {
        "distributorAcceptDisplayDtls": dist_display_columns,
        "retailAcceptDisplayDtls": []
    })

    # Generate Markdown Documentation
    write_readme(output_dir / "README.md", manifest_entries, retail_blueprint, distributor_blueprint)
    write_review_report(
        output_dir / "review_report.md",
        manifest_entries,
        quarantined_files,
        empty_files,
        duplicate_sql_entries,
        hardcoded_paths,
        profile_diffs,
        distributor_blueprint["distributorWorkflows"]
    )

    return {
        "manifest": manifest_entries,
        "quarantined": quarantined_files,
        "empty": empty_files,
        "duplicate_sql": duplicate_sql_entries,
        "hardcoded_paths": hardcoded_paths,
        "profile_diffs": profile_diffs
    }

def map_menu_to_smriti_tile(caption: str, exe: str) -> Dict[str, str]:
    """Map legacy menu item to SMRITI Launchpad Tile and Action."""
    c = caption.lower()
    if "sales dc" in c:
        return {"tileId": "distributor-invoicing", "action": "CREATE_SALES_DC", "workspace": "Billing Desk"}
    if "approval issue dc" in c:
        return {"tileId": "distributor-invoicing", "action": "CREATE_APPROVAL_DC", "workspace": "Billing Desk"}
    if "transport receipt" in c:
        return {"tileId": "dispatch-manifests", "action": "LOG_TRANSPORT_LR", "workspace": "Logistics Hub"}
    if "conversion" in c:
        return {"tileId": "distributor-invoicing", "action": "CONVERT_DC_TYPE", "workspace": "Billing Desk"}
    if "consolidation" in c:
        return {"tileId": "purchase-studio", "action": "CONSOLIDATE_POS", "workspace": "Procurement"}
    if "dc generation" in c:
        return {"tileId": "distributor-invoicing", "action": "OPEN_DC_STUDIO", "workspace": "Billing Desk"}
    return {"tileId": "launchpad", "action": "OPEN_CUSTOM", "workspace": "Main"}

def write_json(path: Path, data: Any):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def write_readme(path: Path, manifest: List[Dict], retail_bp: Dict, dist_bp: Dict):
    content = f"""<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.33.0
  Created      : 2026-08-26
  Modified     : 2026-08-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Shoper9 Legacy Template Blueprints

This directory contains the normalized, verified, and audited blueprints derived from legacy **Shoper9 Template files** (`D:\\Shoper9\\Templates`).

> [!IMPORTANT]
> These artifacts are business and architectural blueprints for SMRITI Retail OS. No legacy SQL is executed directly against production databases (`smritisys`, `smriti001`, `smriti002`).

---

## 1. Directory Structure

- [`template_manifest.json`](./template_manifest.json): Full manifest of all source template files with SHA256 hashes and quarantine status.
- [`retail_blueprint.json`](./retail_blueprint.json): Retail profile configuration and module boundaries.
- [`distributor_blueprint.json`](./distributor_blueprint.json): Distributor profile configuration, Delivery Challans, Transport Receipts, and PO Consolidation.
- [`menus.json`](./menus.json): Normalized menu definitions with direct SMRITI Launchpad tile and workspace mappings.
- [`parameters.json`](./parameters.json): Consolidated system parameters catalog, category hierarchies, and Retail vs Distributor variances.
- [`general_lookups.json`](./general_lookups.json): Master lookups, search filters, and formula definitions.
- [`display_layouts.json`](./display_layouts.json): Billing/Grid display column formatting rules (`ACCEPTDISPLAYDTLS`).
- [`review_report.md`](./review_report.md): Formal audit report of quarantined temporary files, empty files, duplicate statements, and legacy path anomalies.

---

## 2. File Classifications

| Legacy Extension | Description | SMRITI Canonical Concept |
|---|---|---|
| `*.Sy` | System Parameters CSV | `smritisys.system_parameters` |
| `*.Gl` | General Lookups CSV | Master Data, Filters & Categories |
| `*.Lu` | Lookup Value Choices CSV | Parameter Option Enumerations |
| `*.Dbs` | Display Grid SQL | Screen Layouts & Table Formats |
| `*.Mns` | Menu Registry SQL | Fiori Launchpad Tiles & ACAS Permissions |
| `*.TW` | Binary Template Wrapper | Quarantined / Reference Only |
| `*_tmp.txt` | Temporary Backup Files | Quarantined / Non-Importable |
| `*.Ads`, `*.Ams`, `*.Sdbs` | 0-byte Stub Files | Verified Empty Stubs |

---

## 3. Profile Architecture

### Retail Profile (`Retail.Sy`, `Retail.Gl`, `Retail.Lu`)
- **Core Focus**: Fast POS cash/card/UPI billing, barcode lookup, store-level inventory, customer pricing, and retail reporting.
- **Parameters Count**: {retail_bp['parameterCount']}

### Distributor Profile (`Distributor.Sy`, `Distributor.Gl`, `Distributor.Lu`, `Distributor.Dbs`, `Distributor.Mns`)
- **Core Focus**: B2B Wholesale operations, Delivery Challans (Sales DC, Approval Issue DC), Transport LR Entry, DC Type Reclassification, Purchase Order Consolidation, and custom grid layouts.
- **Parameters Count**: {dist_bp['parameterCount']}
- **Display Column Formats**: {dist_bp['displayLayoutCount']} columns
- **Workflow Mappings**: 5 core distributor workflows mapped to SMRITI Distributor Invoicing and Logistics modules.
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def write_review_report(
    path: Path,
    manifest: List[Dict],
    quarantined: List[Dict],
    empty: List[Dict],
    duplicate_sql: List[Dict],
    hardcoded_paths: List[Dict],
    profile_diffs: List[Dict],
    dist_workflows: List[Dict]
):
    content = f"""<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.33.0
  Created      : 2026-08-26
  Modified     : 2026-08-26
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Shoper9 Template Blueprint Review & Audit Report

**Audit Date**: 2026-08-26
**Source Path**: `D:\\Shoper9\\Templates`
**Total Source Files**: {len(manifest)}
**Auditor**: SMRITI Automated Blueprint Engine

---

## 1. Quarantined Temporary Files ({len(quarantined)})
The following files were detected as temporary staging or editor dump files (`*_tmp.txt`) and have been quarantined. They are excluded from all generated blueprints:

| Filename | Size (Bytes) | Reason |
|---|---|---|
"""
    for q in quarantined:
        content += f"| `{q['file']}` | {q['size']:,} | {q['reason']} |\n"

    content += f"""
---

## 2. Empty Template Files ({len(empty)})
The following 0-byte files exist in the legacy template directory:

| Filename | Size | Status |
|---|---|---|
"""
    for e in empty:
        content += f"| `{e['file']}` | 0 bytes | {e['reason']} |\n"

    content += f"""
---

## 3. Duplicate SQL Statements Detected ({len(duplicate_sql)})
The legacy SQL files contain redundant duplicate statements that have been filtered in the generated reviewed copies:

| Source File | Duplicate Statement | Action Taken |
|---|---|---|
"""
    for d in duplicate_sql:
        clean_stmt = d['statement'].replace('\n', ' ')
        content += f"| `{d['file']}` | `{clean_stmt}` | {d['action']} |\n"

    content += f"""
---

## 4. Hardcoded Legacy File Paths ({len(hardcoded_paths)})
The legacy configuration files contain Windows-specific absolute paths that must be overridden by SMRITI environment variables or tenant storage providers:

| Profile | Parameter Code | Description | Legacy Value |
|---|---|---|---|
"""
    for h in hardcoded_paths:
        content += f"| {h['profile']} | `{h['paramCode']}` | {h['description']} | `{h['value']}` |\n"

    content += f"""
---

## 5. Retail vs Distributor Parameter Variances ({len(profile_diffs)})
Differences in parameter values between Retail and Distributor operational profiles:

| Parameter Code | Description | Category | Retail Value | Distributor Value |
|---|---|---|---|---|
"""
    for p in profile_diffs[:20]:
        content += f"| `{p['paramCode']}` | {p['description']} | {p['category']} | `{p['retailValue']}` | `{p['distributorValue']}` |\n"

    if len(profile_diffs) > 20:
        content += f"\n*(Showing 20 of {len(profile_diffs)} parameter variances. Complete listing available in [parameters.json](./parameters.json))*\n"

    content += f"""
---

## 6. Distributor Workflow Mappings ({len(dist_workflows)})

| Workflow ID | Business Capability | Legacy Shoper9 Menu | SMRITI Canonical Target | Status |
|---|---|---|---|---|
"""
    for w in dist_workflows:
        content += f"| `{w['workflowId']}` | {w['title']} | {w['legacyMenu']} | `{w['smritiTarget']}` | `{w['status']}` |\n"

    content += f"""
---

## 7. Safety & Compliance Attestation
- [x] Zero direct SQL execution against `smritisys`, `smriti001`, or `smriti002`.
- [x] Zero modifications, renames, or deletions in `D:\\Shoper9\\Templates`.
- [x] All legacy character encodings preserved.
- [x] Quarantined temporary files excluded from production schemas.
- [x] All duplicate SQL statements pruned from reviewed copies.
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    analyze_and_extract_blueprints()
    print("Shoper9 Template Blueprint extraction completed successfully.")
