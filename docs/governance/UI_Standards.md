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

# SMRITI UI/UX Component & Layout Standard

**Status:** FROZEN — v1.0 (2026-07-28)  
**Reference ADR:** ADR-002 (Platform Architecture), SLGP-001 v2.0

---

## 1. Workspace Layout Patterns (SLGP-001 v2.0)
| Pattern | Usage | Key Rule |
| :--- | :--- | :--- |
| **Pattern A — Scrollable Page** | Reports, Settings, Wiki | Content scrolls; no fixed h-screen on module |
| **Pattern B — Fixed Studio** | POS Terminal, Drawing, Spreadsheet Studio | Fixed viewport; internal scroll managed by studio |
| **Pattern C — Master-Detail** | Item Master, Customer Master, Supplier Master | Left list panel + Right detail/form panel |

## 2. Viewport Rule (SLGP-R6 — MANDATORY)
Modules MUST NOT define:
```tsx
❌  className="h-screen w-screen overflow-hidden"
❌  style={{ height: '100vh', width: '100vw' }}
```
Only the Layout Manager (`WorkspaceLayout.tsx`) controls viewport sizing.

## 3. Canonical UI Components (GR-001 SSOT)
| Capability | Authoritative Component |
| :--- | :--- |
| Dialog / Modal | `<SmritiDialog />` (`src/layout_engine/components/SmritiDialog.tsx`) |
| Tab Container | `<SmritiTabContainer />` |
| Scrollable Area | `<SmritiScrollArea />` |
| List Report | `<FioriListReport />` (`src/components/common/FioriListReport.tsx`) |
| Object Page | `<FioriObjectPage />` (`src/components/common/FioriObjectPage.tsx`) |
| Data Table | `<SEEFDataTable />` (`src/components/common/SEEFDataTable.tsx`) |
| Form Fields | `<SEEFForm />` (`src/components/common/SEEFForm.tsx`) |

## 4. Design Token Rules
```tsx
✅  className="bg-theme-surface-1 text-theme-heading border-theme-divider"
❌  style={{ background: '#1a1a2e', color: '#FFFFFF' }}   // hardcoded — prohibited
```

## 5. Naming Convention
```tsx
✅  <CustomerSelector />     (canonical selector)
✅  <ProductSelector />
✅  <WarehouseSelector />
❌  <CustomerDropdown2 />    (numeral + variant — prohibited)
❌  <MyCustomerPopup />      (non-standard prefix — prohibited)
```

## 6. Component Lifecycle Compliance
Every screen must use the **Module Lifecycle** pattern:
`Planning` ──► `Architecture Review` ──► `Implementation` ──► `Testing` ──► `Docs` ──► `Release`
