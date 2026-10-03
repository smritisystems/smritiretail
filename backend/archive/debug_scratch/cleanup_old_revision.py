import psycopg2
conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smritisys')
cur = conn.cursor()

# Check if old revision exists
cur.execute("SELECT version_num FROM alembic_version WHERE version_num = 'v1390_control_plane_missing_tables'")
old_exists = cur.fetchone() is not None

if old_exists:
    print("⚠️  Old revision found. Cleaning up...")
    cur.execute("DELETE FROM alembic_version WHERE version_num = 'v1390_control_plane_missing_tables'")
    conn.commit()
    print("✅ Old revision deleted")
else:
    print("✅ Old revision not in alembic_version (transaction was rolled back)")

# Show current state
cur.execute("SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 3")
print("\nCurrent Alembic state (last 3):")
for row in cur.fetchall():
    print(f"  {row[0]}")

conn.close()
