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

## Part VI — Business Domain Implementation Roadmap

1. **Phase A — Financial Foundation**: Accounting Engine, Chart of Accounts, General Ledger, GST, Receivables, Payables.
2. **Phase B — Procurement**: Requisitions, Purchase Orders, Goods Receipt Notes (GRN), Purchase Invoices, Vendor Returns.
3. **Phase C — Inventory & Stock**: Stock Ledger, Multi-warehouse transfers, Batch/Serial tracking, FIFO valuation.
4. **Phase D — Sales & POS**: Fast POS checkout, Thermal receipt printing, Barcode scanning, Cash drawer integration.
5. **Phase E — Analytics & BI**: Financial P&L, Balance Sheet, Inventory Turnover, Profitability dashboards.
