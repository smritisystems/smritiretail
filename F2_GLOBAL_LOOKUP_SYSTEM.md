# Global F2 Lookup System - Implementation Guide

## Overview

A **unified global F2 key system** has been implemented across the SMRITI Retail OS application. Press **F2** on any input field to instantly access context-aware data lookups for that field.

---

## Architecture

### Core Components

#### 1. **ActiveFieldContext** (`src/context/ActiveFieldContext.tsx`)
- **Purpose**: Global field tracking and F2 detection system
- **Features**:
  - Detects when any input/textarea element is focused
  - Automatically infers field category (customer, product, supplier, etc.) from:
    - `data-f2-browse` attribute (highest priority)
    - `data-field-type` attribute
    - HTML element name, id, placeholder, aria-label, className
  - Manages 18+ field categories
  - Triggers global F2 modal when F2 key is pressed
- **Key Functions**:
  - `inferFieldCategory()` - Smart field type detection
  - `insertValueIntoActiveField()` - Automatically inserts selected value back into the field

#### 2. **GlobalF2LookupModal** (`src/components/common/GlobalF2LookupModal.tsx`)
- **Purpose**: Unified lookup modal for all field types
- **Features**:
  - Auto-adapts UI based on field category
  - Context-aware API endpoints
  - Smart search with debounce
  - Display templates customized per field type
  - Shows all results on focus, filters on typing
  - Keyboard shortcuts: Enter = select first result, Escape = close
- **Supported Field Categories**:
  - `customer` → `/crm/customers`
  - `supplier` → `/crm/suppliers`
  - `product` → `/universal/items`
  - `staff` → `/crm/staff`
  - `store` → `/warehouse/stores`
  - `brand` → `/universal/brands`
  - `category` → `/universal/categories`
  - `hsn` → `/universal/hsn`
  - `uom` → `/universal/uom`
  - `scheme` → `/sales/schemes`
  - `terms` → `/sales/terms`
  - `invoice` → `/sales/invoices`

#### 3. **Global F2 Event Listener** (in ActiveFieldContext)
- Listens for F2 key press globally on the entire application
- Works on any focused input/textarea/contentEditable element
- Respects authentication state (only works when logged in)

---

## How to Use

### For End Users

**Press F2 on any input field** to open the lookup modal for that field type.

**Examples**:
- F2 on Customer Code → Shows list of all customers
- F2 on Product/Barcode field → Shows list of all products
- F2 on Staff field → Shows list of all staff members
- F2 on any field → Shows appropriate data based on field type

**Keyboard Navigation**:
- Type to search/filter results
- Press **Enter** to select the first result
- Press **Escape** to close the modal
- Mouse click to select any item

---

## Integration Guide

### How to Add F2 Support to an Input Field

#### Method 1: Using Data Attributes (Recommended)

Add `data-f2-browse` attribute to your input field:

```tsx
<input
  type="text"
  name="customerCode"
  placeholder="F2"
  data-f2-browse="customer"
  data-field-type="customer"
  title="Press F2 to open customer lookup"
/>
```

**Supported data-f2-browse values**:
- `customer`, `supplier`, `product`, `staff`, `store`, `brand`, `category`, `hsn`, `uom`, `scheme`, `terms`, `invoice`

#### Method 2: Smart Detection

The system automatically detects field type from:
- HTML element name: `customerCode`, `productId`, `staffName`
- Placeholder: `"F2"`, `"Search..."`, `"Enter product"`
- Class names: `customer-field`, `product-lookup`, `staff-select`
- Aria labels: `aria-label="Customer"`

```tsx
// Will auto-detect as "customer" field
<input
  name="customerCode"
  placeholder="Search customer..."
/>
```

#### Method 3: Using Context (Advanced)

For complex scenarios:

```tsx
import { useActiveField } from "../context/ActiveFieldContext";

function MyComponent() {
  const { openF2Modal, setManualCategory } = useActiveField();

  const handleF2Click = () => {
    setManualCategory("product", "Product Lookup");
    openF2Modal();
  };

  return <button onClick={handleF2Click}>Open F2 Modal</button>;
}
```

---

## Field Category Reference

### Customer
- **API Endpoint**: `/crm/customers`
- **Display Format**: `CUST-001 - John Doe (9876543210)`
- **Insert Value**: customer code
- **Detect Keywords**: customer, cust, mobile, phone, client, buyer, debtor, membership

### Supplier
- **API Endpoint**: `/crm/suppliers`
- **Display Format**: `SUPP-001 - ABC Corp (Contact Person)`
- **Insert Value**: supplier code
- **Detect Keywords**: supplier, vendor, seller, party, creditor

