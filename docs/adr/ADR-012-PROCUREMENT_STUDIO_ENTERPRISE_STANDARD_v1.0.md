# Architecture Decision Record (ADR-012)
# SMRITI_PROCUREMENT_STUDIO_ENTERPRISE_STANDARD_v1.0

**Status:** FROZEN — v1.0 (2026-07-31)  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  
**Scope:** Procurement Studio & Platform Workspace Layout Engine  

---

## Executive Summary

`SMRITI_PROCUREMENT_STUDIO_ENTERPRISE_STANDARD_v1.0` establishes the frozen constitutional blueprint for enterprise procurement workspaces across SMRITI Retail OS. It defines the workspace lifecycle, auto-layout persistence via `SPK.configuration`, the SMRITI Universal Procurement Grid (SUPG) specification, On-the-Fly Temporary Product Engine, Master Data Approval Queue, Collapsible Visual Product Gallery, SWMF pop-out window integration, UAR AI skill extension points, and Industry Pack adaptability.

---

## 1. WORKSPACE LIFECYCLE MANAGEMENT

All enterprise studios MUST adhere to the 11-stage Workspace Lifecycle:

```text
Initialize ──► Restore Layout ──► Restore Filters ──► Restore Active Document
                                                            │
                                                            ▼
Idle State ◄── Auto Save ◄── Subscribe Domain Events ◄──────┘
    │
    ▼
Suspend ──► Resume ──► Close ──► Persist Workspace (SPK.configuration)
```

1. **Initialize**: Validate user session, security scopes, and role permissions via `SPK.security`.
2. **Restore Layout**: Fetch saved user workspace preferences (density, column widths, summary docked state) from `SPK.configuration`.
3. **Restore Filters**: Apply saved supplier, date range, and warehouse filters.
4. **Restore Active Document**: Load active PO / Purchase Invoice draft from state repository.
5. **Subscribe Domain Events**: Register listeners on `DomainEventBus` for `OrderApproved.v1`, `StockUpdated.v1`, and `PriceListUpdated.v1`.
6. **Idle State**: Await user interaction with zero CPU overhead.
7. **Auto Save**: Execute non-blocking background draft auto-saves every 120 seconds.
8. **Suspend**: Pause non-critical subscriptions when tab loses focus.
9. **Resume**: Re-verify session tokens and sync state upon regain of focus.
10. **Close**: Flush pending edits, emit exit events, and clear transient memory.
11. **Persist Workspace**: Save active geometry, density mode, and layout preferences to `SPK.configuration`.

---

## 2. PROCUREMENT WORKSPACE CAPABILITY MATRIX

| Capability | Basic | Standard | Enterprise | Industry Pack | Configurable |
|---|:---:|:---:|:---:|:---:|:---:|
| Purchase Order | ✅ | ✅ | ✅ | ✅ | ✓ |
| Purchase Requisition | ❌ | ✅ | ✅ | ✅ | ✓ |
| RFQ Management | ❌ | ✅ | ✅ | ✅ | ✓ |
| Supplier Quotation Comparison | ❌ | ✅ | ✅ | ✅ | ✓ |
| Blanket Purchase Orders | ❌ | ❌ | ✅ | ✅ | ✓ |
| Contract Purchasing | ❌ | ❌ | ✅ | ✅ | ✓ |
| Approval Workflow | ✓ | ✓ | ✓ | ✓ | ✓ |
| Temporary Product Engine | ✓ | ✓ | ✓ | ✓ | ✓ |
| Product Gallery | Optional | ✓ | ✓ | ✓ | ✓ |
| Variant Matrix | Optional | ✓ | ✓ | Fashion/Footwear | ✓ |
| Barcode Scanning | ✓ | ✓ | ✓ | ✓ | ✓ |
| Supplier Catalog | Optional | ✓ | ✓ | ✓ | ✓ |
| Rich Printing (SUPP) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pop-out Workspace (SWMF) | ❌ | Optional | ✓ | ✓ | ✓ |
| AI Procurement Assistant | ❌ | Optional | ✓ | ✓ | ✓ |

---

## 3. PROCUREMENT CONFIGURATION METADATA (`SPK.configuration`)

```yaml
ProcurementStudio:
  enableTemporaryProducts: true
  requireApprovalForMasterData: true
  enableArticleGallery: true
  galleryView: grid
  enableVariantMatrix: true
  defaultVariantPivot: color_size
  enableBarcodeScanner: true
  enableSupplierCatalog: true
  enableRichPrinting: true
  printImages: medium
  printQRCode: true
  printVariantMatrix: true
  enablePopoutWorkspace: true
  enableAIRecommendations: false
  duplicateDetection: strict
  autoGenerateArticleCode: true
  autoGenerateStyleCode: true
  autoGenerateModelCode: true
```

---

## 4. PROCUREMENT PERSONAS

| Persona | Primary Needs & Actions |
|---|---|
| **Buyer** | Fast PO creation, temporary product entry, barcode scanning, variant matrix buying |
| **Purchase Manager** | Approvals, pricing variance analysis, supplier performance evaluation |
| **Master Data Manager** | Validate, enrich, and approve temporary products into permanent Item Master |
| **Warehouse Inspector** | GRN verification, receipt logging, thermal barcode label printing |
| **Finance Accountant** | GST ITC validation, landed cost calculation, supplier invoice matching |

---

