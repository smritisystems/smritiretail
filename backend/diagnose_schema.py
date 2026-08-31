import psycopg2
import sys

DBs = ['smritisys', 'smriti001']

for db_name in DBs:
    try:
        conn = psycopg2.connect(f'postgresql://postgres:postgres@localhost:5432/{db_name}')
        cur = conn.cursor()
        
        # Check if companies table exists
        cur.execute("SELECT to_regclass('public.companies');")
        if cur.fetchone()[0]:
            # Check if company_code column exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name='companies' AND column_name='company_code'
                );
            """)
            has_column = cur.fetchone()[0]
            
            # Check alembic_version
            cur.execute("SELECT version_num FROM alembic_version LIMIT 1;")
            alembic_row = cur.fetchone()
            alembic_ver = alembic_row[0] if alembic_row else "NONE"
            
            print(f"{db_name}: companies.company_code={'EXISTS' if has_column else 'MISSING'} | Alembic={alembic_ver}")
        else:
            print(f"{db_name}: companies table DOES NOT EXIST")
        
        conn.close()
    except Exception as e:
        print(f"{db_name}: ERROR - {e}")
