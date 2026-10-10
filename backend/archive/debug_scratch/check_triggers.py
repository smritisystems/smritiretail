#!/usr/bin/env python
"""Check for triggers on products table."""

import asyncio
from app.core.config import settings
from sqlalchemy import text, create_engine

def check_triggers():
    # Convert async URL to sync URL
    db_url = settings.DATABASE_URL.replace('+asyncpg', '')
    engine = create_engine(db_url)
    with engine.connect() as conn:
        sql = """
            SELECT trigger_schema, trigger_name, event_object_table, action_statement
            FROM information_schema.triggers 
            WHERE event_object_table = 'products'
        """
        result = conn.execute(text(sql))
        triggers = result.fetchall()
        if triggers:
            print(f'Found {len(triggers)} trigger(s) on products table:')
            for row in triggers:
                print(f'  Trigger: {row[1]} on {row[0]}.{row[2]}')
                print(f'    Action: {str(row[3])[:500]}')
        else:
            print('No triggers found on products table')

if __name__ == "__main__":
    check_triggers()
