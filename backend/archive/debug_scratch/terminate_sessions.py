#!/usr/bin/env python
"""
Force-terminate all sessions on production databases to enable cloning.
Uses multiple strategies to ensure all connections are closed.
"""

import psycopg2
import time
import sys

POSTGRES_CREDS = {
    'user': 'postgres',
    'password': 'postgres',
    'host': 'localhost',
    'port': 5432
}

def terminate_all_connections(target_db, max_attempts=5):
    """Aggressively terminate all connections to a database."""
    
    for attempt in range(max_attempts):
        try:
            # Connect to postgres system database
            conn = psycopg2.connect(
                dbname='postgres',
                user=POSTGRES_CREDS['user'],
                password=POSTGRES_CREDS['password'],
                host=POSTGRES_CREDS['host'],
                port=POSTGRES_CREDS['port']
            )
            conn.autocommit = True
            cur = conn.cursor()

            print(f'\n[Attempt {attempt+1}] Checking {target_db}...')

            # Get current session count
            cur.execute("""
                SELECT COUNT(*) FROM pg_stat_activity
                WHERE datname = %s AND pid <> pg_backend_pid()
            """, (target_db,))
            
            result = cur.fetchone()
            if result is None:
                print(f'  No session info available')
                cur.close()
                conn.close()
                continue
                
            session_count = result[0]
            print(f'  Sessions to terminate: {session_count}')

            if session_count == 0:
                print(f'  ✓ {target_db} ready (no active sessions)')
                cur.close()
                conn.close()
                return True

            # Terminate all sessions
            cur.execute("""
                SELECT pg_terminate_backend(pid) FROM pg_stat_activity
                WHERE datname = %s AND pid <> pg_backend_pid()
            """, (target_db,))
            
            # Get termination results
            results = cur.fetchall()
            terminated_count = sum(1 for r in results if r[0])
            print(f'  Terminated: {terminated_count} sessions')

            cur.close()
            conn.close()

            if session_count == 0:
                return True

            # Wait before retrying
            if attempt < max_attempts - 1:
                print(f'  Waiting 1 second before retry...')
                time.sleep(1)

        except Exception as e:
            print(f'  ✗ Error: {e}')
            if attempt < max_attempts - 1:
                time.sleep(1)

    print(f'WARNING: {target_db} may still have active sessions')
    return False

def main():
    print('=' * 70)
    print('FORCE TERMINATE DATABASE SESSIONS')
    print('=' * 70)
    
    for dbname in ['smritisys', 'smriti001']:
        print(f'\nTarget: {dbname}')
        print('-' * 70)
        success = terminate_all_connections(dbname, max_attempts=5)
        if success:
            print(f'✓ {dbname} is ready for cloning')
        else:
            print(f'⚠ {dbname} may still have sessions (proceeding with caution)')

    print('\n' + '=' * 70)
    print('Session termination complete.')
    print('=' * 70)

if __name__ == '__main__':
    main()
