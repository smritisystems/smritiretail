import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:2781/postgres")
    dbs = await conn.fetch("SELECT datname FROM pg_database WHERE datname LIKE 'smriti%' ORDER BY datname")
    await conn.close()
    
    print("=== SMRITI DATABASES ALEMBIC VERSION STATUS ===")
    for row in dbs:
        db = row['datname']
        try:
            c = await asyncpg.connect(f"postgresql://postgres:postgres@localhost:2781/{db}")
            has_table = await c.fetchval("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'alembic_version')")
            if has_table:
                vers = await c.fetch("SELECT version_num FROM alembic_version")
                versions = [r["version_num"] for r in vers]
                print(f"Database: {db:15} | Alembic Version(s): {versions}")
            else:
                print(f"Database: {db:15} | No alembic_version table")
            await c.close()
        except Exception as e:
            print(f"Database: {db:15} | Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
