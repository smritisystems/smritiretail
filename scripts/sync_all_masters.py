import psycopg2
from psycopg2.extras import RealDictCursor
import json
import uuid

def sync():
    conn_sys = psycopg2.connect("postgresql://postgres:postgres@localhost:2781/smritisys")
    cur_sys = conn_sys.cursor(cursor_factory=RealDictCursor)

    cur_sys.execute("SELECT * FROM master_types;")
    sys_types = cur_sys.fetchall()

    cur_sys.execute("""
        SELECT mt.code as type_code, mv.*
        FROM master_values mv
        JOIN master_types mt ON mt.id = mv.master_type_id
        WHERE mv.is_deleted = false;
    """)
    sys_vals = cur_sys.fetchall()
    conn_sys.close()

    for dbname in ["smriti001", "smriti002", "smriti003"]:
        conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:2781/{dbname}")
        conn.autocommit = False
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # sync types first
        type_id_map = {}
        for st in sys_types:
            cur.execute("SELECT id FROM master_types WHERE code = %s;", (st["code"],))
            existing_t = cur.fetchone()
            if not existing_t:
                cur.execute("""
                    INSERT INTO master_types (
                        id, code, label, field_schema, ui_schema, used_in_modules, depends_on, version, evidence_level, created_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
                    ) RETURNING id;
                """, (
                    st["id"], st["code"], st["label"],
                    json.dumps(st["field_schema"]) if st["field_schema"] else json.dumps({}),
                    json.dumps(st["ui_schema"]) if st["ui_schema"] else json.dumps({}),
                    st["used_in_modules"] if isinstance(st["used_in_modules"], list) else [],
                    st["depends_on"] if st["depends_on"] and not isinstance(st["depends_on"], (list, dict)) else None,
                    st["version"] or 1, st["evidence_level"] or "VERIFIED"
                ))
                type_id_map[st["code"]] = cur.fetchone()["id"]
            else:
                type_id_map[st["code"]] = existing_t["id"]

        # sync values
        for sv in sys_vals:
            mt_id = type_id_map.get(sv["type_code"])
            if not mt_id:
                continue

            cur.execute("""
                SELECT id FROM master_values
                WHERE master_type_id = %s AND (UPPER(code) = %s OR UPPER(name) = %s);
            """, (mt_id, sv["code"].upper(), sv["name"].upper()))
            if not cur.fetchone():
                data_json = json.dumps(sv["data"]) if sv["data"] else json.dumps({})
                cur.execute("""
                    INSERT INTO master_values (
                        id, master_type_id, code, name, data, active, sort_order, is_deleted, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, false, NOW()
                    );
                """, (str(uuid.uuid4()), mt_id, sv["code"], sv["name"], data_json, sv["active"], sv["sort_order"]))

        conn.commit()
        conn.close()
        print(f"Synced all master_types and master_values to {dbname}")

if __name__ == "__main__":
    sync()
