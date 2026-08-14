import os

fn_a4 = r"F:\SMRITRretailNX\src\print_engine\templates\StandardInvoiceA4.tsx"
with open(fn_a4, "r", encoding="utf-8") as f:
    c = f.read()

old_fields = """  customerGst?: string;
  shippingName?: string;
  shippingAddress?: string;"""

new_fields = """  customerGst?: string;
  shippingName?: string;
  shipping_name?: string;
  shippingAddress?: string;
  shipping_address?: string;
  shippingGst?: string;
  shipping_gstin?: string;"""

if old_fields in c:
    c = c.replace(old_fields, new_fields)
    with open(fn_a4, "w", encoding="utf-8") as f:
        f.write(c)
    print("Added shipping fields to InvoiceData interface.")
else:
    print("Could not find target string in StandardInvoiceA4.tsx")
