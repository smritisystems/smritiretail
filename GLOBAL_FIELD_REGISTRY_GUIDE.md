# Global Field Registry Implementation Guide

**Version:** 3.30.0  
**Last Updated:** 2026-09-01  
**Status:** PRODUCTION READY

---

## Table of Contents

1. [Overview](#overview)
2. [Registry Architecture](#registry-architecture)
3. [Quick Start](#quick-start)
4. [Creating New Forms](#creating-new-forms)
5. [Adding Fields to Registry](#adding-fields-to-registry)
6. [Automation & Validation](#automation--validation)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Overview

The Global Field Registry is a **centralized, single-source-of-truth** for all field definitions, lookups, and screen configurations across the SMRITI Retail OS platform.

### Key Benefits

✅ **One place to define fields** - No duplication across forms  
✅ **Automatic F2 lookups** - Press F2 on any registered field  
✅ **Consistent UI** - All forms use same field definitions  
✅ **Reduced code** - Forms become simple data-entry shells  
✅ **Future-proof** - Add new fields/entities without touching form code  

### Architecture Layers

```
┌─────────────────────────────────────────────────┐
│  User Input (Press F2)                          │
├─────────────────────────────────────────────────┤
│  ActiveFieldContext (Detects field type)        │
├─────────────────────────────────────────────────┤
│  GlobalF2LookupModal (Unified modal)            │
├─────────────────────────────────────────────────┤
│  Global Field Registry (Metadata + Routing)     │
├─────────────────────────────────────────────────┤
│  Backend API (/crm/customers, /universal/items) │
└─────────────────────────────────────────────────┘
```

---

## Registry Architecture

### GLOBAL_FIELD_CATALOG

Central repository of all field definitions. Used by all components to understand field behavior.

```ts
interface GlobalFieldDef {
  id: string;                    // Unique field identifier
  entity: GlobalFieldEntity;     // item, customer, supplier, etc.
  fieldKey: string;              // Database/form field name
  label: string;                 // Display label in UI
  dataType: FieldDataType;       // text, number, currency, date, select
  required: boolean;             // Mandatory field?
  aliases: string[];             // Alternative names (customer_code, cust code, etc.)
  lookupGroup?: LookupGroup;     // For F2: product, customer, supplier, staff, hsn, invoice
  sourceTable?: string;          // Database table (items, customers, suppliers)
  displayWidthPct?: number;      // % of form width (8-20% typical)
  active: boolean;               // Is this field in use?
  description?: string;          // Help text
}
```

**Current Coverage:**
- 40+ fields across 7 entities (item, customer, supplier, staff, invoice, warehouse, general)
- 18+ field types (product, article, color, size, brand, department, etc.)
- Extensible to support new entities

### GLOBAL_FIELD_LOOKUP_RULES

Maps lookupGroups to API endpoints and search behavior.

```ts
interface GlobalFieldLookupRule {
  lookupGroup: LookupGroup;        // product, customer, supplier, etc.
  endpoint: string;                // /crm/customers, /universal/items
  searchFields: string[];          // Fields to search: [code, name, mobile]
  insertValueKeys: string[];       // Which field value to insert: [code, id]
  suggestOnF2: boolean;            // Show lookup on F2 press?
  matchPriority: number;           // Priority for multi-match scenarios
  defaultLimit?: number;           // Default result limit
}
```

**Example:**
```ts
{
  lookupGroup: "customer",
  endpoint: "/crm/customers",
  searchFields: ["code", "name", "mobile"],
  insertValueKeys: ["code", "id"],
  suggestOnF2: true,
  matchPriority: 10,
  defaultLimit: 200
}
```

### GLOBAL_SCREEN_FIELD_CONFIG

Per-screen visibility and display rules. Allows same field to appear differently on different screens.

```ts
interface ScreenFieldConfig {
  screenId: string;              // sales_order_form, item_master_grid
  entity: GlobalFieldEntity;     // Which entity this applies to
  fieldKey: string;              // Field identifier
  visible: boolean;              // Show on this screen?
  displayOrder: number;          // 1st, 2nd, 3rd... field
  widthPct?: number;             // Override global width
  requiredInScreen?: boolean;    // Override global required
  overrideLabel?: string;        // Use different label?
}
```

**Example:**
```ts
// Same customer_code field, but different on different screens
{ screenId: "sales_order_form", entity: "customer", fieldKey: "customer_code", visible: true, displayOrder: 1, widthPct: 12 },
{ screenId: "crm_dashboard", entity: "customer", fieldKey: "customer_code", visible: false, displayOrder: 100 }
```

---

## Quick Start

### For Form Developers

#### 1. Create a New Form Using the Template

```bash
# Generate a customer entry form
npm run generate-form -- --entity=customer --screen=customer_form

# Generate supplier form with specific fields
npm run generate-form -- --entity=supplier --screen=supplier_edit --fields=supplier_code,supplier_name,gstin
```

#### 2. Mark Fields with Registry Keys

```tsx
// ✅ CORRECT: Uses registry
<input
  type="text"
  data-field-key="customer_code"
  data-field-type="customer"
  placeholder="Customer Code"
/>

// ❌ WRONG: No registry integration
<input type="text" placeholder="Customer Code" />
```

#### 3. Use ActiveFieldContext for Lookups

```tsx
import { useActiveField } from "../../context/ActiveFieldContext";

export const MyForm = () => {
  const { insertValueIntoActiveField } = useActiveField();
  
  // F2 lookup is automatic! Just press F2 on any field with data-field-key
  return (
    <input data-field-key="customer_code" />
  );
};
```

#### 4. Test Registry Integration

```bash
# Before committing
npm run validate-registry

# Should see: "✅ All form components follow registry patterns!"
```

---

## Creating New Forms

### Step 1: Check If Field Exists in Registry

```ts
import { getFieldMetadata } from "../../services/globalFieldRegistry";

const fieldMeta = getFieldMetadata("customer_code");
if (!fieldMeta) {
  // Field not registered - need to add it first
  // See "Adding Fields to Registry" section
}
```

### Step 2: Generate Form Component

```bash
npm run generate-form -- \
  --entity=invoice \
  --screen=invoice_entry \
  --fields=invoice_no,customer_code,invoice_date,invoice_amount
```

### Step 3: Add Screen Config (Optional)

If you need custom visibility or width settings:

```ts
// In src/services/globalFieldRegistry.ts
export const GLOBAL_SCREEN_FIELD_CONFIG: ScreenFieldConfig[] = [
  // ... existing configs ...
  
  // New screen config
  { screenId: "invoice_entry", entity: "invoice", fieldKey: "invoice_no", visible: true, displayOrder: 1, widthPct: 12 },
  { screenId: "invoice_entry", entity: "invoice", fieldKey: "customer_code", visible: true, displayOrder: 2, widthPct: 14 },
  // ... more fields ...
];
```

### Step 4: Test the Form

```bash
npm run build

# Should succeed without "Registry Usage" warnings
# Try pressing F2 on any field in the form
```

---

## Adding Fields to Registry

### When to Add a Field

- Creating a new form that needs a field
- Refactoring existing form that uses custom lookup logic
- Adding support for new entity type

### How to Add a Field

#### 1. Add to GLOBAL_FIELD_CATALOG

```ts
// src/services/globalFieldRegistry.ts
export const GLOBAL_FIELD_CATALOG: GlobalFieldDef[] = [
  // ... existing fields ...
  
  {
    id: "invoice_date",
    entity: "invoice",
    fieldKey: "invoice_date",
    label: "Invoice Date",
    dataType: "date",
    required: true,
    aliases: ["date", "inv date", "invoice date"],
    lookupGroup: undefined,  // No F2 lookup for dates
    sourceTable: "invoices",
    displayWidthPct: 12,
    active: true,
    description: "Date when invoice was generated"
  },
  
  {
    id: "invoice_amount",
    entity: "invoice",
    fieldKey: "invoice_amount",
    label: "Invoice Amount",
    dataType: "currency",
    required: true,
    aliases: ["amount", "total", "invoice total"],
    lookupGroup: undefined,
    sourceTable: "invoices",
    displayWidthPct: 14,
    active: true,
    description: "Total invoice amount in ₹"
  }
];
```

#### 2. Add Lookup Rule (If Field Has F2 Lookup)

```ts
// If this field needs F2 lookup
export const GLOBAL_FIELD_LOOKUP_RULES: GlobalFieldLookupRule[] = [
  // ... existing rules ...
  
  {
    lookupGroup: "invoice",
    endpoint: "/sales/invoices",
    searchFields: ["invoice_no", "customer_name", "date"],
    insertValueKeys: ["invoice_no", "id"],
    suggestOnF2: true,
    matchPriority: 10,
    defaultLimit: 200
  }
];
```

#### 3. Add Screen Config (Optional)

```ts
// Only needed if field appears on multiple screens with different rules
export const GLOBAL_SCREEN_FIELD_CONFIG: ScreenFieldConfig[] = [
  // ... existing configs ...
  
  { screenId: "invoice_entry", entity: "invoice", fieldKey: "invoice_date", visible: true, displayOrder: 3 },
  { screenId: "invoice_view", entity: "invoice", fieldKey: "invoice_date", visible: true, displayOrder: 2 },
];
```

#### 4. Add Test Coverage

```ts
// src/tests/globalFieldRegistry.test.ts
it("should resolve invoice_date field from registry", () => {
  const field = getFieldMetadata("invoice_date");
  expect(field).toBeDefined();
  expect(field?.dataType).toBe("date");
  expect(field?.required).toBe(true);
});

it("should have lookup rule for invoice", () => {
  const rule = getLookupMetadata("invoice");
  expect(rule).toBeDefined();
  expect(rule?.endpoint).toBe("/sales/invoices");
});
```

#### 5. Verify and Build

```bash
npm run test         # Ensure tests pass
npm run validate-registry  # Check registry compliance
npm run build        # Full build
```

---

## Automation & Validation

### Pre-Commit Hook

Automatically validates registry usage before each commit:

```bash
# Install hook
cp scripts/pre-commit-registry-check.sh .husky/pre-commit
chmod +x .husky/pre-commit

# Test it
git add src/components/MyNewForm.tsx
git commit -m "Add new form"  # Hook runs automatically
```

### Build-Time Validation

Registry validation now runs automatically during build:

```bash
npm run build
# Output:
# 🔍 Validating Registry Usage Across Codebase...
# 📋 Found 12 form components to validate
# ✅ All form components follow registry patterns!
# Building...
```

### Manual Validation

```bash
npm run validate-registry

# Output:
# ✅ All form components follow registry patterns!
# Registry Validation: PASSED
```

### ESLint Rules (Optional)

To enable ESLint rules for registry validation:

```js
// .eslintrc.cjs
{
  "plugins": ["smriti-registry"],
  "rules": {
    "smriti-registry/require-data-field-key": "warn",
    "smriti-registry/no-hardcoded-fields": "warn"
  }
}
```

Then run: `npm run lint`

---

## Troubleshooting

### "F2 lookup not working for my field"

**Checklist:**
1. ✅ Field has `data-field-key` attribute?
2. ✅ Field key exists in `GLOBAL_FIELD_CATALOG`?
3. ✅ Lookup group has rule in `GLOBAL_FIELD_LOOKUP_RULES`?
4. ✅ Backend endpoint exists and returns data?

**Debug:**
```ts
// Check if field is registered
const field = getFieldMetadata("customer_code");
console.log("Field:", field);

// Check if lookup rule exists
const rule = getLookupMetadata("customer");
console.log("Lookup Rule:", rule);
```

### "Build failed: Registry Usage validation error"

**Solution:**
1. Run `npm run validate-registry` to see specific issues
2. Add `data-field-key` to missing inputs
3. Or move custom lookup logic to registry
4. Run `npm run build` again

### "Field appears in registry but not in my form"

**Check Screen Config:**
```ts
const visibleFields = getVisibleFieldIds("my_form_screen", "customer");
console.log("Visible Fields:", visibleFields);
// If empty, need to add screen config to GLOBAL_SCREEN_FIELD_CONFIG
```

### "Different forms showing different field widths"

**Solution:**
```ts
// Field width is centralized in registry
getFieldMetadata("customer_code")?.displayWidthPct  // Returns 12

// To override on specific screen, add to GLOBAL_SCREEN_FIELD_CONFIG:
{ screenId: "crm_dashboard", entity: "customer", fieldKey: "customer_code", widthPct: 20 }
```

---

## FAQ

### Q: Can I use custom field names instead of registry keys?

**A:** No. Use `data-field-key` with canonical registry names. This ensures:
- F2 lookup works automatically
- Field metadata is resolved consistently
- Validation catches missing definitions

### Q: What if I need a field that's not in the registry?

**A:** Add it! Follow the "Adding Fields to Registry" section. It's designed to be extended without code changes to forms.

### Q: Can I hide/show fields on specific screens?

**A:** Yes! Use `GLOBAL_SCREEN_FIELD_CONFIG`:
```ts
{ screenId: "my_screen", entity: "customer", fieldKey: "gstin", visible: false }
```

### Q: How do I change a field's display label on one screen?

**A:** Use `overrideLabel` in screen config:
```ts
{ screenId: "invoice_form", entity: "customer", fieldKey: "customer_name", overrideLabel: "Bill To" }
```

### Q: What if my API returns data in different format than expected?

**A:** Update the endpoint or add normalization in `GlobalF2LookupModal.normalizeLookupItems()`. The registry defines what fields to search/insert, but the modal handles response shape flexibility.

### Q: Can I have F2 lookups for custom categories?

**A:** Yes! Add to both `GLOBAL_FIELD_CATALOG` and `GLOBAL_FIELD_LOOKUP_RULES`:
```ts
{
  id: "warehouse_code",
  entity: "warehouse",
  fieldKey: "warehouse_code",
  label: "Warehouse",
  lookupGroup: "warehouse",  // New lookup group
  // ... other fields ...
}

{
  lookupGroup: "warehouse",
  endpoint: "/warehouse/list",
  searchFields: ["code", "name"],
  insertValueKeys: ["code", "id"],
  // ... other rules ...
}
```

### Q: Does registry affect performance?

**A:** No. Registry functions run at component initialization (one-time). Lookups use optimized backend queries with limits (default 200 results). No runtime overhead.

### Q: Can multiple screens share field definitions?

**A:** Yes! That's the whole point. Define once in `GLOBAL_FIELD_CATALOG`, configure visibility per-screen in `GLOBAL_SCREEN_FIELD_CONFIG`. Same field, different visibility rules.

---

## Related Documentation

- [Global Field Registry Architecture](./ARCHITECTURE.md)
- [API Endpoint Guide](./API_ENDPOINTS.md)
- [Form Component Patterns](./FORM_PATTERNS.md)
- [Testing Guide](./TESTING.md)

---

## Support

For issues or questions:
1. Check this guide's Troubleshooting section
2. Check [Audit Results](../memories/repo/global-registry-audit-and-automation.md)
3. Review test examples in `src/tests/globalFieldRegistry.test.ts`
4. Contact: support@smritibooks.com

---

**Last Updated:** 2026-09-01  
**Maintained By:** Chief Systems Architect  
**License:** Proprietary Commercial Software
