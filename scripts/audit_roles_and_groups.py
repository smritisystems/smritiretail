"""
Comprehensive Audit of Authorization, Roles, Permissions, Groups, and Departments
"""
import psycopg2, json

def audit_db(db_name):
    conn = psycopg2.connect(f'postgresql://postgres:postgres@localhost:5432/{db_name}')
    cur = conn.cursor()
    print(f"\n========================================================")
    print(f" DATABASE AUDIT: {db_name}")
    print(f"========================================================")

    # 1. Check all tables with group, role, perm, dept, auth
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """)
    all_tables = [r[0] for r in cur.fetchall()]
    print(f"Total Base Tables: {len(all_tables)}")

    # 2. Check roles table
    if 'roles' in all_tables:
        cur.execute("SELECT id, name, description, is_system FROM roles ORDER BY name;")
        roles = cur.fetchall()
        print(f"\n--- ROLES TABLE ({len(roles)} rows) ---")
        for r in roles:
            print(f"  ID: {r[0]:<25} | Name: {r[1]:<20} | System: {r[3]} | Desc: {r[2]}")

    # 3. Check smriti_permissions table
    if 'smriti_permissions' in all_tables:
        cur.execute("SELECT COUNT(*) FROM smriti_permissions;")
        cnt = cur.fetchone()[0]
        print(f"\n--- SMRITI_PERMISSIONS TABLE ({cnt} rows) ---")
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'smriti_permissions' ORDER BY ordinal_position;")
        cols = cur.fetchall()
        for c in cols:
            print(f"   Col: {c[0]} ({c[1]})")
        if cnt > 0:
            cur.execute("SELECT * FROM smriti_permissions LIMIT 10;")
            for row in cur.fetchall():
                print(f"   Sample: {row}")

    # 4. Check customer_groups table
    if 'customer_groups' in all_tables:
        cur.execute("SELECT COUNT(*) FROM customer_groups;")
        cnt = cur.fetchone()[0]
        print(f"\n--- CUSTOMER_GROUPS TABLE ({cnt} rows) ---")
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customer_groups' ORDER BY ordinal_position;")
        cols = cur.fetchall()
        for c in cols:
            print(f"   Col: {c[0]} ({c[1]})")
        if cnt > 0:
            cur.execute("SELECT * FROM customer_groups LIMIT 10;")
            for row in cur.fetchall():
                print(f"   Sample: {row}")

    # 5. Check attribute_groups table
    if 'attribute_groups' in all_tables:
        cur.execute("SELECT COUNT(*) FROM attribute_groups;")
        cnt = cur.fetchone()[0]
        print(f"\n--- ATTRIBUTE_GROUPS TABLE ({cnt} rows) ---")
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'attribute_groups' ORDER BY ordinal_position;")
        cols = cur.fetchall()
        for c in cols:
            print(f"   Col: {c[0]} ({c[1]})")
        if cnt > 0:
            cur.execute("SELECT * FROM attribute_groups LIMIT 10;")
            for row in cur.fetchall():
                print(f"   Sample: {row}")

    # 6. Check users table for distinct departments and roles
    if 'users' in all_tables:
        cur.execute("SELECT COUNT(*) FROM users;")
        cnt = cur.fetchone()[0]
        print(f"\n--- USERS TABLE ({cnt} rows) ---")
        cur.execute("SELECT DISTINCT department, role, role_id FROM users;")
        user_combos = cur.fetchall()
        for u in user_combos:
            print(f"   User Dept: {u[0]} | Role: {u[1]} | Role ID: {u[2]}")

    conn.close()

audit_db('smritisys')
audit_db('smriti001')
