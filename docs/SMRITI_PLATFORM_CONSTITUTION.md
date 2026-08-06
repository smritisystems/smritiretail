# SMRITI Platform Constitution

**System:** SMRITI Retail OS / SmritiSys Architecture  
**Status:** BASELINE LTS — v1.0 (2026-08-06)  
**Author & Chief Systems Architect:** Jawahar Ramkripal Mallah  
**Copyright:** © SMRITIBooks.com and AITDL.com. All Rights Reserved.  
**Classification:** Internal Core Architecture Baseline  

---

## Declaration of Architectural Freeze Baseline (v1.0 LTS)

> **SMRITI PLATFORM ARCHITECTURE — VERSION 1.0 LTS**  
> **STATUS: ARCHITECTURE FROZEN**  
> 
> No new architectural layers. No new registries. No new kernel abstractions. No new domain facades.  
> Engineering focus is 95% dedicated to Business Domain Feature Delivery across the 10 Retail Phases.

---

## Part I — SPK Kernel & Kernel Independence (KND-001)

1. `SPK.ule` (Universal Lookup Engine) and all platform kernel services MUST NEVER depend on React, UI components, renderers, or DOM/browser-specific APIs.
2. Kernel services expose strictly contracts, manifests, data, and capabilities. All presentation concerns belong to the UI layer.

---

## Part II — Workspace Platform (WNG-001 — WNG-005)

1. Single Persistent Navigation Sidebar (`WNG-003`). Primary navigation belongs exclusively to the main left sidebar.
2. Context-Aware Domain Navigation (`WNG-004`). Left sidebar displays exclusively the modules belonging to the currently active business domain.
3. Universal Platform Registry (`UPR`). Navigation metadata is declared in `SPK.navigation`.

---

## Part III — Document Platform (SCS-DXP-001 — BASELINE LTS)

### Frozen Public APIs
- `DocumentRegistry`
- `TemplateRegistry`
- `VariableRegistry`
- `DocumentRendererRegistry`
- `OutputChannelRegistry`
- `DocumentBuilderRegistry`
- `DocumentService`

### Governance Rules
- Handcrafted HTML/TSX document forms are strictly prohibited.
- Previews and renderers MUST consume `IDxpDocumentModel` decoupled data structures.

---

## Part IV — Printing Platform (SCS-DXP-002 — BASELINE LTS)

### Frozen Public APIs
- `PrintDomain` (`SPK.printing`)
- `PrintAgentManager` (`DXP-AGT-001`)
- `PrinterDriverRegistry`
- `TransportRegistry`
- `CapabilityResolver`
- `QueueManagerAgent` (`DXP-QUE-001`)
- `PrinterHealthAgent` (`DXP-DIA-001`)
- `RetryAgent` (`DXP-RET-001`)
- `PrinterDiscoveryAgent` (`DXP-DIS-001`)
- `PrinterProfileRegistry`
- `PrintProfileEngine`
- `PrintRoutingEngine`
- `PrintAuditLogService`
- `PrintPipelineHooks`
- `PrintingSDK`

### Governance Rules
- Hardware drivers (ESC/POS, ZPL, TSPL, EPL, CPCL, RAW, PCL) MUST be registered via `PrinterDriverRegistry` plug-ins (`IPrinterDriver`).
- Transports (USB, TCP Network 9100, Bluetooth, SDA, QZ) MUST be registered via `TransportRegistry` plug-ins (`IPrinterTransport`).

---

## Part V — Baseline LTS Governance Model

| Rule Category | Policy |
|---|---|
| **Allowed Changes** | Bug fixes, performance optimizations, new document templates, new driver plugins, new transport plugins, non-breaking schema additions. |
| **Prohibited Changes** | Breaking API signature alterations, removing kernel services, public contract modifications, registry redesigns. |

---

## Part VII — Business Governance & Principles (SCS-BUS-001 — SCS-BUS-004)

### SCS-BUS-001 — Retail First Principle (MANDATORY)
> SMRITI Retail OS shall prioritize POS, Inventory, Purchase, Distribution, and TallyPrime Integration. Any feature that primarily belongs to a full ERP (advanced accounting, manufacturing, payroll, HR, fixed assets, budgeting) shall not be implemented inside the core Retail Engine unless it directly supports retail operations.

### SCS-BUS-002 — Business Engine Dependency Rule (MANDATORY)
> Business modules MUST be built strictly following prerequisite dependency order:
> `Master Data -> Inventory -> Purchase -> Sales/POS -> Tally Sync -> Distribution -> Reports -> Configuration -> CRM -> Extensions`.

### SCS-BUS-003 — Offline First Principle (MANDATORY)
> Every retail POS transaction MUST be capable of executing without Internet connectivity. Synchronization is asynchronous. Billing must NEVER stop because the Internet is unavailable.

