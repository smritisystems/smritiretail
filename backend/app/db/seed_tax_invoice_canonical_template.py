"""
Project      : SMRITI Retail OS
Author       : Jawahar Ramkripal Mallah
Designation  : Chief Systems Architect & Creator
Email        : support@smritibooks.com
Websites     : smritibooks.com | erpnbook.com | aitdl.com
Version      : 4.8.0
Created      : 2026-08-17
Modified     : 2026-08-17
Copyright    : © SMRITIBooks.com. All Rights Reserved.
License      : Proprietary Commercial Software
Classification: Internal
"""

import os
import sys
import json
import hashlib
import uuid
import datetime
import psycopg2
import fitz

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

SELLER_INFO = {
    "name": "TATTLY THREADS",
    "address_line1": "Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery",
    "address_line2": "near HP Petrol Pump, Mumbai, Maharashtra - 400003",
    "web": "www.tattlythreads.com",
    "email_dispatch": "dispatch@tattlythreads.com",
    "email_accounts": "accounts@tattlythreads.com",
    "gstin": "27AAXFT2508H1ZR",
    "state": "Maharashtra",
    "state_code": "27"
}

CANONICAL_LAYOUT_CONFIG = {
    "template_code": "TAX_INVOICE_TATTLY_THREADS",
    "template_name": "TATTLY THREADS Tax Invoice",
    "template_type": "TAX_INVOICE",
    "status": "FROZEN",
    "version": "V1",
    "effective_from": "2026-08-17",
    "page_geometry": {
        "page_size": "A4",
        "orientation": "portrait",
        "width_mm": 210,
        "height_mm": 297,
        "margins_mm": {
            "top": 8,
            "bottom": 12,
            "left": 8,
            "right": 8
        }
    },
    "header_configuration": {
        "seller_info": SELLER_INFO,
        "logo_asset": "F:\\SMRITRretailNX\\TT\\logo\\tattly_logo_black.png",
        "show_barcode": True,
        "show_gst_qr": True
    },
    "customer_configuration": {
        "billed_to_header": "BILLED TO (RECIPIENT)",
        "shipped_to_header": "SHIPPED TO (DELIVERY SITE)"
    },
    "item_grid_configuration": {
        "table_layout": "fixed",
        "border_collapse": "collapse",
        "table_width": "100%",
        "no_wrap": True,
        "row_height_px": 22,
        "horizontal_border_every_row": True,
        "vertical_borders": True,
        "repeat_header_on_page_break": True,
        "columns_interstate": [
            {"name": "#", "width": "3.5%", "align": "center"},
            {"name": "ITEM DESCRIPTION", "width": "26%", "align": "left", "no_wrap": True},
            {"name": "HSN/SAC", "width": "8%", "align": "center"},
            {"name": "QTY", "width": "4.5%", "align": "right"},
            {"name": "MRP", "width": "8%", "align": "right"},
            {"name": "DISC %", "width": "6%", "align": "right"},
            {"name": "TAXABLE VALUE", "width": "11%", "align": "right"},
            {"name": "TAX %", "width": "6%", "align": "center"},
            {"name": "IGST", "width": "9%", "align": "right"},
            {"name": "AMOUNT", "width": "18%", "align": "right"}
        ],
        "columns_intrastate": [
            {"name": "#", "width": "3.5%", "align": "center"},
            {"name": "ITEM DESCRIPTION", "width": "23.5%", "align": "left", "no_wrap": True},
            {"name": "HSN/SAC", "width": "7.5%", "align": "center"},
            {"name": "QTY", "width": "4%", "align": "right"},
            {"name": "MRP", "width": "7.5%", "align": "right"},
            {"name": "DISC %", "width": "5%", "align": "right"},
            {"name": "TAXABLE VALUE", "width": "10.5%", "align": "right"},
            {"name": "CGST %", "width": "5.5%", "align": "center"},
            {"name": "CGST", "width": "8.5%", "align": "right"},
            {"name": "SGST %", "width": "5.5%", "align": "center"},
            {"name": "SGST", "width": "8.5%", "align": "right"},
            {"name": "AMOUNT", "width": "14.5%", "align": "right"}
        ]
    },
    "styling_configuration": {
        "font_family_mono": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        "font_family_sans": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        "font_size_header": "8.5px",
        "font_size_body": "8.5px",
        "font_size_subtotal": "9px",
        "font_size_grand_total": "13px",
        "border_table": "1px solid #d1d5db",
        "border_row_bottom": "1px solid #d1d5db",
        "border_col_right": "1px solid #d1d5db",
        "border_subtotal_top": "2px solid #9ca3af",
        "border_subtotal_bottom": "2px solid #9ca3af"
    },
    "summary_configuration": {
        "show_total_pairs": True,
        "show_subtotal": True,
        "show_amount_in_words": True,
        "show_taxable_value": True,
        "show_tax_totals": True,
        "show_rounding_adjustment": True,
        "show_grand_total": True
    },
    "gst_summary_configuration": {
        "show_hsn_breakdown": True,
        "default_hsn": "64041990"
    },
    "bank_details_configuration": {
        "bank_name": "STATE BANK OF INDIA",
        "account_number": "43976711765",
        "ifsc_code": "SBIN0030425",
        "branch": "WARDHMAN NAGAR NAGPUR"
    },
    "terms_configuration": {
        "terms_text": "Goods once sold will not be taken back without prior written approval. All disputes subject to Mumbai Jurisdiction."
    },
    "signatory_configuration": {
        "company_name": "TATTLY THREADS",
        "title": "AUTHORISED SIGNATORY"
    },
    "footer_configuration": {
        "disclaimer_line1": "This is a computer-generated tax invoice and does not require a physical signature.",
        "disclaimer_line2": "SUBJECT TO MUMBAI JURISDICTION.",
        "powered_by": "SMRITI OS Retail Suite - Powered by SMRITI SYSTEMS"
    }
}


