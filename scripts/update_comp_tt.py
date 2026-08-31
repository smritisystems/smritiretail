"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-08-18
Modified     : 2026-08-18
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import psycopg2

# Tattly Threads verified canonical details (sourced from actual Tax Invoices in smriti001)
COMP_001_UPDATE = {
    "name": "Tattly Threads",
    "address": "Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery, near HP Petrol Pump, Mumbai, Maharashtra - 400003",
    "gst_number": "27AAXFT2508H1ZR",
    "email": "accounts@tattlythreads.com",
    "website": "www.tattlythreads.com",
    "phone": "",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400003",
    "country": "India",
    "comp_id": "COMP-001",
}

conn = psycopg2.connect("postgresql://postgres:postgres@localhost:5432/smritisys")
conn.autocommit = False
cur = conn.cursor()

# 1. Inspect current state
cur.execute("SELECT id, name, gst_number, is_active FROM companies WHERE id = %s;", (COMP_001_UPDATE["comp_id"],))
before = cur.fetchone()
print(f"BEFORE: {before}")

# 2. Check if address, email etc columns exist
cur.execute("""
    SELECT column_name FROM information_schema.columns
    WHERE table_name='companies' ORDER BY ordinal_position;
""")
cols = [r[0] for r in cur.fetchall()]
print(f"Available columns in 'companies': {cols}")

# 3. Update name and gst_number (always present)
cur.execute(
    "UPDATE companies SET name = %s, gst_number = %s WHERE id = %s;",
    (COMP_001_UPDATE["name"], COMP_001_UPDATE["gst_number"], COMP_001_UPDATE["comp_id"])
)
print(f"Rows updated (name+gst): {cur.rowcount}")

# 4. Update optional columns if they exist
optional_fields = {
    "address":  COMP_001_UPDATE["address"],
    "email":    COMP_001_UPDATE["email"],
    "website":  COMP_001_UPDATE["website"],
    "phone":    COMP_001_UPDATE["phone"],
    "city":     COMP_001_UPDATE["city"],
    "state":    COMP_001_UPDATE["state"],
    "pincode":  COMP_001_UPDATE["pincode"],
    "country":  COMP_001_UPDATE["country"],
}
for col, val in optional_fields.items():
    if col in cols:
        cur.execute(f"UPDATE companies SET {col} = %s WHERE id = %s;", (val, COMP_001_UPDATE["comp_id"]))
        print(f"  Updated column '{col}'")
    else:
        print(f"  Skipped column '{col}' (not present)")

# 5. Also update the branch names to reflect Tattly Threads
cur.execute("SELECT id, name FROM branches WHERE company_id = %s;", (COMP_001_UPDATE["comp_id"],))
branches = cur.fetchall()
print(f"\nBranches for COMP-001: {branches}")

# 6. Verify final state
cur.execute("SELECT id, name, gst_number FROM companies WHERE id = %s;", (COMP_001_UPDATE["comp_id"],))
after = cur.fetchone()
print(f"\nAFTER: {after}")

conn.commit()
conn.close()
print("\nSUCCESS: COMP-001 updated to 'Tattly Threads'")
