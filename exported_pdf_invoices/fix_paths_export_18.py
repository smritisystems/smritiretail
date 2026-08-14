import os

fn_18 = r"F:\SMRITRretailNX\scratch\export_inv_18_canonical_pdf.py"
with open(fn_18, "r", encoding="utf-8") as f:
    c = f.read()

c = c.replace('html_file = "scratch/TT2026-2027_18_frozen.html"', 'html_file = os.path.join(os.path.dirname(__file__), "TT2026-2027_18_frozen.html")')
c = c.replace('pdf_file = "exported_pdf_invoices/TT2026-2027_18.pdf"', 'pdf_file = r"F:\\SMRITRretailNX\\exported_pdf_invoices\\1888_TT2026-2027_18.pdf"')

with open(fn_18, "w", encoding="utf-8") as f:
    f.write(c)

print("Fixed paths in export_inv_18_canonical_pdf.py")