### SCS-BUS-004 — Ledger First Principle (MANDATORY)
> Business state shall never be derived from master tables. Inventory = Stock Ledger; Customer Outstanding = Party Ledger; Supplier Outstanding = Party Ledger; Cash = Cash Ledger; Bank = Bank Ledger. Master tables contain reference information only. Every business document MUST create immutable ledger entries.

### Operational vs Financial System of Record Distinction
- **SMRITI Retail OS** = Operational System of Record (inventory, POS checkout, purchase GRNs, distribution, stock movements).
- **TallyPrime** = Financial System of Record (general ledger, statutory books of accounts, tax audit).

### 3-Category Data Architecture Boundary
1. **Operational Data**: Sales, Purchase, Inventory, POS checkout, Stock transfers.
2. **Configuration Data**: GST, Barcodes, Number Series, Branch, Warehouse, Printers, Tally, Themes.
3. **Master Data**: Items, Customers, Suppliers, Categories, Brands.

---

## Part VIII — Universal Business Domain Facade (SPK.business — BASELINE LTS)

All business domain APIs are exposed through a single public facade boundary (`BusinessDomainFacade.ts`):
```ts
SPK.business / BusinessDomain (Frozen Public APIs)
├── masterData     (Item Master, Categories, Brands, Barcodes, Multi-Price Tiers)
├── inventory      (Stock Ledger, Warehouses, Bin Locations, Batches, Serials, FIFO)
├── purchase       (POs, Partial GRNs, Invoices, Landed Cost Allocation)
├── sales          (POS Billing, Barcode Billing, Hold/Resume)
├── schemes        (Indian Scheme Engine: Buy X Get Y, Coupons, Discounts)
├── tally          (SMRITI Communicator 2-Way Sync Engine & Retry Queue)
├── distribution   (Salesman, Beat/Route, Vehicle, Van Loading, Secondary Sales)
├── reports        (Retail Analytics BI, Daily Sales, Stock Ageing, Profitability)
├── configuration  (Financial Year, Branch, Warehouse, Number Series, Tally Setup)
├── crm            (Customer/Supplier Master, Credit Limits, Outstanding Aging)
└── loyalty        (Loyalty Points Redemption, Gift Vouchers, B2B Quotations)
```

---

## Part IX — Master 10-Phase Retail Engine Roadmap & Exit Gates

1. **Phase 1 — Master Data Foundation**: Item Master, Category, Brand, Color, Size, UOM, Barcode, Supplier Mapping, Tax Mapping, Multi-Price Tiers (MRP, Retail, Wholesale, Dealer, Branch, Date-effective).
   - *Exit Gate:* Item Master, Barcodes, Price Tiers, Tax Mapping & Supplier Mapping 100% verified.
2. **Phase 2 — Inventory Engine**: Stock Ledger, Warehouse, Bin Location, Batch, Serial, Transfers, Physical Stock, Adjustment, FIFO, Weighted Average, Reorder.
   - *Exit Gate:* Stock Ledger, Warehouses, Bin Locations, Batches, Serials, Transfers, FIFO Valuation & Reorder Alerts 100% verified.
3. **Phase 3 — Purchase & GRN**: Purchase Order, Partial GRN, Purchase Invoice, Purchase Return, Supplier Ledger, Landed Cost Allocation.
   - *Exit Gate:* PO, Partial GRN, Landed Cost Allocation onto item unit cost 100% verified.
4. **Phase 4 — Sales + POS + Scheme Engine**: Fast POS Billing, Barcode Billing, Hold/Resume, Indian Scheme Engine (Buy X Get Y, Coupons, Mix & Match).
   - *Exit Gate:* POS Checkout, Thermal Receipt Printing, Scheme calculation 100% verified.
5. **Phase 5 — TallyPrime Communicator**: SMRITI Communicator Daemon (Port 9000), 2-Way Sync for Vouchers (Sales, Purchase, Receipts, Payments, Credit/Debit Notes), Masters & Retry Queue.
   - *Exit Gate:* Port 9000 Daemon HTTP listener, 2-Way sync & retry queue 100% verified.
6. **Phase 6 — Distribution & Field Sales Engine**: Salesman, Beat, Route, Vehicle, Van Loading, Delivery Challan, Secondary Sales, Distributor Stock, Market Visit.
7. **Phase 7 — Retail Reports & Analytics**: Daily Sales, Dead Stock, Fast/Slow Moving, Stock Ageing, Profit Analysis by Item/Brand/Supplier.
8. **Phase 8 — Retail Configuration Engine**: Deployment Wizard: Financial Year, Branch, Warehouse, Numbering Series, GST Settings, Barcode Settings, Printer Mapping, Tally Settings.
9. **Phase 9 — Basic CRM**: Customer, Supplier, Credit Limit Warnings, Outstanding Aging Analysis, Contacts.
10. **Phase 10 — Loyalty & Extensions**: Loyalty Points Redemption, Gift Voucher Redemption, B2B Quotations & Sales Orders.

