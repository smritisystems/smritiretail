# SMRITI Platform Constitution

**System:** SMRITI Retail OS / SmritiSys Architecture  
**Status:** BASELINE LTS — v1.0 (2026-08-06)  
**Author & Chief Systems Architect:** Jawahar Ramkripal Mallah  
**Copyright:** © SMRITIBooks.com and AITDL.com. All Rights Reserved.  
**Classification:** Internal Core Architecture Baseline  

---

## Declaration of Platform Milestone

> **SMRITI Platform Infrastructure Phase — COMPLETE**  
> **SMRITI Business Domain Phase — ACTIVE**  

All core platform kernel services, workspace engines, document experience platforms, and printing subsystems are formally certified as **BASELINE LTS** (Long Term Support). Engineering effort is 80–90% dedicated to core business domain execution (Accounting, Purchasing, Inventory, Sales/POS, CRM, Analytics).

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

## Part VII — Business Governance & Retail First Principle (SCS-BUS-001)

### SCS-BUS-001 — Retail First Principle (MANDATORY)
> SMRITI Retail OS shall prioritize POS, Inventory, Purchase, Distribution, and TallyPrime Integration. Any feature that primarily belongs to a full ERP (advanced accounting, manufacturing, payroll, HR, fixed assets, budgeting) shall not be implemented inside the core Retail Engine unless it directly supports retail operations.

---

## Part VIII — Master 10-Phase Retail Engine Roadmap

1. **Phase 1 — Master Data Foundation**: Item Master, Category, Brand, Color, Size, UOM, Barcode, Supplier Mapping, Tax Mapping, Multi-Price Tiers (MRP, Retail, Wholesale, Dealer, Branch, Date-effective).
2. **Phase 2 — Inventory Engine**: Stock Ledger, Warehouse, Bin, Batch, Serial, Transfers, Physical Stock, Adjustment, FIFO, Weighted Average, Reorder.
3. **Phase 3 — Purchase & GRN**: Purchase Order, Partial GRN, Purchase Invoice, Purchase Return, Supplier Ledger, Landed Cost Allocation.
4. **Phase 4 — Sales + POS + Scheme Engine**: Fast POS Billing, Barcode Billing, Hold/Resume, Indian Scheme Engine (Buy X Get Y, Coupons, Mix & Match).
5. **Phase 5 — TallyPrime Communicator**: SMRITI Communicator Daemon (Port 9000), 2-Way Sync for Vouchers (Sales, Purchase, Receipts, Payments, Credit/Debit Notes), Masters & Retry Queue.
6. **Phase 6 — Distribution & Field Sales Engine**: Salesman, Beat, Route, Vehicle, Van Loading, Delivery Challan, Secondary Sales, Distributor Stock, Market Visit.
7. **Phase 7 — Retail Reports & Analytics**: Daily Sales, Dead Stock, Fast/Slow Moving, Stock Ageing, Profit Analysis by Item/Brand/Supplier.
8. **Phase 8 — Retail Configuration Engine**: Financial Year, Branch, Warehouse, Numbering Series, GST Settings, Barcode Settings, Printer Mapping, Tally Settings.
9. **Phase 9 — Basic CRM**: Customer, Supplier, Credit Limit, Outstanding Aging, Contacts.
10. **Phase 10 — Loyalty & Extensions**: Loyalty redemption, Gift vouchers, B2B Quotations.

