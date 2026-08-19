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

import os
import sys
import io
from decimal import Decimal

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, os.path.abspath("backend"))
from app.services.invoice_pdf_service import number_to_indian_words

raw_data = """
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

def compute_invoices():
    lines = [l.strip() for l in raw_data.strip().split("\n") if l.strip()]
    from collections import defaultdict
    grouped = defaultdict(list)
    
    for l in lines:
        parts = l.split("\t")
        sis, art, color, mrp, s36, s37, s38, s39, s40, s41, s42, tot = parts[:12]
        mrp_dec = Decimal(mrp)
        sizes = [
            (36, int(s36)), (37, int(s37)), (38, int(s38)),
            (39, int(s39)), (40, int(s40)), (41, int(s41)), (42, int(s42))
        ]
        unit_rate = (mrp_dec * Decimal("0.5624")).quantize(Decimal("0.01"))
        
        for sz, q in sizes:
            if q > 0:
                tx = (Decimal(q) * unit_rate).quantize(Decimal("0.01"))
                ig = (tx * Decimal("0.05")).quantize(Decimal("0.01"))
                tot_amt = tx + ig
                sku = f"{art}-{color}-{sz}".upper().replace(" ", "")
                name = f"{art} {color} {sz}".upper()
                grouped[sis].append({
                    "sku": sku,
                    "name": name,
                    "article": art,
                    "color": color,
                    "size": sz,
                    "qty": q,
                    "mrp": mrp_dec,
                    "disc_pct": Decimal("43.7600"),
                    "rate": unit_rate,
                    "taxable_value": tx,
                    "gst_rate": Decimal("5.00"),
                    "igst_amount": ig,
                    "total_amount": tot_amt,
                    "hsn_code": "64041990"
                })
                
    # Invoice config
    sis_order = [
        ("TUK5", 104, "5182778198", "Reliance Retail Limited (RRL TF CMR MALL)", "ANDHRA PRADESH", "37AABCR1718E1ZO",
         "First Floor China Gantyada Vlg & Mandal Nh 5 Road Gajuwaka Greater Vishakhpatnam Municipal Corporation Area VIZAG, Andhra Pradesh - 530020",
         "NO 62/2,RIL BUILIDING\nRICHMOND ROAD,\nBANGALORE- 560025 Karnataka, INDIA"),
        
        ("TYAC", 105, "5182778209", "Reliance Retail Limited (RRL TF MB HABITAT MALL)", "KARNATAKA", "29AABCR1718E1ZL",
         "B M Habitat Mall Shop No F 6 F 7And F7A No22/B Vinoba Road Jayalakshmipuram Mysore MYSORE, Karnataka - 570012",
         "NO 62/2,RIL BUILIDING\nRICHMOND ROAD,\nBANGALORE- 560025 Karnataka, INDIA"),
        
        ("TW07", 106, "PO-PENDING", "Reliance Retail Limited (PRESTIGE- COMMERCIAL STREET)", "KARNATAKA", "29AABCR1718E1ZL",
         "PRESTIGE- COMMERCIAL STREET, Commercial Street, BANGALORE, Karnataka - 560001",
         "NO 62/2,RIL BUILIDING\nRICHMOND ROAD,\nBANGALORE- 560025 Karnataka, INDIA")
    ]
    
    for sis, seq, po, site_name, state, gstin, ship_addr, bill_addr in sis_order:
        items = grouped[sis]
        inv_no = f"TT2026-2027/{seq}"
        tot_qty = sum(it["qty"] for it in items)
        tot_taxable = sum(it["taxable_value"] for it in items)
        tot_igst = (tot_taxable * Decimal("0.05")).quantize(Decimal("0.01"))
        pre_round = tot_taxable + tot_igst
        grand_total = Decimal(round(pre_round))
        round_adj = (grand_total - pre_round).quantize(Decimal("0.0001"))
        amount_words = number_to_indian_words(float(grand_total))
        
        print(f"\n=======================================================")
        print(f"INVOICE: {inv_no} | SIS: {sis} | PO: {po}")
        print(f"Site Name       : {site_name}")
        print(f"State / GSTIN   : {state} / {gstin}")
        print(f"Total Lines     : {len(items)} | Total Pairs: {tot_qty}")
        print(f"Taxable Value   : Rs. {tot_taxable:,.2f}")
        print(f"IGST @ 5%       : Rs. {tot_igst:,.2f}")
        print(f"Rounding Adj    : Rs. {round_adj}")
        print(f"Grand Total     : Rs. {grand_total:,.2f}")
        print(f"Amount in Words : {amount_words}")

if __name__ == "__main__":
    compute_invoices()
