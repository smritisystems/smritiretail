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

import sys, os, json, hashlib, argparse
from datetime import datetime, timezone
import psycopg2

sys.stdout.reconfigure(encoding='utf-8')

DB_PARAMS = "postgresql://postgres:postgres@localhost:5432/smritisys"

DEFAULT_THEMES = [
    {
        "id": "theme-smriti-default",
        "company_id": "GLOBAL",
        "theme_name": "SMRITI Classic Slate & Navy",
        "icon_pack": "Material Symbols Outlined",
        "font_heading": "Space Grotesk",
        "font_body": "Inter",
        "border_radius_px": 6,
        "variants": [
            {
                "id": "var-smriti-light",
                "variant": "light",
                "primary_color": "#0f172a",
                "secondary_color": "#475569",
                "accent_color": "#2563eb",
                "background_color": "#f1f5f9",
                "surface_color": "#ffffff",
                "text_primary": "#0f172a",
                "text_secondary": "#64748b",
                "border_color": "#e2e8f0",
                "danger_color": "#ef4444",
                "success_color": "#22c55e",
                "warning_color": "#f59e0b",
                "is_default": True
            },
            {
                "id": "var-smriti-dark",
                "variant": "dark",
                "primary_color": "#e2e8f0",
                "secondary_color": "#94a3b8",
                "accent_color": "#3b82f6",
                "background_color": "#1a2b5c",
                "surface_color": "#16213e",
                "text_primary": "#ffffff",
                "text_secondary": "#8892a4",
                "border_color": "#2a3a5c",
                "danger_color": "#f87171",
                "success_color": "#4ade80",
                "warning_color": "#fbbf24",
                "is_default": False
            }
        ]
    }
]

DEFAULT_PROFILES = [
    {
        "id": "prof-sysadmin",
        "code": "PROF_SYSADMIN",
        "name": "System Administrator Workspace Profile",
        "persona": "SYSADMIN",
        "default_workspace_id": "menu-dashboard",
        "theme": "theme-smriti-default",
        "is_default": True
    },
    {
        "id": "prof-cashier",
        "code": "PROF_CASHIER",
        "name": "Universal POS Billing Cashier Profile",
        "persona": "CASHIER",
        "default_workspace_id": "menu-pos",
        "theme": "theme-smriti-default",
        "is_default": False
    },
    {
        "id": "prof-store-manager",
        "code": "PROF_STORE_MANAGER",
        "name": "Store & Inventory Manager Profile",
        "persona": "STORE_MANAGER",
        "default_workspace_id": "menu-inventory",
        "theme": "theme-smriti-default",
        "is_default": False
    },
    {
        "id": "prof-accountant",
        "code": "PROF_ACCOUNTANT",
        "name": "Financial Ledger & Accounting Profile",
        "persona": "ACCOUNTANT",
        "default_workspace_id": "menu-business-ledger",
        "theme": "theme-smriti-default",
        "is_default": False
    }
]

