# SMRITI Platform — UX Kernel Constitution v1.0.0

**Status:** FROZEN — UX Kernel v1.0.0  
**Effective Date:** 2026-08-03  
**Organization:** SmritiSys / SMRITI Books  
**Chief Systems Architect:** Jawahar Ramkripal Mallah  

---

## Preamble

The **UX Kernel** is the foundational frontend platform engine of SMRITI Retail OS. It defines the immutable architectural contracts, layout boundaries, metadata registries, and design token rules governing all user interfaces across the enterprise platform.

No business domain module (Sales, Purchase, POS, WMS, Marketplace, Consignment, Manufacturing) may implement custom procedural navigation, hardcoded forms, un-tokenized styling, or duplicated workspace shells.

---

## 1. The Eight Immutable UX Constitutional Principles

### Principle 1: Metadata First (Declarative Assembly over Procedural Code)
All user interfaces, form layouts, data grids, action toolbars, and search filters MUST be assembled declaratively through Metadata Registries (`EntityRegistry`, `FormRegistry`, `GridRegistry`, `ActionRegistry`, `NavigationRegistry`, `ValidationRegistry`, `PermissionRegistry`, `LayoutRegistry`, `ThemeRegistry`). Handcrafted, hardcoded TSX forms or procedural screen logic are strictly prohibited.

### Principle 2: Single Persistent Workspace Shell
The platform MUST render exactly one persistent workspace shell (`WorkspaceLayout`) containing the top header, primary navigation sidebar, workspace tabs, slide-out filter drawer, action toolbar, and notification center. Workspaces MUST NEVER instantiate secondary persistent navigation sidebars or duplicate shell boundaries.

### Principle 3: Single Declarative Navigation Engine (SUNEF 5-Level Hierarchy)
Navigation MUST consume the Universal Navigation Facade (`SPK.navigation`) and adhere strictly to the 5-Level Enterprise Navigation Hierarchy:
`Level 1 (Launchpad) ──► Level 2 (Business Domain) ──► Level 3 (Business Module) ──► Level 4 (Workspace Tabs) ──► Level 5 (Task / Form Inspector)`.
UI components MUST NEVER evaluate procedural `if (domain === "...")` branches for menu rendering.

### Principle 4: Adaptive Layout Engine (Desktop, Tablet & Mobile Unified)
All screens MUST execute within a single adaptive layout engine that gracefully adjusts column spans, drawer visibility, top action toolbars, and touch targets based on standard SEDS responsive breakpoint tokens (`sm`, `md`, `lg`, `xl`, `2xl`). Custom media query hacks or device-specific duplicate screens are prohibited.

### Principle 5: Accessibility & Keyboard-First Design
Keyboard navigation, focus rings, ARIA roles, and high-contrast token compliance MUST be natively enforced by platform components. Every actionable grid, form field, modal dialog, and command palette MUST be 100% accessible via keyboard shortcuts and screen readers.

### Principle 6: Strict Token-Based Theme Independence (SEDS Slate Standard)
UI components MUST consume predefined SEDS Design System CSS variables (`--color-*`, `--font-*`, `--space-*`, `--radius-*`) exclusively. Ad-hoc hex colors, hardcoded pixel margins, arbitrary font sizes, or un-tokenized utility classes are strictly flagged and blocked by CI/CD linter gates (`validate_seds.py`).

### Principle 7: Zero Business Logic inside UI Components
UI Components (`UniversalFormRenderer`, `DataGridEngine`, `NavigationSidebar`, `FilterDrawer`) MUST remain 100% generic, pure presentation components. Validation rules, state transitions, security authorization, and backend communication MUST delegate exclusively to registered platform services (`SPK.validation`, `SPK.security`, `SPK.workflow`, `SPK.api`).

### Principle 8: Platform Component Extension over One-Off Widgets
New feature requirements MUST be satisfied by extending registered platform capabilities (`SPK.fields.register()`, `SPK.forms.register()`) rather than inventing standalone, disconnected custom React components.

---

## 2. Three-Tier SMRITI Platform Architecture

```text
================================================================================
LAYER 1: STABLE PLATFORM KERNELS (FROZEN ARCHITECTURE)
  • UX Kernel (SEDS / UFR / WNG / SUNEF)     • Inventory Kernel v1.0.0
  • Security Kernel (USR)                   • Accounting Kernel
  • Pricing & Tax Kernel                     • Workflow Kernel (UWR)
================================================================================
                                       │
                                       ▼
================================================================================
LAYER 2: UNIVERSAL PLATFORM SERVICES
  • Universal Notification Engine           • Universal Search & Lookup Facade
  • Universal Report Registry (URR)          • Universal Print Registry (UPRT)
  • Universal AI Skill Registry (UAR)        • Security Audit & Telemetry
================================================================================
                                       │
                                       ▼
================================================================================
LAYER 3: CERTIFIED BUSINESS DOMAINS
  • Sales (SI_001)       • Purchase (PI_001)    • POS (POS001)
  • Warehouse (WMS001)   • Marketplace (MP001)  • Consignment (CS001)
================================================================================
```

---

## 3. UX Kernel Certification Standards (UX001..UX006)

For a business domain module to achieve **UX Kernel Certification**:
1. **UX001 Shell Compliance**: Uses the single persistent `WorkspaceLayout` shell.
2. **UX002 Navigation Compliance**: Declares all routes and domain tabs in `NavigationRegistry` via `SPK.navigation`.
3. **UX003 Form Compliance**: Renders all edit forms using `UniversalFormRenderer` powered by `FormRegistry` metadata.
4. **UX004 Grid & List Compliance**: Implements the List Report Pattern with top filter drawer and standard data table engine.
5. **UX005 SEDS Token Compliance**: Passes `python scripts/validate_seds.py` with 0 prohibited styling violations.
6. **UX006 Security & Permission Compliance**: Delegates menu, tab, and button visibility to `SPK.security.evaluateAccess()`.
