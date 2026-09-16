import os
import socket
import sys
import psycopg2

TARGET_DB = "smritisys"
HOST = "localhost"
PORT = 5432
USER = "postgres"
PASSWORD = "postgres"

print(f"host={HOST}")
print(f"port={PORT}")
print(f"database={TARGET_DB}")
print("environment=disposable/local test")

conn = psycopg2.connect(dbname="postgres", user=USER, password=PASSWORD, host=HOST, port=PORT)
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT datname FROM pg_database WHERE datname = %s", (TARGET_DB,))
exists = cur.fetchone() is not None
print(f"target_exists={exists}")
if not exists:
    print("TARGET_DATABASE_NOT_FOUND")
    cur.close(); conn.close(); sys.exit(1)

# Safety guard: this script is only for the disposable local validation DB.
if HOST != "localhost" or os.environ.get("USERPROFILE", "").lower() == "":
    print("TARGET_DATABASE_NOT_SAFE_FOR_REBUILD")
    cur.close(); conn.close(); sys.exit(2)

# Terminate existing connections to the target DB before drop.
cur.execute(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %s AND pid <> pg_backend_pid();",
    (TARGET_DB,),
)

cur.execute(f"DROP DATABASE IF EXISTS \"{TARGET_DB}\" WITH (FORCE);")
cur.execute(f"CREATE DATABASE \"{TARGET_DB}\";")
print(f"database_reset={TARGET_DB}")
cur.close(); conn.close()
