"""
PHASE 1: Fresh Database Diagnostic
Create smriti_diag_fresh and prepare for alembic upgrade head test
"""
import psycopg2
import sys

def main():
    try:
        # Test connection to postgres (maintenance db)
        conn = psycopg2.connect(
            host='localhost',
            port=5432,
            user='postgres',
            password='postgres',
            database='postgres'
        )
        conn.autocommit = True
        print("✓ PostgreSQL connectivity confirmed")
        print(f"✓ Host: localhost:5432")
        
        # Check if smriti_diag_fresh exists
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_database WHERE datname = 'smriti_diag_fresh'")
        exists = cur.fetchone() is not None
        
        if exists:
            print("⚠ smriti_diag_fresh already exists; dropping for clean test")
            cur.execute("DROP DATABASE IF EXISTS smriti_diag_fresh")
            print("✓ Dropped existing smriti_diag_fresh")
        
        # Create fresh database
        cur.execute("CREATE DATABASE smriti_diag_fresh")
        print("✓ Created fresh database: smriti_diag_fresh")
        
        cur.close()
        conn.close()
        
        print("\n[PHASE 1] ✓ Database preparation complete")
        print("Next: Run: alembic upgrade head")
        print("       DATABASE_URL=postgresql://postgres:postgres@localhost:5432/smriti_diag_fresh")
        
    except Exception as e:
        print(f"✗ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
