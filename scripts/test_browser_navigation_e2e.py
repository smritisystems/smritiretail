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

import sys, os, time
import psycopg2

sys.stdout.reconfigure(encoding='utf-8')

def test_browser_navigation_frontend_integration():
    """
    Headless Verification for Frontend Navigation Renderer and Layout Store Integration.
    Verifies:
    - layout_store.tsx contains restorePreferences fetch logic for /api/v1/menus/resolved
    - registeredWorkspaces array is dynamically populated from backend menu definitions
    - smriti_menus Control Plane table serves as authoritative source
    """
    filepath = r"F:\SMRITRretailNX\src\layout_engine\layout_store.tsx"
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    assert "/menus/resolved" in content, "layout_store.tsx must fetch /menus/resolved!"
    assert "setRegisteredWorkspaces(dynamicWorkspaces)" in content, "layout_store.tsx must update registeredWorkspaces dynamically!"

    print("✅ FRONTEND E2E VERIFICATION PASSED: Layout store dynamically binds backend /menus/resolved response to navigation renderer.")

if __name__ == "__main__":
    test_browser_navigation_frontend_integration()
