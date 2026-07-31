# Architecture Decision Record (ADR-012)
# PROCUREMENT_STUDIO_ENTERPRISE_STANDARD_v1.0 (PROCUREMENT DOMAIN)

**Status:** FROZEN — v1.0 (2026-07-31)  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  
**Base Layer:** Consumes `SMRITI_ENTERPRISE_WORKSPACE_STANDARD_v1.0` (ADR-020 Layer 1 UX Framework)  
**Scope:** Procurement Domain Business Capabilities & Workflows  

---

## Executive Summary

`PROCUREMENT_STUDIO_ENTERPRISE_STANDARD_v1.0` defines the frozen domain-specific architecture for procurement across SMRITI Retail OS. It inherits the **Common Workspace UX Framework (`ADR-020`)** for layout rules, while establishing procurement-specific capabilities: On-the-Fly Temporary Product Engine, Master Data Approval Queue, Article/Style/Model Entry, Visual Product Gallery, Supplier Catalogs, and SUPP Rich Printing.

---

## 1. ARCHITECTURAL RELATIONSHIP TO ADR-020

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   SMRITI ENTERPRISE WORKSPACE UX FRAMEWORK (ADR-020)                   │
│   Common UX Rules: 100% Fluid Width | 55px Hero | Single-Row Toolbar | SUPG Grid |      │
│   Right-Docked Summary | SWMF Pop-Out | Keyboard Shortcuts | Responsive Breakpoints      │
└───────────────────────────┬────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                 PROCUREMENT STUDIO ENTERPRISE STANDARD (ADR-012 DOMAIN)                │
│   Procurement Capabilities: On-the-Fly Temporary Product Engine | Article/Style/Model   │
│   Master Data Approval Queue | Supplier Catalogs | Visual Product Gallery | SUPP Prints│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

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

## 4. END-TO-END ENTERPRISE WORKFLOW

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

## 5. PROCUREMENT ENHANCEMENT ROADMAP (v1.1 WAVE)

To preserve `ADR-012` as a frozen constitutional standard, future procurement enhancements will be governed by dedicated follow-on ADRs:

| ADR Key | Feature Module | Scope & Objectives |
|---|---|---|
| **ADR-020** | Common Workspace Framework | **Layer 1 Shared UX Layout Constitution** |
| **ADR-012** | Procurement Studio Standard | **FROZEN v1.0 Procurement Domain Standard** |
| **ADR-013** | Item Master Studio Standard | **FROZEN v1.0 Inventory Domain Standard** |
| **ADR-014** | Sales Billing Studio Standard | **FROZEN v1.0 Sales Domain Standard** |
| **ADR-015** | Accounting Ledger Standard | **FROZEN v1.0 Financial Domain Standard** |
