"""
Inspect All Roles, Permissions, Groups, and Departments in Database
"""
import psycopg2, json

for db in ['smritisys', 'smriti001']:
    conn = psycopg2.connect(f'postgresql://postgres:postgres@localhost:5432/{db}')
    cur = conn.cursor()
    print(f"\n========================================================")
    print(f" DATABASE: {db}")
    print(f"========================================================")

    # 1. Roles
    try:
        cur.execute("SELECT id, name, description, is_system, is_active, permissions_json FROM roles ORDER BY name;")
        rows = cur.fetchall()
        print(f"\n[ROLES] Total: {len(rows)}")
        for r in rows:
            perms = json.loads(r[5]) if r[5] else []
            print(f"  Role: {r[0]:<25} | Name: {r[1]:<20} | System: {r[3]} | Active: {r[4]} | Perms count: {len(perms)}")
            if len(perms) < 10:
                print(f"    Perms: {perms}")
    except Exception as e:
        print(f"  Error querying roles: {e}")
        conn.rollback()

    # 2. Master Types & Values (Departments / Lookups)
    try:
        cur.execute("""
            SELECT mt.code, mt.label, mv.id, mv.code, mv.name, mv.active, mv.is_deleted
            FROM master_types mt
            JOIN master_values mv ON mt.id = mv.master_type_id
            ORDER BY mt.code, mv.name;
        """)
        rows = cur.fetchall()
        print(f"\n[MASTER VALUES] Total: {len(rows)}")
        for r in rows:
            print(f"  Type: {r[0]:<15} | TypeLabel: {r[1]:<15} | ValueID: {r[2]} | Code: {r[3]:<10} | Name: {r[4]:<25} | Active: {r[5]} | Deleted: {r[6]}")
    except Exception as e:
        print(f"  Error querying master_values: {e}")
        conn.rollback()

    # 3. Customer Groups
    try:
        cur.execute("""
            SELECT id, name, is_active, is_deleted, company_id, branch_id
            FROM customer_groups
            ORDER BY name;
        """)
        rows = cur.fetchall()
        print(f"\n[CUSTOMER GROUPS] Total: {len(rows)}")
        for r in rows:
            print(f"  ID: {r[0]:<25} | Name: {r[1]:<25} | Active: {r[2]} | Deleted: {r[3]} | Company: {r[4]}")
    except Exception as e:
        print(f"  Error querying customer_groups: {e}")
        conn.rollback()

    # 4. Attribute Groups
    try:
        cur.execute("""
            SELECT id, name, is_active, is_deleted, company_id
            FROM attribute_groups
            ORDER BY name;
        """)
        rows = cur.fetchall()
        print(f"\n[ATTRIBUTE GROUPS] Total: {len(rows)}")
        for r in rows:
            print(f"  ID: {r[0]:<25} | Name: {r[1]:<25} | Active: {r[2]} | Deleted: {r[3]} | Company: {r[4]}")
    except Exception as e:
        print(f"  Error querying attribute_groups: {e}")
        conn.rollback()

    # 5. Users and their departments
    try:
        cur.execute("""
            SELECT id, username, email, role, role_id, department, designation, company_id, status, is_active
            FROM users
            ORDER BY username;
        """)
        rows = cur.fetchall()
        print(f"\n[USERS] Total: {len(rows)}")
        for r in rows:
            print(f"  User: {r[1]:<15} | Role: {r[3]:<12} | RoleID: {str(r[4]):<20} | Dept: {str(r[5]):<15} | Desig: {str(r[6]):<15} | Status: {r[8]} | Active: {r[9]}")
    except Exception as e:
        print(f"  Error querying users: {e}")
        conn.rollback()

    conn.close()
