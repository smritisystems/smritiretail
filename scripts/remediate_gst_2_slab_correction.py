"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-09-29
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Compliance Remediation Script

GST 2.0 Slab Correction Script
================================
Effective 22-Sep-2025: India's GST 2.0 rationalisation abolished the 12% slab.

BEFORE (old slabs): {0%, 5%, 12%, 18%}
AFTER  (GST 2.0):   {0%, 5%, 18%, 40%}

This script:
  1. Adds the 40% slab to smritisys.master_values (type=gst_rate)
  2. Soft-retires the 12% slab (marks is_deleted=True, NOT hard-deleted)
  3. Flags any existing items in smriti001 using tax_rate=12% as REQUIRES_REVIEW
     (non-blocking — the same pattern used in legacy_id_mappings)
  4. Does NOT delete any data. Lists flagged items for CA review.

RUN: python scripts/remediate_gst_2_slab_correction.py
"""

import psycopg2
import uuid
from datetime import datetime, timezone

# ─── Connection details ────────────────────────────────────────────────────────
CP_DSN = "postgresql://postgres:postgres@localhost:2781/smritisys"
TENANT_DSN = "postgresql://postgres:postgres@localhost:2781/smriti001"
EFFECTIVE_DATE = "22-Sep-2025"
OPERATOR = "gst_2_remediation_script"


def run():
    print("=" * 68)
    print(" SMRITI GST 2.0 Slab Correction — effective", EFFECTIVE_DATE)
    print("=" * 68)

    # ── Step 1: Update smritisys control-plane master_values ──────────────────
    cp = psycopg2.connect(CP_DSN)
    cp.autocommit = False
    cp_cur = cp.cursor()

    print("\n[1] Checking current gst_rate master_type in smritisys...")
    cp_cur.execute("""
        SELECT id FROM master_types WHERE code = 'gst_rate' LIMIT 1
    """)
    row = cp_cur.fetchone()
    if not row:
        print("  ERROR: master_type 'gst_rate' not found in smritisys. Aborting.")
        cp.rollback(); cp.close()
        return
    gst_type_id = row[0]
    print(f"  master_type 'gst_rate' found: id={gst_type_id}")

    # Fetch existing values
    cp_cur.execute("""
        SELECT id, code, name, is_deleted
        FROM master_values
        WHERE master_type_id = %s
        ORDER BY code
    """, (gst_type_id,))
    existing = cp_cur.fetchall()
    print(f"  Existing gst_rate master_values ({len(existing)}):")
    existing_codes = {}
    for r in existing:
        print(f"    id={r[0]}  code={r[1]}  name={r[2]}  is_deleted={r[3]}")
        existing_codes[r[1]] = {"id": r[0], "is_deleted": r[3]}

    # Retire 12% slab (soft delete — preserve audit trail)
    if "12" in existing_codes and not existing_codes["12"]["is_deleted"]:
        cp_cur.execute("""
            UPDATE master_values
            SET is_deleted = TRUE,
                data = COALESCE(data, '{}'::jsonb) || %s::jsonb
            WHERE id = %s
        """, (
            f'{{"retired_reason": "GST 2.0 effective {EFFECTIVE_DATE}: 12% slab abolished", '
            f'"retired_by": "{OPERATOR}", "retired_at": "{datetime.now(timezone.utc).isoformat()}"}}',
            existing_codes["12"]["id"]
        ))
        print("\n  [RETIRED] 12% slab — soft-deleted (is_deleted=TRUE). Audit trail preserved.")
    elif "12" in existing_codes:
        print("\n  [SKIP] 12% slab already soft-deleted. No action needed.")
    else:
        print("\n  [SKIP] 12% slab not found — nothing to retire.")

    # Add 40% slab if not present
    if "40" not in existing_codes:
        new_id = str(uuid.uuid4())
        cp_cur.execute("""
            INSERT INTO master_values
                (id, master_type_id, company_id, branch_id, code, name,
                 active, sort_order, is_deleted, data, updated_at)
            VALUES
                (%s, %s, NULL, NULL, '40', '40%%',
                 TRUE, 40, FALSE,
                 %s::jsonb, NOW())
        """, (
            new_id, gst_type_id,
            f'{{"source": "GST_2_REMEDIATION", "effective_date": "{EFFECTIVE_DATE}", '
            f'"statutory_basis": "GST 2.0 rationalisation — luxury goods slab", "added_by": "{OPERATOR}"}}'
        ))
        print(f"  [ADDED] 40% slab — id={new_id}")
    else:
        print("  [SKIP] 40% slab already exists.")

    cp.commit()
    print("\n  smritisys gst_rate master_values updated and committed.")

    # Final state
    cp_cur.execute("""
        SELECT code, name, is_deleted FROM master_values
        WHERE master_type_id = %s ORDER BY code
    """, (gst_type_id,))
    print("\n  [VERIFIED] Final gst_rate slabs in smritisys:")
    for r in cp_cur.fetchall():
        status = "RETIRED" if r[2] else "ACTIVE"
        print(f"    {r[0]:>4}%  [{status}]")
    cp_cur.close(); cp.close()

    # ── Step 2: Flag affected items in smriti001 as REQUIRES_REVIEW ───────────
    tenant = psycopg2.connect(TENANT_DSN)
    tenant.autocommit = False
    t_cur = tenant.cursor()

    print("\n[2] Checking items in smriti001 with tax_rate = 12%...")
    t_cur.execute("""
        SELECT id, item_code, item_name, tax_rate, validation_status
        FROM items
        WHERE tax_rate = 12 AND is_deleted IS NOT TRUE
        ORDER BY item_code
    """)
    affected_items = t_cur.fetchall()

    if not affected_items:
        print("  [CLEAN] No active items found with tax_rate = 12%. No flagging required.")
    else:
        print(f"  [FOUND] {len(affected_items)} item(s) using abolished 12% slab:")
        print(f"  {'item_code':<20}  {'item_name':<40}  current_status")
        print(f"  {'-'*20}  {'-'*40}  {'-'*20}")
        for r in affected_items:
            print(f"  {str(r[1]):<20}  {str(r[2]):<40}  {r[4] or 'None'}")

        print(f"\n  Flagging {len(affected_items)} items as REQUIRES_REVIEW...")
        t_cur.execute("""
            UPDATE items
            SET validation_status  = 'REQUIRES_REVIEW',
                validation_message = %s
            WHERE tax_rate = 12
              AND is_deleted IS NOT TRUE
              AND (validation_status IS NULL OR validation_status NOT IN ('REQUIRES_REVIEW', 'BLOCKED'))
        """, (
            f"GST 2.0 ({EFFECTIVE_DATE}): 12% slab abolished. "
            "CA review required — reclassify to 0%, 5%, 18%, or 40%.",
        ))
        flagged_count = t_cur.rowcount
        print(f"  [FLAGGED] {flagged_count} item(s) flagged as REQUIRES_REVIEW.")
        print("  NOTE: tax_rate value NOT changed — CA must decide the correct new slab.")

        tenant.commit()
        print("  smriti001 items updated and committed.")

    t_cur.close(); tenant.close()

    print("\n" + "=" * 68)
    print(" GST 2.0 Slab Correction Complete.")
    print(f" APPROVED SLABS: 0%, 5%, 18%, 40%")
    print(f" RETIRED SLAB:   12% (soft-deleted, audit trail preserved)")
    if affected_items:
        print(f" ACTION REQUIRED: {len(affected_items)} item(s) flagged REQUIRES_REVIEW for CA review")
    print("=" * 68)


if __name__ == "__main__":
    run()
