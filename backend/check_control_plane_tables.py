import psycopg2

for db_name in ['smritisys', 'smriti001']:
    try:
        conn = psycopg2.connect(f'postgresql://postgres:postgres@localhost:5432/{db_name}')
        cur = conn.cursor()
        
        # Check if smriti_menus table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name='smriti_menus'
            );
        """)
        has_menus = cur.fetchone()[0]
        
        # Check if smriti_permissions table exists  
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name='smriti_permissions'
            );
        """)
        has_perms = cur.fetchone()[0]
        
        # Check if control_psv_configs table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_name='control_psv_configs'
            );
        """)
        has_psv = cur.fetchone()[0]
        
        print(f'{db_name}:')
        print(f'  smriti_menus: {"EXISTS" if has_menus else "MISSING"}')
        print(f'  smriti_permissions: {"EXISTS" if has_perms else "MISSING"}')
        print(f'  control_psv_configs: {"EXISTS" if has_psv else "MISSING"}')
        print()
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f'{db_name}: ERROR - {e}')
