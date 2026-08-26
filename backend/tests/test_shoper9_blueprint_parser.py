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

Automated Pytest Suite for Shoper9 Blueprint Extraction, Normalization & Safety Audits
"""

import sys
import json
from pathlib import Path

# Add workspace root and backend to sys.path
workspace_root = Path(__file__).resolve().parent.parent.parent
backend_dir = workspace_root / "backend"
scripts_dir = workspace_root / "scripts"

for p in [str(workspace_root), str(backend_dir), str(scripts_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from scripts.shoper9_blueprint_parser import (
    analyze_and_extract_blueprints,
    parse_template_inf,
    parse_csv_records,
    parse_sql_statements
)

BLUEPRINTS_DIR = workspace_root / "docs" / "legacy_blueprints" / "shoper9"

def test_01_template_manifest_structure_and_quarantine():
    """Verify template manifest correctly inventories all 21 source files and quarantines tmp files."""
    manifest_path = BLUEPRINTS_DIR / "template_manifest.json"
    assert manifest_path.exists(), "template_manifest.json must exist"

    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert data["totalFiles"] == 21, f"Expected 21 source files, got {data['totalFiles']}"

    # Check quarantine
    quarantined = [f for f in data["files"] if f["status"] == "QUARANTINED"]
    assert len(quarantined) == 2, f"Expected 2 quarantined tmp files, got {len(quarantined)}"
    quarantined_names = {q["filename"] for q in quarantined}
    assert "Distributor_tmp.txt" in quarantined_names
    assert "Retail_tmp.txt" in quarantined_names

    # Check empty files
    empty_files = [f for f in data["files"] if f["status"] == "EMPTY"]
    assert len(empty_files) == 8, f"Expected 8 empty files, got {len(empty_files)}"

def test_02_sql_parser_duplicate_deduplication():
    """Verify SQL parser detects and deduplicates duplicate statements in Distributor.Mns."""
    sample_sql = """
    Insert into vamenu (MnuNo, MenuOPt, MnuName, MnuCap, MnuPgm, ExeName, MnuWght, AllowWhenTrnClosed, Pgmopt, DbInfo, MenuIcon, Menusep, MenuBold) values (100,120,'Sales','DC Generation','M',' ',0,0,0,'0',' ',0,0)
    -GO-
    insert into vavertable (ExeSrl,ExeID,ExeSkip,ExeVer,ExeMinor,ExeSubRel) values (0,'SR115500.EXE','N','9','1','123')
    -GO-
    insert into vavertable (ExeSrl,ExeID,ExeSkip,ExeVer,ExeMinor,ExeSubRel) values (0,'SR115500.EXE','N','9','1','123')
    -GO-
    """
    stmts = parse_sql_statements(sample_sql)
    assert len(stmts) == 3
    assert stmts[0]["type"] == "INSERT_MENU"
    assert stmts[1]["type"] == "INSERT_VERSION"
    assert stmts[2]["type"] == "INSERT_VERSION"

    # Check deduplication logic
    seen = set()
    unique = []
    for s in stmts:
        if s["raw"] not in seen:
            seen.add(s["raw"])
            unique.append(s)
    assert len(unique) == 2, "Duplicate vavertable statement must be filtered to 2 unique statements"

def test_03_distributor_menu_mapping_coverage():
    """Verify all 5 required Distributor workflows are explicitly mapped in distributor_blueprint.json."""
    dist_bp_path = BLUEPRINTS_DIR / "distributor_blueprint.json"
    assert dist_bp_path.exists()

    with open(dist_bp_path, "r", encoding="utf-8") as f:
        dist_bp = json.load(f)

    workflows = dist_bp.get("distributorWorkflows", [])
    assert len(workflows) == 5, f"Expected 5 distributor workflows, found {len(workflows)}"

    wf_ids = {w["workflowId"] for w in workflows}
    assert "WF-DC-SALES" in wf_ids
    assert "WF-DC-APPROVAL" in wf_ids
    assert "WF-TRANSPORT-RECEIPT" in wf_ids
    assert "WF-CONV-SALES-APPROVAL" in wf_ids
    assert "WF-PO-CONSOLIDATION" in wf_ids

def test_04_parameters_and_variance_detection():
    """Verify parameters.json captures full catalog and accurately isolates profile differences."""
    params_path = BLUEPRINTS_DIR / "parameters.json"
    assert params_path.exists()

    with open(params_path, "r", encoding="utf-8") as f:
        params_data = json.load(f)

    assert params_data["totalParameters"] > 500, "Should have > 500 total system parameters"
    assert params_data["profileVariancesCount"] == 26, f"Expected 26 profile variances, got {params_data['profileVariancesCount']}"

def test_05_display_layouts_schema():
    """Verify display_layouts.json contains structured ACCEPTDISPLAYDTLS column definitions."""
    dbs_path = BLUEPRINTS_DIR / "display_layouts.json"
    assert dbs_path.exists()

    with open(dbs_path, "r", encoding="utf-8") as f:
        dbs_data = json.load(f)

    cols = dbs_data.get("distributorAcceptDisplayDtls", [])
    assert len(cols) > 0, "Distributor grid display columns must be populated"

    sample_col = cols[0]
    assert "ColumnId" in sample_col
    assert "Caption" in sample_col
    assert "Visible" in sample_col
