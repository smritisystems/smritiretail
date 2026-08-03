# SMRITI Workspace Experience Framework
## UX Principles v1.0
**Status:** FROZEN  
**Authority:** SXP Constitution v1.0  
**Author:** Jawahar Ramkripal Mallah · Chief Systems Architect  
**Copyright:** © SMRITIBooks.com. All Rights Reserved.

---

## Vision

> **"Power of an Enterprise ERP. Simplicity of WhatsApp."**

SMRITI is not an ERP. It is a workspace operating system for retail operators. Every UX decision must be measured against this vision.

---

## The 10 SWEF Design Principles

### P-001 — Action-First, Not Form-First
Every workspace must lead with **what the user can do**, not with a form or a table. The dominant UI element must be an action, not a field.

### P-002 — Hide Technical Complexity
ERP terminology (`ITEX`, `ILGE`, `Ledger Entry`, `Reservation Engine`) must never appear in user-facing labels. Use plain language: `Receive Stock`, `Transfer`, `Return`.

### P-003 — One Shared Shell, Zero Custom Frames
Every studio renders inside `WorkspaceShell`. Studios do not build their own navigation, toolbar, or header. Zero exceptions.

### P-004 — Adaptive Visibility, Not Conditional Rendering
Feature visibility is controlled exclusively by `canRender(featureKey)` from `adaptiveWorkspaceStore`. Direct `mode === 'ADVANCED'` comparisons in component code are prohibited.

| Mode | Who Sees It | Features Visible |
|---|---|---|
| SIMPLE | Shop owner, cashier | Core sales, stock receipt, scan |
| HYBRID | Store manager | + Cost layers, transfers, holds |
| ADVANCED | Power user, accountant | + Ledger, write-offs, reservations, raw data |

### P-005 — Declarative Navigation Only (WNG-005)
Navigation metadata belongs in `*.manifest.ts` files. No hardcoded `if (domain === "...")` in UI components. The NavigationRegistry is the single source of truth.

### P-006 — Metadata Drives Everything
Workspaces, actions, widgets, dashboards, timelines — all declared in registries. Components are generic consumers. Zero domain logic in UI renderers.

### P-007 — 3-Interaction Rule (Mobile Warehouse)
Scanner-zone operations must complete in **exactly 3 interactions**:
1. Scan / Search
2. Confirm quantity
3. Done

A 4th interaction is an architecture violation. `OperationLauncher` enforces `MAX_STEPS` per mode.

### P-008 — Zero Animation in POS Zone
The `scanner` ExperienceZone disables all `motion/react` transitions during active billing. Performance > aesthetics at checkout.

### P-009 — Platform Timeline, Not Domain Timelines
`WorkspaceTimeline` with the domain adapter pattern is the only permitted timeline component. Each domain provides an adapter. Studios do not build their own timeline.

### P-010 — AI is Always Advisory
AI Skill results (`SPK.ai`) must set `isAdvisoryOnly: true`. AI notifications display "Advisory only — no automatic action taken." No AI component executes financial transactions automatically.

---

## ExperienceZones

| Zone | Purpose | Animation | Mobile |
|---|---|---|---|
| `dashboard` | Widget grid, KPI cards, timeline | Enabled | Scrollable |
| `operator` | Action launcher, list report | Enabled | Tap-friendly |
| `document` | Object Page header + sections | Enabled | Collapsible |
| `executive` | Wide charts, drill-down | Enabled | Read-only |
| `scanner` | Scan input, 3-interaction flow | **Disabled** | Full-screen |
| `approval` | Split list + detail, action tray | Enabled | Sheet |

---

## Adaptive Mode Matrix

| Feature Key | SIMPLE | HYBRID | ADVANCED |
|---|---|---|---|
| `cost_layers` | ✗ | ✓ | ✓ |
| `raw_ledger` | ✗ | ✓ | ✓ |
| `reservations` | ✗ | ✓ | ✓ |
| `batch_tracking` | ✗ | ✗ | ✓ |
| `multi_location` | ✗ | ✓ | ✓ |
| `salesperson_tracking` | ✗ | ✓ | ✓ |
| `analytics_advanced` | ✗ | ✗ | ✓ |
| `ai_advisory` | ✗ | ✓ | ✓ |
