# SMRITI Retail OS – Item Master Demo & User Acceptance Walkthrough

## Objective
Demonstrate the completed Item Master module from an end-user perspective.

Act as a Retail Store Owner, Inventory Manager, and Store Operator. Do not explain the source code or architecture. Demonstrate the application exactly as a customer would use it in a browser.

## Demo Requirements
Create a browser-based walkthrough covering the complete Item Master workflow using realistic sample footwear data.

## Demo Flow

### Part 1 – Open Item Master
Show:
- Dashboard
- Navigate to Inventory → Item Master
- Explain the layout:
  - Context Sidebar
  - Product List
  - Product Details
  - Variant Table
  - Quick Actions

### Part 2 – Browse Products
Demonstrate:
- View All Products
- Filter by Brand
- Filter by Department
- Filter by Category
- Filter by Supplier
- Filter by Warehouse
- Favorites
- Recently Viewed

### Part 3 – Search
Search using:
- Barcode
- Product Name
- Article/Style Code
- SKU

### Part 4 – Variant Management
Open Article CH-01-A.

Demonstrate:
- Color variants
- Size variants
- Barcode per variant
- MRP
- Cost
- Stock

### Part 5 – Bulk Operations
Select multiple products.

Demonstrate:
- Export Excel
- Export CSV
- Print Labels
- Print Price Tags
- Clear Selection

### Part 6 – Barcode Label Printing
Select multiple variants.

Open the Label Print dialog.

Show:
- Preview labels
- Select template
- Select quantity
- Generate PDF
- Generate ZPL
- Generate TSPL
- Generate EPL

### Part 7 – Label Print Ledger
After printing, demonstrate the Label Print Ledger.

Verify that every print job records:
- Print Job ID
- Date & Time
- User
- Product
- Barcode
- Variant
- Quantity
- Template
- Printer
- Output Type
- Source Module
- Status

### Part 8 – Reprint
Open a previous print job.

Reprint the labels.

Verify:
- Reprint Count increases
- A new ledger entry is created
- The original entry remains unchanged

### Part 9 – Performance
Load a large dataset (10,000+ products and 100,000+ variants).

Demonstrate:
- Smooth scrolling
- Instant search
- Fast filtering
- Responsive product opening
- Fast label preview generation

### Part 10 – User Acceptance Testing
Validate that:
- All features work in the browser
- No business logic is broken
- Variant Engine functions correctly
- Bulk actions work correctly
- Label Print Ledger is immutable
- Browser printing works without QZ Tray
- Direct Print is available only when QZ Tray is detected

## Deliverables
Provide:
1. A browser walkthrough
2. A UAT report with pass/fail results
3. Screenshots of key workflows
4. Performance observations
5. UI/UX issues found
6. Recommendations for final improvements

## Success Criteria
A new retail user should be able to:
- Find products quickly
- Manage variants with ease
- Search by barcode or article
- Export selected products to Excel
- Generate and print barcode labels
- View complete Label Print Ledger history
- Reprint labels with full audit tracking
- Complete workflows using only a web browser