def compute_sha256_file(filepath: str) -> str:
    """Computes SHA256 hex digest for a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def seed_canonical_tax_invoice_template(company_db_name: str = "smriti001"):
    """
    Seeds the canonical Tax Invoice template, version V1, and links all generated
    batch invoice PDF artifacts in the specified company database.
    """
    print(f"Connecting to Company DB: {company_db_name}...")
    conn = psycopg2.connect(f"postgresql://postgres:postgres@localhost:5432/{company_db_name}")
    cur = conn.cursor()

    config_str = json.dumps(CANONICAL_LAYOUT_CONFIG, sort_keys=True)
    config_hash = hashlib.sha256(config_str.encode("utf-8")).hexdigest()

    # 1. Upsert Tax Invoice Template
    template_id = "tpl-tax-inv-tt-canonical"
    cur.execute("""
        INSERT INTO tax_invoice_templates (
            id, uuid, company_id, branch_id, template_code, template_name,
            template_type, status, current_version, effective_from,
            layout_configuration, configuration_hash, is_default,
            created_at, modified_at, created_by, is_active, is_deleted, version
        ) VALUES (
            %s, %s, 'comp-default', 'br-default', 'TAX_INVOICE_TATTLY_THREADS',
            'TATTLY THREADS Tax Invoice', 'TAX_INVOICE', 'FROZEN', 'V1', '2026-08-17',
            %s, %s, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'SYSTEM_ARCHITECT', TRUE, FALSE, 1
        )
        ON CONFLICT (template_code) DO UPDATE SET
            layout_configuration = EXCLUDED.layout_configuration,
            configuration_hash = EXCLUDED.configuration_hash,
            status = 'FROZEN',
            current_version = 'V1',
            modified_at = CURRENT_TIMESTAMP;
    """, (template_id, str(uuid.uuid4()), config_str, config_hash))

    # 2. Upsert Tax Invoice Template Version V1
    version_id = "tpl-ver-tax-inv-tt-v1"
    cur.execute("""
        INSERT INTO tax_invoice_template_versions (
            id, uuid, company_id, branch_id, template_id, version,
            status, layout_configuration, configuration_hash, effective_from,
            created_at, modified_at, created_by, is_active, is_deleted, version_num
        ) VALUES (
            %s, %s, 'comp-default', 'br-default', %s, 'V1',
            'FROZEN', %s, %s, '2026-08-17',
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'SYSTEM_ARCHITECT', TRUE, FALSE, 1
        )
        ON CONFLICT (id) DO UPDATE SET
            layout_configuration = EXCLUDED.layout_configuration,
            configuration_hash = EXCLUDED.configuration_hash,
            status = 'FROZEN',
            modified_at = CURRENT_TIMESTAMP;
    """, (version_id, str(uuid.uuid4()), template_id, config_str, config_hash))

    conn.commit()
    print(f"Persisted Canonical Template TAX_INVOICE_TATTLY_THREADS V1 (Hash: {config_hash[:16]}...).")

    # 3. Index generated batch PDF artifacts
    batch_dir = r"F:\SMRITRretailNX\exports\tt_batch_74_103"
    pdf_files = [f for f in os.listdir(batch_dir) if f.endswith(".pdf")]
    print(f"Found {len(pdf_files)} batch PDF artifacts in {batch_dir} to index.")

    artifacts_indexed = 0
    for fname in sorted(pdf_files):
        fpath = os.path.join(batch_dir, fname)
        sha256 = compute_sha256_file(fpath)
        fsize = os.path.getsize(fpath)

        doc = fitz.open(fpath)
        page_count = len(doc)
        doc.close()

        # Extract invoice_no from filename, e.g. SIS_TXSR_TaxInvoice_TT2026-2027_102.pdf -> TT2026-2027/102
        parts = fname.replace(".pdf", "").split("_")
        inv_part1 = parts[-2]
        inv_part2 = parts[-1]
        inv_no = f"{inv_part1}/{inv_part2}"

        # Find invoice in DB
        cur.execute("SELECT id FROM sales_invoices WHERE invoice_no = %s;", (inv_no,))
        row = cur.fetchone()
        if row:
            invoice_id = row[0]
            artifact_id = f"art-{invoice_id}"

            cur.execute("""
                INSERT INTO invoice_document_artifacts (
                    id, uuid, company_id, branch_id, invoice_id, invoice_no,
                    document_type, template_code, template_version, template_status,
                    storage_path, sha256_hash, file_size, page_count,
                    generated_at, created_at, modified_at, created_by, is_active, is_deleted, is_valid, version
                ) VALUES (
                    %s, %s, 'comp-default', 'br-default', %s, %s,
                    'TAX_INVOICE', 'TAX_INVOICE_TATTLY_THREADS', 'V1', 'FROZEN',
                    %s, %s, %s, %s,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'SYSTEM', TRUE, FALSE, TRUE, 1
                )
                ON CONFLICT (id) DO UPDATE SET
                    storage_path = EXCLUDED.storage_path,
                    sha256_hash = EXCLUDED.sha256_hash,
                    file_size = EXCLUDED.file_size,
                    page_count = EXCLUDED.page_count,
                    template_status = 'FROZEN',
                    is_valid = TRUE,
                    modified_at = CURRENT_TIMESTAMP;
            """, (artifact_id, str(uuid.uuid4()), invoice_id, inv_no, fpath, sha256, fsize, page_count))
            artifacts_indexed += 1

    conn.commit()
    conn.close()
    print(f"Successfully indexed {artifacts_indexed} Tax Invoice PDF artifacts in {company_db_name}.")


if __name__ == "__main__":
    seed_canonical_tax_invoice_template("smriti001")
