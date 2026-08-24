"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.16.0
Created      : 2026-08-23
Modified     : 2026-08-23
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def apply():
    conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()
    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_shifts_active_per_register ON shifts (company_id, register_id) WHERE (status = 'OPEN' AND is_deleted = false);")
    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_sct_idempotency ON shift_cash_transactions (company_id, shift_id, idempotency_key) WHERE (idempotency_key IS NOT NULL AND is_deleted = false);")
    print("Unique indexes applied successfully to smriti001.")
    cur.close()
    conn.close()

if __name__ == "__main__":
    apply()
