"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.16.0
Created      : 2026-08-19
Modified     : 2026-08-19
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
"""

data = """
TW07	CH-24-G	BLACK	1899	1	1	2	2	1	1	0	8
TW07	CH-24-G	CREAM	1899	1	1	2	2	1	1	0	8
TW07	CH-04-A	BLACK	1899	1	1	2	2	1	1	0	8
TW07	CH-12-C	BRONZE	2399	1	1	2	2	1	1	0	8
TW07	CH-01-A	CREAM	1899	1	1	2	2	1	1	0	8
TW07	CH-01-A	PEACH	1899	1	1	2	2	1	1	0	8
TW07	SND-06-G	BROWN	1899	0	1	2	2	1	1	1	8
TUK5	CH-19-E	CREAM	1599	1	1	2	2	1	1	0	8
TW07	CH-19-E	CREAM	1599	1	1	2	2	1	1	0	8
TYAC	CH-19-E	CREAM	1599	1	1	2	2	1	1	0	8
TUK5	CH-19-E	TAN	1599	1	1	2	2	1	1	0	8
TW07	CH-19-E	TAN	1599	1	1	2	2	1	1	0	8
TYAC	CH-19-E	TAN	1599	1	1	2	2	1	1	0	8
TUK5	SND-05-G	R-GOLD	1899	1	1	2	2	1	1	0	8
TW07	SND-05-G	R-GOLD	1899	1	1	2	2	1	1	0	8
TYAC	SND-05-G	R-GOLD	1899	1	1	2	2	1	1	0	8
TUK5	CH-18-E	BLACK	2099	0	1	2	2	1	1	1	8
TUK5	CH-18-E	BROWN	2099	0	1	2	2	1	1	1	8
TW07	CH-18-E	BLACK	2099	0	1	2	2	1	1	1	8
TW07	CH-18-E	BROWN	2099	0	1	2	2	1	1	1	8
TYAC	CH-18-E	BLACK	2099	0	1	2	2	1	1	1	8
TYAC	CH-18-E	BROWN	2099	0	1	2	2	1	1	1	8
TUK5	CH-12-C	PINK	2399	1	1	2	2	1	1	0	8
TW07	CH-12-C	PINK	2399	1	1	2	2	1	1	0	8
TYAC	CH-12-C	PINK	2399	1	1	2	2	1	1	0	8
TW07	CH-04-A	CREAM	1899	1	1	2	2	1	1	0	8
TYAC	CH-04-A	CREAM	1899	0	1	2	2	1	1	1	8
"""

lines = [l.strip() for l in data.strip().split("\n") if l.strip()]
from collections import defaultdict
grouped = defaultdict(list)

for l in lines:
    parts = l.split("\t")
    if len(parts) >= 12:
        sis, art, color, mrp, s36, s37, s38, s39, s40, s41, s42, tot = parts[:12]
        grouped[sis].append({
            "article": art,
            "color": color,
            "mrp": float(mrp),
            "sizes": {36: int(s36), 37: int(s37), 38: int(s38), 39: int(s39), 40: int(s40), 41: int(s41), 42: int(s42)},
            "total": int(tot)
        })

print("=== SUMMARY OF INVOICES TO BE GENERATED ===")
for sis, items in grouped.items():
    total_qty = sum(it["total"] for it in items)
    total_mrp_val = sum(it["mrp"] * it["total"] for it in items)
    # Discount in Tattly Threads invoices is 43.76% (effective rate factor 0.5624)
    taxable = total_mrp_val * 0.5624
    tax = taxable * 0.05
    grand_total = taxable + tax
    print(f"\nSIS Code: {sis}")
    print(f"  Article lines : {len(items)}")
    print(f"  Total pairs   : {total_qty}")
    print(f"  Total MRP val : Rs. {total_mrp_val:,.2f}")
    print(f"  Est. Taxable  : Rs. {taxable:,.2f}")
    print(f"  Est. Tax (5%) : Rs. {tax:,.2f}")
    print(f"  Est. Grand Tot: Rs. {round(grand_total):,.2f}")
    for it in items:
        size_str = ", ".join([f"{sz}:{q}" for sz, q in it["sizes"].items() if q > 0])
        print(f"    - {it['article']} {it['color']} (MRP {it['mrp']}) -> {it['total']} pairs [{size_str}]")
