import psycopg2

conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
cur = conn.cursor()

# Check permission table
cur.execute("SELECT to_regclass('public.smriti_permissions')")
perm_exists = cur.fetchone()[0] is not None
print(f"smriti_permissions: {'EXISTS' if perm_exists else 'MISSING'}")

# Check audit log table
cur.execute("SELECT to_regclass('public.smriti_audit_log')")
audit_exists = cur.fetchone()[0] is not None
print(f"smriti_audit_log: {'EXISTS' if audit_exists else 'MISSING'}")

# Check permission indexes
cur.execute("SELECT indexname FROM pg_indexes WHERE tablename = 'smriti_permissions'")
indexes = [row[0] for row in cur.fetchall()]
print(f"Permission indexes: {len(indexes)}")
for idx in sorted(indexes):
    print(f"  - {idx}")

# Check audit log indexes
cur.execute("SELECT indexname FROM pg_indexes WHERE tablename = 'smriti_audit_log'")
indexes_audit = [row[0] for row in cur.fetchall()]
print(f"Audit log indexes: {len(indexes_audit)}")
for idx in sorted(indexes_audit):
    print(f"  - {idx}")

cur.close(); conn.close()
