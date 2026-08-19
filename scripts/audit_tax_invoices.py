"""
SMRITI Phase 2 Discovery: Tax Invoice & GST Data Audit
"""
import psycopg2
import json

DATABASES = {
    "smriti001": "postgresql://postgres:postgres@localhost:5432/smriti001",
    "smriti002": "postgresql://postgres:postgres@localhost:5432/smriti002",
    "smritisys": "postgresql://postgres:postgres@localhost:5432/smritisys",
}

TAX_INVOICE_TABLES = [
    "sales_invoices",
    "sales_invoice_items",
    "tax_invoice_templates",
    "tax_invoice_template_versions",
    "invoice_document_artifacts",
    "eway_bills",
    "compliance_outboxes",
    "compliance_audit_logs",
    "compliance_credentials",
    "invoice_profitability_ledgers",
    "sales_orders",
    "sales_order_items",
    "sales_quotations",
    "sales_quotation_items",
    "sales_returns",
    "sales_return_items",
]

def get_columns(cur, table_name):
    cur.execute("""
        SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = %s
        ORDER BY ordinal_position;
    """, (table_name,))
    return cur.fetchall()

def audit_tax_invoices(db_name, db_url, out):
    out.write(f"\n{'='*80}\n")
    out.write(f"TAX INVOICE AUDIT - DATABASE: {db_name}\n")
    out.write(f"{'='*80}\n")

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
    except Exception as e:
        out.write(f"  CONNECTION FAILED: {e}\n")
        return

    # 1. Row counts across all tax invoice tables
    out.write("\n--- TABLE ROW COUNTS ---\n")
    for t in TAX_INVOICE_TABLES:
        try:
            cur.execute(f"SELECT count(*) FROM {t};")
            c = cur.fetchone()[0]
            out.write(f"  {t:<35} : {c} rows\n")
        except Exception:
            conn.rollback()
            out.write(f"  {t:<35} : [NOT FOUND / ERROR]\n")

    # 2. Inspect sales_invoices detailed sample and GST distribution in this DB
    try:
        cur.execute("SELECT count(*) FROM sales_invoices;")
        inv_count = cur.fetchone()[0]
        if inv_count > 0:
            out.write(f"\n--- SALES INVOICES ANALYSIS ({inv_count} records) ---\n")
            cur.execute("""
                SELECT 
                    is_interstate,
                    payment_mode,
                    status,
                    source_type,
                    e_invoice_status,
                    count(*),
                    sum(grand_total),
                    sum(tax_total)
                FROM sales_invoices
                GROUP BY is_interstate, payment_mode, status, source_type, e_invoice_status;
            """)
            out.write("  [Breakdown: is_interstate, payment_mode, status, source_type, e_invoice_status, count, sum(grand_total), sum(tax_total)]\n")
            for r in cur.fetchall():
                out.write(f"    {r}\n")

            # Sample 3 complete invoices
            cur.execute("SELECT * FROM sales_invoices LIMIT 3;")
            cols = [d[0] for d in cur.description]
            for row in cur.fetchall():
                rdict = {cols[i]: str(row[i])[:60] for i in range(len(cols))}
                out.write(f"\n  Sample Invoice:\n    {rdict}\n")
    except Exception as e:
        conn.rollback()
        out.write(f"  Error querying sales_invoices: {e}\n")

    # 3. Inspect sales_invoice_items GST rate distribution
    try:
        cur.execute("SELECT count(*) FROM sales_invoice_items;")
        item_count = cur.fetchone()[0]
        if item_count > 0:
            out.write(f"\n--- SALES INVOICE ITEMS GST ANALYSIS ({item_count} records) ---\n")
            cur.execute("""
                SELECT 
                    gst_rate,
                    count(*),
                    sum(quantity),
                    sum(tax_amount),
                    sum(total_amount)
                FROM sales_invoice_items
                GROUP BY gst_rate
                ORDER BY gst_rate;
            """)
            out.write("  [Breakdown by gst_rate: gst_rate, count, sum(qty), sum(tax_amount), sum(total_amount)]\n")
            for r in cur.fetchall():
                out.write(f"    {r}\n")

            # HSN code distribution
            cur.execute("""
                SELECT 
                    hsn_code,
                    count(*),
                    sum(total_amount)
                FROM sales_invoice_items
                GROUP BY hsn_code
                ORDER BY count(*) DESC
                LIMIT 10;
            """)
            out.write("\n  [Top 10 HSN Codes: hsn_code, line_count, sum(total_amount)]\n")
            for r in cur.fetchall():
                out.write(f"    {r}\n")
    except Exception as e:
        conn.rollback()
        out.write(f"  Error querying sales_invoice_items: {e}\n")

    # 4. Inspect tax_invoice_templates & versions
    try:
        cur.execute("SELECT count(*) FROM tax_invoice_templates;")
        tmpl_count = cur.fetchone()[0]
        if tmpl_count > 0:
            out.write(f"\n--- TAX INVOICE TEMPLATES ({tmpl_count} records) ---\n")
            cur.execute("SELECT id, template_name, layout_type, is_default, page_size, orientation FROM tax_invoice_templates;")
            for r in cur.fetchall():
                out.write(f"  Template: {r}\n")
    except Exception as e:
        conn.rollback()
        out.write(f"  Error querying templates: {e}\n")

    # 5. Inspect invoice_document_artifacts
    try:
        cur.execute("SELECT count(*) FROM invoice_document_artifacts;")
        art_count = cur.fetchone()[0]
        if art_count > 0:
            out.write(f"\n--- INVOICE DOCUMENT ARTIFACTS ({art_count} records) ---\n")
            cur.execute("""
                SELECT artifact_type, count(*), sum(file_size_bytes)
                FROM invoice_document_artifacts
                GROUP BY artifact_type;
            """)
            for r in cur.fetchall():
                out.write(f"  Artifact breakdown: {r}\n")
    except Exception as e:
        conn.rollback()
        out.write(f"  Error querying artifacts: {e}\n")

    conn.close()

def main():
    output_file = "scripts/tax_invoice_audit.txt"
    with open(output_file, "w", encoding="utf-8") as out:
        for db_name, db_url in DATABASES.items():
            audit_tax_invoices(db_name, db_url, out)
    print(f"Tax Invoice audit written to {output_file}")

if __name__ == "__main__":
    main()