### Product / Item
- **API Endpoint**: `/universal/items`
- **Display Format**: `SKU-001 - Product Name (₹500.00)`
- **Insert Value**: item code
- **Detect Keywords**: barcode, scan, sku, product, item, stockno, stock_no, mrp

### Staff
- **API Endpoint**: `/crm/staff`
- **Display Format**: `ST-001 - John Smith (Manager)`
- **Insert Value**: staff code
- **Detect Keywords**: salesman, salesstaff, staff, cashier, employee, executive

### Store / Warehouse
- **API Endpoint**: `/warehouse/stores`
- **Display Format**: `STORE-01 - Main Warehouse (Location)`
- **Insert Value**: store code
- **Detect Keywords**: store, branch, warehouse, godown, location

### Brand
- **API Endpoint**: `/universal/brands`
- **Display Format**: `BRAND-01 - Nike`
- **Insert Value**: brand code
- **Detect Keywords**: brand

### Category
- **API Endpoint**: `/universal/categories`
- **Display Format**: `CAT-01 - Electronics`
- **Insert Value**: category code
- **Detect Keywords**: category, subcat, subcategory, classification

### HSN / GST
- **API Endpoint**: `/universal/hsn`
- **Display Format**: `8517 - Electronic Communication Equipment (GST: 18%)`
- **Insert Value**: HSN code
- **Detect Keywords**: hsn, sac, tax_code, tax, gst

### Unit of Measure (UOM)
- **API Endpoint**: `/universal/uom`
- **Display Format**: `PCS - Pieces`
- **Insert Value**: UOM code
- **Detect Keywords**: uom, unit_of_measure, unit_measure

### Scheme / Promotion
- **API Endpoint**: `/sales/schemes`
- **Display Format**: `PROMO-001 - Summer Sale (Discount: 20%)`
- **Insert Value**: scheme code
- **Detect Keywords**: scheme, disccode, disc_code, promo

### Terms & Conditions
- **API Endpoint**: `/sales/terms`
- **Display Format**: `TERM-001 - Standard Terms`
- **Insert Value**: terms code
- **Detect Keywords**: term, condition

### Invoice / Document
- **API Endpoint**: `/sales/invoices`
- **Display Format**: `INV-001 - Customer Name (2026-08-31)`
- **Insert Value**: invoice number
- **Detect Keywords**: invoice, bill, order, po, voucher

---

## Implementation in SalesOrderFormPremium

### Example: Customer Code Field
```tsx
<input
  type="text"
  value={formData.customerCode || ""}
  onChange={(e) => onFieldChange("customerCode", e.target.value)}
  data-f2-browse="customer"
  data-field-type="customer"
  placeholder="F2"
  title="Press F2 to open customer lookup"
  className="w-24 px-1.5 py-1 border rounded text-xs bg-white focus:ring-2 focus:ring-blue-400"
/>
```

### Example: Barcode Scanner Field
```tsx
<input
  type="text"
  value={scannerInput}
  onChange={(e) => setScannerInput(e.target.value)}
  data-f2-browse="product"
  data-field-type="product"
  placeholder="Click to view all items, or type to search..."
  title="Press F2 to open product lookup"
  className="w-full px-2.5 py-2 border rounded-lg text-sm font-mono"
/>
```

### Example: Stock No Field (in Item Grid)
```tsx
<input
  type="text"
  value={item.stockNo}
  onChange={(e) => handleItemChange(index, "stockNo", e.target.value)}
  data-f2-browse="product"
  data-field-type="product"
  title="Press F2 for product lookup"
  placeholder="F2 or click"
  className="w-full px-2 py-1.5 border rounded text-xs font-mono"
/>
```

---

## Global App Integration

### In App.tsx

```tsx
// 1. Import the GlobalF2LookupModal
import { GlobalF2LookupModal } from "./components/common/GlobalF2LookupModal.tsx";

// 2. Ensure ActiveFieldProvider is wrapping the app
export const App: React.FC = () => {
  return (
    <PrintProvider>
      <NotificationProvider>
        <DrillDownProvider>
          <ActiveFieldProvider>  {/* ← F2 system enabled here */}
            <LayoutEngineProvider>
              <WorkspaceProvider>
                <ShortcutProvider>
                  <ContextProvider>
                    <AppContent />
                    <GlobalF2LookupModal /> {/* ← Add this line */}
                    <ShortcutPalette />
                  </ContextProvider>
                </ShortcutProvider>
              </WorkspaceProvider>
            </LayoutEngineProvider>
          </ActiveFieldProvider>
        </DrillDownProvider>
      </NotificationProvider>
    </PrintProvider>
  );
};
```

---

## Advanced Features

