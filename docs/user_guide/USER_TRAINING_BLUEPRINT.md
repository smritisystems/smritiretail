<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.16.0
  Created      : 2026-08-14
  Modified     : 2026-08-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS — User Training Blueprint

### Objective

Train the team according to the **actual business transaction lifecycle**, so users understand how each step affects the next.

```text
MASTER CREATION
       ↓
PURCHASE ORDER (PO)
       ↓
PURCHASE RECEIPT / GRN
       ↓
STOCK AVAILABLE
       ↓
SALES / BILLING
       ↓
REPORTS & CONTROL
```

---

## 7-Day Training Blueprint

| Day       | Module                           | Training Outcome                                                                                                           |
| --------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Day 1** | **Master Creation**              | Users learn to create and maintain Items, Customers, Suppliers, Warehouses/Locations, GST/Tax details and required masters |
| **Day 2** | **Purchase Order**               | Supplier → Items → Qty → Rate → Discount/GST → PO creation → Edit/Approval → PO tracking                                   |
| **Day 3** | **Purchase Receipt / GRN**       | Select PO → Receive goods → Qty verification → Short/Excess → Batch/Serial where applicable → Stock update                 |
| **Day 4** | **Sales / Billing**              | Customer → Item → Qty → Discount → GST → Invoice → Save → Print/PDF → Reprint                                              |
| **Day 5** | **Complete Business Cycle**      | Real transaction: **Master → PO → Receipt → Stock → Sales/Billing**                                                        |
| **Day 6** | **Returns & Corrections**        | Purchase Return → Sales Return → Stock adjustments → Invoice cancellation/correction                                       |
| **Day 7** | **Reports + User Certification** | Sales, Purchase, Stock, Customer/Supplier, Outstanding and GST reports + practical user assessment                         |

---

## Daily Training Method

Every module follows the same pattern:

```text
1. EXPLAIN
      ↓
2. DEMONSTRATE
      ↓
3. USER PERFORMS
      ↓
4. REAL BUSINESS SCENARIO
      ↓
5. VERIFY RESULT
      ↓
6. QUESTIONS / CORRECTION
      ↓
7. USER INDEPENDENTLY REPEATS
```

---

### Day 1 — Master Creation

**Foundation first.**

```text
Company / Branch
      ↓
Users & Access
      ↓
Item Master
      ↓
Supplier Master
      ↓
Customer Master
      ↓
Warehouse / Location
      ↓
GST / Tax Configuration
```

#### Detailed Workflow Breakdown:
1. **Company / Branch Setup**: Verification of GSTIN, FSSAI registration (if applicable), billing address, and default branch profiles.
2. **Users & Role Access**: Creation of operational accounts (Store Manager, Cashier, Inventory Clerk) with strict permission scopes.
3. **Item Master**: Defining SKU code, Barcode/EAN, HSN/SAC code, Category/Subcategory, Units of Measure (UOM), and CGST/SGST/IGST tax rates.
4. **Supplier Master**: Recording vendor name, GSTIN, payment terms, credit limits, contact details, and address books.
5. **Customer Master**: Configuring retail default customer, wholesale customer profiles, GSTIN validation, and ledger credit limits.
6. **Warehouse / Location**: Setting up primary store, secondary godowns, transit locations, and rack/shelf designations.
7. **GST / Tax Configuration**: Mapping tax slabs (0%, 5%, 12%, 18%, 28%), intra-state vs inter-state tax engine rules.

**Completion criteria:** User can independently create and correctly maintain required masters.

---

### Day 2 — Purchase Order (PO)

```text
Supplier
 ↓
Select Items
 ↓
Quantity
 ↓
Purchase Rate
 ↓
Discount / GST
 ↓
Create PO
 ↓
Review / Modify
 ↓
PO Confirmation
```

#### Detailed Workflow Breakdown:
1. **Supplier Selection**: Select active vendor from master registry; verify tax registration and active credit terms.
2. **Item Selection & Stock Check**: Add items required for reorder based on min/max threshold alerts.
3. **Quantity & Rate Entry**: Key in ordered quantity, standard landing purchase rate, and supplier trade discounts.
4. **Tax Calculation**: Automated verification of CGST + SGST (intra-state) or IGST (inter-state) computation.
5. **PO Generation & Approval**: Save PO in draft status, route for store manager approval, and generate PO PDF/printout for vendor delivery.
6. **PO Tracking**: Monitor open PO balances, expected delivery timelines, and partial execution statuses.

---

### Day 3 — Purchase Receipt / GRN

```text
PO
 ↓
Receive Material
 ↓
Verify Quantity
 ↓
Check Short / Excess
 ↓
Batch / Serial (if applicable)
 ↓
Receipt / GRN
 ↓
Stock Updated
```

