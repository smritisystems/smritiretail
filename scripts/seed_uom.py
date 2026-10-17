import psycopg2
import uuid
import json

UOM_VALUES = [
    ("PAIR", "Pair"),
    ("PRS", "PRS"),
    ("PAIRS", "Pairs"),
    ("PCS", "Pcs"),
]

for dbname in ["smritisys", "smriti001", "smriti002", "smriti003"]:
    conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:2781/{dbname}")
    conn.autocommit = True
    cur = conn.cursor()

    cur.execute("SELECT id FROM master_types WHERE code = 'uom';")
    mt = cur.fetchone()
    if not mt:
        continue
    mt_id = mt[0]

    for code, name in UOM_VALUES:
        cur.execute("""
            SELECT id FROM master_values 
            WHERE master_type_id = %s AND (UPPER(code) = %s OR UPPER(name) = %s);
        """, (mt_id, code.upper(), name.upper()))
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO master_values (
                    id, master_type_id, code, name, data, active, is_deleted, updated_at
                ) VALUES (
                    %s, %s, %s, %s, '{}', true, false, NOW()
                );
            """, (str(uuid.uuid4()), mt_id, code, name))
            print(f"[{dbname}] Inserted UOM: {code}")

    conn.close()

print("UOM seeding complete.")
