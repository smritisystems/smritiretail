"""
Seed missing footwear master values and ensure vendor codes A-J exist across smritisys and tenant DBs.
"""
import psycopg2
from psycopg2.extras import RealDictCursor
import uuid
import json

NEW_MASTER_VALUES = [
    # (type_code, code, name)
    ("color", "CHIKKU", "CHIKKU"),
    ("color", "R-GOLD", "R-GOLD"),
    ("color", "SULTAN", "SULTAN"),
    ("product_type", "SHOES", "SHOES"),
    ("subcategory", "MUEL", "MUEL"),
    ("heel_type", "WEDGES", "WEDGES"),
    ("upper_material", "MATERIAL", "MATERIAL"),
]

SUPPLIERS = [
    ("A", "Vendor A Footwear"),
    ("B", "Vendor B Footwear"),
    ("C", "Vendor C Footwear"),
    ("D", "Vendor D Footwear"),
    ("E", "Vendor E Footwear"),
    ("F", "Vendor F Footwear"),
    ("G", "Vendor G Footwear"),
    ("H", "Vendor H Footwear"),
    ("I", "Vendor I Footwear"),
    ("J", "Vendor J Footwear"),
]

DBS = ["smritisys", "smriti001", "smriti002", "smriti003"]

def seed_dbs():
    for dbname in DBS:
        print(f"\nSeeding database: {dbname} ...")
        conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:2781/{dbname}")
        conn.autocommit = False
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Find default company_id in this db
        cur.execute("SELECT id FROM companies LIMIT 1;")
        comp = cur.fetchone()
        comp_id = comp["id"] if comp else "COMP-001"

        # 1. Master Values
        for type_code, code, name in NEW_MASTER_VALUES:
            cur.execute("SELECT id FROM master_types WHERE code = %s;", (type_code,))
            mt = cur.fetchone()
            if not mt:
                print(f"[{dbname}] Master type {type_code} not found, skipping.")
                continue
            mt_id = mt["id"]

            cur.execute("""
                SELECT id FROM master_values 
                WHERE master_type_id = %s AND (UPPER(code) = %s OR UPPER(name) = %s);
            """, (mt_id, code.upper(), name.upper()))
            mv = cur.fetchone()
            if not mv:
                cur.execute("""
                    INSERT INTO master_values (
                        id, master_type_id, code, name, data, active, is_deleted, updated_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, true, false, NOW()
                    );
                """, (str(uuid.uuid4()), mt_id, code, name, json.dumps({})))
                print(f"[{dbname}] Inserted master_value: {type_code} -> {code}")
            else:
                print(f"[{dbname}] Already exists: {type_code} -> {code}")

        # 2. Suppliers
        for code, name in SUPPLIERS:
            cur.execute("SELECT id FROM suppliers WHERE UPPER(code) = %s AND is_deleted = false;", (code.upper(),))
            sup = cur.fetchone()
            if not sup:
                cur.execute("""
                    INSERT INTO suppliers (
                        id, uuid, code, name, company_id, outstanding, is_active, is_deleted, created_at, modified_at, version
                    ) VALUES (
                        %s, %s, %s, %s, %s, 0.0, true, false, NOW(), NOW(), 1
                    );
                """, (str(uuid.uuid4()), str(uuid.uuid4()), code, name, comp_id))
                print(f"[{dbname}] Inserted supplier: {code} - {name} (comp_id={comp_id})")
            else:
                print(f"[{dbname}] Supplier already exists: {code}")

        conn.commit()
        conn.close()
        print(f"[{dbname}] Seeding complete.")

if __name__ == "__main__":
    seed_dbs()
