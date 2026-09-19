"""
Seed the SMRITISYS control-plane sentinel company and branch into smritisys.
These are required for platform_capabilities and workspace_templates FK constraints.
Run once: python scripts/seed_smritisys_control_sentinel.py
"""
import psycopg2

conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
conn.autocommit = False
cur = conn.cursor()

# Check if SMRITISYS company already exists
cur.execute("SELECT id FROM companies WHERE id = 'SMRITISYS'")
if cur.fetchone() is None:
    cur.execute("""
        INSERT INTO companies (id, uuid, company_code, name, is_active, is_deleted, created_at, modified_at)
        VALUES ('SMRITISYS', 'uuid-smritisys-control-sentinel', 'SMRITISYS', 'SMRITI Control Plane', true, false, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
    """)
    print("INSERTED companies: SMRITISYS")
else:
    print("SKIP companies: SMRITISYS already exists")

cur.execute("SELECT id FROM branches WHERE id = 'SYSTEM'")
if cur.fetchone() is None:
    cur.execute("""
        INSERT INTO branches (id, uuid, company_id, code, name, is_active, is_deleted)
        VALUES ('SYSTEM', 'uuid-system-branch-sentinel', 'SMRITISYS', 'SYSTEM', 'System Branch', true, false)
        ON CONFLICT (id) DO NOTHING
    """)
    print("INSERTED branches: SYSTEM")
else:
    print("SKIP branches: SYSTEM already exists")

conn.commit()
conn.close()
print("Done.")
