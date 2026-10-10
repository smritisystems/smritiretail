#!/usr/bin/env python3
"""Verify canonical tables exist in production."""
import psycopg2
import psycopg2.extensions

conn = psycopg2.connect(dbname="smritisys", user="postgres", password="postgres", host="localhost")
conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
cur = conn.cursor()

# Check if canonical tables exist in production
canonical_sample = [
    'crm_leads', 'crm_opportunities', 'approval_policies',
    'distribution_routes', 'distribution_settlements', 'loading_sheets',
    'ecom_channels', 'party_addresses', 'platform_capabilities'
]

cur.execute("""
SELECT table_name FROM information_schema.tables 
WHERE table_schema='public' AND table_name = ANY(%s)
ORDER BY table_name
""", (canonical_sample,))

result = cur.fetchall()
print(f"✓ Production smritisys ALREADY HAS {len(result)}/{len(canonical_sample)} canonical tables:")
for row in result:
    print(f"  ✓ {row[0]}")

cur.close()
conn.close()
