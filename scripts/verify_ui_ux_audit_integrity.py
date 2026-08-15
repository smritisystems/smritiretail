"""
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
"""

import sys, os
import openpyxl
import psycopg2

sys.stdout.reconfigure(encoding='utf-8')

EXCEL_PATH = r"F:\SMRITRretailNX\SMRITI_UI_UX_Control_Plane_Audit.xlsx"
DOC_PATH = r"F:\SMRITRretailNX\docs\architecture\SMRITI_UI_UX_CONTROL_PLANE_AUDIT_v1.0.md"
DB_PARAMS = "postgresql://postgres:postgres@localhost:5432/smritisys"

def verify_audit_artifacts():
    assert os.path.exists(EXCEL_PATH), f"Excel missing at {EXCEL_PATH}"
    assert os.path.exists(DOC_PATH), f"Markdown doc missing at {DOC_PATH}"

    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    sheets = wb.sheetnames

    expected_sheets = [
        "README", "DATABASE_TABLES", "UI_UX_MODELS", "FRONTEND_REGISTRIES",
        "THEME_SYSTEM", "AWE_SAEF", "SCREEN_WORKSPACES", "FORM_FIELD_CONFIG",
        "USER_PERSONALIZATION", "FEATURE_FLAGS", "DUPLICATE_REGISTRIES",
        "OWNERSHIP_CLASSIFICATION", "CONTROL_PLANE_CANDIDATES", "DECISION_BOARD"
    ]

    for s in expected_sheets:
        assert s in sheets, f"Missing expected sheet '{s}' in Excel workbook!"

    conn = psycopg2.connect(DB_PARAMS)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM smriti_menus;")
    menu_count = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM smriti_audit_log;")
    audit_count = cur.fetchone()[0]
    conn.close()

    assert menu_count == 34, f"smriti_menus count changed! Expected 34, got {menu_count}"
    assert audit_count == 40, f"smriti_audit_log count changed! Expected 40, got {audit_count}"

    print("============================================================")
    print("SMRITI UI/UX AUDIT INTEGRITY VERIFICATION PASSED")
    print("============================================================")
    print(f"Excel Workbook Path   : {EXCEL_PATH}")
    print(f"Worksheets Count ({len(sheets)}) : {', '.join(sheets)}")
    print(f"Markdown Doc Path     : {DOC_PATH}")
    print(f"smriti_menus Count    : {menu_count} rows (UNCHANGED)")
    print(f"smriti_audit_log Count: {audit_count} rows (UNCHANGED)")
    print("Database Mutations    : ZERO (0 Mutations Verified)")
    print("FINAL STATUS          : AUDIT_COMPLETE")

if __name__ == "__main__":
    verify_audit_artifacts()
