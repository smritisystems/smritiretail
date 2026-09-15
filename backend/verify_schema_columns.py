"""
Inspect is_tax_inclusive column metadata across products, items, item_variants via psycopg2.
"""
import psycopg2

def inspect():
    conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smriti001")
    cur = conn.cursor()
    cur.execute("""
        SELECT table_name, column_name, data_type, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name IN ('products', 'items', 'item_variants') 
          AND column_name = 'is_tax_inclusive' 
        ORDER BY table_name;
    """)
    rows = cur.fetchall()
    print("--- SCHEMA VERIFICATION RESULTS ---")
    for row in rows:
        print(f"Table: {row[0]} | Column: {row[1]} | Type: {row[2]} | Nullable: {row[3]} | Default: {row[4]}")
    print("--- END SCHEMA VERIFICATION ---")
    cur.close()
    conn.close()

if __name__ == "__main__":
    inspect()
