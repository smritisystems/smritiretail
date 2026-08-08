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

# Walkthrough: SMRITI Viewport & Layout Governance Framework (`SLGP-001 v2.0`)

## 1. Purpose
Implement the **SMRITI Viewport & Layout Governance Framework (`SLGP-001 v2.0`)**, freezing Level 1 Architecture Constitution **Rule SLGP-R6 ("Modules Shall Never Control the Viewport")**. This standard eliminates competing viewport bounds, nested scrollbars, clipped elements, and broken dialog heights by enforcing centralized layout management, reusable workspace wrappers, layout tokens, developer inspection overlays, and automated build linters.

---

## 2. Scope
- Level 1 Constitution Rule `SLGP-R6` frozen in `.agents/AGENTS.md`.
- Level 2 Policy Document [`docs/governance/SLGP_001_Viewport_And_Layout_Governance_Standard.md`](file:///f:/SMRITRretailNXmgrt/docs/governance/SLGP_001_Viewport_And_Layout_Governance_Standard.md).
- Centralized Layout Tokens (`src/layout_engine/tokens/layoutTokens.ts`).
- Layout Bounds Calculation Service & Reactive Hook (`src/layout_engine/services/layoutService.ts`).
- Reusable Workspace Component `WorkspaceLayout.tsx` supporting 3 layout contracts:
  - **Pattern A (Scrollable Page)**: Natural vertical document scrolling.
  - **Pattern B (Fixed Studio)**: Fixed top toolbar + inner scrollable table + fixed bottom totals.
  - **Pattern C (Master-Detail Workspace)**: Left list/grid panel + Right form panel independently scrollable.
- Standardized Modal Dialog Component (`SmritiDialog.tsx`).
- Standardized Tabbed View Container Component (`SmritiTabContainer.tsx`).
- Developer Layout Inspector Overlay (`LayoutInspectorOverlay.tsx`).
- Automated Build Linter (`scripts/validate_layout_tokens.py`).

---

## 3. Files Created
- `docs/governance/SLGP_001_Viewport_And_Layout_Governance_Standard.md`
- `src/layout_engine/tokens/layoutTokens.ts`
- `src/layout_engine/services/layoutService.ts`
- `src/layout_engine/components/MasterDetailWorkspace.tsx`
- `src/layout_engine/components/WorkspaceLayout.tsx`
- `src/layout_engine/components/SmritiDialog.tsx`
- `src/layout_engine/components/SmritiTabContainer.tsx`
- `src/layout_engine/components/LayoutInspectorOverlay.tsx`
- `scripts/validate_layout_tokens.py`
- `docs/walkthrough/foundation/Foundation_SLGP001_Viewport_And_Layout_Governance_v5.4.0.md`

---

## 4. Files Modified
- `.agents/AGENTS.md`
- `src/layout_engine/layout_manager.tsx`
- `src/components/AIConfigurationTab.tsx`
- `src/components/DataExchangeTab.tsx`
- `src/components/ExplainModal.tsx`
- `src/components/MasterManagementTab.tsx`
- `src/components/OperationalHealthDashboard.tsx`
- `src/components/ScreenStudioTab.tsx`
- `src/components/SmritiEcosystemHub.tsx`
- `src/components/WikiTab.tsx`
- `src/design-system/layout/SEDSWorkspaceShell.tsx`
- `docs/walkthrough/README.md`

---

## 5. Architecture Decisions
- **AD-1: Level 1 Constitution Rule SLGP-R6**: Business modules are strictly prohibited from defining `h-screen`, `100vh`, `100vw`, or outer scroll behavior. Viewports are governed exclusively by `LayoutManager` and `WorkspaceLayout`.
- **AD-2: Pattern C Master-Detail Workspace**: Enables split-pane views where left list and right form panels scroll independently within a single viewport bounding box.
- **AD-3: Centralized Layout Tokens**: Replaced hardcoded CSS pixel offsets with `LAYOUT_TOKENS` (`HEADER_HEIGHT_PX`, `SIDEBAR_WIDTH_PX`, `STATUS_BAR_HEIGHT_PX`, etc.).
- **AD-4: Developer Layout Inspector**: Provides floating overlay toggle to inspect bounding boxes, flex flexbox trees, and token values live in the UI.

---

## 6. Design Rationale
Centralizing viewport management prevents child React components from breaking parent layout boundaries. By providing reusable `<WorkspaceLayout mode="scroll | studio | master-detail" />` wrappers and enforcing build linters, all future modules automatically inherit consistent scrolling behavior.

---

## 7. Implementation Summary
1. **Rule SLGP-R6 Constitution**: Added Rule SLGP-R6 to `.agents/AGENTS.md` and authored policy standard `SLGP_001`.
2. **Tokens & Service**: Created `LAYOUT_TOKENS` and `LayoutService` with `useLayoutBounds()` hook.
3. **Workspace Patterns A/B/C**: Built `WorkspaceLayout.tsx`, `MasterDetailWorkspace.tsx`, `SmritiDialog.tsx`, `SmritiTabContainer.tsx`, and `LayoutInspectorOverlay.tsx`.
4. **Layout Manager Integration**: Updated `src/layout_engine/layout_manager.tsx` with `flex-1 min-h-0 flex flex-col overflow-hidden` bounds.
5. **Automated Linter**: Created `scripts/validate_layout_tokens.py` scanning 322 component files and verifying 0 layout violations.

---

## 8. Tests Executed
1. **Layout Governance Linter Execution**:
   ```bash
   python scripts/validate_layout_tokens.py
   ```
2. **TypeScript Verification Check**:
   ```bash
   npx tsc --noEmit
   ```

---

## 9. Verification Results
- **Layout Governance Linter**: Passed (`[OK] LINTER PASSED: Zero layout governance violations found in src/`).
- **TypeScript Verification Check**: Passed (0 compilation errors).

---

## 10. Known Limitations
- High-density data tables require responsive horizontal scroll wrappers when viewport width is below 640px.

---

## 11. Future Work
- Add layout token preset switcher under SEEF Admin Configurator.

---

## 12. Related ADRs
- `ADR-001`: SMRITI Platform Architecture & Four-Tier Isolation

---

## 13. Related RFCs
- `RFC-SLGP-001`: Viewport Height & Layout Bounding Framework Specification
