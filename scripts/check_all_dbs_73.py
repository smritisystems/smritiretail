"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-08-19
Modified     : 2026-08-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

import psycopg2

for db in ['smriti001', 'smriti002', 'smritisys', 'smriti_test_fresh']:
    try:
        conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{db}")
        cur = conn.cursor()
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%invoice%';")
        tables = [r[0] for r in cur.fetchall()]
        for t in tables:
            try:
                cur.execute(f"SELECT COUNT(*) FROM {t} WHERE invoice_no = 'TT2026-2027/73';")
                cnt = cur.fetchone()[0]
                if cnt > 0:
                    print(f"[{db}] {t} has {cnt} rows for TT2026-2027/73")
            except Exception:
                pass
        conn.close()
    except Exception as e:
        print(f"Error connecting {db}: {e}")
