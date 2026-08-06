# SMRITI Retail OS v1.0 Beta — Definition of Done (DoD)

**System:** SMRITI Retail OS  
**Status:** MANDATORY RELEASE GATE  
**Standard:** SCS-BUS-001 — SCS-BUS-005 (FROZEN v1.0 LTS)  
**Author:** Jawahar Ramkripal Mallah  
**Copyright:** © SMRITIBooks.com and AITDL.com. All Rights Reserved.  

---

## Declaration of Retail v1.0 Beta Release Gate

SMRITI Retail OS shall be certified **READY FOR BETA PILOT DEPLOYMENT** only when all 12 core workflow validation criteria are 100% verified end-to-end.

---

## 12 Mandatory Retail Beta Workflow Criteria

- [ ] **1. Organization & Branch Setup**: Retailer can create company, branches, and warehouses via Retail Configuration Wizard.
- [ ] **2. System & Hardware Settings**: Retailer can configure GSTIN, HSN tax rates, document numbering series, thermal receipt printers, and barcode printers.
- [ ] **3. Master Data Management**: Retailer can create Item Master, Categories, Brands, Colors/Sizes/UOM, EAN-13 Barcodes, Multi-Price Tiers (MRP, Retail, Wholesale), and bulk import/export via CSV/Excel.
- [ ] **4. Procurement & GRN Workflow**: Retailer can execute Purchase Order -> Partial/Full Goods Receipt Note (GRN) with Landed Cost allocation -> Purchase Invoice -> Supplier Outstanding posting.
- [ ] **5. Multi-Warehouse Stock Transfers**: Retailer can transfer stock between warehouses and branches with in-transit status tracking.
- [ ] **6. Physical Stock Reconciliation**: Retailer can perform physical stock audits, record stock adjustments, and view automated reorder alerts.
- [ ] **7. Fast POS & Barcode Checkout**: Cashier can scan barcodes, bill items under 3 seconds, hold/resume carts, apply schemes (Buy X Get Y, Coupons), and collect multi-mode payments (Cash, UPI, Card, Credit).
- [ ] **8. Sales Returns & Exchanges**: Cashier can process sales returns, generate store credit / credit notes, and redeem them at checkout.
- [ ] **9. Receipts & Payments**: Cashier/Accountant can record customer receipts, supplier payments, cash/bank vouchers, and view party outstanding ledgers.
- [ ] **10. Print Engine Execution**: System prints thermal ESC/POS receipts, Zebra ZPL barcode sticky labels, and A4 tax invoices via SCS-DXP-002 `PrintDomain`.
- [ ] **11. SMRITI Communicator Tally Synchronization**: Background daemon pushes Sales, Purchase, Receipts, Payments, Credit/Debit Notes, and Master Data into TallyPrime / Tally.ERP 9 with automatic retry queue and error logging.
- [ ] **12. Operational BI Reports**: Retailer can generate Daily Sales, GST Returns, Dead Stock, Fast/Slow-Moving, Stock Valuation (FIFO), and Item/Brand Profitability reports.
