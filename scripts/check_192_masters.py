import csv
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path

TSV_PATH = Path(r"f:\SMRITRretailNX\tests\fixtures\smart_import_192_footwear_items.tsv")

def main():
    rows = []
    with open(TSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for r in reader:
            rows.append(r)

    print(f"Total rows in TSV: {len(rows)}")

    # Extract distinct values
    brands = sorted(set(r.get("BRAND NAME", "").strip() for r in rows if r.get("BRAND NAME")))
    colors = sorted(set(r.get("COLOR", "").strip() for r in rows if r.get("COLOR")))
    sizes = sorted(set(r.get("SIZE", "").strip() for r in rows if r.get("SIZE")))
    genders = sorted(set(r.get("GENDER", "").strip() for r in rows if r.get("GENDER")))
    vendors = sorted(set(r.get("VENDOR CODE", "").strip() for r in rows if r.get("VENDOR CODE")))
    departments = sorted(set(r.get("DEPARTMENT", "").strip() for r in rows if r.get("DEPARTMENT")))
    categories = sorted(set(r.get("MERCHANDISE CATEGORY", "").strip() for r in rows if r.get("MERCHANDISE CATEGORY")))
    subcategories = sorted(set(r.get("Sub category", "").strip() for r in rows if r.get("Sub category")))
    heels = sorted(set(r.get("HEELS", "").strip() for r in rows if r.get("HEELS")))
    upper_materials = sorted(set(r.get("UPPER MATERIAL", "").strip() for r in rows if r.get("UPPER MATERIAL")))
    outsoles = sorted(set(r.get("OUTSOLE", "").strip() for r in rows if r.get("OUTSOLE")))

    for dbname in ["smritisys", "smriti001"]:
        print(f"\n==========================================")
        print(f"--- Checking DB: {dbname} ---")
        print(f"==========================================")
        conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:2781/{dbname}")
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT mt.code as type_code, mv.code as val_code, mv.name as val_name
            FROM master_values mv
            JOIN master_types mt ON mt.id = mv.master_type_id
            WHERE mv.is_deleted = false AND mv.active = true;
        """)
        existing_mv = cur.fetchall()
        mv_map = {}
        for mv in existing_mv:
            dtype = mv["type_code"].lower()
            if dtype not in mv_map:
                mv_map[dtype] = set()
            if mv["val_code"]:
                mv_map[dtype].add(mv["val_code"].strip().casefold())
            if mv["val_name"]:
                mv_map[dtype].add(mv["val_name"].strip().casefold())

        dim_checks = {
            "brand": brands,
            "color": colors,
            "size": sizes,
            "gender": genders,
            "department": departments,
            "product_type": categories,
            "subcategory": subcategories,
            "heel_type": heels,
            "upper_material": upper_materials,
            "outsole_material": outsoles,
        }

        for dtype, vals in dim_checks.items():
            existing = mv_map.get(dtype, set())
            missing = [v for v in vals if v.strip().casefold() not in existing]
            if missing:
                print(f"[{dbname}] Missing in {dtype}: {missing}")
            else:
                print(f"[{dbname}] All {len(vals)} values present for {dtype}!")

        # Check suppliers
        try:
            cur.execute("SELECT code, name FROM suppliers WHERE is_deleted = false;")
            suppliers = cur.fetchall()
            supp_codes = {s["code"].strip().upper() for s in suppliers if s["code"]}
            missing_vendors = [v for v in vendors if v.strip().upper() not in supp_codes]
            if missing_vendors:
                print(f"[{dbname}] Missing Suppliers: {missing_vendors}")
            else:
                print(f"[{dbname}] All {len(vendors)} suppliers present: {sorted(supp_codes)}")
        except Exception as e:
            print(f"[{dbname}] Supplier query error: {e}")

        conn.close()

if __name__ == "__main__":
    main()