### Auto-Populated Values

When a user selects an item from F2 lookup, the value is automatically:
1. Inserted into the focused input field
2. Triggers `onChange` event for React state update
3. Works seamlessly with form validation

### Smart Field Detection Algorithm

1. **Check explicit attributes** (highest priority):
   - `data-f2-browse="category"`
   - `data-field-type="category"`
   - `data-lookup="category"`

2. **Analyze HTML properties**:
   - Input name: `customerCode` → detects "customer"
   - Element id: `productLookup` → detects "product"
   - Placeholder: "Search customer..." → detects "customer"
   - Aria-label: "Customer Field" → detects "customer"

3. **Search element classes**:
   - `.customer-field` → detects "customer"
   - `.product-lookup` → detects "product"

4. **Fallback**: Generic global search

### Search / Filter Behavior

- **Empty search**: Shows all items (limit 100)
- **Type to search**: Filters on `query` parameter
- **Debounce**: 200ms for API calls
- **Local fallback**: Falls back to local filtering if API fails

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `F2` | Open/toggle F2 modal for focused field |
| `Enter` | Select first search result |
| `Escape` | Close F2 modal and refocus field |
| `Ctrl+K` | Global search (alternate) |

---

## Configuration

### API Endpoints

Modify `ENDPOINT_MAP` in `GlobalF2LookupModal.tsx` to add/change endpoints:

```tsx
const ENDPOINT_MAP: Record<string, string> = {
  customer: "/crm/customers",
  supplier: "/crm/suppliers",
  product: "/universal/items",
  // Add more...
};
```

### Display Templates

Customize how items appear in the dropdown:

```tsx
const DISPLAY_TEMPLATES: Record<string, (item: any) => string> = {
  customer: (item) => `${item.code} - ${item.name} (${item.mobile})`,
  product: (item) => `${item.item_code} - ${item.item_name} (₹${item.selling_price})`,
  // Add more...
};
```

### Primary Fields

Define which field to insert when a user selects an item:

```tsx
const PRIMARY_FIELD_MAP: Record<string, string> = {
  customer: "code",        // Insert customer.code
  product: "item_code",    // Insert product.item_code
  staff: "code",           // Insert staff.code
  // Add more...
};
```

---

## Backward Compatibility

- Existing individual modals (CustomerLookupModal, StockLookupModal) are still available as fallback
- Old F2 implementations continue to work
- New data attributes enable the global system without breaking old code
- Graceful degradation if GlobalF2LookupModal is not available

---

## File Locations

```
src/
├── context/
│   └── ActiveFieldContext.tsx          ← Global F2 detection & context
├── components/
│   └── common/
│       └── GlobalF2LookupModal.tsx     ← Unified F2 modal component
└── App.tsx                             ← F2 provider wrapper
```

---

## Quick Start Checklist

- [x] Add `data-f2-browse="fieldType"` to input fields
- [x] GlobalF2LookupModal is mounted in App.tsx
- [x] ActiveFieldProvider wraps the application
- [x] Press F2 on any input field to test
- [x] Select an item to auto-populate the field

---

## Troubleshooting

### F2 Modal Not Opening
- Ensure ActiveFieldProvider is wrapping the app
- Check that GlobalF2LookupModal is mounted in App.tsx
- Verify the input field is properly focused
- Check browser console for errors

### Wrong Field Type Detected
- Add explicit `data-f2-browse="correctType"` attribute
- The system will prioritize explicit attributes over auto-detection

### API Error on Search
- Check `/api/v1/{endpoint}?query=...` is available
- Verify authentication token is present
- Check network tab in browser DevTools

### Value Not Inserting
- Ensure the field is properly focused when selecting
- Check that `insertValueIntoActiveField` has permission to write to the field
- Verify PRIMARY_FIELD_MAP has entry for that field type

---

## Future Enhancements

- [ ] Keyboard arrow key navigation in dropdown
- [ ] Multi-select for bulk operations
- [ ] Recent/favorite items section
- [ ] Custom filters per field type
- [ ] Configurable hotkeys (Ctrl+F2, Shift+F2, etc.)
- [ ] Performance optimization for large datasets
- [ ] Advanced filtering UI (date ranges, price ranges, etc.)
- [ ] F2 statistics and usage tracking

---

## Support

For issues or enhancements, refer to the codebase:
- `src/context/ActiveFieldContext.tsx` - Field detection logic
- `src/components/common/GlobalF2LookupModal.tsx` - Modal UI and API calls
- Check existing implementations in SalesOrderFormPremium.tsx

**Version**: 1.0.0  
**Last Updated**: 2026-09-01  
**Author**: Jawahar Ramkripal Mallah
