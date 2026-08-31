"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.63.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import re
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, Any, List, Optional


def parse_sql_values(val_str: str) -> List[str]:
    """Parse comma-separated SQL VALUES clause respecting quotes."""
    values = []
    current = []
    in_quote = False
    quote_char = None
    
    i = 0
    while i < len(val_str):
        ch = val_str[i]
        if ch in ("'", '"'):
            if in_quote and ch == quote_char:
                # Check for escaped quote ''
                if i + 1 < len(val_str) and val_str[i + 1] == quote_char:
                    current.append(ch)
                    i += 1
                else:
                    in_quote = False
                    quote_char = None
            elif not in_quote:
                in_quote = True
                quote_char = ch
            else:
                current.append(ch)
        elif ch == "," and not in_quote:
            values.append("".join(current).strip())
            current = []
        else:
            current.append(ch)
        i += 1
    if current:
        values.append("".join(current).strip())
    
    cleaned = []
    for v in values:
        if v.upper() == "NULL":
            cleaned.append(None)
        elif (v.startswith("'") and v.endswith("'")) or (v.startswith('"') and v.endswith('"')):
            cleaned.append(v[1:-1].replace("''", "'"))
        else:
            cleaned.append(v)
    return cleaned


def extract_shoper9_configs(shoper_ini_dir: Path, param_def_dir: Path) -> Dict[str, Any]:
    """Extract all SysParam, SysParamExtd, GenLookUp, and ParamDef definitions."""
    params: Dict[str, Dict[str, Any]] = {}
    param_extds: Dict[str, Dict[str, Any]] = {}
    lookups: Dict[str, List[Dict[str, Any]]] = {}
    tables_created: List[str] = []
    
    # 1. Parse all .S9Q XML patch scripts in D:\Shoper9\ini
    s9q_files = sorted(list(shoper_ini_dir.glob("*.S9Q")))
    print(f"[*] Analyzing {len(s9q_files)} .S9Q patch scripts in {shoper_ini_dir}...")
    
    for s9q_file in s9q_files:
        try:
            content = s9q_file.read_text(encoding="utf-8", errors="ignore")
            # Wrap in root tag if not valid xml or extract blocks
            blocks = re.findall(r"<s9qsqlblk>.*?</s9qsqlblk>", content, re.DOTALL | re.IGNORECASE)
            for block in blocks:
                script_id_m = re.search(r"<s9qScriptID>(.*?)</s9qScriptID>", block, re.IGNORECASE)
                title_m = re.search(r"<s9qtitle>(.*?)</s9qtitle>", block, re.IGNORECASE)
                script_m = re.search(r"<s9qScript>(.*?)</s9qScript>", block, re.DOTALL | re.IGNORECASE)
                
                script_id = script_id_m.group(1).strip() if script_id_m else s9q_file.stem
                title = title_m.group(1).strip() if title_m else ""
                sql_text = script_m.group(1) if script_m else ""
                
                # Extract CREATE TABLE statements
                for ct in re.findall(r"CREATE\s+TABLE\s+(?:\[dbo\]\.)?\[?(\w+)\]?", sql_text, re.IGNORECASE):
                    if ct not in tables_created:
                        tables_created.append(ct)
                
                # Extract INSERT INTO sysparam statements
                sysparam_matches = re.finditer(
                    r"INSERT\s+INTO\s+\[?sysparam\]?\s*\((.*?)\)\s*VALUES\s*\((.*?)\)",
                    sql_text,
                    re.IGNORECASE | re.DOTALL
                )
                for sm in sysparam_matches:
                    cols = [c.strip(" []'\"") for c in sm.group(1).split(",")]
                    vals = parse_sql_values(sm.group(2))
                    if len(cols) == len(vals):
                        row = dict(zip(cols, vals))
                        pcode = row.get("ParamCode") or row.get("Id")
                        if pcode:
                            if pcode not in params:
                                params[pcode] = {
                                    "id": row.get("Id"),
                                    "param_code": pcode,
                                    "description": row.get("Descr"),
                                    "default_boolean": row.get("Boolean"),
                                    "default_int": row.get("Intg"),
                                    "default_text": row.get("Txt"),
                                    "default_date": row.get("Dt"),
                                    "default_float": row.get("Sng"),
                                    "default_currency": row.get("Cur"),
                                    "data_type": row.get("Opt"),
                                    "source_script": script_id,
                                    "source_file": s9q_file.name
                                }
                
                # Extract INSERT INTO sysparamextd statements
                sysparamextd_matches = re.finditer(
                    r"INSERT\s+INTO\s+\[?sysparamextd\]?\s*\((.*?)\)\s*VALUES\s*\((.*?)\)",
                    sql_text,
                    re.IGNORECASE | re.DOTALL
                )
                for sm in sysparamextd_matches:
                    cols = [c.strip(" []'\"") for c in sm.group(1).split(",")]
                    vals = parse_sql_values(sm.group(2))
                    if len(cols) == len(vals):
                        row = dict(zip(cols, vals))
                        pcode = row.get("ParamCode") or row.get("Id")
                        if pcode:
                            param_extds[pcode] = {
                                "category": row.get("Category"),
                                "category_descr": row.get("CatDescr"),
                                "fixed": row.get("Fixed"),
                                "display_order": row.get("DispOrder")
                            }
                
                # Extract INSERT INTO genlookup statements
                genlookup_matches = re.finditer(
                    r"INSERT\s+INTO\s+\[?genlookup\]?\s*\((.*?)\)\s*VALUES\s*\((.*?)\)",
                    sql_text,
                    re.IGNORECASE | re.DOTALL
                )
                for gm in genlookup_matches:
                    cols = [c.strip(" []'\"") for c in gm.group(1).split(",")]
                    vals = parse_sql_values(gm.group(2))
                    if len(cols) == len(vals):
                        row = dict(zip(cols, vals))
                        cat = row.get("Flag") or "GENERAL"
                        if cat not in lookups:
                            lookups[cat] = []
                        lookups[cat].append({
                            "code": row.get("Code"),
                            "description": row.get("Descr"),
                            "number": row.get("Number")
                        })
        except Exception as e:
            print(f"[!] Warning reading {s9q_file.name}: {e}")

    # 2. Parse D:\Shoper9\ParamDef\SP_*.INI files for UI definitions
    param_def_files = sorted(list(param_def_dir.glob("SP_*.INI")) + list(param_def_dir.glob("SP_*.ini")))
    print(f"[*] Analyzing {len(param_def_files)} UI parameter definitions in {param_def_dir}...")
    
    ui_definitions: Dict[str, Dict[str, Any]] = {}
    for pdef_file in param_def_files:
        try:
            lines = pdef_file.read_text(encoding="utf-8", errors="ignore").splitlines()
            hdr_caption = ""
            hdr_hints = ""
            details = []
            
            for line in lines:
                line = line.strip()
                if line.startswith("!@#~H~"):
                    parts = line.split("~")
                    if len(parts) >= 6:
                        hdr_caption = parts[4]
                        hdr_hints = parts[5]
                elif line.startswith("!@#~D~"):
                    parts = line.split("~")
                    if len(parts) >= 8:
                        details.append({
                            "segment_caption": parts[3] if len(parts) > 3 else "",
                            "field_type": parts[4] if len(parts) > 4 else "",
                            "control_type": parts[5] if len(parts) > 5 else "",
                            "control_val": parts[6] if len(parts) > 6 else "",
                            "min_val": parts[7] if len(parts) > 7 else "",
                            "max_val": parts[8] if len(parts) > 8 else "",
                            "tooltip": parts[9] if len(parts) > 9 else ""
                        })
            
            file_id = pdef_file.stem.replace("SP_", "")
            ui_definitions[file_id] = {
                "caption": hdr_caption,
                "hints": hdr_hints,
                "controls": details
            }
        except Exception as e:
            pass

    # 3. Merge SysParam with SysParamExtd and ParamDef
    catalog: List[Dict[str, Any]] = []
    categories: Dict[str, int] = {}
    
    for pcode, pdata in params.items():
        ext = param_extds.get(pcode, {})
        category = ext.get("category") or "General System Parameters"
        categories[category] = categories.get(category, 0) + 1
        
        param_id = pdata.get("id") or ""
        ui_def = ui_definitions.get(param_id, {})
        
        entry = {
            **pdata,
            "category": category,
            "category_description": ext.get("category_descr", ""),
            "fixed_status": ext.get("fixed", "Variable"),
            "display_order": ext.get("display_order"),
            "ui_caption": ui_def.get("caption", ""),
            "ui_hints": ui_def.get("hints", ""),
            "ui_controls": ui_def.get("controls", [])
        }
        catalog.append(entry)

    # Sort by Category and ParamCode
    catalog.sort(key=lambda x: (x["category"], x["param_code"]))
    
    return {
        "metadata": {
            "total_sysparams": len(catalog),
            "total_categories": len(categories),
            "total_lookup_categories": len(lookups),
            "total_ddl_tables_found": len(tables_created),
            "source_ini_path": str(shoper_ini_dir),
            "source_paramdef_path": str(param_def_dir)
        },
        "categories_breakdown": categories,
        "tables_discovered": sorted(tables_created),
        "parameters": catalog,
        "lookups": lookups
    }


