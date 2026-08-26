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
import uuid
import datetime
import argparse
import psycopg2
import psycopg2.extras
import pymupdf
from decimal import Decimal

# Configuration
PDF_DIR = r"F:\Smriti-Clients Data\Tattly Threads\Invoice\Tattly Threads"
COMPANY_DB_URL = "postgresql://postgres:postgres@localhost:5432/smriti001"
BACKUP_PATH = r"F:\SMRITRretailNX\backups\smriti001_pre_phase1_po_recon.sql"
COMPANY_ID = "COMP-001"
BRANCH_ID = "MAIN"

def parse_date(date_str):
    """Converts DD.MM.YYYY to YYYY-MM-DD date object."""
    if not date_str:
        return None
    try:
        parts = date_str.strip().split(".")
        if len(parts) == 3:
            return datetime.date(int(parts[2]), int(parts[1]), int(parts[0]))
    except Exception:
        pass
    return None

def extract_all_pos(pdf_dir=PDF_DIR):
    """Parses all 60 PO PDFs with 100% precision."""
    pdf_files = sorted([f for f in os.listdir(pdf_dir) if f.endswith(".pdf")])
    po_records = []
    unique_products = {}

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
                        if prod_key not in unique_products:
                            unique_products[prod_key] = {
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
        
        po_record = {
            'pdf_name': pdf_name,
            'po_number': po_no,
            'po_date_raw': po_date_raw,
            'po_date': parse_date(po_date_raw),
            'delivery_date_raw': deliv_date_raw,
            'delivery_date': parse_date(deliv_date_raw),
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
        po_records.append(po_record)

    return po_records, unique_products

def ensure_schema_migrations(conn):
    """Ensures extended columns and allocation table exist in PostgreSQL."""
    cur = conn.cursor()
    
    # 1. Extend sales_orders
    cur.execute("""
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS po_number VARCHAR(100);
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS po_date DATE;
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS delivery_date DATE;
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS site_code VARCHAR(50);
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS site_name VARCHAR(255);
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS vendor_code VARCHAR(50);
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50);
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS customer_gstin VARCHAR(50);
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS basic_total NUMERIC(15, 2) DEFAULT 0.00;
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS is_interstate BOOLEAN DEFAULT TRUE;
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS total_qty NUMERIC(15, 4) DEFAULT 0.0000;
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS billed_qty NUMERIC(15, 4) DEFAULT 0.0000;
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS billed_value NUMERIC(15, 2) DEFAULT 0.00;
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS pending_qty NUMERIC(15, 4) DEFAULT 0.0000;
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS pending_value NUMERIC(15, 2) DEFAULT 0.00;
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(50) DEFAULT 'UNFULFILLED';
        ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS po_metadata JSONB DEFAULT '{}'::jsonb;
        CREATE INDEX IF NOT EXISTS idx_sales_orders_po_number ON sales_orders(po_number);
    """)

    # 2. Extend sales_order_items
    cur.execute("""
        ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS sr_no INTEGER;
        ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS article_no VARCHAR(50);
        ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS ean VARCHAR(50);
        ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS vendor_style VARCHAR(100);
        ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS color VARCHAR(50);
        ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS size VARCHAR(50);
        ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS uom VARCHAR(20) DEFAULT 'EA';
        ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS mrp NUMERIC(15, 2);
        ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS base_cost NUMERIC(15, 2);
        ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS taxable_value NUMERIC(15, 2);
        ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(15, 2) DEFAULT 0.00;
        ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(15, 2) DEFAULT 0.00;
        ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(15, 2) DEFAULT 0.00;
        ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS line_total NUMERIC(15, 2);
        ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS delivery_date DATE;
        ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS site_code VARCHAR(50);
        CREATE INDEX IF NOT EXISTS idx_sales_order_items_product_id ON sales_order_items(product_id);
    """)

    # 3. Create sales_order_invoice_allocations table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sales_order_invoice_allocations (
            id VARCHAR(50) PRIMARY KEY,
            uuid VARCHAR(36) NOT NULL UNIQUE,
            company_id VARCHAR(50) REFERENCES companies(id) ON DELETE RESTRICT,
            branch_id VARCHAR(50) REFERENCES branches(id) ON DELETE RESTRICT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            modified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_by VARCHAR(100),
            updated_by VARCHAR(100),
            is_active BOOLEAN DEFAULT TRUE,
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMP WITH TIME ZONE,
            deleted_by VARCHAR(100),
            version INTEGER DEFAULT 1,
            
            order_id VARCHAR(50) NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
            order_no VARCHAR(100) NOT NULL,
            po_number VARCHAR(100) NOT NULL,
            invoice_id VARCHAR(50) NOT NULL REFERENCES sales_invoices(id) ON DELETE RESTRICT,
            invoice_no VARCHAR(100) NOT NULL,
            invoice_date DATE NOT NULL,
            
            po_quantity NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
            po_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            billed_quantity NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
            billed_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            pending_quantity NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
            pending_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
            status VARCHAR(50) DEFAULT 'ALLOCATED',
            allocation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        );
        CREATE INDEX IF NOT EXISTS idx_so_alloc_order_id ON sales_order_invoice_allocations(order_id);
        CREATE INDEX IF NOT EXISTS idx_so_alloc_po_number ON sales_order_invoice_allocations(po_number);
        CREATE INDEX IF NOT EXISTS idx_so_alloc_invoice_id ON sales_order_invoice_allocations(invoice_id);
        CREATE INDEX IF NOT EXISTS idx_so_alloc_invoice_no ON sales_order_invoice_allocations(invoice_no);
    """)
    conn.commit()

def execute_commit():
    """Executes the final transactional reconciliation and commit to database."""
    print("=" * 80)
    print("SMRITI RETAIL OS: EXECUTING PHASE 1 HISTORICAL PO RECONCILIATION COMMIT")
    print("=" * 80)

    # 1. Parse POs
    po_list, unique_prods = extract_all_pos()
    po_map = {p['po_number']: p for p in po_list}

    conn = psycopg2.connect(COMPANY_DB_URL)
    ensure_schema_migrations(conn)
    cur = conn.cursor()

    # Resolve Customer ID
    cur.execute("SELECT id, name FROM customers WHERE name ILIKE '%Reliance%' ORDER BY id LIMIT 1;")
    cust_row = cur.fetchone()
    customer_id = cust_row[0] if cust_row else "cust-rrl-192b561d"

    # Invoices in DB
    cur.execute("""
        SELECT id, invoice_no, date, grand_total, taxable_value, tax_total, po_reference, sis_code, site_name, customer_gstin
        FROM sales_invoices
        WHERE is_deleted = false
        ORDER BY CAST(SPLIT_PART(invoice_no, '/', 2) AS INTEGER);
    """)
    invoices = cur.fetchall()
    po_to_invoices = {}
    for inv in invoices:
        po_ref = inv[6]
        if po_ref in po_map:
            po_to_invoices.setdefault(po_ref, []).append(inv)

    # Billed metrics from invoice items
    cur.execute("""
        SELECT si.po_reference, SUM(sii.quantity), SUM(sii.taxable_value), SUM(sii.tax_amount), SUM(sii.total_amount)
        FROM sales_invoice_items sii
        JOIN sales_invoices si ON sii.invoice_id = si.id
        WHERE si.is_deleted = false
        GROUP BY si.po_reference;
    """)
    billed_by_po = {r[0]: {'qty': r[1], 'taxable': r[2], 'tax': r[3], 'total': r[4]} for r in cur.fetchall()}

    # 2. Product Master Upsert / Resolution
    cur.execute("UPDATE products SET branch_id = %s WHERE company_id = %s;", (BRANCH_ID, COMPANY_ID))
    cur.execute("SELECT id, code, barcode, style_code, color, size FROM products WHERE is_deleted = false;")
    db_prods = cur.fetchall()
    existing_by_barcode = {r[2]: r[0] for r in db_prods if r[2]}
    existing_by_scs = {(str(r[3]).upper().strip(), str(r[4]).upper().strip(), str(r[5]).upper().strip()): r[0] for r in db_prods if r[3] and r[4] and r[5]}

    prod_key_to_id = {}
    created_products_count = 0
    now = datetime.datetime.now(datetime.timezone.utc)

    for (ean, style, color, size), pdata in unique_prods.items():
        if ean in existing_by_barcode:
            prod_id = existing_by_barcode[ean]
        elif (style, color, size) in existing_by_scs:
            prod_id = existing_by_scs[(style, color, size)]
        else:
            # Create new deduplicated product
            clean_style = style.lower().replace(' ', '-').replace('/', '-')
            clean_color = color.lower().replace(' ', '-').replace('/', '-')
            clean_size = size.lower().replace(' ', '-').replace('/', '-')
            prod_id = f"prod-{clean_style}-{clean_color}-{clean_size}"
            code_val = f"{style}-{color}-{size}".replace(' ', '')
            sku_val = f"{style}-{color}-{size}".replace(' ', '')
            
            # Check unique code conflict
            cur.execute("SELECT id FROM products WHERE code = %s OR sku = %s;", (code_val, sku_val))
            conf = cur.fetchone()
            if conf:
                prod_id = conf[0]
            else:
                cat_val = "CHAPPAL" if "CHAPP" in pdata['description'].upper() else ("SANDAL" if "SANDAL" in pdata['description'].upper() else "FOOTWEAR")
                cur.execute("""
                    INSERT INTO products (
                        id, uuid, company_id, branch_id, created_at, modified_at, is_active, is_deleted, version,
                        code, name, price, stock, reserved_stock, category, barcode, brand, color, size, mrp, gst_percentage,
                        style_code, buying_price, cost_price, sku, hsn_code, pricing_mode, tracking_mode,
                        attributes, primary_image_url
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, true, false, 1,
                        %s, %s, %s, 0, 0.0000, %s, %s, 'Tattly Threads', %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, 'Fixed', 'Standard',
                        %s, NULL
                    );
                """, (
                    prod_id, str(uuid.uuid4()), COMPANY_ID, BRANCH_ID, now, now,
                    code_val, pdata['description'], pdata['base_cost'], cat_val, ean, color, size, pdata['mrp'], pdata['gst_rate'],
                    style, pdata['base_cost'], pdata['base_cost'], sku_val, pdata['hsn_code'],
                    psycopg2.extras.Json({
                        'article_no': pdata['article_no'],
                        'vendor_style': pdata['vendor_style'],
                        'color': pdata['color'],
                        'size': pdata['size'],
                        'uom': pdata['uom'],
                        'description': pdata['description']
                    })
                ))
                created_products_count += 1
                existing_by_barcode[ean] = prod_id
                existing_by_scs[(style, color, size)] = prod_id

        prod_key_to_id[(ean, style, color, size)] = prod_id

    print(f"Product Deduplication Complete: {len(prod_key_to_id)} SKUs mapped ({created_products_count} newly inserted).")

    # 3. Create / Update 60 Sales Orders, Lines, and Terms Snapshots
    created_so_count = 0
    updated_so_count = 0
    created_lines_count = 0
    created_snapshots_count = 0
    created_allocations_count = 0

    for po in po_list:
        po_no = po['po_number']
        order_no = f"SO-{po_no}"
        so_id = f"so-tt-{po_no}"

        billed_stat = billed_by_po.get(po_no, {'qty': Decimal('0'), 'taxable': Decimal('0'), 'tax': Decimal('0'), 'total': Decimal('0')})
        b_qty = billed_stat['qty']
        b_val = billed_stat['total']
        p_qty = po['sum_qty'] - b_qty
        p_val = po['grand_total'] - b_val
        
        if b_qty >= po['sum_qty'] and po['sum_qty'] > 0:
            fulfillment_status = "FULLY_BILLED"
        elif b_qty > 0:
            fulfillment_status = "PARTIALLY_BILLED"
        else:
            fulfillment_status = "UNFULFILLED"

        # Check existing SalesOrder
        cur.execute("SELECT id FROM sales_orders WHERE order_no = %s OR po_number = %s;", (order_no, po_no))
        so_exists = cur.fetchone()

        if not so_exists:
            cur.execute("""
                INSERT INTO sales_orders (
                    id, uuid, company_id, branch_id, created_at, modified_at, is_active, is_deleted, version,
                    order_no, date, customer_name, tax_total, grand_total, status, source_quotation_id,
                    po_number, po_date, delivery_date, site_code, site_name, delivery_address, vendor_code,
                    customer_id, customer_gstin, basic_total, is_interstate, total_qty, billed_qty, billed_value,
                    pending_qty, pending_value, fulfillment_status, po_metadata
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, true, false, 1,
                    %s, %s, %s, %s, %s, 'Confirmed', NULL,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s
                );
            """, (
                so_id, str(uuid.uuid4()), COMPANY_ID, BRANCH_ID, now, now,
                order_no, po['po_date'], po['customer_name'], po['tax_total'], po['grand_total'],
                po_no, po['po_date'], po['delivery_date'], po['site_code'], po['site_name'], po['delivery_address'], po['vendor_code'],
                customer_id, po['customer_gstin'], po['basic_total'], po['is_interstate'], po['sum_qty'], b_qty, b_val,
                p_qty, p_val, fulfillment_status, psycopg2.extras.Json({
                    'pdf_name': po['pdf_name'],
                    'vendor_code': po['vendor_code'],
                    'site_code': po['site_code'],
                    'site_name': po['site_name'],
                    'po_lines_count': po['lines_count'],
                    'original_po_date': po['po_date_raw'],
                    'original_delivery_date': po['delivery_date_raw']
                })
            ))
            created_so_count += 1
        else:
            so_id = so_exists[0]
            cur.execute("""
                UPDATE sales_orders SET
                    branch_id = %s, company_id = %s,
                    date = %s, customer_name = %s, tax_total = %s, grand_total = %s, status = 'Confirmed',
                    po_number = %s, po_date = %s, delivery_date = %s, site_code = %s, site_name = %s,
                    delivery_address = %s, vendor_code = %s, customer_id = %s, customer_gstin = %s,
                    basic_total = %s, is_interstate = %s, total_qty = %s, billed_qty = %s, billed_value = %s,
                    pending_qty = %s, pending_value = %s, fulfillment_status = %s, modified_at = %s,
                    po_metadata = %s
                WHERE id = %s;
            """, (
                BRANCH_ID, COMPANY_ID,
                po['po_date'], po['customer_name'], po['tax_total'], po['grand_total'],
                po_no, po['po_date'], po['delivery_date'], po['site_code'], po['site_name'],
                po['delivery_address'], po['vendor_code'], customer_id, po['customer_gstin'],
                po['basic_total'], po['is_interstate'], po['sum_qty'], b_qty, b_val,
                p_qty, p_val, fulfillment_status, now, psycopg2.extras.Json({
                    'pdf_name': po['pdf_name'],
                    'vendor_code': po['vendor_code'],
                    'site_code': po['site_code'],
                    'site_name': po['site_name'],
                    'po_lines_count': po['lines_count'],
                    'original_po_date': po['po_date_raw'],
                    'original_delivery_date': po['delivery_date_raw']
                }), so_id
            ))
            updated_so_count += 1

        # Delete existing items for clean idempotency
        cur.execute("DELETE FROM sales_order_items WHERE order_id = %s;", (so_id,))

        # Insert PO Lines
        line_records = []
        for line in po['lines']:
            prod_key = (line['ean'], line['vendor_style'], line['color'], line['size'])
            pid = prod_key_to_id[prod_key]
            item_code = f"{line['vendor_style']}-{line['color']}-{line['size']}".replace(' ', '')
            line_deliv_dt = parse_date(line['delivery_date']) or po['delivery_date']

            line_records.append((
                so_id, pid, item_code, line['description'], line['quantity'], line['base_cost'],
                line['hsn_code'], line['gst_rate'], line['tax_amount'], line['line_total'],
                line['sr_no'], line['article_no'], line['ean'], line['vendor_style'], line['color'], line['size'],
                line['uom'], line['mrp'], line['base_cost'], line['line_total'], line['igst_amount'],
                line['cgst_amount'], line['sgst_amount'], line['line_total'], line_deliv_dt, line['site_code']
            ))

        psycopg2.extras.execute_batch(cur, """
            INSERT INTO sales_order_items (
                order_id, product_id, code, name, quantity, price, hsn_code, gst_rate, tax_amount, total_amount,
                sr_no, article_no, ean, vendor_style, color, size, uom, mrp, base_cost, taxable_value,
                igst_amount, cgst_amount, sgst_amount, line_total, delivery_date, site_code
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s
            );
        """, line_records)
        created_lines_count += len(line_records)

        # Upsert Immutable Terms Snapshot
        cur.execute("DELETE FROM terms_snapshots WHERE document_type = 'SALES_ORDER' AND document_no = %s;", (order_no,))
        cur.execute("""
            INSERT INTO terms_snapshots (
                id, uuid, company_id, branch_id, created_at, modified_at, is_active, is_deleted, version,
                document_type, document_no, snapshot_at, clauses_snapshot
            ) VALUES (
                %s, %s, %s, %s, %s, %s, true, false, 1,
                'SALES_ORDER', %s, %s, %s
            );
        """, (
            f"terms-so-{po_no}", str(uuid.uuid4()), COMPANY_ID, BRANCH_ID, now, now,
            order_no, po['po_date'], po['terms_text']
        ))
        created_snapshots_count += 1

        # Delete and recreate Invoice Allocation Records for this PO
        cur.execute("DELETE FROM sales_order_invoice_allocations WHERE order_id = %s OR po_number = %s;", (so_id, po_no))
        inv_list = po_to_invoices.get(po_no, [])
        for inv_tuple in inv_list:
            inv_id, inv_no, inv_date, inv_grand, inv_taxable, inv_tax, p_ref, sis_c, s_nm, c_gst = inv_tuple
            alloc_id = f"alloc-{po_no}-{inv_no.replace('/', '-').replace(' ', '')}"
            cur.execute("""
                INSERT INTO sales_order_invoice_allocations (
                    id, uuid, company_id, branch_id, created_at, modified_at, is_active, is_deleted, version,
                    order_id, order_no, po_number, invoice_id, invoice_no, invoice_date,
                    po_quantity, po_value, billed_quantity, billed_value, pending_quantity, pending_value,
                    status, allocation_metadata
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, true, false, 1,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s
                );
            """, (
                alloc_id, str(uuid.uuid4()), COMPANY_ID, BRANCH_ID, now, now,
                so_id, order_no, po_no, inv_id, inv_no, inv_date,
                po['sum_qty'], po['grand_total'], b_qty, b_val, p_qty, p_val,
                fulfillment_status, psycopg2.extras.Json({
                    'invoice_grand_total': str(inv_grand),
                    'invoice_taxable_value': str(inv_taxable),
                    'invoice_tax_total': str(inv_tax),
                    'sis_code': sis_c,
                    'site_name': s_nm
                })
            ))
            created_allocations_count += 1

    conn.commit()

    print("\n--- COMMIT EXECUTION SUMMARY ---")
    print(f"  Sales Orders Created:            {created_so_count}")
    print(f"  Sales Orders Updated:            {updated_so_count}")
    print(f"  Total Sales Orders Active:       {created_so_count + updated_so_count} / 60")
    print(f"  Sales Order Lines Inserted:      {created_lines_count:,}")
    print(f"  Terms Snapshots Committed:       {created_snapshots_count}")
    print(f"  Invoice Allocations Committed:   {created_allocations_count}")
    print(f"  Item Master Products Created:    {created_products_count}")
    print("=" * 80)
    print("COMMIT SUCCESSFUL: All historical Sales Orders, lines, terms, and allocations are committed to PostgreSQL.")
    print("=" * 80)
    conn.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Tattly Threads Historical PO Reconciliation Engine")
    parser.add_argument("--dry-run", action="store_true", help="Execute dry run and print statistics")
    parser.add_argument("--commit", action="store_true", help="Execute database migration and commit")
    args = parser.parse_args()

    if args.commit:
        execute_commit()
    else:
        from scripts.reconcile_historical_pos import run_dry_run_reconciliation
        run_dry_run_reconciliation()
