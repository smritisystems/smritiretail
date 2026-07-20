<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.0.0
  Created      : 2026-07-20
  Modified     : 2026-07-20
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Retail OS v5.0 — Enterprise Billing Terminal Framework Execution Plan

## 1. Objective
Refactor the existing Billing module into a standalone Enterprise Billing Terminal Framework based on the v5.0 Architecture Specification. Map execution into structured milestones to separate the POS Terminal and the Tax Invoice Terminal, adding fullscreen layouts, keyboard shortcuts, and custom permission profiles.

## 2. Business Motivation
Improve transaction speeds, cashier experience, and wholesale B2B compliance across retail lanes by implementing dedicated terminal applications, scanner-optimized workflows, and mixed payment calculators while maintaining 100% database and API compatibility.

## 3. Project Dependencies
This execution plan relies on the following internal SMRITI systems:
- **Approval Engine:** Handles manager PIN approvals for overrides or bulk item voids.
- **RBAC Framework:** Maps security roles to `billing.*` permissions.
- **Offline Sync Engine:** Syncs IndexedDB offline cart queues with PostgreSQL backend.
- **Inventory Engine:** Manages stock ledger increments/decrements.
- **GST Tax Engine:** Computes CGST/SGST/IGST tax values and statutory rounding.
- **Printing Engine:** Sends raw ESC/POS commands to lane hardware.
- **Audit Logging:** Traces all checkout edits, holds, voids, and prints.

## 4. Scope
- **Phase 1:** Shared Framework, Custom Routing, and Fullscreen Layout Switch.
- **Phase 2:** POS Terminal, Keyboard-first layout, continuous scanner mode, virtualized grid, and Salesperson & Commission Engine.
- **Phase 3:** Tax Invoice Terminal, B2B addresses, transporter logs, payment terms, Sales Executives mapping, and TCS/TDS calculation.
- **Phase 4:** Permissions seeding, unit testing, performance validation, and migration guides.

## 5. Migration Strategy
To guarantee zero checkout lane downtime:
```text
Existing Billing (Baseline)
          ↓
Feature Freeze (Freeze changes to PosTerminalTab.tsx)
          ↓
Shared Framework (Deploy terminal routing and launch hooks)
          ↓
POS Terminal / parallel testing (Run legacy and v5.0 side-by-side)
          ↓
Tax Terminal / User Acceptance (Pilot wholesale invoices)
          ↓
Production Rollout (Incremental store-by-store switch)
          ↓
Legacy Billing Code Cleanup (Decommission old tab components)
```

## 6. Detailed Phased Milestones & Deliverables

### Phase 1: Shared Framework & Routing
- **Routing Switch:** In `src/App.tsx`, check path and parameters to enable `isTerminalMode` and mount the requested terminal directly in a fullscreen container.
- **Shared Terminal Shell:** Contains toolbar action buttons, status bar indicators (online, scanner, printer), and global keyboard listener bindings.
- **Terminal Launcher:** Add triggers in Sales Studio to open `/terminal/pos` and `/terminal/tax` in new browser windows (`_blank`).
- **Deliverables:**
  - Shared Terminal Shell Component
  - Fullscreen Routing Hook
  - Keyboard Overrides Hook
  - Toolbar & Status Bar Components
  - Terminal Context Provider
- **Acceptance Criteria:**
  - Standard outer layout is hidden when launching with `?terminal=pos` parameter.
  - Sidebar and top header are bypassed entirely.
  - Layout matches 100% black theme guidelines.

### Phase 2: POS Terminal
- **Keyboard Shortcuts:** Overrides native actions for F2 (Customer), F3 (Product Search), F4 (Qty), F5 (Cash), F6 (UPI), F7 (Card), F8 (Hold), F9 (Print), F10 (Recall), Ctrl+N (New Bill), Esc (Void), Delete (Remove Line).
- **Scanner Engine:** Continuous scanning loop with duplicate scan detection and audio feedback.
- **Transaction Grid:** Excel-like editable grid with arrow-key cell movements, virtualized row updates, and line-level Salesperson mapping dropdowns.
- **Payment Engine:** Multi-mode mixed split payments (Cash tender, Cards, UPI, Wallets, Loyalty points).
- **Salesperson & Commission Engine:** Multi-mode lookup selectors (Disabled, Single, Line-level) mapped to Employee Master.
- **Shift & Cash Drawer Controls:** Declare opening cash float, drops, payouts, and close settlements with discrepancy analysis.
- **Deliverables:**
  - POS Terminal Layout with Billing Header (incorporating separate Cashier & Salesperson entries)
  - Barcode Scanner Integration
  - Excel-like Editable Grid with line Salesperson column
  - Quick Tender Calculator & Cash Drawer RJ11 kick trigger
  - Hold / Recall Drawer Modal
  - Customer display / Pole display adapter hook
