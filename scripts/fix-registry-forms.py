from pathlib import Path
import re

root = Path("src")

# Common malformed patterns created in the earlier pass
broken_patterns = [
    re.compile(r'onChange=\{\s*\(\s*e\s*\)\s*=\s*data-field-key=(?:["\'])([^"\']+)(?:["\'])\s*>\s*', re.I),
    re.compile(r'onChange=\{\s*e\s*=\s*data-field-key=(?:["\'])([^"\']+)(?:["\'])\s*>\s*', re.I),
    re.compile(r'onChange=\{\s*\(\s*\)\s*=\s*data-field-key=(?:["\'])([^"\']+)(?:["\'])\s*>\s*', re.I),
    re.compile(r'onChange=\{\s*\(\s*e\s*\)\s*=\s*data-field-key=(?:["\'])([^"\']+)(?:["\'])\s*>\s*\{|', re.I),
]

def infer_field_key(tag_text: str) -> str | None:
    s = tag_text.lower()
    if any(token in s for token in ['type="hidden"', "type='hidden'", 'type="file"', "type='file'", 'type="button"', "type='button'", 'readonly', 'disabled', 'aria-hidden']):
        return None

    mapping = {
        'customer_code': ['customercode', 'customer code', 'customer_code', 'customer id', 'cust code', 'customer'],
        'customer_name': ['customername', 'customer name', 'customer_name', 'customer'],
        'staff_name': ['salesstaff', 'staff name', 'staff_name', 'staffname', 'cashier', 'employee'],
        'item_code': ['stockno', 'stock no', 'stock_no', 'itemcode', 'item_code', 'sku', 'barcode', 'stock number'],
        'product_name': ['productname', 'product name', 'product_name', 'item name', 'description', 'name'],
        'selling_price': ['sellprice', 'selling price', 'selling_price', 'rate', 'price', 'amount', 'mrp'],
        'quantity': ['quantity', 'qty'],
        'reference_no': ['refno', 'reference_no', 'reference no', 'reference'],
        'invoice_number': ['invoice no', 'invoice_number', 'invoiceno', 'bill no', 'billno'],
        'remarks': ['remarks', 'comment', 'notes', 'note'],
        'date': ['docdate', 'date', 'paymentdate'],
        'hsn_code': ['hsn'],
        'discount_percent': ['discount', 'discpercent', 'disc percent', 'disc%', 'disccode'],
        'delivery_terms': ['delivery terms', 'deliveryterms'],
        'payment_terms': ['payment terms', 'paymentterms'],
        'supplier_name': ['supplier name', 'suppliername'],
        'warehouse_name': ['warehouse name', 'warehousename'],
        'brand': ['brand'],
        'category': ['category'],
        'uom': ['uom'],
        'company_name': ['company name', 'companyname'],
        'store_name': ['store name', 'storename'],
    }

    for key, needles in mapping.items():
        if any(needle in s for needle in needles):
            return key
    return "general"

for path in root.rglob("*.tsx"):
    text = path.read_text(encoding="utf-8")
    original = text

    for pattern in broken_patterns:
        text = pattern.sub("onChange={(e) => ", text)

    def fix_tag(match: re.Match[str]) -> str:
        tag = match.group(0)
        if 'data-field-key' in tag:
            return tag

        key = infer_field_key(tag)
        if key is None:
            return tag

        if tag.rstrip().endswith('/>'):
            return tag[:-2] + f' data-field-key="{key}" />'
        return tag[:-1] + f' data-field-key="{key}" >'

    text = re.sub(r'<(input|select|textarea)([^>]*?)>', fix_tag, text, flags=re.I)

    if text != original:
        path.write_text(text, encoding="utf-8")
        print(path)

print("registry form repair complete")
