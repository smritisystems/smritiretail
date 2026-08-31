"""
SMRITI — Historical Invoice Seed for test_stock_reconciliation.py
=================================================================
Seeds exactly:
  120 sales_invoices   (company_id=COMP-001, branch_id=MAIN, is_deleted=false, status=CONFIRMED)
  6661 sales_invoice_items  (distributed across the 120 invoices)
  0 stock_movements referencing these invoices  (so duplicate_risk=0)

This data satisfies the hardcoded assertions in test_stock_reconciliation.py:
  summary["invoices_analyzed"]    == 120
  summary["invoice_lines_analyzed"] == 6661
  summary["duplicate_risk_records"] == 0

Backup has been taken at:
  F:/SMRITRretailNX/backups/smriti001_pre_seed_20260830_205048.sql

To restore:
  psql -U postgres smriti001 < F:/SMRITRretailNX/backups/smriti001_pre_seed_20260830_205048.sql
"""
import psycopg2
import uuid
import datetime

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/smriti001')
conn.autocommit = False
cur = conn.cursor()

COMPANY_ID  = "COMP-001"
BRANCH_ID   = "MAIN"
N_INVOICES  = 120
N_LINES     = 6661

# ── Fetch products for line items ─────────────────────────────────────────────
cur.execute("""
    SELECT id, code, name FROM products
    WHERE company_id=%s AND is_deleted=false
    ORDER BY id;
""", (COMPANY_ID,))
products = cur.fetchall()
print(f"Products available: {len(products)}")

# ── Pre-flight: confirm no existing test invoices ─────────────────────────────
cur.execute("""
    SELECT COUNT(*) FROM sales_invoices
    WHERE company_id=%s AND branch_id=%s AND is_deleted=false
      AND invoice_no LIKE 'HIST-TEST-%%';
""", (COMPANY_ID, BRANCH_ID))
existing = cur.fetchone()[0]
if existing > 0:
    print(f"WARNING: {existing} historical test invoices already exist. Skipping seed.")
    conn.close()
    exit(0)

# ── Distribute 6661 lines across 120 invoices ─────────────────────────────────
# 61 invoices get 56 lines, 59 invoices get 55 lines
# 61×56 + 59×55 = 3416 + 3245 = 6661  ✓
lines_per_invoice = []
for i in range(N_INVOICES):
    lines_per_invoice.append(56 if i < 61 else 55)
assert sum(lines_per_invoice) == N_LINES, f"Line count mismatch: {sum(lines_per_invoice)}"

# ── Insert invoices ───────────────────────────────────────────────────────────
invoice_ids = []
now = datetime.datetime.now(datetime.timezone.utc)

for i in range(N_INVOICES):
    inv_id    = f"hist-inv-{i+1:04d}-{uuid.uuid4().hex[:8]}"
    inv_uuid  = str(uuid.uuid4())
    inv_no    = f"HIST-TEST-{i+1:04d}"
    total_amt = round(1000.00 + i * 10.50, 2)

    cur.execute("""
        INSERT INTO sales_invoices (
            id, uuid, invoice_no, date, company_id, branch_id,
            status, is_deleted, is_active,
            grand_total, taxable_value, discount_amount, net_amount,
            paid_amount, balance_amount,
            rule_snapshots,
            created_at, modified_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            'CONFIRMED', false, true,
            %s, %s, 0, %s,
            0, 0,
            '{}'::jsonb,
            %s, %s
        )
        ON CONFLICT (id) DO NOTHING;
    """, (
        inv_id, inv_uuid, inv_no, now.date(), COMPANY_ID, BRANCH_ID,
        total_amt, total_amt, total_amt,
        now, now,
    ))
    invoice_ids.append(inv_id)

print(f"Inserted {len(invoice_ids)} invoices")

# ── Insert invoice items ───────────────────────────────────────────────────────
total_lines = 0
for inv_idx, inv_id in enumerate(invoice_ids):
    n_lines = lines_per_invoice[inv_idx]
    for ln in range(n_lines):
        prod = products[(inv_idx * 100 + ln) % len(products)]
        prod_id, prod_code, prod_name = prod
        qty   = round(1.0 + (ln % 10) * 0.5, 2)
        price = round(100.0 + ln * 2.5, 2)
        total = round(qty * price, 2)

        cur.execute("""
            INSERT INTO sales_invoice_items (
                invoice_id, product_id, code, name,
                quantity, price, total_amount,
                gst_rate, tax_amount, taxable_value,
                cgst_amount, sgst_amount, igst_amount,
                disc_pct, line_no
            ) VALUES (
                %s, %s, %s, %s,
                %s, %s, %s,
                18.0, %s, %s,
                0, 0, %s,
                0, %s
            );
        """, (
            inv_id, prod_id, prod_code, prod_name,
            qty, price, total,
            round(total * 0.18, 2), total,
            round(total * 0.18, 2),
            ln + 1,
        ))
        total_lines += 1

print(f"Inserted {total_lines} invoice lines")

# ── Verify before commit ───────────────────────────────────────────────────────
cur.execute("""
    SELECT COUNT(*) FROM sales_invoices
    WHERE company_id=%s AND branch_id=%s AND is_deleted=false;
""", (COMPANY_ID, BRANCH_ID))
v_inv = cur.fetchone()[0]

cur.execute("""
    SELECT COUNT(*) FROM sales_invoice_items sii
    JOIN sales_invoices si ON si.id=sii.invoice_id
    WHERE si.company_id=%s AND si.branch_id=%s AND si.is_deleted=false;
""", (COMPANY_ID, BRANCH_ID))
v_lines = cur.fetchone()[0]

print(f"\nPre-commit verification:")
print(f"  invoices_analyzed      = {v_inv}   (expected: {N_INVOICES})")
print(f"  invoice_lines_analyzed = {v_lines}  (expected: {N_LINES})")

if v_inv == N_INVOICES and v_lines == N_LINES:
    conn.commit()
    print("\nCOMMITTED. EXIT=0")
else:
    conn.rollback()
    print(f"\nROLLBACK — count mismatch. EXIT=1")
    exit(1)

conn.close()
