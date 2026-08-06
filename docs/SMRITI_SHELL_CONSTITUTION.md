# SMRITI Shell Constitution v1.0 (`SCS-SHL-001`)

**Status:** FROZEN — Level 1 SMRITI Architecture Constitution v1.0 (2026-08-06)  
**Standard:** `SCS-SHL-001` (Unified Operating System Shell Standard)  

---

## 1. Operating System Shell Paradigm

SMRITI Retail OS is an **Operating System Shell** (similar to Windows Explorer, VS Code, or SAP Fiori Launchpad OS).

- The Shell is **permanent and immutable**.
- Modules and workspaces do **NOT** render their own top headers.
- Workspaces open as **Chrome / VS Code style workspace tabs**.

---

## 2. Six Frozen Shell Zones (Zones A — F)

```text
========================================================================================
SMRITI FROZEN SHELL ZONES ARCHITECTURE (SCS-SHL-001)
========================================================================================
[ZONE A: Logo & Brand]        │ [ZONE B: Universal Command Search] │ [ZONE E: Status Controls]
SMRITI Enterprise OS          │ 🔍 Search anything... (Ctrl+K)    │ 🤖 AI  ⚡ Sync  🔔  👤 User
----------------------------------------------------------------------------------------
[ZONE C: Workspace Tabs Bar]
🏠 Dashboard  │  🖨 Print Studio  │  🛒 POS Terminal  │  📦 Item Master  │  [+]
----------------------------------------------------------------------------------------
[ZONE D: Context Toolbar] (Module-specific action buttons e.g., Save, Print, Overflow ⋯)
----------------------------------------------------------------------------------------
[ZONE F: Workspace Viewport Area] (Minimum 85% Viewport height dedicated to content)
========================================================================================
```

### Zone Specification:

1. **Zone A (Logo & Identity)**: Compact `SMRITI Enterprise OS` identity badge.
2. **Zone B (Universal Search)**: Global Command Search input (`Ctrl+K`) for Products, Invoices, Customers, Actions, Settings, and Commands.
3. **Zone C (Workspace Tabs Bar)**: Chrome/VS Code style tabs with unhyphenated labels, icons, pin support, and close `✕` buttons.
4. **Zone D (Module Context Toolbar)**: Module-specific actions organized as `Primary | Secondary | ⋯ Overflow`.
5. **Zone E (Status Controls)**: Header status bar exposing `🤖 First-Class AI Copilot`, `⚡ Live Sync`, `🔔 Notifications`, and `👤 User Profile`.
6. **Zone F (Workspace Content Area)**: Clean content area occupying **≥ 85% of viewport height**.

---

## 3. Responsive Shell Rules

| Screen Size | Shell Row Height | Shell Layout Rule |
|---|---|---|
| **Desktop (≥ 1024px)** | 2 Rows | Full 2-Row Fiori Shell (Header + Tabs Bar) |
| **Tablet (768px - 1023px)** | 2 Rows | Compact 2-Row Fiori Shell with icon-only status buttons |
| **Mobile (< 768px)** | 1 Row | **1-Row Adaptive Shell** (Logo + Search Icon + Hamburger Menu) |

---

## 4. Constitutional Freeze Compliance

- **No module may create its own top header bar.**
- **Maximum 2 header rows allowed on desktop.**
- **All AI inquiries must route through Zone E (`🤖 AI Copilot`).**
