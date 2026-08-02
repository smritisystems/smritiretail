<!--
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
-->

# SMRITI Retail OS Roadmap v4.1 Architectural Specification

**Document Identifier:** SPEC-ROADMAP-V4  
**Status:** ACTIVE / FROZEN BASELINE  
**Author:** SMRITI Architecture & Engineering  
**Version:** 4.1.0  

---

## 1. Executive Summary & Operational Master Strategy

The SMRITI Retail OS Development Roadmap v4.1 reorganizes software delivery around operational master dependencies and enterprise multi-vertical scalability. In enterprise retail systems (FMCG, Apparel, Footwear, Consumer Electronics, Supermarkets), master data fragmentation or premature transaction coding creates massive database rework, duplicate field definitions, and schema migrations.

Roadmap v4.1 enforces a strict prerequisite sequence:
1. **Foundation Infrastructure** (Metadata, Identity, Shared Engines)
2. **Enterprise Organization & Security** (Company, Branch, Security, Financial Year, Document Series)
3. **Decoupled Geographic & Monetary Masters** (Geography Master, Currency Engine)
4. **Common Lookup Masters** (Tax, UOM, Storage Hierarchy, 8-Tier Product Hierarchy)
5. **Partner Masters** (Supplier, Customer using Foundation Engines)
6. **Price Engine & Price Rules** (Price Lists, Price Rules, Discounts)
7. **Item Master** (Consuming verified lookups & price contracts)
8. **Data Migration & Opening Stock Validation** (Mandatory Gate 9A)
9. **Transactions** (Purchase → Inventory → POS / Billing → Sales → Accounting)

---

## 2. Comprehensive Phase Breakdown (Phases 0 to 21)

### Phase 0: Foundation Platform (Status: FREEZE)
- Shared Identity, Tenant, Address Engine, Contact Engine, Bank Engine, Communication Engine, Document Engine, Audit Engine, Settings, and Metadata Architecture.

### Phase 1: Company Information (Status: BUILD)
- Legal Entity Definition, CIN, PAN, TAN, Registered Address, Statutory Attributes, Currency defaults, Fiscal Info.

### Phase 2: Organization & Branch
- Branch Master, Franchise Nodes, Operational Units, Cost Centers, Multi-Branch relationships, Regional Offices.

### Phase 3: Users, Roles & Security
- RBAC Permission Scopes, Role Assignments, Session Security, Field Level Permissions, Authorization Policies.

### Phase 4: Financial Year & Accounting Periods
- Fiscal Year Calendar, Open/Closed Periods, Adjustment Periods, Audit Locks, Year-End closing prerequisites.

### Phase 5: Number Series & Document Configuration
- Auto-numbering engine, Document Prefix/Suffix, Branch-wise Series, Reset Frequency (Annual/Monthly/Never), Document Types.

### Phase 6: Geography Master
- Global Country, State, District, City, Pin Code Lookup, State GST Codes (India), Timezone standards, Language preferences.

### Phase 7: Currency Engine & Exchange Rates
- Multi-Currency Master, Daily/Historical Exchange Rate Matrix, Currency Formatting, Rounding Rules, Precision Rules (Decimal Places).

### Phase 8: Tax Foundation (GST, HSN, SAC, Tax Templates)
- Statutory GST Engine, HSN/SAC Classification, Tax Rates (CGST, SGST, IGST, UTGST, Cess), Tax Component Templates, Exemptions.

### Phase 9: UOM & UOM Conversion
- Base Units of Measure (Pcs, Kg, Ltr, Box, Pack, Carton, Meter), Conversion Factor Matrix (e.g., 1 Box = 24 Pcs), Fractional Precision settings.

### Phase 10: Warehouse & Storage Locations
- 6-Tier Location Hierarchy (`Company → Branch → Warehouse → Location → Rack → Bin`), Storage Type (Cold Storage, Bulk, Pick Bin), Capacity constraints.

### Phase 11: Product Classification
- 8-Tier Classification Hierarchy (`Business Vertical → Department → Section → Category → Sub Category → Brand → Collection → Season`), HSN Mapping, Attribute Sets.

### Phase 12: Supplier Master
- Vendor Directory, Credit Terms, GSTIN Validation, Ledger Mapping, Address Engine reuse, Contact Engine reuse, Bank Engine reuse.

### Phase 13: Customer Master
- B2B & B2C Customer Directory, Customer Groups, Credit Limits, Loyalty Linkage, GSTIN, Address Engine reuse, Contact Engine reuse, Bank Engine reuse.

