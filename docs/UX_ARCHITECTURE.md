<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.17.0
  Created      : 2026-08-16
  Modified     : 2026-08-16
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal Architecture Audit
-->

# SMRITI RETAIL OS — UX & SYSTEM ARCHITECTURE MAP

## 1. System Technology Stack

```text
+-----------------------------------------------------------------------+
|                         SMRITI FRONTEND LAYOUT                        |
|   React 18 + Vite 5 + TailwindCSS 4 + Lucide React + Motion/React    |
+-----------------------------------------------------------------------+
                                   |
                                   v
+-----------------------------------------------------------------------+
|                    LAYOUT & WORKSPACE ENGINE                          |
|  - LayoutManager (Header, Dock, Toolbar, Taskbar, Canvas)             |
|  - ThemeProvider (28-Token Light / Dark Fiori Horizon Tokens)          |
|  - WorkspaceProvider (Floating Windows, Docking, Snapping, Zoom)      |
+-----------------------------------------------------------------------+
                                   |
       +---------------------------+---------------------------+
       |                                                       |
       v                                                       v
+-----------------------------+             +-----------------------------+
|    EXPRESS API PROXY GATEWAY|             |   FASTAPI SYSTEM OF RECORD  |
|  - Port 3000 (server.ts)    |             |  - Port 8000 (backend/app)  |
|  - Transient UI Caching     |             |  - PostgreSQL Database      |
|  - Dev Mock Fallback Routes |             |  - Transactional Ledgers    |
+-----------------------------+             +-----------------------------+
```

---

## 2. Core Architecture Layers

### Layer 1: Presentation & Layout Engine
- **Layout Host**: [`src/layout_engine/layout_manager.tsx`](file:///F:/SMRITRretailNX/src/layout_engine/layout_manager.tsx)
- **Theme Engine**: [`src/contexts/ThemeContext.tsx`](file:///F:/SMRITRretailNX/src/contexts/ThemeContext.tsx) (28 semantic design tokens defined in `src/index.css` supporting Light Baseline & Dark Alternative).
- **Navigation Renderer**: [`src/layout_engine/NavRenderer.tsx`](file:///F:/SMRITRretailNX/src/layout_engine/NavRenderer.tsx) (Supports Left, Right, Top, Bottom, Hidden, and Focus Mode docks).
- **Floating Workspace Host**: [`src/components/FloatingWindowHost.tsx`](file:///F:/SMRITRretailNX/src/components/FloatingWindowHost.tsx) (Supports multi-window tiling, docking, zooming, and standalone window popouts).
- **Workspace Taskbar**: [`src/components/WorkspaceTaskbar.tsx`](file:///F:/SMRITRretailNX/src/components/WorkspaceTaskbar.tsx) (Hidable bottom bar with collapse trigger pill).

### Layer 2: Business Modules & Workspaces
- **POS Billing Desk**: [`src/components/PosTerminalTab.tsx`](file:///F:/SMRITRretailNX/src/components/PosTerminalTab.tsx) & [`src/components/AdvancedBillingEng.tsx`](file:///F:/SMRITRretailNX/src/components/AdvancedBillingEng.tsx)
- **Sales Studio**: [`src/components/SalesStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/SalesStudioTab.tsx)
- **Item Master**: [`src/components/ItemMasterTab.tsx`](file:///F:/SMRITRretailNX/src/components/ItemMasterTab.tsx)
- **Purchase Studio**: [`src/components/PurchaseStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/PurchaseStudioTab.tsx)
- **Barcode Studio**: [`src/components/BarcodeStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/BarcodeStudioTab.tsx)
- **Customer Master**: [`src/components/CustomerMasterTab.tsx`](file:///F:/SMRITRretailNX/src/components/CustomerMasterTab.tsx)
- **CRM Studio**: [`src/components/CrmStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/CrmStudioTab.tsx)
- **Loyalty Studio**: [`src/components/LoyaltyStudioTab.tsx`](file:///F:/SMRITRretailNX/src/components/LoyaltyStudioTab.tsx)
- **Business Ledger**: [`src/components/BusinessLedgerTab.tsx`](file:///F:/SMRITRretailNX/src/components/BusinessLedgerTab.tsx)
- **Stock Ledger**: [`src/components/StockLedgerTab.tsx`](file:///F:/SMRITRretailNX/src/components/StockLedgerTab.tsx)
- **Report Designer**: [`src/components/ReportDesignerTab.tsx`](file:///F:/SMRITRretailNX/src/components/ReportDesignerTab.tsx)
- **Terms Engine**: [`src/components/TermsEngineTab.tsx`](file:///F:/SMRITRretailNX/src/components/TermsEngineTab.tsx)
- **Data Exchange**: [`src/components/DataExchangeTab.tsx`](file:///F:/SMRITRretailNX/src/components/DataExchangeTab.tsx)

### Layer 3: Frontend API & Communication Helpers
- `src/lib/apiFetch.ts`: Route helper targeting Express endpoints (`/api/*`).
- `src/lib/apiFetchV1.ts`: Route helper targeting FastAPI endpoints (`/api/v1/*`).

### Layer 4: System-of-Record Backend
- **FastAPI Core**: `backend/app/main.py`
- **Postgres Engine**: `backend/app/db/session.py`
- **Transactional Ledgers**: `backend/app/models/` (Sales, Purchases, Inventory, Stock Movements, Customers, Tax Compliance).

---

## 3. Verification & Governance Principles
1. **Single Workspace Principle**: Contextual adaptive UX (SIMPLE / HYBRID / ADVANCED) operating inside unified single workspaces rather than duplicated screen files.
2. **Universal Author Header Policy (UADHP)**: Mandatory header on all source files.
3. **Four-State Verification Policy**: Every task/file audit is strictly labeled `Done`, `Failed`, `Partially Verified`, or `Unverified`.
