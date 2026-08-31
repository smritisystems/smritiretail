import csv
import os
from scripts.convert_po_5182778158_to_excel import parse_po_pdf, PDF_PATH

items = parse_po_pdf(PDF_PATH)

csv_path = r"F:\Smriti-Clients Data\Tattly Threads\Invoice\Tattly Threads\PO_5182778158_Items_Register.csv"

fieldnames = [
    "sr_no", "article_no", "hsn", "ean", "vendor_art", "description",
    "art_name", "color", "size", "delivery_date", "site", "qty", "uom",
    "mrp", "base_cost", "igst_pct", "igst_amt", "total_base_val", "total_gross_val"
]

with open(csv_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    for it in items:
        writer.writerow(it)

print(f"Saved CSV: {csv_path} ({os.path.getsize(csv_path):,} bytes)")
