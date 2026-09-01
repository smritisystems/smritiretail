const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = [
  'src/components/billing/PdtImportModal.tsx',
  'src/components/billing/propos/ProPosSupervisorAuthModal.tsx',
  'src/components/crm/ComplaintCRMModal.tsx',
  'src/components/crm/Customer360LoyaltyModal.tsx',
  'src/components/crm/CustomerCreditModal.tsx',
  'src/components/crm/LoyaltyLedgerModal.tsx',
  'src/components/customer/CustFormTab.tsx',
  'src/components/ExcelGridEntrySec.tsx',
  'src/components/export/ExportCenterModal.tsx',
  'src/components/FormulaRegistryTab.tsx',
  'src/components/inventory/WarehouseWavePickingModal.tsx',
  'src/components/itemMaster/ItemCatalogGrid.tsx',
  'src/components/itemMaster/ItemDetailsGrid.tsx',
  'src/components/pos/CashDrawerModal.tsx',
  'src/components/pos/GiftCardLifecycleModal.tsx',
  'src/components/pos/GiftVoucherModal.tsx',
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
  return String(value || '')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'field';
}

for (const rel of files) {
  const filePath = path.join(root, rel);
  const text = fs.readFileSync(filePath, 'utf8');
  let changed = false;

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
    changed = true;
    return `<input${attrs} data-field-key="${key}">`;
  });

  if (changed) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(rel);
  }
}