## 5. INDUSTRY PACK ADAPTATION MATRIX

| Industry | Default Item Entry Mode | Primary Entity Hierarchy |
|---|---|---|
| **Apparel** | Article ➔ Color × Size Matrix | Article ➔ Style ➔ Color ➔ Size |
| **Footwear** | Style ➔ Color × Size Matrix | Style ➔ Brand ➔ Color ➔ Size |
| **Jewellery** | Design ➔ Purity ➔ Size | Design ➔ Gold Purity ➔ Net Weight |
| **Electronics** | Model ➔ Serial Number | Model ➔ Brand ➔ Serial / IMEI |
| **Furniture** | Model ➔ Finish ➔ Dimension | Model ➔ Wood Type ➔ Finish ➔ Dimensions |
| **Grocery** | SKU / Barcode | SKU ➔ EAN Barcode ➔ Unit |
| **Pharmacy** | Product ➔ Batch ➔ Expiry | Drug ➔ Composition ➔ Batch ➔ Expiry |
| **Restaurant** | Ingredient / Recipe Item | Raw Material ➔ Recipe Ingredient ➔ UOM |

---

## 6. SMRITI UNIVERSAL PROCUREMENT GRID (SUPG CONTRACT)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        SUPG — Universal Procurement Grid Standard                      │
│   ✓ Sticky Column Header          ✓ Sticky Live Summary Footer    ✓ Frozen Columns     │
│   ✓ Pixel Column Resizing         ✓ Drag Column Reordering       ✓ Multi-Row Select   │
│   ✓ Keyboard Nav (Tab/F2/F7/F10)   ✓ Right-Click Context Menu     ✓ Virtual Scroll     │
│   ✓ Real-time STRE Validation     ✓ Excel Copy/Paste Ready       ✓ Formula Extensions │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. END-TO-END ENTERPRISE WORKFLOW

```text
Dashboard ──► Purchase Order ──► Add Existing Product / Multi-Mode Entry
                                        │
                                        ├─► Add New Article ──┐
                                        ├─► Add New Style    ├──► Temporary Product Engine
                                        └─► Add New Model   ──┘          │
                                                                         ▼
                                                           Variant Matrix Entry (Color x Size)
                                                                         │
                                                                         ▼
                                                              Visual Product Gallery
                                                                         │
                                                                         ▼
                                                              Submit Purchase Order
                                                                         │
                                                                         ▼
                                                              Approval Workflow Queue
                                                                         │
                                                                         ▼
                                                            Create Permanent Item Master
                                                                         │
                                                                         ▼
                                                               SUPP Rich Printing
                                                                         │
                                                                         ▼
                                                               GRN / Goods Receipt
                                                                         │
                                                                         ▼
                                                               Accounts Payable
```

---

## 8. SWMF — SMRITI WORKSPACE MANAGEMENT FRAMEWORK

Multi-window and pop-out support is governed by **SWMF (SMRITI Workspace Management Framework v1.0)**:

```typescript
// SWMF Standalone Pop-out Window Launch
WindowManager.openTabStandalone("purchase", "SMRITI Procurement Studio");
```

---

## 9. AI READINESS & EXTENSION POINTS (`SPK.ai` / UAR)

Procurement Studio delegates all AI Advisory skills exclusively through the **Universal AI Skill Registry (`SPK.ai`)** in compliance with Rule AOP-001 (AI Optionality Principle):

| AI Skill | UAR Registration Key | Purpose |
|---|---|---|
| Supplier Recommendation | `SPK.ai.executeSkill("procurement.suggestSupplier")` | Recommends optimal vendor based on lead time & pricing history |
| Reorder Suggestion | `SPK.ai.executeSkill("procurement.reorderSuggestions")` | Identifies low-stock items approaching reorder thresholds |
| Purchase Price Analysis | `SPK.ai.executeSkill("procurement.priceVarianceAnalysis")` | Flags price spikes against historical purchase orders |
| Duplicate Invoice Detection| `SPK.ai.executeSkill("procurement.detectDuplicateInvoice")` | Prevents double-entry of vendor invoice numbers |
| GST Validation | `SPK.ai.executeSkill("procurement.validateGSTIN")` | Verifies vendor GSTIN against government portal schema |
| Vendor Performance | `SPK.ai.executeSkill("procurement.vendorScorecard")` | Generates supplier fulfillment & quality scorecard |

---

## 10. MANDATORY UI REGRESSION CHECKLIST

- [x] **Hero Banner**: Fits in a single row (~55px height) with title, subtitle, desk role, and tax jurisdiction badge.
- [x] **Subtab Bar**: Single horizontal toolbar row (42px height) without line wrapping.
- [x] **Full-Width Workspace**: 100% fluid container width without `max-w-7xl` constraints.
- [x] **Document Toolbar**: Single horizontal row containing breadcrumbs, title, status, search, actions, and document number.
- [x] **2-Column Master Form**: 7/5 split ratio for Supplier Information and Document Details.
- [x] **Data Grid Density**: 15% lower row height with compact mono-font numeric fields.
- [x] **Sticky Summary Panel**: Net Payable Summary docked on the right side.
- [x] **SWMF Pop-out Workspace**: Standalone window trigger calling `WindowManager.openTabStandalone`.
- [x] **Themes & Resolutions**: Verified on 1366×768, 1920×1080, Dark theme, and Light theme.
