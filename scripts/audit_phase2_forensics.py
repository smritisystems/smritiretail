import asyncio
import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.db.session import engine
from sqlalchemy import text
from app.models.purchase import PurchaseBill

async def run_audit():
    print("=" * 80)
    print("PHASE 2 FORENSIC SCHEMA AUDIT: purchase_bills")
    print("=" * 80)
    
    async with engine.connect() as conn:
        # 1. Columns in information_schema
        res_cols = await conn.execute(text("""
            SELECT 
                column_name, 
                data_type, 
                udt_name,
                character_maximum_length, 
                numeric_precision, 
                numeric_scale, 
                is_nullable, 
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'purchase_bills'
            ORDER BY ordinal_position;
        """))
        db_cols = res_cols.fetchall()
        print(f"Total columns in DB 'purchase_bills': {len(db_cols)}")
        for col in db_cols:
            print(f"  - {col[0]}: {col[1]} ({col[2]}), len={col[3]}, prec={col[4]}, scale={col[5]}, nullable={col[6]}, default={col[7]}")
            
        # 2. Constraints (PK, Unique, FK)
        res_cons = await conn.execute(text("""
            SELECT 
                tc.constraint_name, 
                tc.constraint_type, 
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            LEFT JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            WHERE tc.table_schema = 'public' AND tc.table_name = 'purchase_bills'
            ORDER BY tc.constraint_type, tc.constraint_name;
        """))
        db_cons = res_cons.fetchall()
        print(f"\nConstraints in DB 'purchase_bills': {len(db_cons)}")
        for con in db_cons:
            print(f"  - {con[0]} ({con[1]}): column={con[2]} -> foreign={con[3]}.{con[4]}")

        # 3. Indexes
        res_idx = await conn.execute(text("""
            SELECT 
                indexname, 
                indexdef 
            FROM pg_indexes 
            WHERE schemaname = 'public' AND tablename = 'purchase_bills'
            ORDER BY indexname;
        """))
        db_indexes = res_idx.fetchall()
        print(f"\nIndexes in DB 'purchase_bills': {len(db_indexes)}")
        for idx in db_indexes:
            print(f"  - {idx[0]}: {idx[1]}")

        # 4. Compare with ORM Model PurchaseBill
        orm_cols = PurchaseBill.__table__.columns
        print(f"\nORM PurchaseBill columns: {len(orm_cols)}")
        db_col_names = {c[0] for c in db_cols}
        orm_col_names = set(orm_cols.keys())
        
        missing_in_db = orm_col_names - db_col_names
        extra_in_db = db_col_names - orm_col_names
        print(f"  Missing in DB: {missing_in_db if missing_in_db else 'NONE (100% Match)'}")
        print(f"  Extra in DB: {extra_in_db if extra_in_db else 'NONE (100% Match)'}")

        # 4b. Check purchase_bill_items in DB & compare with ORM PurchaseBillItem
        from app.models.purchase import PurchaseBillItem
        res_pbi = await conn.execute(text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'purchase_bill_items'
            ORDER BY ordinal_position;
        """))
        pbi_cols = res_pbi.fetchall()
        print(f"\nTotal columns in DB 'purchase_bill_items': {len(pbi_cols)}")
        for col in pbi_cols:
            print(f"  - {col[0]}: {col[1]} (nullable={col[2]})")
        orm_pbi_cols = set(PurchaseBillItem.__table__.columns.keys())
        db_pbi_cols = {c[0] for c in pbi_cols}
        print(f"  Missing in DB: {orm_pbi_cols - db_pbi_cols if orm_pbi_cols - db_pbi_cols else 'NONE (100% Match)'}")
        print(f"  Extra in DB: {db_pbi_cols - orm_pbi_cols if db_pbi_cols - orm_pbi_cols else 'NONE (100% Match)'}")

        # 5. Check Approval Policies in production
        res_ap = await conn.execute(text("""
            SELECT id, company_id, document_type, min_amount, max_amount, required_role, is_active
            FROM approval_policies
            WHERE is_deleted = false
            ORDER BY company_id, document_type, min_amount;
        """))
        ap_rows = res_ap.fetchall()
        print(f"\nProduction Approval Policies in DB: {len(ap_rows)}")
        for ap in ap_rows:
            print(f"  - id={ap[0]}, company={ap[1]}, doc_type={ap[2]}, range=[{ap[3]}, {ap[4]}], role={ap[5]}, active={ap[6]}")

        # 6. Check counts in procurement tables
        res_counts = await conn.execute(text("""
            SELECT 
                (SELECT count(*) FROM purchase_orders) as po_count,
                (SELECT count(*) FROM purchase_receipts) as pr_count,
                (SELECT count(*) FROM goods_receipt_notes) as grn_count,
                (SELECT count(*) FROM purchase_bills) as pb_count,
                (SELECT count(*) FROM workflow_events) as we_count,
                (SELECT count(*) FROM approval_requests) as ar_count;
        """))
        counts = res_counts.fetchone()
        print(f"\nProcurement Record Counts:")
        print(f"  purchase_orders: {counts[0]}")
        print(f"  purchase_receipts: {counts[1]}")
        print(f"  goods_receipt_notes: {counts[2]}")
        print(f"  purchase_bills: {counts[3]}")
        print(f"  workflow_events: {counts[4]}")
        print(f"  approval_requests: {counts[5]}")

if __name__ == "__main__":
    asyncio.run(run_audit())
