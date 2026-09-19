"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 6.34.1
Created      : 2026-09-18
Modified     : 2026-09-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(".env")
db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("DATABASE_URL not found")
    exit(1)

conn = psycopg2.connect(db_url)
cur = conn.cursor()

# 1. Verify tables
tables = [
    "smriti_identity_registry",
    "smriti_numbering_registry",
    "smriti_identity_alias",
    "smriti_identity_allocation_log",
]

print("=== SMRITI CONTROL PLANE TABLE VERIFICATION ===")
for tbl in tables:
    cur.execute(
        """
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = %s
        ORDER BY ordinal_position
        """,
        (tbl,),
    )
    cols = cur.fetchall()
    print(f"\nTable: {tbl} ({len(cols)} columns)")
    for col in cols:
        print(f"  - {col[0]}: {col[1]} (nullable={col[2]}, default={col[3]})")

print("\n=== SEEDED IDENTITY REGISTRY ENTITIES ===")
cur.execute(
    "SELECT entity_type, entity_code, group_code, identity_code_prefix, database_table, system_id_strategy FROM smriti_identity_registry ORDER BY group_code, entity_type"
)
for r in cur.fetchall():
    print(f"  {r[0]:<15} code={r[1]:<5} group={r[2]:<5} prefix={r[3]:<10} table={r[4]:<20} strategy={r[5]}")

print("\n=== SEEDED NUMBERING REGISTRY SEQUENCES ===")
cur.execute(
    "SELECT entity_type, group_code, prefix, sequence_value, scope, reset_policy FROM smriti_numbering_registry ORDER BY group_code, entity_type"
)
for r in cur.fetchall():
    print(f"  {r[0]:<15} group={r[1]:<5} prefix={r[2]:<10} seq={r[3]:<5} scope={r[4]:<10} reset={r[5]}")

# Verify indexes
print("\n=== INDEXES VERIFICATION ===")
cur.execute(
    """
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE tablename IN ('smriti_identity_registry', 'smriti_numbering_registry', 'smriti_identity_alias', 'smriti_identity_allocation_logs')
    ORDER BY tablename, indexname
    """
)
for r in cur.fetchall():
    print(f"  {r[0]} -> {r[1]}: {r[2]}")

conn.close()
print("\n=== ALL VERIFICATION QUERIES COMPLETED CLEANLY ===")