- **Acceptance Criteria:**
  - Barcode scanner auto-focuses on input launch.
  - Adding products is completed with zero clicks.
  - Transaction checkout completes in under 20 seconds.
  - Salesperson is successfully selected and logged in audit trails.
  - Local IndexedDB queue successfully stores carts when offline.

### Phase 3: Tax Invoice Terminal
- **GST Validation:** Integrated B2B GSTIN lookup and validator.
- **Address & Warehouse:** Manage billing/shipping addresses and choose warehouses.
- **Logistics Logs:** Vehicle number, transporter name, freight, insurance, and payment credit terms.
- **Sales Executive Assignment:** Link B2B transactions to Territory Managers or Account Managers.
- **Taxes:** Calculate TCS/TDS and auto-apply nearest rupee rounding rules.
- **Deliverables:**
  - Tax Invoice Terminal Layout
  - B2B GSTIN Lookup Panel
  - Address Manager Form
  - Transporter Logs Section
  - Rupee Rounding Handler
- **Acceptance Criteria:**
  - Invoices validate GSTIN format limits.
  - Transporter data fields bind correctly to database schemas.
  - PDF export and print preview are rendered correctly.

### Phase 4: Testing & Migration
- **Permission Seeding:** Seed new scopes `billing.pos`, `billing.tax`, `billing.return`, `billing.void`, `billing.import`, `billing.recall`, `billing.discount`, `billing.override`, `billing.reprint`, `billing.salesperson.view`, `billing.salesperson.assign`, and `billing.salesperson.override` in `backend/app/db/seed.py`.
- **Unit & UI Tests:** Add tests for shortcut key overrides and offline queue recovery.
- **NFR Benchmarking:** Validate scanner addition time is < 150ms and 1000-line scroll rendering remains at 60 FPS.
- **Deliverables:**
  - Database permission seed script updates
  - Keyboard Navigation test suite
  - Hardware integration validation report
- **Acceptance Criteria:**
  - All unit, integration, and regression test suites pass.
  - Security endpoints block access for non-cashier roles.

## 7. Testing Scope
- **Keyboard Navigation Tests:** Automated key-event simulations.
- **Hardware Scanner Tests:** Intercept barcode raw sequence timings.
- **Offline Sync & Recovery Tests:** Disable networks during checkout and verify data queue syncs.
- **Performance Benchmarks:** Run test scripts with 1000-line carts.
- **Regression Tests:** Verify legacy checkout functionality is unbroken.

## 8. Hardware Validation Matrix
The terminal must be verified against the following peripherals:
- Barcode Scanners (Continuous scanner mode)
- Thermal ESC/POS Receipt Printers (80mm / 58mm)
- Electronic Weighing Scales (Serial/USB COM port)
- Cash Drawer RJ11 Triggers
- Customer Pole Displays

## 9. Rollout Plan
```text
Dev Verification ➔ Staging QA ➔ Pilot Store Launch ➔ 10-Store Phase ➔ 100-Store Phase ➔ General Availability
```

## 10. Key Performance Indicators (KPIs)
- Average checkouts / hour
- Average scanner read latency (< 150ms)
- Cashier keyboard usage rate (> 95% on POS)
- Synchronization queue error rate (0%)
- Print queue failure rate (0%)
- Commission data mismatch rate (0%)

## 11. Risk Register

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| Browser shortcut conflicts | Medium | Override only supported key codes, utilizing `e.preventDefault()` where safe. |
| Grid rendering lag on large lists | High | Implement virtualized rendering list wrappers. |
| Offline transaction sync overlaps | High | Generate unique UUID sequence keys for conflict resolution. |
| Hardware adapter failures | Medium | Create fallback print formats (A4 standard) if receipt drivers fail. |
| Cashier training adoption resistance | Medium | Keep keyboard shortcut assignments consistent with legacy billing profiles. |

## 12. Definition of Done
The refactoring is considered complete when:
- All execution milestones (Phases 1-4) are implemented.
- Existing POS and Advanced Billing features remain 100% functional.
- All regression test suites run successfully.
- Performance targets (sub-150ms barcode scans) are verified.
- Pilot store rollout succeeds with zero data discrepancies.
- Migration guides and specs are checked into docs.