### Phase 14: Price Lists & Pricing Rules
- Multi-tier Price Lists (MSRP, Wholesale, Retail, Franchise, Online), Promotional Price Rules, Quantity Discounts, Tax Inclusion/Exclusion Rules.

### Phase 15: Item Master (Gate 9 Freeze)
- SKU Master, Barcode Engine linkage, UOM references, Classification lookups, Tax Template linkage, Price List mapping, Variant Matrix.

### Phase 16: Master Data Migration, Opening Balances & Stock Validation (Gate 9A Freeze)
- Stock Ledger Initialization, Batch/Serial Opening Inventory, Supplier Opening Balances, Customer Opening Balances, General Ledger Opening Balances, Data Integrity Audit.

### Phase 17: Purchase Transaction Engine
- Purchase Requisition → Purchase Order → Goods Receipt Note (GRN) → Purchase Invoice → Debit Note / Purchase Return.

### Phase 18: Inventory Management Engine
- Stock Movements, Inter-Branch Transfers (IBT), Physical Stock Audits, Stock Adjustments, Batch/Serial Tracking, Costing (FIFO/Weighted Avg).

### Phase 19: POS / Billing Engine
- High-Speed Counter Billing, Barcode Scanning, Offline Queue, Multi-Tender Payments, Thermal Printing, Cash Drawer Reconciliation.

### Phase 20: Sales Transaction Engine
- B2B Sales Quotes, Sales Orders, Delivery Challans, Sales Invoices, Credit Notes / Sales Returns, E-Way Bill / E-Invoice integration.

### Phase 21: Accounting & Financial Ledger Engine
- Automated Journal Entry Posting from POS/Sales/Purchase/Inventory, General Ledger, Trial Balance, Profit & Loss, Balance Sheet, GST Returns (GSTR-1, GSTR-3B).

---

## 3. Structural Hierarchies & Engine Integration Rules

### 3.1 8-Tier Product Classification Hierarchy
```
Business Vertical (e.g., Retail)
    └── Department (e.g., Footwear)
          └── Section (e.g., Mens)
                └── Category (e.g., Sports)
                      └── Sub Category (e.g., Running)
                            └── Brand (e.g., Nike)
                                  └── Collection (e.g., Air Max)
                                        └── Season (e.g., Summer 2027)
```

### 3.2 6-Tier Warehouse & Bin Location Hierarchy
```
Company (SMRITI Retail Ltd)
    └── Branch (Connaught Place Store)
          └── Warehouse (CP Main Store Warehouse)
                └── Location (Floor 1 - Menswear Stockroom)
                      └── Rack (Rack M-04)
                            └── Bin (Bin M-04-B2)
```

### 3.3 Partner Entity Foundation Reuse Standard
Both Supplier and Customer entities inherit zero custom storage for contacts, addresses, or banks. They implement the Foundation Platform Engine contracts:
- `AddressEngine`: Single/Multi-address handling with Billing, Shipping, Head Office tagging.
- `ContactEngine`: Primary/Secondary contact persons, designation, phone, email.
- `BankEngine`: Bank name, IFSC, Account number, Branch, UPI ID, Virtual Payment Address.
- `DocumentEngine`: KYC, Tax Certificates, Contracts, PAN cards.
- `AuditEngine`: Immutable change recording and field-level history.

---

## 4. Sequential Freeze Governance

The system architecture MUST be frozen in 11 sequential gates. Moving to a subsequent gate requires 100% compliance with Rules 1–10 of `AGENTS.md` and complete test coverage for all preceding entities:

```
[Gate 0: Foundation] ──► [Gate 1: Company Info] ──► [Gate 2: Org & Branch] ──► [Gate 3: Security]
        │
        ▼
[Gate 4: Financial & Numbering] ──► [Gate 5: Common Masters (Geography, Currency, Tax, UOM)]
        │
        ▼
[Gate 6: Warehouse & Product Classification] ──► [Gate 7: Partner Masters (Supplier/Customer)]
        │
        ▼
[Gate 8: Price Management] ──► [Gate 9: Item Master (FREEZE)] ──► [Gate 9A: Migration & Opening Stock Validation] ──► [Gate 10: Transactions]
```

---

## 5. Architectural Compliance & Verification

All code developed under Roadmap v4.1 must produce verifiable diffs, pass domain validators (`validate_tokens.py`, `pytest`, `tsc`), and enforce zero database cross-contamination in accordance with Level 1 Architecture Constitution (AOP-001 through AOP-008).
