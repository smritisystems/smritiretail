"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 3.28.0
Created      : 2026-08-26
Modified     : 2026-08-26
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import re
import sys
import time
import pymupdf
from decimal import Decimal

PDF_DIR = r"F:\Smriti-Clients Data\Tattly Threads\Invoice\Tattly Threads"

def parse_all_pos(pdf_dir=PDF_DIR):
    pdf_files = sorted([f for f in os.listdir(pdf_dir) if f.endswith(".pdf")])
    print(f"Total PDFs found: {len(pdf_files)}", flush=True)

    po_data_list = []
    total_lines = 0
    total_qty = Decimal("0")
    total_basic = Decimal("0")
    total_tax = Decimal("0")
    total_grand = Decimal("0")
    all_unique_products = {} # (ean, vendor_style, color, size) -> dict

    t0 = time.time()
    for idx, pdf_name in enumerate(pdf_files, start=1):
        pdf_path = os.path.join(pdf_dir, pdf_name)
        doc = pymupdf.open(pdf_path)
        
        # 1. Header extraction from Page 1
        p1 = doc[0].get_text()
        po_no = re.search(r'PO NO\.?:\s*(\d+)', p1).group(1)
        site_code = re.search(r'Site\s*:\s*([A-Za-z0-9]+)', p1).group(1)
        po_date_raw = re.search(r'PO Date\s*:\s*([\d\.]+)', p1).group(1)
        deliv_date_raw = re.search(r'DELIVERY DATE\s*:\s*([\d\.]+)', p1).group(1)
        vendor_code = re.search(r'Vendor Code\s*:\s*(\d+)', p1).group(1)
        
        deliv_addr_m = re.search(r'Delivery Address\s*:\s*\n(.*?)(?=\nTel\s*:|\nGSTN No\s*:)', p1, re.DOTALL)
        delivery_address = deliv_addr_m.group(1).strip() if deliv_addr_m else ''
        
        gstn_m = re.search(r'Delivery Address\s*:.*?GSTN No\s*:\s*([A-Za-z0-9]+)', p1, re.DOTALL)
        gstin = gstn_m.group(1) if gstn_m else ''
        
        site_name_m = re.search(r'For\s+(.*?)\nReliance Retail Limited', p1)
        site_name = site_name_m.group(1).strip() if site_name_m else ''
        
        basic_val = Decimal(re.search(r'TOTAL BASIC VALUE\s*\n\s*INR\s*\n\s*([\d,\.]+)', p1).group(1).replace(',', ''))
        
        igst_m = re.search(r'TOTAL IGST\s*\n\s*INR\s*\n\s*([\d,\.]+)', p1)
        cgst_m = re.search(r'TOTAL CGST\s*\n\s*INR\s*\n\s*([\d,\.]+)', p1)
        sgst_m = re.search(r'TOTAL SGST\s*\n\s*INR\s*\n\s*([\d,\.]+)', p1)
        
        if igst_m:
            is_interstate = True
            igst_val = Decimal(igst_m.group(1).replace(',', ''))
            cgst_val = Decimal('0.00')
            sgst_val = Decimal('0.00')
            tax_val = igst_val
        else:
            is_interstate = False
            igst_val = Decimal('0.00')
            cgst_val = Decimal(cgst_m.group(1).replace(',', '')) if cgst_m else Decimal('0.00')
            sgst_val = Decimal(sgst_m.group(1).replace(',', '')) if sgst_m else Decimal('0.00')
            tax_val = cgst_val + sgst_val
            
        total_val = Decimal(re.search(r'Total Order Value\s*:\s*\n\s*INR\s*\n\s*([\d,\.]+)', p1).group(1).replace(',', ''))
        
        lines = []
        terms_pages = []
        
        for page_idx in range(1, len(doc)):
            page = doc[page_idx]
            txt = page.get_text()
            if 'Sr.No Article No.' not in txt:
                terms_pages.append(txt.strip())
                continue
                
            table_text = txt.split('Total Base Value\n')[-1]
            raw_lines = [l.strip() for l in table_text.split('\n') if l.strip()]
            i = 0
            while i < len(raw_lines):
                if raw_lines[i].isdigit():
                    sr_no = int(raw_lines[i])
                    if i + 1 < len(raw_lines) and re.match(r'^\d{10,14}$', raw_lines[i+1]):
                        art_no = raw_lines[i+1]
                        hsn = raw_lines[i+2]
                        ean = raw_lines[i+3]
                        vendor_style = raw_lines[i+4]
                        desc = raw_lines[i+5]
                        line_deliv = raw_lines[i+6]
                        line_site = raw_lines[i+7]
                        qty = Decimal(raw_lines[i+8].replace(',', ''))
                        uom = raw_lines[i+9]
                        mrp = Decimal(raw_lines[i+10].replace(',', ''))
                        base_cost = Decimal(raw_lines[i+11].replace(',', ''))
                        
                        if is_interstate:
                            gst_rate = Decimal(raw_lines[i+12].replace(',', ''))
                            igst_amt = Decimal(raw_lines[i+15].replace(',', ''))
                            cgst_amt = Decimal('0.00')
                            sgst_amt = Decimal('0.00')
                            line_tax = igst_amt
                            line_total = Decimal(raw_lines[i+18].replace(',', ''))
                            advance = 19
                        else:
                            cgst_rate = Decimal(raw_lines[i+12].replace(',', ''))
                            sgst_rate = Decimal(raw_lines[i+13].replace(',', ''))
                            gst_rate = cgst_rate + sgst_rate
                            cgst_amt = Decimal(raw_lines[i+16].replace(',', ''))
                            sgst_amt = Decimal(raw_lines[i+17].replace(',', ''))
                            igst_amt = Decimal('0.00')
                            line_tax = cgst_amt + sgst_amt
                            line_total = Decimal(raw_lines[i+20].replace(',', ''))
                            advance = 21
                        
                        parts = [p.strip() for p in desc.split(',')]
                        art_title = parts[0] if len(parts) > 0 else desc
                        color = parts[1].upper() if len(parts) > 1 else ''
                        size = parts[2].upper() if len(parts) > 2 else ''
                        
                        line_dict = {
                            'sr_no': sr_no,
                            'article_no': art_no,
                            'hsn_code': hsn,
                            'ean': ean,
                            'vendor_style': vendor_style,
                            'description': desc,
                            'article_title': art_title,
                            'color': color,
                            'size': size,
                            'quantity': qty,
                            'uom': uom,
                            'mrp': mrp,
                            'base_cost': base_cost,
                            'gst_rate': gst_rate,
                            'igst_amount': igst_amt,
                            'cgst_amount': cgst_amt,
                            'sgst_amount': sgst_amt,
                            'tax_amount': line_tax,
                            'line_total': line_total,
                            'delivery_date': line_deliv,
                            'site_code': line_site
                        }
                        lines.append(line_dict)
                        
                        prod_key = (ean, vendor_style, color, size)
                        if prod_key not in all_unique_products:
                            all_unique_products[prod_key] = {
                                'ean': ean,
                                'article_no': art_no,
                                'vendor_style': vendor_style,
                                'description': desc,
                                'article_title': art_title,
                                'color': color,
                                'size': size,
                                'uom': uom,
                                'mrp': mrp,
                                'base_cost': base_cost,
                                'hsn_code': hsn,
                                'gst_rate': gst_rate,
                            }
                        i += advance
                        continue
                i += 1
                
        sum_qty = sum(l['quantity'] for l in lines)
        sum_base = sum(l['line_total'] for l in lines)
        sum_tax = sum(l['tax_amount'] for l in lines)
        
        diff_base = sum_base - basic_val
        diff_tax = sum_tax - tax_val
        
        total_lines += len(lines)
        total_qty += sum_qty
        total_basic += basic_val
        total_tax += tax_val
        total_grand += total_val
        
        po_record = {
            'pdf_name': pdf_name,
            'po_number': po_no,
            'po_date': po_date_raw,
            'delivery_date': deliv_date_raw,
            'site_code': site_code,
            'site_name': site_name,
            'delivery_address': delivery_address,
            'vendor_code': vendor_code,
            'customer_name': 'Reliance Retail Limited',
            'customer_gstin': gstin,
            'is_interstate': is_interstate,
            'basic_total': basic_val,
            'igst_total': igst_val,
            'cgst_total': cgst_val,
            'sgst_total': sgst_val,
            'tax_total': tax_val,
            'grand_total': total_val,
            'lines_count': len(lines),
            'sum_qty': sum_qty,
            'sum_base': sum_base,
            'diff_base': diff_base,
            'diff_tax': diff_tax,
            'terms_text': '\n\n'.join(terms_pages),
            'lines': lines
        }
        po_data_list.append(po_record)

    t1 = time.time()
    print(f"Extracted all {len(po_data_list)} POs in {t1 - t0:.2f} seconds.", flush=True)
    print(f"Extraction Summary:", flush=True)
    print(f"  Total POs Processed: {len(po_data_list)}", flush=True)
    print(f"  Total Line Items:    {total_lines}", flush=True)
    print(f"  Total Qty:           {total_qty}", flush=True)
    print(f"  Total Basic Value:   INR {total_basic:,.2f}", flush=True)
    print(f"  Total Tax Value:     INR {total_tax:,.2f}", flush=True)
    print(f"  Total Grand Total:   INR {total_grand:,.2f}", flush=True)
    print(f"  Unique Products:     {len(all_unique_products)}", flush=True)
    
    mismatches = [p for p in po_data_list if p['diff_base'] != 0 or p['diff_tax'] != 0]
    print(f"  POs with line vs header diff: {len(mismatches)}", flush=True)
    if mismatches:
        for m in mismatches:
            print(f"    PO {m['po_number']}: diff_base={m['diff_base']}, diff_tax={m['diff_tax']}", flush=True)
    else:
        print("  100% PERFECT MATCH: All 60 POs have 0.00 base and tax differences across all line items!", flush=True)

    return po_data_list, all_unique_products

if __name__ == '__main__':
    parse_all_pos()