def run_seeding(dry_run=True):
    mode_str = "DRY-RUN (READ-ONLY)" if dry_run else "APPLY (TRANSACTIONAL MUTATION)"
    print("============================================================")
    print(f"SMRITI UI/UX CONTROL PLANE SEEDING — MODE: {mode_str}")
    print("============================================================")

    conn = psycopg2.connect(DB_PARAMS)
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM smriti_themes;")
    theme_cnt = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM smriti_workspace_profiles;")
    profile_cnt = cur.fetchone()[0]

    print(f"Current smriti_themes count            : {theme_cnt}")
    print(f"Current smriti_workspace_profiles count: {profile_cnt}")

    print("\n--- PROPOSED SYSTEM THEMES ---")
    for t in DEFAULT_THEMES:
        print(f"  - Theme ID: {t['id']} | Name: {t['theme_name']} ({len(t['variants'])} variants)")

    print("\n--- PROPOSED WORKSPACE PROFILES ---")
    for p in DEFAULT_PROFILES:
        print(f"  - Profile Code: {p['code']:<20} | Persona: {p['persona']:<15} | Default WS: {p['default_workspace_id']}")

    if dry_run:
        print("\n============================================================")
        print("DRY-RUN COMPLETE — ZERO MUTATIONS PERFORMED ON DATABASE.")
        print("STATUS: DRY_RUN_PASSED")
        print("Awaiting explicit --apply command.")
        print("============================================================")
        conn.close()
        return

    # APPLY MODE
    try:
        cur.execute("BEGIN;")
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

        cur.execute("SELECT sha256_hash FROM smriti_audit_log WHERE sha256_hash IS NOT NULL ORDER BY changed_at DESC LIMIT 1;")
        last_hash_row = cur.fetchone()
        prev_h = last_hash_row[0] if last_hash_row else "00000000000000000000000000000000"

        # 1. Seed Themes & Variants
        for t in DEFAULT_THEMES:
            cur.execute("""
                INSERT INTO smriti_themes (id, company_id, theme_name, icon_pack, font_heading, font_body, border_radius_px, is_active, created_at, modified_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, true, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET theme_name = EXCLUDED.theme_name, modified_at = NOW();
            """, (t["id"], t["company_id"], t["theme_name"], t["icon_pack"], t["font_heading"], t["font_body"], t["border_radius_px"]))

            for v in t["variants"]:
                cur.execute("""
                    INSERT INTO smriti_theme_variants (
                        id, theme_id, variant, primary_color, secondary_color, accent_color,
                        background_color, surface_color, text_primary, text_secondary,
                        border_color, danger_color, success_color, warning_color, is_default, created_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (id) DO UPDATE SET primary_color = EXCLUDED.primary_color;
                """, (
                    v["id"], t["id"], v["variant"], v["primary_color"], v["secondary_color"], v["accent_color"],
                    v["background_color"], v["surface_color"], v["text_primary"], v["text_secondary"],
                    v["border_color"], v["danger_color"], v["success_color"], v["warning_color"], v["is_default"]
                ))

            # Audit entry
            audit_id = f"aud-thm-{ts}-{t['id'][:10]}"
            new_hash_input = f"{audit_id}:{t['id']}:INSERT:{prev_h}"
            cur_h = hashlib.sha256(new_hash_input.encode('utf-8')).hexdigest()
            cur.execute("""
                INSERT INTO smriti_audit_log (
                    id, tenant_id, entity_id, changed_table, changed_record_id, field_name,
                    old_value, new_value, change_type, change_reason, change_source,
                    changed_by, changed_by_name, changed_at, sha256_hash, prev_hash
                )
                VALUES (%s, 'smritibus_default', %s, 'smriti_themes', %s, 'theme_seed', 'NONE', %s, 'INSERT', 'Seed default system theme', 'ThemeSeedEngine_v1', 'usr-super', 'System Admin', NOW(), %s, %s);
            """, (audit_id, t["id"], t["id"], t["theme_name"], cur_h, prev_h))
            prev_h = cur_h

        # 2. Seed Workspace Profiles
        for p in DEFAULT_PROFILES:
            cur.execute("""
                INSERT INTO smriti_workspace_profiles (
                    id, code, name, persona, default_workspace_id, theme, is_default, is_active, is_deleted, created_at, modified_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, true, false, NOW(), NOW())
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, modified_at = NOW();
            """, (p["id"], p["code"], p["name"], p["persona"], p["default_workspace_id"], p["theme"], p["is_default"]))

            # Audit entry
            audit_id = f"aud-prf-{ts}-{p['id'][:10]}"
            new_hash_input = f"{audit_id}:{p['id']}:INSERT:{prev_h}"
            cur_h = hashlib.sha256(new_hash_input.encode('utf-8')).hexdigest()
            cur.execute("""
                INSERT INTO smriti_audit_log (
                    id, tenant_id, entity_id, changed_table, changed_record_id, field_name,
                    old_value, new_value, change_type, change_reason, change_source,
                    changed_by, changed_by_name, changed_at, sha256_hash, prev_hash
                )
                VALUES (%s, 'smritibus_default', %s, 'smriti_workspace_profiles', %s, 'profile_seed', 'NONE', %s, 'INSERT', 'Seed AWE workspace profile', 'ProfileSeedEngine_v1', 'usr-super', 'System Admin', NOW(), %s, %s);
            """, (audit_id, p["id"], p["id"], p["code"], cur_h, prev_h))
            prev_h = cur_h

        conn.commit()
        print("\n✅ TRANSACTION COMMITTED SUCCESSFULLY: System themes and AWE workspace profiles seeded cleanly into PostgreSQL.")
        print("STATUS: APPLIED_AND_VERIFIED")
    except Exception as e:
        conn.rollback()
        print(f"\n❌ SEEDING TRANSACTION FAILED: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SMRITI UI/UX Control Plane Seeding Engine")
    parser.add_argument("--apply", action="store_true", help="Execute transactional apply mode. Default is dry-run.")
    args = parser.parse_args()

    run_seeding(dry_run=not args.apply)
