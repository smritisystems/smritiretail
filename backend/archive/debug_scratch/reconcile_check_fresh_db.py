from sqlalchemy import text, create_engine
from sqlalchemy.pool import NullPool

admin_url = 'postgresql://postgres:postgres@localhost:5432/postgres'
engine = create_engine(admin_url, poolclass=NullPool, isolation_level='AUTOCOMMIT')

print("CHECKING DATABASE EXISTENCE...")
print("=" * 60)

with engine.connect() as conn:
    # Check which databases exist
    result = conn.execute(text("""
        SELECT datname FROM pg_database 
        WHERE datname IN ('smritisys', 'smriti001', 'smriti_diag_fresh', 'smriti_diag_fresh_test')
        ORDER BY datname
    """))
    
    existing = [row[0] for row in result.fetchall()]
    print("Existing databases:")
    for db in existing:
        print(f"  OK {db}")
    
    print()
    print("Non-existent databases:")
    for db in ['smritisys', 'smriti001', 'smriti_diag_fresh', 'smriti_diag_fresh_test']:
        if db not in existing:
            print(f"  MISSING {db}")
    
    # If fresh_test exists, check its tables
    if 'smriti_diag_fresh_test' in existing:
        print()
        print("FRESH TEST DATABASE SCHEMA CHECK:")
        try:
            # Switch context
            conn2 = engine.raw_connection()
            conn2.set_session(autocommit=True)
            cursor = conn2.cursor()
            cursor.execute("""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_catalog = 'smriti_diag_fresh_test'
            """)
            count = cursor.fetchone()[0]
            print(f"  Table count: {count}")
            
            # Check alembic_version
            try:
                cursor.execute("""
                    SELECT version_num FROM smriti_diag_fresh_test.public.alembic_version
                    ORDER BY version_num DESC LIMIT 1
                """)
                version = cursor.fetchone()
                if version:
                    print(f"  Alembic HEAD: {version[0]}")
                else:
                    print("  Alembic HEAD: EMPTY alembic_version TABLE")
            except Exception as e:
                print(f"  Alembic HEAD: ERROR — {str(e)[:60]}")
            
            conn2.close()
        except Exception as e:
            print(f"  Error checking schema: {str(e)[:60]}")

engine.dispose()
