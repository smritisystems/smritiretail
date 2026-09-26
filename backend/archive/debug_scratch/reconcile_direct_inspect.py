from sqlalchemy import text, create_engine, inspect
from sqlalchemy.pool import NullPool

# Connect to fresh test DB directly using sync engine
url = 'postgresql://postgres:postgres@localhost:5432/smriti_diag_fresh_test'
engine = create_engine(url, poolclass=NullPool)

print("FRESH TEST DATABASE DIRECT INSPECTION:")
print("=" * 70)

inspector = inspect(engine)
tables = inspector.get_table_names()

print(f"Table count: {len(tables)}")
print()

if len(tables) == 0:
    print("NO TABLES FOUND!")
    print()
    print("Checking if alembic_version table exists...")
    with engine.connect() as conn:
        try:
            result = conn.execute(text("SELECT * FROM alembic_version;"))
            versions = result.fetchall()
            print(f"alembic_version rows: {len(versions)}")
            for row in versions:
                print(f"  {row}")
        except Exception as e:
            print(f"ERROR: {str(e)[:100]}")
else:
    print("Tables in fresh test database:")
    for table in sorted(tables):
        print(f"  - {table}")

engine.dispose()
