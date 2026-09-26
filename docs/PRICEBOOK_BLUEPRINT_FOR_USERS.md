<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.16.0
  Classification: Internal
  Document     : PriceBook System Blueprint (Non-Technical User Guide)
-->

# 📚 PRICE BOOK SYSTEM BLUEPRINT
## Complete Guide for Non-Technical Users

**Version:** 1.0  
**Last Updated:** 2026-09-05  
**Status:** DESIGN READY FOR IMPLEMENTATION

---

## Table of Contents
1. [What is a Price Book?](#what-is-a-price-book)
2. [Why Do We Need Price Books?](#why-do-we-need-price-books)
3. [Core Concepts (Explained Simply)](#core-concepts-explained-simply)
4. [Price Book Types & Scenarios](#price-book-types--scenarios)
5. [Step-by-Step Workflows](#step-by-step-workflows)
6. [UI/UX Design Specifications](#uiux-design-specifications)
7. [Real-World Examples](#real-world-examples)
8. [User Roles & Permissions](#user-roles--permissions)
9. [Common Questions (FAQ)](#common-questions-faq)
10. [Error Handling & Safety Checks](#error-handling--safety-checks)
11. [Universal Import: Barcode-Based Activities](#universal-import-barcode-based-activities)

---

## SECTION 11: Universal Import: Barcode-Based Activities

### The Important New Feature

One **Universal Import** screen should be available from every relevant module. A user can upload a CSV/Excel/text file, paste scanned rows, or select an existing transaction, then choose what the rows should create or update.

The same row can be used for:

| Activity | Result |
|----------|--------|
| Item Master | Create or update item/variant/barcode master data |
| Price Book | Add or update MRP, selling price, cost, and quantity tiers |
| Purchase Inward | Create inward lines and increase stock |
| Sales Order | Add lines to a sales order |
| Sales Return | Add returned items and quantities |
| Stock Adjustment | Increase or decrease stock with a reason |
| Label Printing | Prepare labels using barcode, quantity, MRP, and price |

### A User Can Start With Any Supported Combination

The importer must accept all of these forms without forcing unnecessary columns:

```text
8901234567890
8901234567890,10
8901234567890,10,500
8901234567890,10,500,425
8901234567890,10,500,425,300
```

The meaning is selected by the column headings or the field mapping screen:

```text
Barcode | Qty | MRP | Selling Price | Cost Price | Reason
8901234567890 | 10 | 500 | 425 | 300 | Opening stock
```

Barcode is preferred, but the user can use SKU or item code when a barcode is not available. The system resolves the row against the canonical item/variant/barcode records before anything is saved.

### Search by Product Combination

Barcode is not mandatory when the product can be identified by its attributes. The user may provide:

```text
Style / Article | Size | Color | Brand | Qty | MRP | Selling Price
SHIRT-001       | M    | Blue  | SMRITI| 10  | 1999| 1499
```

The matching priority is:

```text
1. Barcode
2. SKU / Variant SKU
3. Item code
4. Style/Article + Size + Color
5. Style/Article + Size + Color + Brand when required to remove ambiguity
```

If more than one product matches the combination, the preview stops at **Needs Review** and shows the possible products. The user selects the correct row; the system never guesses between two variants.

### Simple Four-Step Experience

```text
1. CHOOSE ACTIVITY
   [Item Master] [Price Book] [Purchase Inward] [Sales Order]
   [Sales Return] [Stock Adjustment] [Label Printing]

2. PROVIDE DATA
   [Upload File] [Paste Rows] [Scan Barcodes] [Use Existing Transaction]

3. REVIEW PREVIEW
   ✓ Matched rows     ⚠ Needs review     ✕ Invalid rows
   Show product name, barcode, quantity, MRP, price, and final action.

4. CONFIRM COMMIT
   The user sees exactly what will be created or updated before saving.
```

### Start With a Template

Users should not have to design column mappings for every file. They choose one familiar template:

| Template | Use when |
|----------|----------|
| Barcode only | Looking up products or creating item records |
| Barcode + Quantity | Receiving, selling, returning, adjusting stock, or printing labels |
| Barcode + Prices | Updating a Price Book with MRP, selling price, and cost |
| Style + Size + Color | Barcode/SKU is unavailable and the variant is identified by attributes |

The system auto-selects the most suitable activity, but the user can change it before previewing.

### Scan Mode Combines Repeated Reads

In scan mode, scanning the same barcode multiple times does not create confusing duplicate lines. The system combines the reads:

```text
Scan 8901234567890  -> Quantity 1
Scan 8901234567890  -> Quantity 2
Scan 8901234567890  -> Quantity 3
```

The user can still expand the row to see the individual scan history if required.

### Plain-Language Preview Summary

Before the final button, show a simple summary instead of technical validation counts:

```text
98 rows ready
4 new products
12 existing products will be updated
2 rows need your selection
1 row has an error

[Review 3 rows] [Commit 114 rows]
```

### Universal Import Screen

```text
┌──────────────────────────────────────────────────────────────┐
│ UNIVERSAL IMPORT                                              │
├──────────────────────────────────────────────────────────────┤
│ What do you want to create or update?                         │
│ [Price Book ▼]                                                │
│                                                              │
│ Source: [Upload CSV/Excel] [Paste] [Scan] [Existing document] │
│                                                              │
│ Column mapping                                                │
│ Barcode       [Barcode ▼]       Required for lookup           │
│ SKU / Item    [Not mapped ▼]                                 │
│ Quantity      [Qty ▼]            Optional for master/price    │
│ MRP           [MRP ▼]            Optional                     │
│ Selling Price [Selling Price ▼] Optional                     │
│ Cost Price    [Cost Price ▼]    Optional                     │
│                                                              │
│ [AUTO-MAP HEADERS]                 [DOWNLOAD TEMPLATE]         │
│                                                              │
│ Preview: 98 matched | 2 new | 1 warning | 0 errors            │
│                                                              │
│ Row │ Barcode        │ Product       │ Qty │ MRP │ Price │ Action │
│  2  │ 8901234567890  │ Rice 5kg      │ 10  │ 500 │ 425   │ UPDATE │
│  3  │ 8901234567891  │ Not found     │  5  │ 450 │ 380   │ REVIEW │
│                                                              │
│ [SAVE AS TEMPLATE] [EXPORT ERRORS] [CANCEL] [COMMIT 98 ROWS]  │
└──────────────────────────────────────────────────────────────┘
```

### Safety Rules

- Never create a fake product silently from an unknown barcode.
- Unknown identifiers become **Needs Review** and offer `Create Item` or `Map to Existing Item`.
- Existing records show whether the action is `CREATE`, `UPDATE`, `ADD STOCK`, `ADD ORDER LINE`, or `PRINT`.
- Duplicate identifiers in one file are flagged. The user may choose `Combine Quantity` or remove the duplicate.
- Selling price above MRP is blocked until corrected or explicitly approved by an authorized user.
- Quantity is required for stock and transaction activities, but defaults to `1` for item master and price book rows.
- A final confirmation displays the number of rows, affected products, stock change, and price change summary.
- Every commit records source file, target activity, user, timestamp, and row-level result in the audit trail.

### Example: One File, Different Activities

```text
File row: Barcode=8901234567890, Qty=10, MRP=500, Selling Price=425

Price Book       → Add/update the 10+ quantity tier at ₹425
Purchase Inward  → Receive 10 units using the resolved item
Sales Order      → Add 10 units to the order
Stock Adjustment → Add or remove 10 units after choosing a reason
Label Printing   → Print 10 labels with MRP ₹500 and price ₹425
```

The row is imported once, but the selected activity controls what the system is allowed to change. This keeps barcode lookup common while keeping business rules separate for pricing, stock, and transactions.

---

## SECTION 1: What is a Price Book?

### Simple Definition
**A Price Book is a master list of prices for your products, organized by customer type and order quantity.**

Think of it like:
- **Multiple price lists** - You don't have one price list. You have separate lists for Retail customers, Wholesale dealers, B2B companies, and online stores.
- **Quantity discounts** - The more you buy, the less you pay. Price Book manages these tiers.
- **Controlled updates** - When prices change, you update ONE Price Book, not individual products.

### Physical Analogy
```
Imagine a car showroom with 3 price boards:

📍 RETAIL BOARD (Customers buying 1-5 cars)
   Model A: ₹25,00,000

📍 WHOLESALE BOARD (Dealers buying 6-20 cars)  
   Model A: ₹23,50,000 (5% discount)

📍 B2B BOARD (Fleet companies buying 21+ cars)
   Model A: ₹22,00,000 (12% discount)

When a CUSTOMER buys 1 car → Price Board 1 (₹25,00,000)
When a DEALER buys 10 cars → Price Board 2 (₹23,50,000)
When a FLEET buys 50 cars → Price Board 3 (₹22,00,000)
```

### What Problem Does It Solve?

| Problem | Solution |
|---------|----------|
| Different customers expect different prices | Price Books by customer type |
| Need to change prices frequently | Update Price Book, not individual items |
| Quantity discounts are hard to manage | Volume breaks in Price Books |
| Sales channels (POS, Online, B2B) need different pricing | Separate Price Books per channel |
| Hard to track price history | All price changes are logged automatically |
| Confusion about which price applies | System automatically determines correct price |

---

## SECTION 2: Why Do We Need Price Books?

### Business Benefits

#### 🎯 Profit Optimization
- **Maximize revenue** from retail customers (full price)
- **Attract wholesale dealers** with volume discounts
- **Compete for B2B contracts** with tiered pricing

#### 📊 Sales Strategy
- **Channel-specific pricing** - Online prices differ from store prices
- **Promotional campaigns** - Run temporary price books for festivals, seasons
- **Geographic pricing** - Different prices in different regions
- **Customer loyalty** - VIP customers get better prices

#### 🏢 Operations Control
- **Centralized management** - Manage ALL prices from one place
- **Consistency** - No rogue pricing across stores
- **Audit trail** - Every price change is recorded with timestamp and user name
- **Compliance** - MRP (Maximum Retail Price) is always visible

#### 💰 Cost & Margin Control
- **Profit margins tracked** - Know exact cost vs selling price
- **Bulk cost analysis** - Understand per-unit costs at different quantities
- **Seasonal adjustments** - Update costs without changing selling price format

---

## SECTION 3: Core Concepts (Explained Simply)

### Concept 1: Price Book (The Master List)

**What is it?** A collection of prices for all your products during a specific time period.

**Analogy:** Like a printed catalog that you distribute to customers.

**Key Details:**
- **Name** - Descriptive name for humans (e.g., "Diwali Festival Offer 2026")
- **Code** - Short unique identifier (e.g., "PB-DIWALI-2026")
- **Currency** - Usually INR (Indian Rupees)
- **Valid From / To** - Time period when this price book is active
  - Example: Valid from Sept 15 to Oct 15 (Diwali season)
- **Channel** - Where it applies (RETAIL = stores, WHOLESALE = dealers, B2B = corporate)
- **Status** - ACTIVE (in use), INACTIVE (not used), ARCHIVED (historical)

**Visual:**
```
┌─────────────────────────────────────────────────────────┐
│ PRICE BOOK HEADER                                       │
├─────────────────────────────────────────────────────────┤
│ Name:          Wholesale Distributor 2026               │
│ Code:          PB-WHOLESALE-2026                        │
│ Channel:       WHOLESALE                                │
│ Currency:      INR (₹)                                  │
│ Valid From:    Sep 1, 2026                              │
│ Valid To:      Dec 31, 2026                             │
│ Status:        ACTIVE ✓                                 │
│ Description:   For all wholesale dealers & distributors │
│ Set as Default: YES (use when no other applies)         │
└─────────────────────────────────────────────────────────┘
         ↓ Contains many product entries ↓
    (See Concept 2 below)
```

---

### Concept 2: Price Book Entry (Individual Product Price)

**What is it?** The actual price for ONE specific product (or variant) with quantity breaks.

**Analogy:** Like a line item in a traditional price list catalog.

**Key Details:**

```
PRICE BOOK ENTRY (One per product in price book)
├── Product Details
│   ├── Item: Basmati Rice (5kg bag)
│   ├── Variant: None (or "Extra Long Grain" if variants exist)
│   └── Barcode: 8901234567890
│
├── Quantity Tiers (Volume Breaks)
│   ├── Tier 1: Buy 1-10 bags → ₹425 each
│   ├── Tier 2: Buy 11-50 bags → ₹410 each
│   ├── Tier 3: Buy 51-100 bags → ₹395 each
│   └── Tier 4: Buy 100+ bags → ₹380 each
│
└── Statutory Info
    ├── MRP (Maximum Retail Price): ₹500
    ├── Selling Price: ₹425 (or ₹410, ₹395, ₹380 by tier)
    └── Cost Price: ₹300 (optional, for margin tracking)
```

**Why Quantity Tiers?**
```
Scenario: Wholesale dealer buys 25 bags of rice

❌ WITHOUT TIERS (One price for all quantities)
   25 bags × ₹425 = ₹10,625

✅ WITH TIERS (Volume discount)
   25 bags × ₹410 = ₹10,250  [₹375 saved for dealer]
   
This encourages bulk buying!
```

---

### Concept 3: Customer Price Tier (Customer Group Classification)

**What is it?** A classification that links customers to specific Price Books OR gives them automatic discounts.

**Analogy:** Like a "customer club card" - different club members get different discounts.

**Example Tiers:**
```
1. RETAIL CUSTOMER
   └─ No specific tier
   └─ Uses Default Price Book
   └─ Pays full price

2. WHOLESALE DEALER
   └─ Tier Code: TIER-WHOLESALE
   └─ Linked to: PB-WHOLESALE-2026
   └─ Gets volume breaks automatically

3. VIP CUSTOMER
   └─ Tier Code: TIER-VIP
   └─ Linked to: PB-WHOLESALE-2026
   └─ + Additional 5% discount on top

4. CORPORATE B2B
   └─ Tier Code: TIER-B2B
   └─ Linked to: PB-B2B-CORPORATE
   └─ Special pricing + Net 30 payment terms
```

**How It Works:**
```
When customer "ABC Distributor" orders 50 bags of rice:

1. System looks up: ABC Distributor → TIER-WHOLESALE
2. System finds tier → PB-WHOLESALE-2026
3. System finds price in that book → 25-50 qty tier = ₹410
4. Final price: ₹410 per bag automatically applied!
```

---

### Concept 4: Price Resolution (How System Chooses the Right Price)

**What is it?** The automatic process the system uses to pick the correct price.

**Priority Order:**
```
STEP 1: Is there an explicit price book for this order?
        └─ YES: Use it (highest priority)
        └─ NO: Go to Step 2

STEP 2: Is this customer assigned to a tier with a price book?
        └─ YES: Use that tier's price book
        └─ NO: Go to Step 3

STEP 3: Is there a DEFAULT price book?
        └─ YES: Use the default one
        └─ NO: Go to Step 4

STEP 4: Use the product's base price (from Item Master)
        └─ This is the lowest priority fallback

RESULT: ✓ One price is applied automatically!
```

**Visual Decision Tree:**
```
                    CUSTOMER ORDER
                          ↓
              Is specific Price Book given?
                     YES ↙      ↘ NO
                        │         │
                   Use that   Customer has Tier?
                   Price Book       ↓
                        ↓      YES ↙ ↘ NO
                        │         │    │
                        │    Use Tier  Is Default
                        │    Price Book available?
                        │         ↓    ↓
                        │      YES ↙ ↘ NO
                        │         │    │
                        │    Use Default │
                        │              Use Item
                        │              Base Price
                        └──────┬───────┘
                               ↓
                        APPLY QUANTITY TIER
                    (auto discount if qty is high)
                               ↓
                        FINAL PRICE CALCULATED
                               ↓
                        SHOW TO CUSTOMER
```

---

## SECTION 4: Price Book Types & Scenarios

### Type 1: RETAIL Price Book
**For:** Individual customers buying in small quantities
**Channel:** POS (Point of Sale) stores, online retail sites

**Characteristics:**
- Prices at or near MRP (Maximum Retail Price)
- Small quantity breaks (1, 5, 10 units)
- Valid year-round
- Usually marked as DEFAULT

**Example:**
```
RETAIL PRICE BOOK (Default)
├── Product: Basmati Rice 5kg
│   ├── Min Qty 1: ₹500 (full MRP)
│   ├── Min Qty 10: ₹495 (2% discount)
│   └── Min Qty 20: ₹490 (2% more discount)
└── Status: ACTIVE (always available)
```

---

### Type 2: WHOLESALE Price Book
**For:** Dealers, distributors, resellers
**Channel:** B2B wholesale portal

**Characteristics:**
- 10-20% below retail
- Bulk quantity breaks (10, 50, 100, 500+ units)
- Valid for specific seasons
- Linked to WHOLESALE TIER

**Example:**
```
WHOLESALE PRICE BOOK
├── Product: Basmati Rice 5kg
│   ├── Min Qty 10: ₹425 (15% discount)
│   ├── Min Qty 50: ₹410 (18% discount)
│   ├── Min Qty 100: ₹395 (21% discount)
│   └── Min Qty 500: ₹380 (24% discount)
└── Valid: Sep 1 - Dec 31, 2026
```

---

### Type 3: PROMOTIONAL Price Book
**For:** Festival, seasonal, or flash sale prices
**Channel:** All channels during campaign

**Characteristics:**
- Temporary (specific date range)
- Significant discounts for limited time
- Created for specific promotions
- Overrides default pricing temporarily

**Example:**
```
DIWALI SALE 2026
├── Valid: Oct 1 - Oct 15, 2026
├── Product: Basmati Rice 5kg
│   ├── Min Qty 1: ₹399 (20% discount!)
│   └── Min Qty 10: ₹379 (24% discount!)
└── Status: ACTIVE (Oct 1 only)
   Status: INACTIVE (after Oct 15)
```

---

### Type 4: CHANNEL-SPECIFIC Price Book
**For:** Different channels (online vs offline) with different prices
**Channel:** E-commerce, marketplace, physical stores

**Characteristics:**
- Same products, different channels, different prices
- Overlapping date ranges (both active simultaneously)
- Linked to specific channel code

**Example:**
```
ECOMMERCE EXCLUSIVE (Amazon, Flipkart)
├── Lower prices (reduced logistics costs)
├── Product: Basmati Rice 5kg
│   ├── ₹430 (vs ₹500 in retail store)

RETAIL STORE EXCLUSIVE
├── Higher prices (shop rent costs)
├── Product: Basmati Rice 5kg
│   ├── ₹500 (full MRP)
```

---

### Type 5: GEOGRAPHIC Price Book
**For:** Regional pricing differences (if needed)
**Channel:** Different geographic regions

**Characteristics:**
- Same product, different regions
- Accounts for regional purchasing power
- Can be temporary or permanent

**Example:**
```
TIER-1 CITIES (Delhi, Mumbai, Bangalore)
├── Product: Basmati Rice 5kg → ₹500

TIER-2 CITIES (Pune, Hyderabad, etc.)
├── Product: Basmati Rice 5kg → ₹480

TIER-3 CITIES (Smaller towns)
├── Product: Basmati Rice 5kg → ₹460
```

---

## SECTION 5: Step-by-Step Workflows

### WORKFLOW 1: Creating a New Price Book

**Goal:** Set up a new price list (e.g., Diwali sale prices)

**Who does this:** Manager, Finance, or Pricing Team

**Steps:**

```
STEP 1: Click "Price Books" → "Create New Price Book"
   ↓
STEP 2: Fill in Basic Information
   ├── Name: "Diwali Festival Sale 2026"
   ├── Code: "PB-DIWALI-2026" (must be unique)
   ├── Currency: INR (default)
   ├── Channel: RETAIL (or WHOLESALE, B2B, etc.)
   └── Description: "Special prices during Diwali festival"
   ↓
STEP 3: Set Date Validity
   ├── Valid From: Oct 1, 2026
   ├── Valid To: Oct 15, 2026
   └─ ⚠️ Important: Prices only apply during this window!
   ↓
STEP 4: Set As Default? (Optional)
   ├── YES: Use this when no other applies
   │   ⚠️ WARNING: This removes "default" from previous one
   └── NO: Use only when explicitly selected
   ↓
STEP 5: Set Initial Status
   ├── ACTIVE: Ready to use now
   ├── INACTIVE: Draft, will activate later
   └── ARCHIVED: Old price book, not used
   ↓
STEP 6: Review & Save
   ├── Check all fields
   ├── Confirm dates
   └── Click "CREATE PRICE BOOK" → ✅ SUCCESS!
   ↓
STEP 7: Next Step - Add Products
   └─ See Workflow 2
```

**Form Fields Explained:**

| Field | What It Is | Example | Important Notes |
|-------|-----------|---------|-----------------|
| Name | Human-readable title | "Wholesale Q3 2026" | Max 200 characters |
| Code | Unique identifier | "PB-WHOLESALE-Q3" | Only letters, numbers, hyphens. NO SPACES |
| Channel | Where this applies | RETAIL, WHOLESALE | Controls which customer sees it |
| Currency | Money type | INR, USD | Usually INR for India |
| Valid From | Start date/time | Sep 1, 2026 10:00 AM | Prices apply AFTER this |
| Valid To | End date/time | Dec 31, 2026 11:59 PM | Prices apply UNTIL this |
| Is Default? | Use if nothing else applies | YES/NO | Only ONE default allowed |
| Status | Is it active? | ACTIVE/INACTIVE/ARCHIVED | ACTIVE = in use now |
| Description | Notes about this book | "For all dealers during monsoon" | Helps team remember why |

---

### WORKFLOW 2: Adding Products to Price Book

**Goal:** Add items with prices to a newly created Price Book

**Who does this:** Pricing Team, Inventory Manager

**Steps:**

```
STEP 1: Open the Price Book created in Workflow 1
   ├── Click "Price Books" → Select "Diwali Festival Sale 2026"
   └── Click "View Details" / "Manage Products"
   ↓
STEP 2: Click "Add Product to This Price Book"
   ↓
STEP 3: Select the Product
   ├── Type in product name or barcode
   │   Example: Type "basmati rice" 
   │   └─ F2 Modal pops up → shows matching products
   │
   ├── SELECT "Basmati Rice 5kg" (ID: itm_rice_5kg_001)
   │
   └─ ⚠️ IMPORTANT: Product MUST exist in Item Master first!
   ↓
STEP 4: Select Variant (if product has variants)
   ├── NO variant: Leave blank
   ├── WITH variant: Choose (e.g., "Extra Long Grain")
   └── Note: Each variant can have different price!
   ↓
STEP 5: Set MRP (Maximum Retail Price)
   ├── This is the OFFICIAL maximum price
   ├── Example: ₹500 for Basmati Rice
   └── ⚠️ Cannot be exceeded (by law in India)
   ↓
STEP 6: Set SELLING PRICE (Main Price for Tier 1)
   ├── This is what customer pays for quantity 1-9
   ├── Example: ₹399 (Diwali discount from ₹500)
   └── Must be ≤ MRP
   ↓
STEP 7: Set COST PRICE (Optional but Recommended)
   ├── What you paid for this product
   ├── Example: ₹300
   ├── Used for profit margin calculations
   └── Not visible to customers
   ↓
STEP 8: Add Volume Break Tiers (Optional)
   │
   │   TIER 1 (Already filled above)
   │   └── Min Qty: 1, Price: ₹399 [Already set in Step 6]
   │
   ├── TIER 2 (Click "Add Another Tier")
   │   ├── Min Qty: 10 (buy 10+)
   │   ├── Selling Price: ₹379 (5% extra discount)
   │   └── MRP: ₹500 (stays same)
   │
   ├── TIER 3 (Click "Add Another Tier")
   │   ├── Min Qty: 25 (buy 25+)
   │   ├── Selling Price: ₹359 (more discount)
   │   └── MRP: ₹500
   │
   └── ⚠️ NOTE: Each tier MUST have HIGHER min_qty than previous!
   ↓
STEP 9: Review All Tiers
   ┌─────────────────────────────────────────────────┐
   │ BASMATI RICE 5KG - DIWALI SALE                  │
   ├─────────────────────────────────────────────────┤
   │ MRP:              ₹500                          │
   │ TIER 1:  Buy 1-9   → ₹399 each                 │
   │ TIER 2:  Buy 10-24 → ₹379 each                 │
   │ TIER 3:  Buy 25+   → ₹359 each                 │
   └─────────────────────────────────────────────────┘
   ↓
STEP 10: Save Product Entry
   └── Click "ADD TO PRICE BOOK" → ✅ SUCCESS!
   ↓
STEP 11: Repeat Steps 2-10 for Each Product
   └── Add all products needed in this price book
```

**Visual: Adding Volume Tiers**

```
When adding TIER 2, system shows:

┌─────────────────────────────────────────┐
│ ADD VOLUME TIER                         │
├─────────────────────────────────────────┤
│                                         │
│ Minimum Quantity to Qualify:            │
│ [10____________________]                │
│ (Buying 10 or more items)               │
│                                         │
│ Selling Price for this Tier:            │
│ ₹ [379______________]                   │
│                                         │
│ MRP (stays same):                       │
│ ₹ [500______________]                   │
│                                         │
│ Cost Price (optional):                  │
│ ₹ [300______________]                   │
│                                         │
│ ⚠️ Selling price must be < MRP          │
│ ⚠️ Min quantity must be > previous tier │
│                                         │
│ [CANCEL]  [ADD TIER]                    │
└─────────────────────────────────────────┘
```

---

### WORKFLOW 3: Creating Customer Tiers

**Goal:** Define customer groups (Retail, Wholesale, VIP, etc.)

**Who does this:** Manager, Sales Lead

**Steps:**

```
STEP 1: Go to "Customer Tiers" → "Create New Tier"
   ↓
STEP 2: Name the Tier
   ├── Name: "Wholesale Distributor"
   ├── Code: "TIER-WHOLESALE" (unique identifier)
   └── Example: Name helps humans, Code for system
   ↓
STEP 3: Describe This Tier (Optional)
   ├── Description: "For all wholesale dealers and distributors"
   ├── Used for team reference
   └── Not visible to customers
   ↓
STEP 4: Choose Pricing Strategy
   │
   ├── OPTION A: Link to a Price Book
   │   ├── Select Price Book: "PB-WHOLESALE-2026"
   │   └─ All customers in this tier use this book
   │   └─ They get all volume breaks automatically
   │
   └── OPTION B: Apply Flat Discount %
       ├── Discount: 15%
       └─ All prices reduced by 15% automatically
       
   Note: You can do BOTH!
        Link to PB + Add flat 5% extra discount on top
   ↓
STEP 5: Save the Tier
   └── Click "CREATE TIER" → ✅ SUCCESS!
   ↓
STEP 6: Assign Customers to This Tier
   └─ See Workflow 4 (done by Sales/CRM team)
```

**Example Tier Setup:**

```
┌────────────────────────────────────────────────────┐
│ CREATE CUSTOMER TIER                               │
├────────────────────────────────────────────────────┤
│                                                    │
│ Tier Name: WHOLESALE DISTRIBUTOR                  │
│ Tier Code: TIER-WHOLESALE                         │
│                                                    │
│ Description:                                       │
│ For all wholesale dealers and large distributors   │
│ Typically buy 50+ units per order                  │
│                                                    │
│ Link to Price Book (Optional):                     │
│ [Dropdown: PB-WHOLESALE-2026        ▼]             │
│                                                    │
│ Additional Discount %:                             │
│ [  5  ]%  (on top of price book)                   │
│                                                    │
│ Notes:                                             │
│ "These customers negotiate quarterly contracts"   │
│                                                    │
│ [CANCEL]  [CREATE TIER]                            │
└────────────────────────────────────────────────────┘
```

---

### WORKFLOW 4: Assigning Customers to Tiers

**Goal:** Link specific customers to a pricing tier

**Who does this:** Sales Team, Account Manager

**Steps:**

```
STEP 1: Open Customer Profile
   ├── Go to "Customers" / "CRM"
   ├── Search: "ABC Distributors"
   └── Click on customer → Edit
   ↓
STEP 2: Find "Pricing Tier" Field
   ├── In customer profile/form
   ├── Currently: [None / Default Retail]
   └── Click to change
   ↓
STEP 3: Select New Tier
   ├── Dropdown shows all available tiers:
   │   □ TIER-RETAIL
   │   □ TIER-WHOLESALE ← SELECT THIS
   │   □ TIER-VIP
   │   □ TIER-B2B
   │
   └── Click "TIER-WHOLESALE"
   ↓
STEP 4: Confirm & Save
   ├── Preview: "This customer now gets:"
   │   ├── Price Book: PB-WHOLESALE-2026
   │   ├── Additional Discount: 5%
   │   └── Auto volume breaks on bulk orders
   │
   └── Click "SAVE" → ✅ SUCCESS!
   ↓
STEP 5: Next Order Will Use New Prices!
   ├── Customer orders 50 bags rice
   ├── System: "This customer = TIER-WHOLESALE"
   ├── Applies: PB-WHOLESALE-2026 + volume tier pricing
   └── Final Price: Much lower than retail! ✓
```

**What Happens Automatically:**

```
BEFORE (No tier assigned):
   ABC Distributors orders 50 bags
   → Uses DEFAULT RETAIL price
   → ₹500/bag × 50 = ₹25,000 ❌ (oops, too expensive!)

AFTER (TIER-WHOLESALE assigned):
   ABC Distributors orders 50 bags
   → Uses PB-WHOLESALE-2026
   → Finds qty tier: Buy 50+ = ₹380/bag
   → Applies 5% extra discount = ₹361/bag
   → ₹361/bag × 50 = ₹18,050 ✅ (much better!)
```

---

### WORKFLOW 5: Changing/Updating Prices in Active Price Book

**Goal:** Update prices mid-season (e.g., costs went up, need to raise prices)

**Who does this:** Pricing Manager, Finance

**Steps:**

```
STEP 1: Open the Price Book to Update
   ├── Go to "Price Books"
   ├── Find: "PB-WHOLESALE-2026"
   └── Click "Edit" / "Manage Products"
   ↓
STEP 2: Find Product to Update
   ├── Search: "Basmati Rice"
   ├── OR Scroll and find
   └── Click "Edit" next to product
   ↓
STEP 3: Update Tier Prices
   │
   ├── TIER 1 (Buy 1-9):
   │   ├── OLD: ₹425
   │   ├── NEW: ₹440 (cost increased)
   │   └── [Change field]
   │
   ├── TIER 2 (Buy 10-24):
   │   ├── OLD: ₹410
   │   ├── NEW: ₹425
   │   └── [Change field]
   │
   └── TIER 3 (Buy 50+):
       ├── OLD: ₹395
       ├── NEW: ₹410
       └── [Change field]
   ↓
STEP 4: Review Changes
   ┌────────────────────────────────────────┐
   │ PRICE CHANGE PREVIEW                   │
   ├────────────────────────────────────────┤
   │ Product: Basmati Rice 5kg               │
   │ Price Book: PB-WHOLESALE-2026          │
   │                                        │
   │ TIER 1:  ₹425 → ₹440 (+3.5%)           │
   │ TIER 2:  ₹410 → ₹425 (+3.7%)           │
   │ TIER 3:  ₹395 → ₹410 (+3.8%)           │
   │                                        │
   │ ⚠️ This affects all orders after save! │
   └────────────────────────────────────────┘
   ↓
STEP 5: Confirm & Save
   ├── Check all prices correct
   ├── Make sure new prices > cost price
   ├── Make sure new prices ≤ MRP
   └── Click "UPDATE PRICE BOOK" → ✅ SAVED!
   ↓
STEP 6: System Action
   ├── Price change logged with:
   │   ├── Old price
   │   ├── New price
   │   ├── Timestamp
   │   ├── Your username
   │   └── Old prices still available in history
   │
   └── Next order after save gets NEW price!

IMPORTANT NOTES:
⚠️ Old orders NOT affected (their prices locked at time of order)
✅ New orders use NEW prices immediately
📊 All changes tracked for audit trail
```

---

### WORKFLOW 6: Checking Effective Price for an Order

**Goal:** Verify what price a customer will get for specific order

**Who does this:** Sales Team (to give quote), Support Team (to verify)

**Steps:**

```
STEP 1: Go to "Price Calculator" / "Check Price"
   └── Usually in Admin Tools or Pricing Dashboard
   ↓
STEP 2: Enter Order Details
   ├── Customer Name: "ABC Distributors"
   │   └─ F2 lookup → auto-selects from CRM
   │
   ├── Product: "Basmati Rice 5kg"
   │   └─ F2 lookup → auto-selects from inventory
   │
   ├── Variant (if any): "Extra Long"
   │
   └── Quantity: 50
       └─ How many bags they're ordering
   ↓
STEP 3: System Calculates Price
   │
   └─ Shows calculation step-by-step:
      ├── Step 1: Customer = ABC Distributors
      ├── Step 2: Tier = TIER-WHOLESALE
      ├── Step 3: Price Book = PB-WHOLESALE-2026
      ├── Step 4: Qty 50 matches tier: Buy 50+ = ₹410/bag
      ├── Step 5: Customer tier has 5% extra discount
      ├── Step 6: Final Price = ₹410 × (1 - 0.05) = ₹389.50/bag
      └── Step 7: Total Order = ₹389.50 × 50 = ₹19,475
   ↓
STEP 4: View Complete Breakdown
   ┌──────────────────────────────────────────────┐
   │ PRICING CALCULATION RESULT                   │
   ├──────────────────────────────────────────────┤
   │                                              │
   │ Customer:           ABC Distributors         │
   │ Product:            Basmati Rice 5kg         │
   │ Quantity:           50 bags                  │
   │                                              │
   │ ──── PRICE HIERARCHY ────                    │
   │ Price Book Applied: PB-WHOLESALE-2026        │
   │ Pricing Source:     PRICE_BOOK_VOLUME        │
   │                                              │
   │ ──── PRICE BREAKDOWN ────                    │
   │ MRP:                ₹500.00                  │
   │ Base Selling Price: ₹500.00                  │
   │ Volume Tier Price:  ₹410.00  (for qty 50+)   │
   │ Customer Discount:  5%                       │
   │ Final Price/Unit:   ₹389.50                  │
   │                                              │
   │ ──── TOTALS ────                             │
   │ Unit Price:         ₹389.50                  │
   │ Quantity:           50 bags                  │
   │ Line Total:         ₹19,475.00               │
   │                                              │
   │ ──── MARGINS (INFO ONLY) ────                │
   │ Cost Price:         ₹300.00                  │
   │ Profit/Unit:        ₹89.50 (23% margin)      │
   │                                              │
   │ [PRINT] [COPY TO CLIPBOARD]                  │
   └──────────────────────────────────────────────┘
   ↓
STEP 5: Share or Use This Price
   ├── Send to customer as quotation
   ├── Use in POS to create sales order
   ├── Share with sales team for negotiations
   └── Save as reference
```

**What This Shows:**
- **Pricing Source** - Which Price Book was used (helps verify correctness)
- **Volume Tier Applied** - Which quantity tier matched
- **Discounts Applied** - Customer discount percentage
- **Profit Margin** - For internal reference (not shown to customers)
- **Timestamp** - When this price was calculated

---

## SECTION 6: UI/UX Design Specifications

### Screen 1: Price Books List (Dashboard)

**Purpose:** Overview of all price books in the system

**Layout:**
```
┌────────────────────────────────────────────────────────────────┐
│ PRICE BOOKS                                  [+ CREATE NEW]    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ Filter: [All ▼] [ACTIVE ▼] [VALID NOW ▼] [Search...]         │
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ PRICE BOOK NAME       CODE        STATUS   CHANNEL       │  │
│ ├──────────────────────────────────────────────────────────┤  │
│ │ ✓ Wholesale Q3 2026   PB-WHL-Q3   ACTIVE   WHOLESALE     │  │
│ │   └ Default book, Valid Sep-Dec 2026                    │  │
│ │   └ 45 products, Last updated 2 days ago                │  │
│ │   [EDIT] [VIEW DETAILS] [DUPLICATE] [DELETE]            │  │
│ │                                                          │  │
│ │ Diwali Festival Sale   PB-DIWALI   ACTIVE   RETAIL       │  │
│ │   └ Valid Oct 1-15 only (promotional)                   │  │
│ │   └ 120 products, Last updated today                    │  │
│ │   [EDIT] [VIEW DETAILS] [DUPLICATE] [DELETE]            │  │
│ │                                                          │  │
│ │ Retail Regular        PB-RETAIL    ACTIVE   RETAIL       │  │
│ │   └ Default book, No date limit                         │  │
│ │   └ 380 products, Last updated 5 days ago               │  │
│ │   [EDIT] [VIEW DETAILS] [DUPLICATE] [DELETE]            │  │
│ │                                                          │  │
│ │ B2B Corporate Q2 2026 PB-B2B-Q2    INACTIVE B2B          │  │
│ │   └ Draft stage, Ready to activate                      │  │
│ │   └ 45 products                                         │  │
│ │   [EDIT] [VIEW DETAILS] [ACTIVATE] [DELETE]             │  │
│ │                                                          │  │
│ │ Summer Sale 2026      PB-SUMMER    ARCHIVED RETAIL       │  │
│ │   └ Historical, Valid Jun-Aug (past)                    │  │
│ │   └ 200 products                                        │  │
│ │   [VIEW ONLY] [RESTORE]                                 │  │
│ │                                                          │  │
│ │ ... [LOAD MORE]                                         │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
│ Showing 5 of 12 Price Books                                   │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Default indicator (✓)** - Shows which one is default
- **Quick stats** - Product count, last update
- **Status colors:**
  - 🟢 ACTIVE (green)
  - 🟡 INACTIVE (yellow/gray)
  - ⚫ ARCHIVED (dark)
- **Quick actions** - Edit, View, Delete without opening
- **Bulk operations** - Select multiple, perform action on all

---

### Screen 2: Price Book Details (Create/Edit)

**Purpose:** Create new or edit existing price book header

**Layout:**
```
┌────────────────────────────────────────────────────────────────┐
│ PRICE BOOK DETAILS                                  [SAVE] [X] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ 📝 BASIC INFORMATION                                           │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ Price Book Name *                                       │  │
│ │ [Wholesale Distributor 2026 ________________] Max 200  │  │
│ │                                                          │  │
│ │ Price Book Code * (Unique)                              │  │
│ │ [PB-WHOLESALE-2026 ________________]                     │  │
│ │ Format: Letters, numbers, hyphens only (no spaces)      │  │
│ │                                                          │  │
│ │ Currency                                                │  │
│ │ [INR ▼]  [USD]  [EUR]                                   │  │
│ │                                                          │  │
│ │ Sales Channel                                           │  │
│ │ ○ RETAIL   ○ WHOLESALE   ○ B2B   ○ ECOMMERCE   ○ POS    │  │
│ │                                                          │  │
│ │ Description (Optional)                                  │  │
│ │ [For all wholesale dealers and large distributors ____│  │
│ │ ___________________________________] Max 500 chars      │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
│ 📅 VALIDITY PERIOD                                             │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │                                                          │  │
│ │ Valid From (Start Date)                                 │  │
│ │ [Sep 1, 2026 ________] [10:00 AM] 🕐                    │  │
│ │ (Prices apply AFTER this date)                          │  │
│ │                                                          │  │
│ │ Valid To (End Date)                                     │  │
│ │ [Dec 31, 2026 ________] [11:59 PM] 🕐                   │  │
│ │ (Prices apply UNTIL this date)                          │  │
│ │                                                          │  │
│ │ ⚠️ Leave BLANK if no expiration (permanent price book)  │  │
│ │                                                          │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
│ ⚙️ SETTINGS                                                    │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ Set as DEFAULT Price Book?                              │  │
│ │ ☑ YES  ☐ NO                                             │  │
│ │ (Use this when no other price book applies)             │  │
│ │                                                          │  │
│ │ Status                                                  │  │
│ │ ○ ACTIVE    ○ INACTIVE    ○ ARCHIVED                    │  │
│ │ ACTIVE = Available for use now                          │  │
│ │ INACTIVE = Ready but not enabled yet                    │  │
│ │ ARCHIVED = Historical, not used                         │  │
│ │                                                          │  │
│ │ Allow Negative Margins?                                 │  │
│ │ ☐ YES (Selling Price < Cost Price)                      │  │
│ │ ⚠️ WARNING: Only enable for loss leaders / promos!       │  │
│ │                                                          │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
│                          [← BACK] [SAVE PRICE BOOK]            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Validation Rules:**
- **Name** - Required, max 200 chars
- **Code** - Required, unique, alphanumeric + hyphens only
- **Channel** - At least one must be selected
- **Dates** - "Valid From" must be before "Valid To"
- **Default** - Only one price book can be default per channel

---

### Screen 3: Product Entries in Price Book (Detailed View)

**Purpose:** Manage all products and their prices within a price book

**Layout:**
```
┌────────────────────────────────────────────────────────────────┐
│ PRODUCTS IN: Wholesale Distributor 2026                        │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ [+ ADD PRODUCT] [IMPORT BULK CSV] [EXPORT] [SETTINGS]          │
│                                                                │
│ Search: [Find product...] [Filter▼]  Showing 1-10 of 45       │
│                                                                │
│ ┌────────────────────────────────────────────────────────────┐│
│ │ PRODUCT NAME       MRP    TIERS  MARGIN  STATUS  ACTION     ││
│ ├────────────────────────────────────────────────────────────┤│
│ │ Basmati Rice 5kg   ₹500   3      23%     ACTIVE           ││
│ │ └ Variant: None                                           ││
│ │ Tier 1 (1+):    ₹420  | Tier 2 (10+): ₹410  | Tier 3(50+): ₹395││
│ │ Cost: ₹300                                                ││
│ │                                                            ││
│ │ [EDIT TIERS] [EDIT PRICES] [HISTORY] [DELETE]             ││
│ │                                                            ││
│ │─────────────────────────────────────────────────────────────││
│ │ Aromatic Jasmine   ₹450   2      20%     ACTIVE           ││
│ │ └ Variant: 2kg Bag                                         ││
│ │ Tier 1 (1+):    ₹380  | Tier 2 (25+): ₹360              ││
│ │ Cost: ₹280                                                ││
│ │                                                            ││
│ │ [EDIT TIERS] [EDIT PRICES] [HISTORY] [DELETE]             ││
│ │                                                            ││
│ │─────────────────────────────────────────────────────────────││
│ │ Soybean Oil 5L     ₹650   1      18%     ACTIVE           ││
│ │ └ Variant: None                                           ││
│ │ Tier 1 (1+):    ₹530                                      ││
│ │ Cost: ₹435                                                ││
│ │                                                            ││
│ │ [EDIT TIERS] [EDIT PRICES] [HISTORY] [DELETE]             ││
│ │                                                            ││
│ │─────────────────────────────────────────────────────────────││
│ │ ... (more products)                                       ││
│ └────────────────────────────────────────────────────────────┘│
│                                                                │
│ Showing 3 of 45 products                    [LOAD MORE]        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Key Information Displayed:**
- **Margin %** - Automatically calculated (Selling - Cost) / Selling × 100
- **Tier Count** - How many quantity tiers for this product
- **Status** - Active/Inactive/Error
- **Action links** - Quick access to edit/delete/history

---

### Screen 4: Add/Edit Product Entry (Volume Tiers)

**Purpose:** Detailed view for editing a single product's prices and tiers

**Layout:**
```
┌────────────────────────────────────────────────────────────────┐
│ EDIT PRODUCT IN PRICE BOOK                    [SAVE] [DISCARD] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ 📦 PRODUCT DETAILS                                             │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ Product Name:        Basmati Rice 5kg                   │  │
│ │ Product SKU:         SKU-RICE-5KG-001                   │  │
│ │ Barcode:             8901234567890                      │  │
│ │ Variant (if any):    [None ▼]                           │  │
│ │                                                          │  │
│ │ Category:            Grocery → Rice                     │  │
│ │ HSN Code:            1006.30                            │  │
│ │ Tax Rate:            5%                                 │  │
│ │                                                          │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
│ 💰 PRICING INFORMATION                                         │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ MRP (Maximum Retail Price) * Required                    │  │
│ │ [₹ 500.00 _____________] (Statutory maximum)            │  │
│ │                                                          │  │
│ │ Base Cost Price (For margin calculation)                │  │
│ │ [₹ 300.00 _____________]                                │  │
│ │                                                          │  │
│ │ Base Selling Price (Tier 1: Min 1 unit)                │  │
│ │ [₹ 420.00 _____________]                                │  │
│ │ ⚠️ Must be ≤ MRP                                        │  │
│ │ Margin: (420-300)/420 × 100 = 28.6% ✓                  │  │
│ │                                                          │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
│ 📊 VOLUME BREAK TIERS                                          │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │                                                          │  │
│ │ [DEFAULT TIER - FIXED]                                  │  │
│ │ Min Qty: 1           Price: ₹420      MRP: ₹500         │  │
│ │                                                          │  │
│ │ ─────────────────────────────────────────────────────   │  │
│ │                                                          │  │
│ │ TIER 2:                                                 │  │
│ │ Min Qty: [10 ___] (Buy 10+)    Price: [₹ 410 ___]       │  │
│ │                                 MRP: [₹ 500 ___]         │  │
│ │                                 Cost: [₹ 300 ___]        │  │
│ │ Margin: (410-300)/410 × 100 = 26.8% ✓                  │  │
│ │                                                          │  │
│ │ [DELETE THIS TIER]                                      │  │
│ │                                                          │  │
│ │ ─────────────────────────────────────────────────────   │  │
│ │                                                          │  │
│ │ TIER 3:                                                 │  │
│ │ Min Qty: [50 ___] (Buy 50+)    Price: [₹ 395 ___]       │  │
│ │                                 MRP: [₹ 500 ___]         │  │
│ │                                 Cost: [₹ 300 ___]        │  │
│ │ Margin: (395-300)/395 × 100 = 24.1% ✓                  │  │
│ │                                                          │  │
│ │ [DELETE THIS TIER]                                      │  │
│ │                                                          │  │
│ │ ─────────────────────────────────────────────────────   │  │
│ │                                                          │  │
│ │ [+ ADD ANOTHER TIER]                                    │  │
│ │                                                          │  │
│ │ ⚠️ Rules:                                               │  │
│ │ • Each tier Min Qty must be > previous tier             │  │
│ │ • Prices usually decrease as quantity increases          │  │
│ │ • Cost price should be same across all tiers            │  │
│ │                                                          │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
│ 📝 NOTES (Optional)                                            │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ [Internal notes about this product's pricing____         │  │
│ │  (not shown to customers)___________________________] │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
│ [← BACK] [PREVIEW PRICE CALC] [SAVE PRODUCT] [DELETE]        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Instant margin calculation** - Shows profit % automatically
- **Validation feedback** - Red/green indicators
- **Tier ordering** - Min quantities auto-verified
- **Price comparison** - Visually compare tiers
- **Delete option** - Remove tiers individually

---

### Screen 5: Customer Tiers Management

**Purpose:** Define and manage customer classifications

**Layout:**
```
┌────────────────────────────────────────────────────────────────┐
│ CUSTOMER PRICE TIERS                         [+ CREATE NEW]    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│ Filter: [All ▼]  Search: [Find tier...]                       │
│                                                                │
│ ┌──────────────────────────────────────────────────────────┐  │
│ │ TIER NAME        CODE             PRICE BOOK   DISCOUNT  │  │
│ ├──────────────────────────────────────────────────────────┤  │
│ │ Retail Customer  TIER-RETAIL      (Default)     0%       │  │
│ │ └ 1,245 customers assigned                              │  │
│ │ [EDIT] [VIEW CUSTOMERS] [DELETE]                         │  │
│ │                                                          │  │
│ │ Wholesale Dealer TIER-WHOLESALE   PB-WHOLESALE-2026  5% │  │
│ │ └ 89 customers assigned                                 │  │
│ │ [EDIT] [VIEW CUSTOMERS] [DELETE]                         │  │
│ │                                                          │  │
│ │ VIP Customer     TIER-VIP         PB-WHOLESALE-2026  10% │  │
│ │ └ 12 customers assigned                                 │  │
│ │ [EDIT] [VIEW CUSTOMERS] [DELETE]                         │  │
│ │                                                          │  │
│ │ B2B Corporate    TIER-B2B         PB-B2B-CORPORATE   0%  │  │
│ │ └ 34 customers assigned                                 │  │
│ │ [EDIT] [VIEW CUSTOMERS] [DELETE]                         │  │
│ │                                                          │  │
│ └──────────────────────────────────────────────────────────┘  │
│                                                                │
│ Showing 4 of 4 tiers                                           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## SECTION 7: Real-World Examples

### Example 1: Rice Distributor Setup

**Scenario:** You run a rice wholesale distribution company. You sell to:
- Individual retail customers (from website)
- Small retailers (local shops)
- Large distributors (chain stores)

**Price Book Setup:**

```
┌─────────────────────────────────────────────────────┐
│ PRICE BOOK 1: RETAIL ONLINE                         │
├─────────────────────────────────────────────────────┤
│ For: Individual customers on your website           │
│ Code: PB-RETAIL-ONLINE                              │
│ Status: ACTIVE (always)                             │
│ Valid: No date limit                                │
│ Is Default: YES                                     │
│                                                     │
│ BASMATI RICE 5KG                                    │
│ ├─ Qty 1-4:   ₹500/bag (Full MRP)                  │
│ ├─ Qty 5-9:   ₹495/bag (1% discount)               │
│ └─ Qty 10+:   ₹490/bag (2% discount)               │
│                                                     │
│ JASMINE RICE 5KG                                    │
│ ├─ Qty 1-4:   ₹450/bag (Full MRP)                  │
│ ├─ Qty 5-9:   ₹445/bag                             │
│ └─ Qty 10+:   ₹440/bag                             │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ PRICE BOOK 2: WHOLESALE DISTRIBUTOR                │
├─────────────────────────────────────────────────────┤
│ For: Large distributors who buy in bulk             │
│ Code: PB-WHOLESALE-DIST                             │
│ Status: ACTIVE                                      │
│ Valid: Sep 1 - Dec 31, 2026                         │
│ Is Default: NO                                      │
│                                                     │
│ BASMATI RICE 5KG                                    │
│ ├─ Qty 10-49:   ₹420/bag (16% discount)            │
│ ├─ Qty 50-99:   ₹410/bag (18% discount)            │
│ ├─ Qty 100-249: ₹395/bag (21% discount)            │
│ ├─ Qty 250-499: ₹385/bag (23% discount)            │
│ └─ Qty 500+:    ₹375/bag (25% discount)            │
│                                                     │
│ JASMINE RICE 5KG                                    │
│ ├─ Qty 10-49:   ₹380/bag                           │
│ ├─ Qty 50-99:   ₹370/bag                           │
│ └─ Qty 100+:    ₹360/bag                           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ PRICE BOOK 3: RETAIL CHAIN                          │
├─────────────────────────────────────────────────────┤
│ For: Large retail chains (special negotiated rates) │
│ Code: PB-RETAIL-CHAIN                               │
│ Status: ACTIVE                                      │
│ Valid: Permanent (no expiry)                        │
│ Is Default: NO                                      │
│                                                     │
│ BASMATI RICE 5KG                                    │
│ └─ Qty 100+: ₹380/bag (24% discount)               │
│   (Negotiated with BigMart chain)                   │
│                                                     │
│ JASMINE RICE 5KG                                    │
│ └─ Qty 100+: ₹340/bag                              │
└─────────────────────────────────────────────────────┘
```

**Customer Tier Setup:**

```
┌──────────────────────────────────────┐
│ TIER: RETAIL CUSTOMER                │
├──────────────────────────────────────┤
│ Code: TIER-RETAIL                    │
│ Price Book: (none - uses DEFAULT)    │
│ Discount: 0%                         │
│ Customers: >1000                     │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ TIER: WHOLESALE DISTRIBUTOR          │
├──────────────────────────────────────┤
│ Code: TIER-WHOLESALE                 │
│ Price Book: PB-WHOLESALE-DIST        │
│ Discount: 0%                         │
│ Customers: 89 (ABC Dist, XYZ Corp...) │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ TIER: RETAIL CHAIN                   │
├──────────────────────────────────────┤
│ Code: TIER-RETAIL-CHAIN              │
│ Price Book: PB-RETAIL-CHAIN          │
│ Discount: 0%                         │
│ Customers: 3 (BigMart, MegaStore, etc) │
└──────────────────────────────────────┘
```

**Real Transaction Examples:**

```
SCENARIO A: Small customer orders online
├─ Customer: Rajesh Kumar
├─ Tier: TIER-RETAIL (default)
├─ Order: 5 bags Basmati Rice
├─ Price Book Applied: PB-RETAIL-ONLINE (default)
├─ Qty Tier: 5-9 bags
├─ Price: ₹495/bag × 5 = ₹2,475
└─ ✅ APPROVED

SCENARIO B: Wholesaler places bulk order
├─ Customer: ABC Distributors  
├─ Tier: TIER-WHOLESALE
├─ Order: 150 bags Basmati Rice
├─ Price Book Applied: PB-WHOLESALE-DIST (via tier)
├─ Qty Tier: 100-249 bags tier applies to order
├─ Price: ₹395/bag × 150 = ₹59,250
└─ ✅ APPROVED

SCENARIO C: Retail chain negotiated order
├─ Customer: BigMart Chain
├─ Tier: TIER-RETAIL-CHAIN
├─ Order: 200 bags Jasmine Rice
├─ Price Book Applied: PB-RETAIL-CHAIN (via tier)
├─ Qty Tier: Only one tier available (100+)
├─ Price: ₹340/bag × 200 = ₹68,000
└─ ✅ APPROVED
```

---

### Example 2: Festival/Promotional Price Book

**Scenario:** Diwali festival is coming. You want to run a promotion with special prices for 2 weeks.

**Setup:**

```
CREATE: "Diwali Festival Sale 2026"
Code:    PB-DIWALI-2026
Valid:   October 1, 2026 → October 15, 2026
Status:  ACTIVE (after Oct 1)
Channel: RETAIL

PRODUCTS:
├── Basmati Rice 5kg
│   ├── MRP: ₹500 (same)
│   ├── Qty 1+:   ₹350 (30% DISCOUNT!)
│   ├── Qty 10+:  ₹330
│   └── Qty 25+:  ₹310

├── Jasmine Rice 5kg
│   ├── MRP: ₹450
│   ├── Qty 1+:   ₹315 (30% discount)
│   ├── Qty 10+:  ₹300
│   └── Qty 25+:  ₹285

└── Soybean Oil 5L
    ├── MRP: ₹650
    ├── Qty 1+:   ₹455 (30% discount)
    └── Qty 5+:   ₹440
```

**What Happens:**

```
BEFORE Oct 1:
  All orders use PB-RETAIL-ONLINE (default)
  Basmati Rice = ₹500/bag
  
Oct 1 - Oct 15:
  PB-DIWALI-2026 becomes ACTIVE
  Customers shopping during this period see:
  Basmati Rice = ₹350/bag (30% off!)
  System still applies volume breaks
  Qty 10 = ₹330/bag (even better!)
  
After Oct 15:
  PB-DIWALI-2026 expires
  All orders revert to PB-RETAIL-ONLINE
  Basmati Rice = ₹500/bag (sale ends)
```

---

## SECTION 8: User Roles & Permissions

### Role 1: Pricing Manager

**Responsibilities:**
- Create and manage Price Books
- Add/update/remove products from Price Books
- Set MRP and selling prices
- Define volume break tiers
- Activate/deactivate price books
- Monitor price changes history

**Permissions:**
```
✅ Can CREATE price books
✅ Can EDIT price books (before activation)
✅ Can EDIT prices in ACTIVE books
✅ Can DELETE draft price books only
❌ Cannot delete ACTIVE books (must ARCHIVE)
✅ Can view price history/audit logs
✅ Can export price lists
❌ Cannot delete ARCHIVED books
```

**Access Level:** Medium-High

---

### Role 2: Sales Manager

**Responsibilities:**
- Create and manage Customer Tiers
- Assign customers to pricing tiers
- Verify prices for customer orders
- Monitor competitor pricing
- Request temporary price books for special deals

**Permissions:**
```
✅ Can view all price books
✅ Can CREATE customer tiers
✅ Can EDIT customer tier assignments
✅ Can assign customers to tiers
✅ Can use Price Calculator
✅ Can view price history
❌ Cannot create/edit price books
❌ Cannot delete customer tiers
```

**Access Level:** Medium

---

### Role 3: Customer Service

**Responsibilities:**
- Check correct prices for customers
- Verify pricing in customer quotes
- Answer price-related inquiries
- Process price adjustments (within guidelines)

**Permissions:**
```
✅ Can view all price books (read-only)
✅ Can view customer tier assignments
✅ Can use Price Calculator
✅ Can view price history
✅ Can print price lists
✅ Can generate price quotes
❌ Cannot create/edit price books
❌ Cannot edit prices
❌ Cannot create tiers
```

**Access Level:** Low-Medium

---

### Role 4: System Administrator

**Responsibilities:**
- Oversee all pricing configuration
- Archive/restore old price books
- Manage user permissions
- Audit all price changes
- Backup and recovery

**Permissions:**
```
✅ Can do EVERYTHING
✅ Can CREATE/EDIT/DELETE price books
✅ Can view all audit logs
✅ Can restore deleted items
✅ Can manage all permissions
```

**Access Level:** High

---

## SECTION 9: Common Questions (FAQ)

### Q1: What if I forget to set a Price Book? What happens?
**A:** The DEFAULT Price Book is automatically used. If no default exists, the Item Master base price is used. You can always specify a Price Book explicitly for any order.

---

### Q2: Can I use the same product in multiple Price Books?
**A:** YES! Same product can be in multiple price books with different prices. Example: ₹500 in Retail book, ₹420 in Wholesale book.

---

### Q3: What if I want to change prices for existing orders?
**A:** GOOD NEWS: Old orders keep their original prices (locked at time of order). Only NEW orders use the new prices. This protects customers from surprise price changes mid-transaction.

---

### Q4: Can I have NEGATIVE margin (sell below cost)?
**A:** The system WARNS you (showing red), but you can force it if needed (e.g., loss leaders during promotions). But it's not recommended!

---

### Q5: What happens if a product variant doesn't have a price entry?
**A:** System falls back to the base Item price for that variant. This is intentional - saves you from entering every variant separately.

---

### Q6: Can I run two price books simultaneously?
**A:** YES! You can have multiple ACTIVE price books with overlapping dates. The system picks based on:
1. Explicit Price Book if specified
2. Customer Tier's assigned Price Book
3. DEFAULT Price Book
4. Item Master base price (fallback)

---

### Q7: What's the difference between MRP and Selling Price?
**A:**
- **MRP** = Maximum Retail Price (what customers see on product package)
- **Selling Price** = What you actually charge (can be ≤ MRP)

Example:
- MRP: ₹500 (printed on box)
- Selling Price: ₹420 (what you charge in wholesale book)
- Customer sees: ₹420 charged, ₹500 crossed out

---

### Q8: Can I bulk import prices from Excel/CSV?
**A:** YES! The system has bulk import feature. Format:
```
Item Code | Variant | Qty 1 | Qty 10 | Qty 50 | MRP
SKU-001   | -       | 420   | 410    | 395    | 500
SKU-002   | Red     | 300   | 290    | 280    | 350
```

---

### Q9: Can I see who changed prices and when?
**A:** ABSOLUTELY! Every change is logged with:
- Old price & new price
- Timestamp (exact date/time)
- User who made change
- Price book affected
- Products affected

Example log entry:
```
2026-09-05 14:30:00 | User: Priya (pricing_mgr) | 
Changed: PB-WHOLESALE | 
Item: Basmati Rice | Qty 50+ | 
FROM: ₹395 TO: ₹410 | Reason: "Cost increase"
```

---

### Q10: What if I want to stop using a Price Book?
**A:** Don't DELETE it! Instead:
1. Change Status to INACTIVE
2. If it was DEFAULT, set new default
3. Historical orders keep their pricing
4. Price book remains in system for audit trail
5. You can RESTORE it later if needed

---

### Q11: Can different branches have different price books?
**A:** YES! Each branch can have its own price books. System automatically checks branch context when applying prices.

---

### Q12: Is there a minimum/maximum price limit?
**A:** No hard limits, but system validates:
- Selling Price ≤ MRP (required)
- Cost Price ≤ Selling Price (warning if violated)
- Volume tier prices decrease (usually - can override)

---

## SECTION 10: Error Handling & Safety Checks

### Error 1: Duplicate Price Book Code

**Error Message:**
```
⚠️ ERROR: Price Book Code 'PB-WHOLESALE' already exists!

The code must be unique. Please use a different code.

Suggestion: PB-WHOLESALE-2026
```

**Solution:**
- Choose a different, more specific code
- Include date or version in code
- Example: PB-WHOLESALE-Q3-2026

---

### Error 2: Invalid Date Range

**Error Message:**
```
⚠️ ERROR: Invalid Date Range!

Valid To must be AFTER Valid From.

Your dates:
  From: Oct 15, 2026
  To:   Oct 1, 2026  ← This is BEFORE!
```

**Solution:**
- Ensure end date is after start date
- Use calendar picker to prevent mistakes

---

### Error 3: Selling Price > MRP

**Error Message:**
```
🔴 ERROR: Selling Price Cannot Exceed MRP!

MRP (Maximum Retail Price):      ₹500
Your Selling Price:               ₹520  ← INVALID!

Fix: Reduce Selling Price to ≤ ₹500
```

**Solution:**
- Lower selling price
- Increase MRP if needed
- Use MRP Validator

---

### Error 4: Negative Margin Warning

**Warning Message:**
```
⚠️ WARNING: Negative Margin Detected!

Cost Price:        ₹300
Selling Price:     ₹250  
Margin:            -₹50 (LOSS!)

You're selling below cost!
This is only recommended for promotions.

[PROCEED ANYWAY] [EDIT PRICE]
```

**Solution:**
- Increase selling price, OR
- Confirm this is intentional (loss leader), OR
- Update cost price if incorrect

---

### Error 5: Product Not Found

**Error Message:**
```
🔴 ERROR: Product Not Found!

Item Code: SKU-INVALID-001

This product does not exist in Item Master.

Action:
1. Create the product in Item Master first
2. Then add it to this Price Book

[CREATE PRODUCT] [CANCEL]
```

**Solution:**
- First create product in Item Master
- Then reference it in Price Book
- Verify product code is correct

---

### Error 6: Conflicting Quantity Tiers

**Error Message:**
```
🔴 ERROR: Invalid Quantity Tier Configuration!

Tier 1: Min Qty = 1,   Price = ₹420
Tier 2: Min Qty = 10,  Price = ₹420  ← SAME as Tier 1!
Tier 3: Min Qty = 5    Price = ₹410  ← LESS than Tier 2!

Issues:
❌ Tier 2 Min Qty (10) not > Tier 1 (1)
❌ Tier 3 Min Qty (5) not > Tier 2 (10)

Fix: Ensure each tier has HIGHER Min Qty than previous
```

**Solution:**
- Reorder tiers: 1 → 10 → 25 → 50 (ascending)
- Remove duplicate tier
- Verify each tier has unique Min Qty

---

### Success Confirmations

#### Confirmation 1: Price Book Created

```
✅ SUCCESS: Price Book Created!

Name:            Diwali Festival Sale 2026
Code:            PB-DIWALI-2026
Valid:           Oct 1 - Oct 15, 2026
Status:          ACTIVE
Products Added:  0 (Add products next)

Next Steps:
[ADD PRODUCTS] [VIEW DETAILS] [CLOSE]
```

---

#### Confirmation 2: Prices Updated

```
✅ SUCCESS: 45 Product Prices Updated!

Updated in: PB-WHOLESALE-2026
Changed by: Priya Sharma
Timestamp:  Sep 5, 2026 2:30 PM

Changes Summary:
• 45 products updated
• Average price increase: 3.2%
• Max increase: ₹45/unit
• Min increase: ₹5/unit

Audit Log Entry: AUTO-LOGGED
[VIEW AUDIT LOG] [CLOSE]
```

---

#### Confirmation 3: Customer Tier Assigned

```
✅ SUCCESS: Customer Assigned to Tier!

Customer:    ABC Distributors
New Tier:    TIER-WHOLESALE
Price Book:  PB-WHOLESALE-2026
Discount:    5%

Effect:
Starting next order, this customer will receive:
• Wholesale pricing (vs retail)
• Volume break discounts
• Additional 5% tier discount
• Effective cost reduction: ~15-20%

[VIEW CUSTOMER] [CREATE ORDER] [CLOSE]
```

---

### Audit Trail Viewing

**Where to See All Changes:**

```
PRICING DASHBOARD → AUDIT LOG

┌─────────────────────────────────────────────────────────┐
│ AUDIT LOG: All Price Changes                            │
├─────────────────────────────────────────────────────────┤
│ Filter: [All ▼] [Price Books ▼] [Date Range ▼]        │
│                                                         │
│ 2026-09-05 14:30 | Priya Sharma | PRICE UPDATED        │
│ └─ Book: PB-WHOLESALE | Item: Basmati Rice            │
│    FROM ₹395 (qty 50+) TO ₹410 | Reason: "Cost increase" │
│                                                         │
│ 2026-09-05 10:15 | Rajesh (Manager) | BOOK ACTIVATED   │
│ └─ Book: PB-DIWALI-2026 | Status: INACTIVE → ACTIVE    │
│    Valid: Oct 1-15 | 120 products                       │
│                                                         │
│ 2026-09-04 16:45 | Priya Sharma | TIER CREATED         │
│ └─ Tier: TIER-VIP | Discount: 10%                      │
│    Linked Book: PB-WHOLESALE-2026                       │
│                                                         │
│ 2026-09-03 09:20 | Rajesh (Manager) | PRODUCT ADDED    │
│ └─ Book: PB-DIWALI-2026 | Product: Soybean Oil 5L      │
│    Tier 1 (1+): ₹455 | Cost: ₹350                      │
│                                                         │
│ [LOAD MORE] [EXPORT REPORT] [EMAIL REPORT]             │
└─────────────────────────────────────────────────────────┘
```

---

## Conclusion

This Price Book system gives you:

✅ **Flexibility** - Manage unlimited price lists for different customers/channels  
✅ **Control** - Volume breaks, promotional pricing, channel-specific pricing  
✅ **Automation** - System picks right price automatically (no manual lookups)  
✅ **Compliance** - MRP tracking, audit trails for every change  
✅ **Scalability** - Works for 10 products or 10,000 products  
✅ **Simplicity** - Even non-technical users can manage pricing  
✅ **Safety** - Multiple validation checks prevent errors  
✅ **History** - Every change tracked forever  

**Implementation is ready to proceed with this blueprint!**

---

## Next Steps

1. **Review** - Share this blueprint with team
2. **Customize** - Adjust for your specific business needs
3. **Test** - Create test price books in dev environment
4. **Train** - Train staff using workflows in Section 5
5. **Launch** - Go live with live data migration

---

**Document Version:** 1.0  
**Status:** READY FOR DEVELOPMENT  
**Created:** 2026-09-05  
**Last Updated:** 2026-09-05  
