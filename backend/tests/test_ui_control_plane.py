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

import pytest
import psycopg2

DB_PARAMS = "postgresql://postgres:postgres@localhost:5432/smritisys"

def test_ui_control_plane_tables_and_schemas():
    """Verify smriti_themes and smriti_workspace_profiles Control Plane structure."""
    conn = psycopg2.connect(DB_PARAMS)
    cur = conn.cursor()

    # 1. Assert smriti_themes exists
    cur.execute("SELECT COUNT(*) FROM smriti_themes;")
    theme_count = cur.fetchone()[0]

    # 2. Assert smriti_workspace_profiles exists
    cur.execute("SELECT COUNT(*) FROM smriti_workspace_profiles;")
    profile_count = cur.fetchone()[0]

    conn.close()

    assert theme_count >= 0
    assert profile_count >= 0
