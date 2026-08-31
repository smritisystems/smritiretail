"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 1.0.0
Created      : 2026-08-25
Modified     : 2026-08-25
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import psycopg2

conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
cur = conn.cursor()

# Check tables
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('shift_cash_transactions', 'accounts', 'chart_of_accounts', 'journal_vouchers');")
tables = [r[0] for r in cur.fetchall()]
print("Existing tables in smriti001:", tables)

if "shift_cash_transactions" in tables:
    cur.execute("""
        SELECT tc.constraint_name, tc.constraint_type, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
        LEFT JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'shift_cash_transactions';
    """)
    print("\nConstraints on shift_cash_transactions:")
    for r in cur.fetchall():
        print(f"  {r[0]} ({r[1]}): {r[2]} -> {r[3]}.{r[4]}")

    # Check orphan counts
    if "accounts" in tables:
        cur.execute("SELECT COUNT(*) FROM shift_cash_transactions sct LEFT JOIN accounts acc ON acc.id = sct.account_id WHERE sct.account_id IS NOT NULL AND acc.id IS NULL;")
        print("Orphan accounts count:", cur.fetchone()[0])
    if "journal_vouchers" in tables:
        cur.execute("SELECT COUNT(*) FROM shift_cash_transactions sct LEFT JOIN journal_vouchers jv ON jv.id = sct.gl_voucher_id WHERE sct.gl_voucher_id IS NOT NULL AND jv.id IS NULL;")
        print("Orphan journal_vouchers count:", cur.fetchone()[0])

conn.close()
