const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = [
  'src/components/pricing/PricingStudioModal.tsx',
  'src/components/PrintPreviewModal.tsx',
  'src/components/procurement/SupplierPaymentModal.tsx',
  'src/components/procurement/VendorReturnModal.tsx',
  'src/components/reports/ScheduleReportModal.tsx',
  'src/components/sales/components/ComplianceDispatchModal.tsx',
  'src/components/sales/components/TaxEntryBar.tsx',
  'src/components/sales/components/TaxInvoiceItemGrid.tsx',
  'src/components/sales/SalesOrderForm.tsx',
  'src/components/sales/SalesOrderMatrixEntry.tsx',
];

function sanitize(value) {
  const cleaned = String(value || '')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'field';
}

for (const rel of files) {
  const filePath = path.join(root, rel);
  const text = fs.readFileSync(filePath, 'utf8');
  const updated = text.replace(/<input\b([^>]*?)>/gi, (tag, attrs) => {
    const lower = tag.toLowerCase();
    if (/data-field-key/i.test(attrs)) return tag;
    if (
      /type\s*=\s*["']?(hidden|file|button)["']?/i.test(lower) ||
      /readonly/i.test(lower) ||
      /disabled/i.test(lower) ||
      /aria-hidden/i.test(lower)
    ) {
      return tag;
    }

    let key = null;
    for (const attr of ['name', 'id', 'aria-label', 'placeholder', 'data-testid']) {
      const match = attrs.match(new RegExp(`${attr}\\s*=\\s*["']([^"']+)["']`, 'i'));
      if (match) {
        key = sanitize(match[1]);
        break;
      }
    }
    if (!key) key = 'field';
    return `<input${attrs} data-field-key="${key}">`;
  });

  if (updated !== text) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(rel);
  }
}
