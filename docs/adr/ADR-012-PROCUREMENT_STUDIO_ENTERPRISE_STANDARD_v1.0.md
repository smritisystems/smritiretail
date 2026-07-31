# Architecture Decision Record (ADR-012)
# PROCUREMENT_STUDIO_ENTERPRISE_STANDARD_v1.0

**Status:** FROZEN — v1.0 (2026-07-31)  
**Author:** Jawahar Ramkripal Mallah, Chief Systems Architect & Creator  
**Scope:** Procurement Studio & Platform Workspace Layout Engine  

---

## Executive Summary

`PROCUREMENT_STUDIO_ENTERPRISE_STANDARD_v1.0` establishes the frozen architectural blueprint for enterprise workspaces across SMRITI Retail OS. It defines the workspace lifecycle, auto-layout persistence via `SPK.configuration`, the SMRITI Universal Procurement Grid (SUPG) specification, telemetry metrics, SWMF pop-out window integration, and UAR AI skill extension points.

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

## 2. AUTO LAYOUT PERSISTENCE (`SPK.configuration`)

Workspace preferences MUST be automatically saved and restored across sessions:

| Preference Attribute | Storage Key | Description |
|---|---|---|
| Sidebar State | `spk.config.workspace.sidebarCollapsed` | Collapsed / Expanded left navigation state |
| Grid Column Widths | `spk.config.procurement.gridColumnWidths` | Pixel width per data table column |
| Grid Sorting & Filters | `spk.config.procurement.gridSortFilterState` | Active column sort order and filters |
| Workspace Density | `spk.config.workspace.density` | Mode: `comfortable`, `compact` (default), `dense` |
| Summary Panel State | `spk.config.procurement.summaryDocked` | Collapsed / Expanded state of right summary panel |
| Selected Warehouse | `spk.config.procurement.defaultWarehouse` | Active warehouse default selection |
| Selected Supplier | `spk.config.procurement.defaultSupplierId` | Last selected vendor ID |

---

## 3. SMRITI UNIVERSAL PROCUREMENT GRID (SUPG CONTRACT)

The **SMRITI Universal Procurement Grid (SUPG)** defines the enterprise data grid specification:

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

## 4. SWMF — SMRITI WORKSPACE MANAGEMENT FRAMEWORK

Multi-window and pop-out support is governed by **SWMF (SMRITI Workspace Management Framework v1.0)**:

```typescript
// SWMF Standalone Pop-out Window Launch
WindowManager.openTabStandalone("purchase", "SMRITI Procurement Studio");
```

- Launches a dedicated browser window (`/?popout=purchase`).
- Restores geometry (width, height, X/Y screen coordinates).
- Establishes two-way state synchronization via BroadcastChannel (`smriti_sawf_window_channel`).

---

## 5. WORKSPACE TELEMETRY & METRICS

Procurement Studio collects real-time operational telemetry for UX optimization:

- **Workspace Open Time**: Initial load latency (< 500 ms target).
- **Toolbar Action Frequency**: Click counts on F-keys and action buttons.
- **Grid Edit Count**: Total line-item cell updates per session.
- **Rows Added / Deleted**: Line-item creation and removal frequency.
- **Save / Submit / Print Latencies**: Performance SLA metrics.
- **SWMF Pop-out Launch Count**: Frequency of multi-window workspace usage.
- **Auto Save Frequency**: Background save success rates.

---

## 6. AI READINESS & EXTENSION POINTS (`SPK.ai` / UAR)

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

## 7. MANDATORY UI REGRESSION CHECKLIST

- [x] **Hero Banner**: Fits in a single row (~55px height) with title, subtitle, desk role, and tax jurisdiction badge.
- [x] **Subtab Bar**: Single horizontal toolbar row (42px height) without line wrapping.
- [x] **Full-Width Workspace**: 100% fluid container width without `max-w-7xl` constraints.
- [x] **Document Toolbar**: Single horizontal row containing breadcrumbs, title, status, search, actions, and document number.
- [x] **2-Column Master Form**: 7/5 split ratio for Supplier Information and Document Details.
- [x] **Data Grid Density**: 15% lower row height with compact mono-font numeric fields.
- [x] **Sticky Summary Panel**: Net Payable Summary docked on the right side.
- [x] **SWMF Pop-out Workspace**: Standalone window trigger calling `WindowManager.openTabStandalone`.
- [x] **Themes & Resolutions**: Verified on 1366×768, 1920×1080, Dark theme, and Light theme.
