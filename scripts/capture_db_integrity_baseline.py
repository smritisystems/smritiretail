"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-10-01
Modified     : 2026-10-01
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""
import os
import sys
import asyncio

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from sqlalchemy import text
from app.db.session import async_session

async def run_baseline_metrics():
    print("=" * 80)
    print("SMRITI RETAIL OS: TRANSACTION LIFECYCLE DATABASE INTEGRITY BASELINE")
    print("=" * 80)

    async with async_session() as s:
        # Check tables existence first
        r_tables = await s.execute(text("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('purchase_orders', 'goods_receipt_notes', 'purchase_bills', 'approval_requests', 'approval_actions', 'approval_policies', 'workflow_events', 'workflow_definitions');
        """))
        tables = set(row[0] for row in r_tables.fetchall())
        print("Existing Target Tables:", sorted(list(tables)))

        # 1. Purchase Orders count
        r_po = await s.execute(text("SELECT count(*) FROM purchase_orders;"))
        po_count = r_po.scalar()
        print(f"1. Total Purchase Orders: {po_count}")

        # PO breakdown by status and is_deleted
        r_po_status = await s.execute(text("SELECT status, is_deleted, count(*) FROM purchase_orders GROUP BY status, is_deleted ORDER BY status, is_deleted;"))
        print("   PO Status & Soft-Delete Breakdown:")
        for row in r_po_status.fetchall():
            print(f"   - status={row[0]}, is_deleted={row[1]}: {row[2]}")

        # 2. GRN count
        if "goods_receipt_notes" in tables:
            r_grn = await s.execute(text("SELECT count(*) FROM goods_receipt_notes;"))
            print(f"2. Total Goods Receipt Notes (GRN): {r_grn.scalar()}")
            r_grn_status = await s.execute(text("SELECT status, count(*) FROM goods_receipt_notes GROUP BY status;"))
            for row in r_grn_status.fetchall():
                print(f"   - status={row[0]}: {row[1]}")
        else:
            print("2. goods_receipt_notes table: NOT PRESENT")

        # 3. Purchase Bill count
        if "purchase_bills" in tables:
            r_pb = await s.execute(text("SELECT count(*) FROM purchase_bills;"))
            print(f"3. Total Purchase Bills: {r_pb.scalar()}")
        else:
            print("3. purchase_bills table: NOT PRESENT (Checking alternative schema/tables...)")

        # 4. Cancelled records with is_deleted=true (Legacy defects)
        r_cancel_del = await s.execute(text("SELECT count(*) FROM purchase_orders WHERE status = 'CANCELLED' AND is_deleted = true;"))
        print(f"4. Cancelled POs with legacy is_deleted=true: {r_cancel_del.scalar()}")

        # 5. Cancelled records with is_deleted=false (Correct lifecycle state)
        r_cancel_nodel = await s.execute(text("SELECT count(*) FROM purchase_orders WHERE status = 'CANCELLED' AND is_deleted = false;"))
        print(f"5. Cancelled POs with is_deleted=false: {r_cancel_nodel.scalar()}")

        # 6. Amended records with broken parent links
        r_broken_parent = await s.execute(text("""
            SELECT count(*) FROM purchase_orders p 
            WHERE p.parent_order_id IS NOT NULL 
            AND NOT EXISTS (SELECT 1 FROM purchase_orders parent WHERE parent.id = p.parent_order_id);
        """))
        print(f"6. Amended POs with broken parent_order_id: {r_broken_parent.scalar()}")

        # 7. Duplicate order_no per company
        r_dup_no = await s.execute(text("""
            SELECT company_id, order_no, count(*) 
            FROM purchase_orders 
            GROUP BY company_id, order_no 
            HAVING count(*) > 1;
        """))
        dups = r_dup_no.fetchall()
        print(f"7. Duplicate order_no per company count: {len(dups)}")

        # 8. Workflow Events
        if "workflow_events" in tables:
            r_wf = await s.execute(text("SELECT count(*) FROM workflow_events;"))
            print(f"8. Total Workflow Events: {r_wf.scalar()}")
            r_wf_states = await s.execute(text("SELECT from_status, to_status, count(*) FROM workflow_events GROUP BY from_status, to_status;"))
            print("   Workflow Events Transitions Breakdown:")
            for row in r_wf_states.fetchall():
                print(f"   - {row[0]} -> {row[1]}: {row[2]}")

        # 9. Approval Policies & Requests
        if "approval_policies" in tables:
            r_pol = await s.execute(text("SELECT count(*) FROM approval_policies;"))
            print(f"9. Total Approval Policies: {r_pol.scalar()}")
            r_pol_rows = await s.execute(text("SELECT id, document_type, min_amount, max_amount, required_role, status FROM approval_policies;"))
            for row in r_pol_rows.fetchall():
                print(f"   - policy: id={row[0]}, doc_type={row[1]}, min={row[2]}, max={row[3]}, role={row[4]}, status={row[5]}")

        if "approval_requests" in tables:
            r_app = await s.execute(text("SELECT count(*) FROM approval_requests;"))
            print(f"10. Total Approval Requests: {r_app.scalar()}")

    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_baseline_metrics())
