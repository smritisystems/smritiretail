<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Classification: Internal
  Document     : PriceBook System - Technical Implementation Guide
-->

# 📋 PRICE BOOK SYSTEM - TECHNICAL IMPLEMENTATION GUIDE
## For Developers Building the UI/Backend Features

**Version:** 1.0  
**Last Updated:** 2026-09-05  
**Status:** READY FOR IMPLEMENTATION

---

## Quick Links
1. [API Endpoints Reference](#api-endpoints-reference)
2. [Database Schema](#database-schema)
3. [Data Flow Diagrams](#data-flow-diagrams)
4. [Frontend Component Structure](#frontend-component-structure)
5. [State Management](#state-management)
6. [Form Validation Rules](#form-validation-rules)
7. [API Request/Response Examples](#api-requestresponse-examples)
8. [Error Codes & Handling](#error-codes--handling)
9. [Testing Checklist](#testing-checklist)
10. [Performance Optimization](#performance-optimization)

---

## API ENDPOINTS REFERENCE

## UNIVERSAL IMPORT CONTRACT

All import-capable screens should use one normalized row contract before calling a module-specific commit endpoint:

```typescript
type UniversalImportTarget =
  | "ITEM_MASTER" | "PRICE_BOOK" | "PURCHASE_INWARD"
  | "SALES_ORDER" | "SALES_RETURN" | "STOCK_ADJUSTMENT"
  | "LABEL_PRINT";

interface UniversalImportRow {
  rowNumber: number;
  identifier: string;
  identifierType: "BARCODE" | "SKU" | "ITEM_CODE" | "STYLE_SIZE_COLOR" | "STYLE_SIZE_COLOR_BRAND";
  identity: {
    styleArticle?: string;
    size?: string;
    color?: string;
    brand?: string;
  };
  quantity: number;
  mrp?: number;
  sellingPrice?: number;
  costPrice?: number;
  raw: Record<string, unknown>;
}
```

Identifier resolution priority is barcode, SKU/variant SKU, item code, then `style/article + size + color`, with brand used to disambiguate. Composite matching must return `Needs Review` when multiple variants match; it must not select an arbitrary record.

The current frontend implementation starts this contract in `src/services/universalImportEngine.ts`. It normalizes barcode/SKU/item-code input, supports optional quantity and price fields, rejects duplicate identifiers, and blocks selling price above MRP before a commit is attempted.

Recommended server workflow:

```text
POST /api/v1/import/preview
  -> resolve every identifier in tenant/branch context
  -> return matched, new, warning, and error rows

POST /api/v1/import/commit
  -> require target + preview token + user confirmation
  -> invoke target-specific service
  -> return row-level created/updated/skipped results
```

Do not make `/import/commit` infer the target from the file. The target must be explicitly selected by the user and authorized by role.

### Price Book Management

#### 1. Create Price Book
```http
POST /api/v1/pricing/books
Content-Type: application/json

{
  "name": "Diwali Festival Sale 2026",
  "code": "PB-DIWALI-2026",
  "currency": "INR",
  "channel": "RETAIL",
  "is_default": false,
  "valid_from": "2026-10-01T00:00:00Z",
  "valid_to": "2026-10-15T23:59:59Z",
  "status": "INACTIVE",
  "description": "Special prices during Diwali festival"
}

RESPONSE (201 Created):
{
  "id": "pb_a1b2c3d4e5f6",
  "code": "PB-DIWALI-2026",
  "name": "Diwali Festival Sale 2026",
  "currency": "INR",
  "is_default": false,
  "status": "INACTIVE",
  "valid_from": "2026-10-01T00:00:00Z",
  "valid_to": "2026-10-15T23:59:59Z",
  "description": "Special prices during Diwali festival",
  "entries_count": 0,
  "created_at": "2026-09-05T14:30:00Z",
  "created_by": "user_123"
}
```

#### 2. List Price Books
```http
GET /api/v1/pricing/books?status=ACTIVE

RESPONSE (200 OK):
{
  "items": [
    {
      "id": "pb_retail_001",
      "code": "PB-RETAIL",
      "name": "Retail Default",
      "currency": "INR",
      "is_default": true,
      "status": "ACTIVE",
      "valid_from": null,
      "valid_to": null,
      "description": "Default retail pricing",
      "entries_count": 380,
      "created_at": "2026-08-15T10:00:00Z"
    },
    {
      "id": "pb_a1b2c3d4e5f6",
      "code": "PB-DIWALI-2026",
      "name": "Diwali Festival Sale 2026",
      "currency": "INR",
      "is_default": false,
      "status": "ACTIVE",
      "valid_from": "2026-10-01T00:00:00Z",
      "valid_to": "2026-10-15T23:59:59Z",
      "description": "Festival special prices",
      "entries_count": 120,
      "created_at": "2026-09-05T14:30:00Z"
    }
  ],
  "total": 12,
  "page": 1,
  "page_size": 20
}
```

#### 3. Update Price Book
```http
PATCH /api/v1/pricing/books/{book_id}
Content-Type: application/json

{
  "name": "Diwali Festival Sale 2026 - Extended",
  "valid_to": "2026-10-20T23:59:59Z",
  "status": "ACTIVE",
  "is_default": false
}

RESPONSE (200 OK):
{
  "id": "pb_a1b2c3d4e5f6",
  "code": "PB-DIWALI-2026",
  "name": "Diwali Festival Sale 2026 - Extended",
  ...
  "modified_at": "2026-09-05T15:00:00Z",
  "updated_by": "user_456"
}
```

#### 4. Delete Price Book (Soft Delete - Archive)
```http
DELETE /api/v1/pricing/books/{book_id}

RESPONSE (200 OK):
{
  "message": "Price Book archived successfully",
  "id": "pb_a1b2c3d4e5f6",
  "status": "ARCHIVED",
  "archived_at": "2026-09-05T15:05:00Z",
  "archived_by": "user_123"
}
```

---

### Price Book Entry Management

#### 1. Add/Update Product to Price Book
```http
POST /api/v1/pricing/books/{book_id}/entries
Content-Type: application/json

{
  "item_id": "itm_rice_5kg_001",
  "variant_id": null,
  "min_quantity": 1.0,
  "selling_price": 399.00,
  "mrp": 500.00,
  "cost_price": 300.00
}

RESPONSE (201 Created):
{
  "id": "pbe_x1y2z3a4b5c6",
  "price_book_id": "pb_a1b2c3d4e5f6",
  "item_id": "itm_rice_5kg_001",
  "variant_id": null,
  "min_quantity": 1.0,
  "selling_price": 399.00,
  "mrp": 500.00,
  "cost_price": 300.00,
  "created_at": "2026-09-05T14:35:00Z"
}

Note: If entry with same item_id + variant_id + min_quantity exists,
it UPDATES the existing entry instead of creating new one.
```

#### 2. Add Volume Break Tier to Product
```http
POST /api/v1/pricing/books/{book_id}/entries
Content-Type: application/json

{
  "item_id": "itm_rice_5kg_001",
  "variant_id": null,
  "min_quantity": 10.0,        ← Different min_quantity
  "selling_price": 379.00,     ← Lower price for bulk
  "mrp": 500.00,
  "cost_price": 300.00
}

RESPONSE (201 Created):
{
  "id": "pbe_p1q2r3s4t5u6",
  ...
  "min_quantity": 10.0,
  "selling_price": 379.00,
  ...
}

Now same product has TWO tiers:
├─ Tier 1: Qty 1+   → ₹399
└─ Tier 2: Qty 10+  → ₹379
```

#### 3. Get All Entries in Price Book
```http
GET /api/v1/pricing/books/{book_id}/entries?page=1&limit=20

RESPONSE (200 OK):
{
  "items": [
    {
      "id": "pbe_x1y2z3a4b5c6",
      "price_book_id": "pb_a1b2c3d4e5f6",
      "item_id": "itm_rice_5kg_001",
      "item_name": "Basmati Rice 5kg",
      "variant_id": null,
      "min_quantity": 1.0,
      "selling_price": 399.00,
      "mrp": 500.00,
      "cost_price": 300.00,
      "margin_percentage": 24.8,
      "created_at": "2026-09-05T14:35:00Z"
    },
    {
      "id": "pbe_p1q2r3s4t5u6",
      "price_book_id": "pb_a1b2c3d4e5f6",
      "item_id": "itm_rice_5kg_001",
      "item_name": "Basmati Rice 5kg",
      "variant_id": null,
      "min_quantity": 10.0,
      "selling_price": 379.00,
      "mrp": 500.00,
      "cost_price": 300.00,
      "margin_percentage": 21.1,
      "created_at": "2026-09-05T14:36:00Z"
    }
  ],
  "total": 120,
  "page": 1,
  "page_size": 20
}
```

#### 4. Delete Price Book Entry
```http
DELETE /api/v1/pricing/books/{book_id}/entries/{entry_id}

RESPONSE (200 OK):
{
  "message": "Entry deleted successfully",
  "id": "pbe_x1y2z3a4b5c6"
}
```

---

### Customer Price Tier Management

#### 1. Create Customer Tier
```http
POST /api/v1/pricing/tiers
Content-Type: application/json

{
  "name": "Wholesale Distributor",
  "code": "TIER-WHOLESALE",
  "price_book_id": "pb_wholesale_001",
  "discount_percentage": 5.0,
  "description": "For all wholesale dealers and distributors"
}

RESPONSE (201 Created):
{
  "id": "cpt_m1n2o3p4q5r6",
  "code": "TIER-WHOLESALE",
  "name": "Wholesale Distributor",
  "price_book_id": "pb_wholesale_001",
  "discount_percentage": 5.0,
  "description": "For all wholesale dealers and distributors",
  "created_at": "2026-09-05T15:10:00Z"
}
```

#### 2. List Customer Tiers
```http
GET /api/v1/pricing/tiers

RESPONSE (200 OK):
{
  "items": [
    {
      "id": "cpt_retail_001",
      "code": "TIER-RETAIL",
      "name": "Retail Customer",
      "price_book_id": null,
      "discount_percentage": 0.0,
      "description": "Default tier for retail customers",
      "customer_count": 1245
    },
    {
      "id": "cpt_m1n2o3p4q5r6",
      "code": "TIER-WHOLESALE",
      "name": "Wholesale Distributor",
      "price_book_id": "pb_wholesale_001",
      "discount_percentage": 5.0,
      "description": "For all wholesale dealers",
      "customer_count": 89
    }
  ],
  "total": 4
}
```

---

### Pricing Resolution & Calculation

#### 1. Calculate Single Item Price
```http
POST /api/v1/pricing/resolve
Content-Type: application/json

{
  "item_id": "itm_rice_5kg_001",
  "variant_id": null,
  "quantity": 25.0,
  "price_book_code": "PB-DIWALI-2026",
  "customer_tier_code": null,
  "as_of_date": "2026-10-05T12:00:00Z"
}

RESPONSE (200 OK):
{
  "item_id": "itm_rice_5kg_001",
  "variant_id": null,
  "quantity": 25.0,
  "base_mrp": 500.00,
  "base_selling_price": 500.00,
  "effective_unit_price": 359.00,
  "line_subtotal": 8975.00,
  "applied_price_book": "PB-DIWALI-2026",
  "applied_tier": null,
  "discount_percentage": 0.0,
  "pricing_source": "PRICE_BOOK_VOLUME",
  "rule_version": 1,
  "calculation_details": {
    "step_1": "Checked explicit price book: PB-DIWALI-2026 ✓",
    "step_2": "Price book valid for date: Oct 5, 2026 ✓",
    "step_3": "Found volume tier: qty 25 → min_quantity 10 ✓",
    "step_4": "Applied price: ₹359.00",
    "step_5": "Applied customer tier discount: 0%",
    "final_price": "₹359.00 × 25 = ₹8,975.00"
  }
}
```

#### 2. Calculate Bulk Cart Pricing
```http
POST /api/v1/pricing/resolve/bulk
Content-Type: application/json

{
  "items": [
    {
      "item_id": "itm_rice_5kg_001",
      "variant_id": null,
      "quantity": 50.0,
      "custom_discount_percentage": 0.0
    },
    {
      "item_id": "itm_oil_5l_001",
      "variant_id": null,
      "quantity": 10.0,
      "custom_discount_percentage": 2.0
    }
  ],
  "price_book_code": "PB-WHOLESALE-2026",
  "customer_tier_code": "TIER-WHOLESALE",
  "as_of_date": "2026-09-05T12:00:00Z"
}

RESPONSE (200 OK):
{
  "order_total": 26850.00,
  "subtotal": 26850.00,
  "total_discount": 1485.00,
  "effective_discount_percentage": 5.25,
  "line_items": [
    {
      "item_id": "itm_rice_5kg_001",
      "item_name": "Basmati Rice 5kg",
      "quantity": 50.0,
      "unit_price": 395.00,
      "line_subtotal": 19750.00,
      "applied_price_book": "PB-WHOLESALE-2026",
      "pricing_source": "PRICE_BOOK_VOLUME"
    },
    {
      "item_id": "itm_oil_5l_001",
      "item_name": "Soybean Oil 5L",
      "quantity": 10.0,
      "unit_price": 735.20,
      "line_subtotal": 7352.00,
      "applied_price_book": "PB-WHOLESALE-2026",
      "pricing_source": "PRICE_BOOK_VOLUME",
      "custom_discount_applied": 2.0
    }
  ],
  "applied_tier": "TIER-WHOLESALE",
  "tier_discount_percentage": 5.0,
  "calculation_timestamp": "2026-09-05T12:00:00Z"
}
```

---

## DATABASE SCHEMA

### Table: price_books

```sql
CREATE TABLE price_books (
    id VARCHAR(50) PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
    branch_id VARCHAR(50) REFERENCES branches(id),
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    currency VARCHAR(10) DEFAULT 'INR',
    is_default BOOLEAN DEFAULT FALSE,
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_to TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) DEFAULT 'ACTIVE',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(100),
    version INTEGER DEFAULT 1,
    
    UNIQUE(company_id, code),
    INDEX(status),
    INDEX(is_default),
    INDEX(valid_from),
    INDEX(valid_to)
);
```

### Table: price_book_entries

```sql
CREATE TABLE price_book_entries (
    id VARCHAR(50) PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
    branch_id VARCHAR(50) REFERENCES branches(id),
    price_book_id VARCHAR(50) NOT NULL REFERENCES price_books(id) ON DELETE CASCADE,
    item_id VARCHAR(50) NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    variant_id VARCHAR(50) REFERENCES item_variants(id) ON DELETE CASCADE,
    min_quantity NUMERIC(12, 4) DEFAULT 1.0000,
    selling_price NUMERIC(15, 2) NOT NULL,
    mrp NUMERIC(15, 2) NOT NULL,
    cost_price NUMERIC(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1,
    
    UNIQUE(price_book_id, item_id, variant_id, min_quantity),
    INDEX(price_book_id),
    INDEX(item_id),
    INDEX(variant_id),
    INDEX(min_quantity)
);
```

### Table: customer_price_tiers

```sql
CREATE TABLE customer_price_tiers (
    id VARCHAR(50) PRIMARY KEY,
    company_id VARCHAR(50) NOT NULL REFERENCES companies(id),
    branch_id VARCHAR(50) REFERENCES branches(id),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL UNIQUE,
    price_book_id VARCHAR(50) REFERENCES price_books(id) ON DELETE SET NULL,
    discount_percentage NUMERIC(5, 2) DEFAULT 0.00,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1,
    
    UNIQUE(company_id, code),
    INDEX(code),
    INDEX(is_active)
);
```

---

## DATA FLOW DIAGRAMS

### Flow 1: Create Price Book with Products

```
┌─────────────────────────────────────────────────────────────┐
│ USER: Manager creates new Price Book                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND: PriceBookForm.tsx                                 │
│ • Validates inputs (name, code, dates)                      │
│ • Shows error messages                                       │
│ • Enables/disables fields based on status                   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ API REQUEST: POST /api/v1/pricing/books                     │
│ {                                                            │
│   "name": "Diwali Festival Sale",                           │
│   "code": "PB-DIWALI-2026",                                 │
│   "valid_from": "2026-10-01T00:00:00Z",                     │
│   ...                                                        │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ BACKEND: pricing.py router                                  │
│ • Extract company_id from auth context                      │
│ • Call PricingEngine.create_price_book()                    │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ DATABASE: Write to price_books table                        │
│ • Generate unique ID (pb_xxx)                              │
│ • Set created_at = NOW()                                    │
│ • Set created_by = current_user                             │
│ • Set is_default=false, status=INACTIVE                     │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ RESPONSE: Return PriceBookResponse                          │
│ {                                                            │
│   "id": "pb_a1b2c3d4e5f6",                                 │
│   "code": "PB-DIWALI-2026",                                │
│   "status": "INACTIVE",                                     │
│   ...                                                        │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND: Store book_id in React state                      │
│ • Redirect to "Add Products" page                           │
│ • Show product entry form                                   │
│ • User can now add items to this book                       │
└─────────────────────────────────────────────────────────────┘
```

### Flow 2: Price Resolution When Customer Orders

```
┌─────────────────────────────────────────────────────────────┐
│ CUSTOMER: Places Order via POS/Web                          │
│ • Customer: ABC Distributors                                │
│ • Product: Basmati Rice 5kg                                 │
│ • Quantity: 50 bags                                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND: OrderForm.tsx                                     │
│ • Show "Calculating price..." spinner                       │
│ • Call pricing calculator API                               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ API REQUEST: POST /api/v1/pricing/resolve                   │
│ {                                                            │
│   "item_id": "itm_rice_5kg_001",                            │
│   "quantity": 50,                                            │
│   "customer_tier_code": "TIER-WHOLESALE"                    │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ BACKEND: PricingEngine.calculate_effective_price()          │
│                                                              │
│ STEP 1: Look up customer → ABC Distributors                 │
│         Find tier → TIER-WHOLESALE                          │
│         Find tier's price book → PB-WHOLESALE-2026          │
│                                                              │
│ STEP 2: Query price book entries:                           │
│         WHERE price_book = PB-WHOLESALE-2026                │
│         AND item = itm_rice_5kg_001                         │
│         AND min_quantity <= 50                              │
│         ORDER BY min_quantity DESC                          │
│                                                              │
│ STEP 3: Found entry:                                        │
│         min_quantity=50, selling_price=₹395                 │
│                                                              │
│ STEP 4: Apply tier discount (5%):                           │
│         ₹395 × (1 - 0.05) = ₹375.25                         │
│                                                              │
│ STEP 5: Calculate total:                                    │
│         ₹375.25 × 50 = ₹18,762.50                           │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ DATABASE: Read-only operations                              │
│ • Query price_books table (indexed on code)                │
│ • Query price_book_entries table (indexed on item_id, qty)  │
│ • Query customer_price_tiers (indexed on code)              │
│ • All indexes ensure sub-millisecond response               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ RESPONSE: Return PricingResolutionResponse                  │
│ {                                                            │
│   "item_id": "itm_rice_5kg_001",                            │
│   "quantity": 50,                                            │
│   "base_selling_price": 500.00,                             │
│   "effective_unit_price": 375.25,                           │
│   "line_subtotal": 18762.50,                                │
│   "applied_price_book": "PB-WHOLESALE-2026",               │
│   "applied_tier": "TIER-WHOLESALE",                         │
│   "discount_percentage": 5.0,                               │
│   "pricing_source": "PRICE_BOOK_VOLUME"                     │
│ }                                                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND: Display Price                                     │
│ ┌────────────────────────────────────┐                      │
│ │ Item:      Basmati Rice 5kg         │                      │
│ │ Quantity:  50 bags                  │                      │
│ │ Unit Price: ₹375.25 (was ₹500)      │                      │
│ │ Line Total: ₹18,762.50              │                      │
│ │ Applied:   TIER-WHOLESALE           │                      │
│ └────────────────────────────────────┘                      │
│                                                              │
│ • Show calculation breakdown                                │
│ • Highlight discounts applied                               │
│ • Allow user to proceed or modify                           │
└─────────────────────────────────────────────────────────────┘
```

---

## FRONTEND COMPONENT STRUCTURE

### Component Tree

```
App/
├── PricingModule/
│   ├── PriceBookList.tsx
│   │   ├── PriceBookCard.tsx (individual book card)
│   │   ├── PriceBookFilters.tsx
│   │   └── PriceBookActions.tsx (CRUD buttons)
│   │
│   ├── PriceBookForm.tsx (Create/Edit header)
│   │   ├── BasicInfoSection.tsx
│   │   ├── ValidityPeriodSection.tsx
│   │   └── SettingsSection.tsx
│   │
│   ├── ProductEntriesManager.tsx
│   │   ├── ProductEntryList.tsx
│   │   │   └── ProductEntryRow.tsx (each product)
│   │   │
│   │   ├── AddProductForm.tsx
│   │   │   ├── ProductSelector.tsx (F2 lookup)
│   │   │   ├── PricingSection.tsx
│   │   │   └── VolumeTiersList.tsx
│   │   │       └── AddTierForm.tsx
│   │   │
│   │   └── BulkImportCSV.tsx
│   │
│   ├── CustomerTierManager.tsx
│   │   ├── TierList.tsx
│   │   │   └── TierRow.tsx
│   │   │
│   │   └── CreateTierForm.tsx
│   │
│   ├── PriceCalculator.tsx (Resolve pricing)
│   │   ├── CalculatorForm.tsx
│   │   └── PricingResultDisplay.tsx
│   │
│   └── AuditLog.tsx (Price change history)
│       └── AuditLogEntry.tsx
```

---

## STATE MANAGEMENT

### Redux Store Structure

```javascript
// store/slices/pricing.ts

interface PricingState {
  priceBooks: {
    list: PriceBook[];
    current: PriceBook | null;
    loading: boolean;
    error: string | null;
    filters: {
      status: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
      channel: string;
      dateRange: [Date, Date] | null;
      searchText: string;
    };
    pagination: {
      page: number;
      pageSize: number;
      total: number;
    };
  };
  
  priceBookEntries: {
    list: PriceBookEntry[];
    byBookId: Record<string, PriceBookEntry[]>;
    loading: boolean;
    error: string | null;
  };
  
  customerTiers: {
    list: CustomerPriceTier[];
    loading: boolean;
    error: string | null;
  };
  
  pricingCalculation: {
    result: PricingResolutionResponse | null;
    loading: boolean;
    error: string | null;
    lastCalculation: {
      itemId: string;
      quantity: number;
      timestamp: Date;
    } | null;
  };
  
  auditLog: {
    entries: AuditLogEntry[];
    loading: boolean;
    filter: {
      action: string;
      dateRange: [Date, Date];
      user: string;
    };
  };
}

// Actions
export const pricingSlice = createSlice({
  name: 'pricing',
  initialState,
  reducers: {
    // Price Book actions
    setPriceBooks: (state, action) => { ... },
    setPriceBookLoading: (state, action) => { ... },
    addPriceBook: (state, action) => { ... },
    updatePriceBook: (state, action) => { ... },
    deletePriceBook: (state, action) => { ... },
    
    // Product Entry actions
    setProductEntries: (state, action) => { ... },
    addProductEntry: (state, action) => { ... },
    updateProductEntry: (state, action) => { ... },
    
    // Customer Tier actions
    setCustomerTiers: (state, action) => { ... },
    
    // Pricing Calculation
    setPricingResult: (state, action) => { ... },
  },
  extraReducers: (builder) => {
    // Handle async thunks
    builder
      .addCase(fetchPriceBooks.pending, ...)
      .addCase(fetchPriceBooks.fulfilled, ...)
      .addCase(fetchPriceBooks.rejected, ...);
  }
});
```

---

## FORM VALIDATION RULES

### Price Book Form Validation

```javascript
const priceBookSchema = Yup.object().shape({
  name: Yup.string()
    .required('Price Book name is required')
    .max(200, 'Name must not exceed 200 characters')
    .test('unique-name', 'This name already exists', async (value) => {
      // Check against existing price books
      return isUniquePriceBookName(value);
    }),
  
  code: Yup.string()
    .required('Code is required')
    .max(50, 'Code must not exceed 50 characters')
    .matches(
      /^[A-Z0-9-]+$/,
      'Code must contain only letters, numbers, and hyphens'
    )
    .test('unique-code', 'This code already exists', async (value) => {
      return isUniquePriceBookCode(value);
    }),
  
  channel: Yup.string()
    .required('Channel must be selected')
    .oneOf(['RETAIL', 'WHOLESALE', 'B2B', 'ECOMMERCE', 'POS']),
  
  currency: Yup.string()
    .required('Currency is required')
    .length(3, 'Currency must be 3 characters'),
  
  valid_from: Yup.date()
    .nullable()
    .typeError('Invalid date format')
    .test('valid-from-lt-to', 'Start date must be before end date', function(value) {
      const { valid_to } = this.parent;
      if (!value || !valid_to) return true;
      return value < valid_to;
    }),
  
  valid_to: Yup.date()
    .nullable()
    .typeError('Invalid date format')
    .test('valid-to-gt-from', 'End date must be after start date', function(value) {
      const { valid_from } = this.parent;
      if (!value || !valid_from) return true;
      return value > valid_from;
    }),
  
  is_default: Yup.boolean()
    .test('only-one-default', 'Only one default price book allowed', async (value) => {
      if (!value) return true;
      return !(await hasExistingDefault());
    }),
  
  status: Yup.string()
    .required('Status is required')
    .oneOf(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
});
```

### Price Book Entry Validation

```javascript
const priceBookEntrySchema = Yup.object().shape({
  item_id: Yup.string()
    .required('Product is required')
    .test('item-exists', 'Product not found', async (value) => {
      return itemExists(value);
    }),
  
  min_quantity: Yup.number()
    .required('Minimum quantity is required')
    .positive('Quantity must be greater than 0')
    .test('qty-format', 'Must have max 4 decimal places', (value) => {
      return (value.toString().split('.')[1] || '').length <= 4;
    })
    .test('qty-unique', 'This quantity tier already exists', async function(value) {
      const { item_id, variant_id } = this.parent;
      return !(await tierExistsForItem(item_id, variant_id, value));
    })
    .test('qty-sequence', 'Quantity must be greater than previous tier', function(value) {
      const { previousTierMinQty } = this.parent;
      if (!previousTierMinQty) return true;
      return value > previousTierMinQty;
    }),
  
  selling_price: Yup.number()
    .required('Selling price is required')
    .positive('Price must be greater than 0')
    .test('price-lte-mrp', 'Selling price cannot exceed MRP', function(value) {
      const { mrp } = this.parent;
      return value <= mrp;
    })
    .test('price-format', 'Price must have max 2 decimal places', (value) => {
      return (value.toString().split('.')[1] || '').length <= 2;
    }),
  
  mrp: Yup.number()
    .required('MRP is required')
    .positive('MRP must be greater than 0')
    .test('mrp-format', 'MRP must have max 2 decimal places', (value) => {
      return (value.toString().split('.')[1] || '').length <= 2;
    }),
  
  cost_price: Yup.number()
    .nullable()
    .positive('Cost price must be greater than 0 or left blank')
    .test('cost-format', 'Cost must have max 2 decimal places', (value) => {
      if (!value) return true;
      return (value.toString().split('.')[1] || '').length <= 2;
    })
    .test('cost-lt-selling', 'Cost price should be less than selling price', function(value) {
      const { selling_price } = this.parent;
      if (!value) return true;
      return value <= selling_price;
    })
});
```

---

## API REQUEST/RESPONSE EXAMPLES

### Scenario: Diwali Campaign Setup

**Step 1: Create Price Book**
```json
POST /api/v1/pricing/books

REQUEST:
{
  "name": "Diwali Festival Sale 2026",
  "code": "PB-DIWALI-2026",
  "currency": "INR",
  "channel": "RETAIL",
  "is_default": false,
  "valid_from": "2026-10-01T00:00:00+05:30",
  "valid_to": "2026-10-15T23:59:59+05:30",
  "status": "INACTIVE",
  "description": "30% discount campaign during Diwali festival"
}

RESPONSE (201):
{
  "id": "pb_d1e2f3g4h5i6",
  "code": "PB-DIWALI-2026",
  "name": "Diwali Festival Sale 2026",
  "currency": "INR",
  "is_default": false,
  "status": "INACTIVE",
  "valid_from": "2026-10-01T00:00:00+05:30",
  "valid_to": "2026-10-15T23:59:59+05:30",
  "description": "30% discount campaign during Diwali festival",
  "entries_count": 0,
  "created_at": "2026-09-05T14:30:00Z",
  "created_by": "user_pricing_mgr"
}
```

**Step 2: Add Products to Campaign**
```json
POST /api/v1/pricing/books/pb_d1e2f3g4h5i6/entries

REQUEST:
{
  "item_id": "itm_rice_5kg_001",
  "variant_id": null,
  "min_quantity": 1.0,
  "selling_price": 350.00,
  "mrp": 500.00,
  "cost_price": 300.00
}

RESPONSE (201):
{
  "id": "pbe_a1b2c3d4e5f6",
  "price_book_id": "pb_d1e2f3g4h5i6",
  "item_id": "itm_rice_5kg_001",
  "item_name": "Basmati Rice 5kg",
  "variant_id": null,
  "min_quantity": 1.0,
  "selling_price": 350.00,
  "mrp": 500.00,
  "cost_price": 300.00,
  "margin_percentage": 14.29,
  "created_at": "2026-09-05T14:35:00Z"
}
```

**Step 3: Add Volume Tier**
```json
POST /api/v1/pricing/books/pb_d1e2f3g4h5i6/entries

REQUEST:
{
  "item_id": "itm_rice_5kg_001",
  "variant_id": null,
  "min_quantity": 10.0,
  "selling_price": 330.00,
  "mrp": 500.00,
  "cost_price": 300.00
}

RESPONSE (201):
{
  "id": "pbe_g7h8i9j0k1l2",
  "price_book_id": "pb_d1e2f3g4h5i6",
  "item_id": "itm_rice_5kg_001",
  "min_quantity": 10.0,
  "selling_price": 330.00,
  ...
}
```

**Step 4: Activate Price Book (Change Status)**
```json
PATCH /api/v1/pricing/books/pb_d1e2f3g4h5i6

REQUEST:
{
  "status": "ACTIVE"
}

RESPONSE (200):
{
  "id": "pb_d1e2f3g4h5i6",
  "status": "ACTIVE",
  "modified_at": "2026-09-05T23:59:00Z",
  "updated_by": "user_pricing_mgr"
}
```

**Step 5: Customer Places Order During Campaign**
```json
POST /api/v1/pricing/resolve

REQUEST:
{
  "item_id": "itm_rice_5kg_001",
  "quantity": 15.0,
  "as_of_date": "2026-10-05T14:00:00+05:30"
}

RESPONSE (200):
{
  "item_id": "itm_rice_5kg_001",
  "quantity": 15.0,
  "base_mrp": 500.00,
  "base_selling_price": 500.00,
  "effective_unit_price": 330.00,
  "line_subtotal": 4950.00,
  "applied_price_book": "PB-DIWALI-2026",
  "applied_tier": null,
  "discount_percentage": 0.0,
  "pricing_source": "PRICE_BOOK_VOLUME",
  "rule_version": 1
}
```

**Step 6: Campaign Ends, Auto Reverts (Oct 16+)**
```json
POST /api/v1/pricing/resolve

REQUEST:
{
  "item_id": "itm_rice_5kg_001",
  "quantity": 15.0,
  "as_of_date": "2026-10-16T14:00:00+05:30"  ← After campaign end
}

RESPONSE (200):
{
  "item_id": "itm_rice_5kg_001",
  "quantity": 15.0,
  "base_mrp": 500.00,
  "base_selling_price": 500.00,
  "effective_unit_price": 490.00,  ← Back to normal retail
  "line_subtotal": 7350.00,
  "applied_price_book": "PB-RETAIL",  ← Default book used
  "pricing_source": "PRICE_BOOK_VOLUME",
  "rule_version": 1
}
```

---

## ERROR CODES & HANDLING

### HTTP Status Codes

| Code | Scenario | Message |
|------|----------|---------|
| 201 | Successfully created resource | Resource created |
| 200 | Successfully retrieved/updated | Operation successful |
| 400 | Invalid request data | Details in response |
| 404 | Resource not found | Price book or entry not found |
| 409 | Conflict (duplicate code, etc) | Resource already exists |
| 500 | Server error | Contact support |

### Error Response Format

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    {
      "field": "code",
      "message": "Price Book code 'PB-DUPLICATE' already exists",
      "type": "UNIQUE_CONSTRAINT_VIOLATION"
    },
    {
      "field": "valid_from",
      "message": "Start date must be before end date",
      "type": "DATE_RANGE_INVALID"
    }
  ],
  "timestamp": "2026-09-05T14:30:00Z",
  "request_id": "req_xyz789"
}
```

### Frontend Error Handling

```typescript
// API call with error handling
async function createPriceBook(data: CreatePriceBookRequest) {
  try {
    const response = await api.post('/pricing/books', data);
    return response.data;
  } catch (error) {
    if (error.response?.status === 409) {
      // Duplicate code
      showNotification({
        type: 'error',
        title: 'Price Book Code Already Exists',
        message: `The code ${data.code} is already in use. Please choose a different code.`,
        action: {
          label: 'Try Different Code',
          onClick: () => focusField('code')
        }
      });
    } else if (error.response?.status === 400) {
      // Validation error
      const fieldErrors = error.response.data.details;
      fieldErrors.forEach(err => {
        setFieldError(err.field, err.message);
      });
    } else {
      // Generic error
      showNotification({
        type: 'error',
        title: 'Failed to Create Price Book',
        message: 'An unexpected error occurred. Please try again.'
      });
    }
    throw error;
  }
}
```

---

## TESTING CHECKLIST

### Unit Tests

- [ ] Price book creation with all fields
- [ ] Price book code uniqueness validation
- [ ] Date range validation (from < to)
- [ ] MRP vs selling price validation
- [ ] Volume tier quantity sequencing
- [ ] Negative margin detection
- [ ] Customer tier discount application
- [ ] Price resolution hierarchy

### Integration Tests

- [ ] Create price book → Add products → Query products
- [ ] Create customer tier → Assign customer → Check pricing
- [ ] Multiple tiers for same product → Query correct tier
- [ ] Expired price book → Falls back to default
- [ ] Default price book behavior
- [ ] Soft delete (archive) operations

### E2E Tests

- [ ] User creates Diwali campaign price book
- [ ] Adds 100+ products via CSV import
- [ ] Activates price book on campaign date
- [ ] Customer orders with campaign pricing
- [ ] Campaign ends, prices revert
- [ ] Pricing audit log shows all changes

### Performance Tests

- [ ] Price resolution < 50ms for 10k products
- [ ] List price books < 100ms for 50 books
- [ ] Bulk import 1000 products < 30 seconds
- [ ] Concurrent pricing requests (1000/sec)
- [ ] Database query optimization (indexes verify)

---

## PERFORMANCE OPTIMIZATION

### Database Indexes

```sql
-- Ensure these indexes exist for fast queries

-- Price book lookups
CREATE INDEX idx_pb_code ON price_books(code);
CREATE INDEX idx_pb_company_status ON price_books(company_id, status);
CREATE INDEX idx_pb_is_default ON price_books(is_default);
CREATE INDEX idx_pb_dates ON price_books(valid_from, valid_to);

-- Price book entry lookups (CRITICAL)
CREATE INDEX idx_pbe_book_item ON price_book_entries(price_book_id, item_id);
CREATE INDEX idx_pbe_qty ON price_book_entries(min_quantity);
CREATE INDEX idx_pbe_item_qty ON price_book_entries(item_id, min_quantity);
CREATE INDEX idx_pbe_composite ON price_book_entries(
  price_book_id, 
  item_id, 
  variant_id, 
  min_quantity
);

-- Customer tier lookups
CREATE INDEX idx_cpt_code ON customer_price_tiers(code);
CREATE INDEX idx_cpt_active ON customer_price_tiers(is_active);
```

### Caching Strategy

```typescript
// Cache price book entries for 5 minutes
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const priceBookEntryCache = new Map<string, CacheEntry>();

async function getProductEntries(bookId: string) {
  const cached = priceBookEntryCache.get(bookId);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const entries = await api.get(`/pricing/books/${bookId}/entries`);
  
  priceBookEntryCache.set(bookId, {
    data: entries,
    timestamp: Date.now()
  });
  
  return entries;
}

// Invalidate cache on updates
async function updatePriceBookEntry(bookId: string, entryId: string, data: any) {
  await api.patch(`/pricing/books/${bookId}/entries/${entryId}`, data);
  priceBookEntryCache.delete(bookId); // Invalidate
}
```

### Query Optimization

```python
# In pricing_engine.py - Optimize the main resolution query

# ❌ BAD: Multiple sequential queries
pb = session.query(PriceBook).filter(...).first()
entries = session.query(PriceBookEntry).filter(...).all()
tier = session.query(CustomerPriceTier).filter(...).first()

# ✅ GOOD: Single optimized query with joins
stmt = (
    select(PriceBookEntry)
    .where(
        PriceBookEntry.price_book_id == pb_id,
        PriceBookEntry.item_id == item_id,
        PriceBookEntry.min_quantity <= qty
    )
    .order_by(PriceBookEntry.min_quantity.desc())
    .limit(1)
)
```

---

## Summary

This technical guide provides:
✅ Complete API specifications  
✅ Database schema and indexes  
✅ Data flow diagrams  
✅ Frontend component structure  
✅ State management patterns  
✅ Form validation rules  
✅ Real-world examples  
✅ Error handling patterns  
✅ Testing checklist  
✅ Performance optimization tips  

**All information needed to build the PriceBook UI/Backend!**

---

**Document Version:** 1.0  
**Status:** READY FOR DEVELOPMENT  
**Created:** 2026-09-05  
