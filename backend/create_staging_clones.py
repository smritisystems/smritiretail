#!/usr/bin/env python
"""
Create staging database clones using subprocess isolation.
Each operation happens in a fresh process to avoid session conflicts.
"""

import psycopg2
import subprocess
import time
import sys

POSTGRES_CREDS = {
    'user': 'postgres',
    'password': 'postgres',
    'host': 'localhost',
    'port': 5432
}

PROD_SOURCES = [('smritisys', 'smritisys_stage'), ('smriti001', 'smriti001_stage')]

def aggressive_terminate():
    """Use subprocess to terminate all sessions in a clean process."""
    script = """
import psycopg2
import time

creds = {
    'user': 'postgres',
    'password': 'postgres',
    'host': 'localhost',
    'port': 5432
}

conn = psycopg2.connect(dbname='postgres', **creds)
conn.autocommit = True
cur = conn.cursor()

# Kill ALL non-postgres connections
for attempt in range(5):
    cur.execute(
        "SELECT COUNT(*) FROM pg_stat_activity "
        "WHERE datname IN ('smritisys', 'smriti001') "
        "AND pid <> pg_backend_pid() "
        "AND usename <> 'postgres'"
    )
    
    count_before = cur.fetchone()[0]
    
    if count_before == 0:
        print(f'No sessions to terminate (attempt {attempt+1})')
        break
    
    print(f'Terminating {count_before} sessions (attempt {attempt+1})')
    
    cur.execute(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
        "WHERE datname IN ('smritisys', 'smriti001') "
        "AND pid <> pg_backend_pid() "
        "AND usename <> 'postgres'"
    )
    
    terminated = len(cur.fetchall())
    print(f'  Sent termination to {terminated} sessions')
    
    time.sleep(0.5)

cur.close()
conn.close()
print('Termination process complete')
"""
    
    print('Running aggressive session termination...')
    result = subprocess.run([sys.executable, '-c', script], capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print('STDERR:', result.stderr)
    return result.returncode == 0

def clone_database(src, dst):
    """Create a clone in a fresh subprocess."""
    script = f"""
import psycopg2

creds = {{
    'user': 'postgres',
    'password': 'postgres',
    'host': 'localhost',
    'port': 5432
}}

try:
    conn = psycopg2.connect(dbname='postgres', **creds)
    conn.autocommit = True
    cur = conn.cursor()
    
    print('Dropping existing {dst}...')
    cur.execute(f'DROP DATABASE IF EXISTS "{dst}" WITH (FORCE)')
    
    print('Creating {dst} from {src}...')
    cur.execute(f'CREATE DATABASE "{dst}" WITH TEMPLATE "{src}"')
    
    print('Verifying {dst}...')
    cur.execute(f"SELECT datname, pg_database_size(datname) FROM pg_database WHERE datname = '{dst}'")
    result = cur.fetchone()
    if result:
        print(f'SUCCESS: {dst} created, size={{result[1]}} bytes')
    else:
        print(f'ERROR: {dst} not found after creation')
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f'ERROR cloning {src} -> {dst}: {{e}}')
    raise
"""
    
    print(f'Cloning {src} → {dst}...')
    result = subprocess.run([sys.executable, '-c', script], capture_output=True, text=True, timeout=60)
    print(result.stdout)
    if result.stderr:
        print('STDERR:', result.stderr)
    return result.returncode == 0

def main():
    print('=' * 70)
    print('DATABASE CLONING (STAGING RECONCILIATION)')
    print('=' * 70)
    
    # Step 1: Aggressive termination
    if not aggressive_terminate():
        print('WARNING: Termination process reported an error')
        return False
    
    print('\nWaiting 2 seconds for connections to fully close...')
    time.sleep(2)
    
    # Step 2: Clone each database
    all_success = True
    for src, dst in PROD_SOURCES:
        if clone_database(src, dst):
            print(f'✓ {dst} created successfully\n')
        else:
            print(f'✗ Failed to create {dst}\n')
            all_success = False
    
    print('=' * 70)
    return all_success

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
