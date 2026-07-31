# Architecture Decision Record (ADR-020)
# SMRITI_ENTERPRISE_WORKSPACE_STANDARD_v1.0 (COMMON WORKSPACE UX FRAMEWORK)

**Status:** FROZEN — v1.0 (2026-07-31)  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  
**Scope:** Universal Enterprise Workspace UX Framework across all SMRITI Business Studios  

---

## Executive Summary

`SMRITI_ENTERPRISE_WORKSPACE_STANDARD_v1.0` establishes the common, business-agnostic UI/UX layout framework for all enterprise studios across SMRITI Retail OS. It decouples shared UI layout rules (Hero banner height, single-row toolbars, full-width fluid layouts, SUPG data grid contracts, right-docked summary panels, SWMF pop-out window triggers) from domain-specific business capabilities.

---

## 1. ARCHITECTURAL LAYERING CONSTITUTION

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   SMRITI ENTERPRISE WORKSPACE UX FRAMEWORK (ADR-020)                   │
│   Common UX Rules: 100% Fluid Width | 55px Hero | Single-Row Toolbar | SUPG Grid |      │
│   Right-Docked Summary | SWMF Pop-Out | Keyboard Shortcuts | Responsive Breakpoints      │
└───────────────────────────┬────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┬───────────────────┐
        ▼                   ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Procurement  │    │ Item Master  │    │    Sales     │    │  Accounting  │
│  (ADR-012)   │    │  (ADR-013)   │    │  (ADR-014)   │    │  (ADR-015)   │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

---

## 2. COMMON WORKSPACE UX PRINCIPLES (LAYER 1)

Every SMRITI business workspace MUST implement the following 8 shared layout principles:

1. **Full-Width Fluid Container (100%)**: Zero artificial `max-w-7xl` centered constraints; 100% horizontal screen utilization (`w-full bg-slate-100 p-2.5 sm:p-3 space-y-3`).
2. **Compact Hero Banner (~55px)**: Single horizontal row containing module path, domain title, role desk badge, context indicator, and online status badge.
3. **Single Horizontal ERP Toolbar**: Integrated search input (`F2`), primary creation button, multi-mode selector, action buttons, filter drawer toggle, and SWMF pop-out trigger.
4. **2-Column Master Form (7/5 Split)**:
   - **Left (7 Columns)**: Primary entity information (Customer, Supplier, Product Identity).
   - **Right (5 Columns)**: Document parameters, pricing, warehouse, or tax context.
5. **SMRITI Universal Data Grid (SUPG Contract)**: 15% lower row height, mono-font numeric fields, sticky header, sticky summary footer, virtual scrolling, and multi-row selection.
6. **Right-Docked Sticky Summary Panel**: Live summary calculations, tax breakdowns, round-off, and Net Payable / Valuation totals with Amount in Words.
7. **SWMF Standalone Window Support**: Standalone window trigger calling `WindowManager.openTabStandalone(tabId, title)`.
8. **Standardized Keyboard Shortcuts**: `F2` Search, `F4` Primary Action, `F6` Hold, `F7` Line Item, `F8` Discount, `F10` Submit, `Ctrl+P` Print.

---

## 3. DOMAIN ISOLATION & NON-INHERITANCE RULES

- **Item Master Studio (`ADR-013`)**: Inherits Layer 1 UX Framework. MUST NOT inherit Procurement business logic (No Temporary Product Engine, No Supplier Approval Queues, No RFQ Workflows). Focuses exclusively on SKU/Barcode, UOM, HSN/GST, Multi-Tier Pricing, and Stock Levels.
- **Sales Billing Studio (`ADR-014`)**: Inherits Layer 1 UX Framework. Focuses exclusively on STRE Tax Resolution, Quick Billing, Cash/UPI Payments, and Held Bills.
- **Procurement Studio (`ADR-012`)**: Inherits Layer 1 UX Framework plus Procurement-specific capabilities (On-the-Fly Temporary Products, Article/Style/Model Entry, Supplier Catalogs).