def main():
    shoper_ini_dir = Path("D:/Shoper9/ini")
    param_def_dir = Path("D:/Shoper9/ParamDef")
    out_dir = Path("F:/SMRITRretailNX/docs/legacy/shoper")
    out_dir.mkdir(parents=True, exist_ok=True)
    
    if not shoper_ini_dir.exists():
        print(f"[!] Path not found: {shoper_ini_dir}")
        return
    
    print("[*] Starting Shoper 9 Configuration & Schema Ingestion Engine...")
    result = extract_shoper9_configs(shoper_ini_dir, param_def_dir)
    
    # Save structured JSON
    json_path = out_dir / "SH9_CONFIG_CATALOG.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print(f"[OK] Saved JSON Catalog: {json_path} ({len(result['parameters'])} parameters)")
    
    # Generate Markdown Summary
    md_path = out_dir / "SH9_CONFIG_SUMMARY.md"
    md_content = [
        "<!--",
        "  Project      : SMRITI Retail OS",
        "  Author       : Jawahar Ramkripal Mallah",
        "  Designation  : Chief Systems Architect & Creator",
        "  Email        : support@smritibooks.com",
        "  Websites     : smritibooks.com | erpnbook.com | aitdl.com",
        "  Version      : 3.63.0",
        "  Created      : 2026-08-25",
        "  Modified     : 2026-08-25",
        "  Copyright    : © SMRITIBooks.com. All Rights Reserved.",
        "  License      : Proprietary Commercial Software",
        "  Classification: Internal",
        "-->",
        "",
        "# Shoper 9 System Parameters & Configuration Catalog",
        "",
        f"- **Total System Parameters (`SysParam`):** {result['metadata']['total_sysparams']}",
        f"- **Total Categories:** {result['metadata']['total_categories']}",
        f"- **Total Lookup Groups (`GenLookUp`):** {result['metadata']['total_lookup_categories']}",
        f"- **Total Legacy DDL Tables Discovered:** {result['metadata']['total_ddl_tables_found']}",
        "",
        "## 1. Parameters by Functional Category",
        "",
        "| Category Name | Parameter Count |",
        "|---|---|"
    ]
    
    for cat, count in sorted(result["categories_breakdown"].items(), key=lambda x: -x[1]):
        md_content.append(f"| **{cat}** | `{count}` |")
        
    md_content.extend([
        "",
        "## 2. Parameter Master Excerpt (Sample)",
        "",
        "| Parameter Code | Description | Data Type | Default Value | Category |",
        "|---|---|---|---|---|"
    ])
    
    for p in result["parameters"][:30]:
        val = p.get("default_boolean") or p.get("default_int") or p.get("default_text") or p.get("default_currency") or "0"
        md_content.append(f"| `{p['param_code']}` | {p['description'] or ''} | `{p.get('data_type') or 'V'}` | `{val}` | {p['category']} |")
    
    md_content.extend([
        "",
        "## 3. Discovered Legacy Tables for Migration Pipeline",
        "",
        ", ".join([f"`{t}`" for t in result["tables_discovered"][:50]]) + f" ... and {max(0, len(result['tables_discovered']) - 50)} more.",
        ""
    ])
    
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_content))
    print(f"[OK] Saved Markdown Summary: {md_path}")
    
    print("\n========================================================")
    print(f"[SUCCESS] Extracted {result['metadata']['total_sysparams']} SysParams across {result['metadata']['total_categories']} categories.")
    print("========================================================")


if __name__ == "__main__":
    main()
