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

import sys, os, json, hashlib, glob
from datetime import datetime, timezone
import psycopg2

sys.stdout.reconfigure(encoding='utf-8')

DB_PARAMS = "postgresql://postgres:postgres@localhost:5432/smritisys"
BACKUP_DIR = r"F:\SMRITRretailNX\scratch\backups"

def run_audited_rollback():
    print("============================================================")
    print("SMRITI MENU GOVERNANCE — HARDENED AUDITED ROLLBACK ENGINE")
    print("============================================================")

    backup_files = glob.glob(os.path.join(BACKUP_DIR, "smriti_menus_backup_*.json"))
    if not backup_files:
        print("❌ FAIL: No backup files found in scratch/backups directory!")
        sys.exit(1)

    latest_backup = max(backup_files, key=os.path.getmtime)
    print(f"Using latest backup file: {latest_backup}")

    with open(latest_backup, "r", encoding="utf-8") as f:
        backup_payload = json.load(f)

    menus_backup = backup_payload["menus_data"]

    conn = psycopg2.connect(DB_PARAMS)
    cur = conn.cursor()

    cur.execute("SELECT sha256_hash FROM smriti_audit_log WHERE sha256_hash IS NOT NULL ORDER BY changed_at DESC LIMIT 1;")
    latest_hash_row = cur.fetchone()
    prev_h = latest_hash_row[0] if latest_hash_row else "00000000000000000000000000000000"

    try:
        cur.execute("BEGIN;")
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        rollback_count = 0

        for menu_id, old_data in menus_backup.items():
            parent_sql = old_data["parent_id"]
            cur.execute("""
                UPDATE smriti_menus
                SET title = %s, module = %s, parent_id = %s, sequence = %s, permission = %s, modified_at = NOW()
                WHERE id = %s;
            """, (old_data["title"], old_data["module"], parent_sql, old_data["sequence"], old_data["permission"], menu_id))

            audit_id = f"aud-rbk-{ts}-{menu_id[:12]}"
            new_hash_input = f"{audit_id}:{menu_id}:ROLLBACK:{prev_h}"
            cur_h = hashlib.sha256(new_hash_input.encode('utf-8')).hexdigest()

            cur.execute("""
                INSERT INTO smriti_audit_log (
                    id, tenant_id, entity_id, changed_table, changed_record_id, field_name,
                    old_value, new_value, change_type, change_reason, change_source,
                    changed_by, changed_by_name, changed_at, sha256_hash, prev_hash
                )
                VALUES (
                    %s, 'smritibus_default', %s, 'smriti_menus', %s, 'menu_governance_rollback',
                    'MIGRATED_STATE', %s, 'ROLLBACK', 'Menu Governance Rollback Execution',
                    'MenuRollbackEngine', 'usr-super', 'System Admin', NOW(), %s, %s
                );
            """, (audit_id, menu_id, menu_id, str(old_data), cur_h, prev_h))

            prev_h = cur_h
            rollback_count += 1

        conn.commit()
        print(f"✅ AUDITED ROLLBACK COMPLETED SUCCESSFULLY: Restored {rollback_count} menu definitions and logged audited rollback entries with SHA256 hashes.")
        print("STATUS: ROLLED_BACK")
    except Exception as e:
        conn.rollback()
        print(f"❌ ROLLBACK FAILED: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    run_audited_rollback()