#### Detailed Workflow Breakdown:
1. **PO Lookup**: Retrieve pending PO by Supplier Name or PO Reference Number.
2. **Physical Inspection**: Inspect physical delivery against vendor delivery challan/invoice.
3. **Quantity Verification**: Enter actual received quantities; system automatically flags short receipts or excess delivery variances.
4. **Batch & Expiry Control**: Capture batch number, manufacturing date, and expiry date for perishable or batch-tracked inventory.
5. **Goods Receipt Note (GRN) Generation**: Post GRN transaction into SMRITI backend system of record.
6. **Stock Ledger Update**: Instant automated update to available stock ledgers across specified warehouse locations.

---

### Day 4 — Sales / Billing

```text
Customer
 ↓
Select / Scan Item
 ↓
Quantity
 ↓
Discount
 ↓
GST
 ↓
SAVE
 ↓
Tax Invoice
 ↓
Print / PDF
```

#### Detailed Workflow Breakdown:
1. **Customer Identification**: Quick-select walk-in cash customer or lookup registered CRM customer profile.
2. **Barcode Scanning / Item Lookup**: Rapid barcode scanning or manual search by SKU/name via POS touch console.
3. **Quantity & Price Audit**: Adjust quantities, verify unit selling prices, and apply authorized bill/line item discounts.
4. **Tax & Totaling**: Instant automated tax invoice rendering (CGST/SGST/IGST breakdown with statutory rounding).
5. **Tender & Payment Processing**: Process single or split payment modes (Cash, Credit Card, UPI, Store Credit).
6. **Invoice Generation & Printing**: Commit bill to PostgreSQL database, trigger POS thermal printer or thermal PDF generator, and handle reprint requests.

---

### Day 5 — Most Important Session (Complete Business Cycle)

Run a **complete real-world transaction**:

```text
Create Item
   ↓
Create Supplier
   ↓
Create PO
   ↓
Receive Goods
   ↓
Verify Stock
   ↓
Create Customer
   ↓
Sell Item
   ↓
Generate Tax Invoice
   ↓
Check Stock
   ↓
Check Reports
```

#### Practical Assessment Scenario:
This session serves as the **main competency test**. Trainees execute an end-to-end transaction chain independently:
- Create a brand new item with HSN code and 18% GST.
- Register a new supplier and issue a PO for 50 units @ ₹100/unit.
- Generate GRN for 50 units and verify stock ledger increments to 50.
- Register a new customer and execute a POS invoice for 5 units @ ₹150/unit.
- Validate that available stock decrements cleanly to 45 units.
- Inspect Stock Register, Daily Sales Report, and GST Sales Summary to confirm accuracy.

---

### Day 6 — Returns & Corrections

```text
PURCHASE RETURN / DEBIT NOTE
       ↓
SALES RETURN / CREDIT NOTE
       ↓
STOCK ADJUSTMENT / AUDIT
       ↓
INVOICE CORRECTION / CANCEL
```

#### Detailed Workflow Breakdown:
1. **Purchase Returns (Debit Note)**: Select GRN/Purchase Invoice, select damaged/rejected items, generate Debit Note, and verify stock reduction.
2. **Sales Returns (Credit Note)**: Lookup original customer invoice, process returned goods into stock/salvage location, and issue refund or store credit.
3. **Physical Stock Adjustments**: Perform stock audit adjustments (breakage, expiry, shrinkage) with mandatory manager authorization.
4. **Invoice Cancellation & Reversal**: Cancel erroneous transactions with automated ledger and tax report reversals.

---

### Day 7 — Reports + User Certification

```text
SALES REPORTS (Daily / POS / Category)
       ↓
PURCHASE REPORTS (Vendor / Item / PO Status)
       ↓
STOCK REPORTS (Valuation / Reorder / Ledger)
       ↓
GST & TAX COMPLIANCE REPORTS (GSTR-1 / GSTR-3B)
       ↓
PRACTICAL USER ASSESSMENT & CERTIFICATION
```

#### Certification & Evaluation Criteria:
1. **Report Navigation**: Generate and interpret Sales Summary, Stock Movement Ledger, Customer Outstanding, and Vendor Ledger.
2. **GST Compliance Verification**: Cross-verify tax liability outputs against GSTR-1 and GSTR-3B summary tables.
3. **Practical Competency Test**: Trainees must pass an unassisted 30-minute real-world transaction test covering creation, purchasing, selling, and reconciliation.

---

## Training Rule

**Don't teach SMRITI as separate screens. Teach it as one connected business workflow.**

> **Master → Purchase → Receipt → Stock → Sales → Reports**

That will make adoption much faster because users understand **what to do, why they are doing it, and what changes in the system after each transaction**.
