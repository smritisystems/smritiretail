import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def check_db(db_name):
    url = f'postgresql+asyncpg://postgres:postgres@localhost:5432/{db_name}'
    engine = create_async_engine(url)
    try:
        async with engine.begin() as conn:
            # Get HEAD version
            try:
                result = await conn.execute(text("""
                    SELECT version_num FROM alembic_version 
                    ORDER BY version_num DESC LIMIT 1
                """))
                version = result.scalar()
            except:
                version = "TABLE_NOT_FOUND"
            
            # Get table count
            result = await conn.execute(text("""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = 'public'
            """))
            tables = result.scalar()
            
            return {'db': db_name, 'version': version, 'tables': tables}
    except Exception as e:
        return {'db': db_name, 'version': 'CONNECTION_ERROR', 'tables': 0, 'error': str(e)[:100]}
    finally:
        await engine.dispose()

async def main():
    dbs = ['smritisys', 'smriti001', 'smriti_diag_fresh', 'smriti_diag_fresh_test']
    print("DATABASE VERSIONS AND SCHEMA STATUS:")
    print("=" * 70)
    for db_name in dbs:
        result = await check_db(db_name)
        print(f"{result['db']:30} version: {str(result['version']):35} tables: {result['tables']}")
    print()

asyncio.run(main())
