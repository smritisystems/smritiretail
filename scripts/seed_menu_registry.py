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

import sys, re, uuid, psycopg2

sys.stdout.reconfigure(encoding='utf-8')

def run_seed():
    with open(r"F:\SMRITRretailNX\src\layout_engine\layout_store.tsx", "r", encoding="utf-8") as f:
        content = f.read()

    # Match multiline object blocks: { id: "...", label: "...", icon: "...", category: "..." }
    pattern = r'\{\s*id:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*icon:\s*"([^"]+)",\s*category:\s*"([^"]+)",?\s*\}'
    matches = re.findall(pattern, content, re.MULTILINE | re.DOTALL)
    print(f"Extracted {len(matches)} registered workspaces from layout_store.tsx.")

    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
    cur = conn.cursor()

    seq = 10
    inserted = 0
    updated = 0

    for m in matches:
        ws_id, label, icon, category = m[0].strip(), m[1].strip(), m[2].strip(), m[3].strip()
        menu_id = f"menu-{ws_id}"
        route = f"/{ws_id}"

        # Check existing row
        cur.execute("SELECT id, title FROM smriti_menus WHERE id = %s OR route = %s;", (menu_id, route))
        row = cur.fetchone()

        if row:
            # Update icon, module, sequence without overwriting custom permissions
            cur.execute("""
                UPDATE smriti_menus
                SET icon = %s, module = %s, is_active = true, modified_at = NOW()
                WHERE id = %s;
            """, (icon, category, row[0]))
            updated += 1
        else:
            cur.execute("""
                INSERT INTO smriti_menus (
                    id, uuid, title, route, icon, module, permission, sequence, parent_id,
                    is_active, is_deleted, created_at, modified_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, NULL, %s, NULL, true, false, NOW(), NOW());
            """, (menu_id, str(uuid.uuid4()), label, route, icon, category, seq))
            seq += 10
            inserted += 1

    conn.commit()
    cur.execute("SELECT COUNT(*) FROM smriti_menus;")
    total = cur.fetchone()[0]
    conn.close()

    print(f"✅ Menu Seed Completed: Inserted={inserted}, Updated={updated}, Total Rows in smriti_menus={total}")

if __name__ == "__main__":
    run_seed()
