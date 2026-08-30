"""
Final Verification Script for SMRITI Groups by Departments Audit
"""
import psycopg2

conn_sys = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smritisys')
cur_sys = conn_sys.cursor()

conn_tenant = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
cur_tenant = conn_tenant.cursor()

print("=== SMRITI CONTROL PLANE (smritisys) ===")
cur_sys.execute("SELECT count(*) FROM roles;")
print(f"Total roles in smritisys: {cur_sys.fetchone()[0]}")

cur_sys.execute("SELECT count(*) FROM users;")
print(f"Total users in smritisys: {cur_sys.fetchone()[0]}")

print("\n=== SMRITI TENANT PLANE (smriti001) ===")
cur_tenant.execute("SELECT count(*) FROM customer_groups WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL);")
print(f"Active Customer Groups in smriti001: {cur_tenant.fetchone()[0]}")

cur_tenant.execute("SELECT count(*) FROM attribute_groups WHERE is_active = true AND (is_deleted = false OR is_deleted IS NULL);")
print(f"Active Attribute Groups in smriti001: {cur_tenant.fetchone()[0]}")

conn_sys.close()
conn_tenant.close()
