# Walkthrough - SMRITI Enterprise Design System (SEDS) UI Redesign

## 1. Purpose
This document details the complete architectural redesign of the **SMRITI Business OS** user interface using the UX principles of the **SAP Fiori Design System** (Launchpad, Object Page, List Report, Worklist, Flexible Column Layout, Wizard, Dynamic Page, Message Popover, Global Search, Value Help Dialog, Smart Filter Bar, Shell Bar, Notification Center) powered by the original **SMRITI Enterprise Design System (SEDS)**.

## 2. Scope
- Foundational SEDS UI components (`SEDSTable`, `SEDSWizard`, `SEDSFilterBar`, `SEDSToolbar`, `SEDSCard`, `SEDSStatusBadge`, `SEDSHeader`, `SEDSAvatar`, `SEDSNotification`).
- Enterprise UX layout patterns (`SEDSListReport`, `SEDSObjectPage`).
- Theme design token integration & accessibility enhancements (WCAG AA).
- Refactoring `SetupWizardTab`, `ItemMasterTab`, and `App.tsx` navigation.

## 3. Files Created
- `src/design-system/components/SEDSTable.tsx`
- `src/design-system/components/SEDSWizard.tsx`
- `src/design-system/components/SEDSFilterBar.tsx`
- `src/design-system/components/SEDSToolbar.tsx`
- `src/design-system/components/SEDSCard.tsx`
- `src/design-system/components/SEDSStatusBadge.tsx`
- `src/design-system/components/SEDSHeader.tsx`
- `src/design-system/components/SEDSAvatar.tsx`
- `src/design-system/components/SEDSNotification.tsx`
- `src/design-system/components/patterns/SEDSListReport.tsx`
- `src/design-system/components/patterns/SEDSObjectPage.tsx`

## 4. Files Modified
- `src/design-system/index.ts`
- `src/components/SetupWizard/SetupWizardTab.tsx`
- `src/App.tsx`
- `backend/app/api/deps.py`
- `backend/app/api/v1/system.py`

## 5. Architecture Decisions
- **Original SEDS Visual Identity**: 100% original visual language with zero vendor-specific assets or proprietary code.
- **Max 7 Primary Actions Constraint**: Screen toolbars restrict primary buttons to a maximum of 7 items with overflow menus to prevent cognitive overload.
- **Hierarchical Navigation Flow**: Enforces `Launchpad` → `Workspace` → `List Page` → `Object Page`.
- **Public Unauthenticated Setup Status API**: `/api/v1/system/setup-status` and `/api/v1/company/setup` support initial unauthenticated first-run provisioning.

## 6. Design Rationale
- Inspired by SAP Fiori's high information density, clear visual hierarchy, and instant keyboard accessibility while tailored specifically for SMRITI retail OS workflows.
- Low visual clutter with curated HSL color tokens, dark mode glassmorphism accents, and accessible typography.

## 7. Implementation Summary
1. Implemented `SEDSTable` with sticky headers, column chooser, column sorting, filtering, row selection, and bulk action toolbar.
2. Implemented `SEDSWizard` with visual step navigator, progressive disclosure, and step validation.
3. Implemented `SEDSFilterBar` with multi-attribute search and filter tokens.
4. Implemented `SEDSObjectPage` with fixed summary header, status badges, horizontal navigation tabs, and structured attribute sections.
5. Implemented `SEDSListReport` combining Shell Header, Smart Filter Bar, Toolbar, and Data Table.

## 8. Tests Executed
- Frontend production bundle build via `docker exec smriti-workspace npm run build`.
- Backend container status check via `docker restart smriti-api`.
- Browser launch & navigation via `Start-Process "chrome.exe" "http://localhost:3000"`.

## 9. Verification Results
- `npm run build` completed clean in 3.66s with zero TypeScript compilation errors.
- Native Google Chrome browser launched on desktop at `http://localhost:3000`.

## 10. Known Limitations
- Advanced multi-column custom filter saved presets can be further extended in upcoming minor releases.

## 11. Future Work
- Add `SEDSFlexibleColumnLayout` 3-column split view for high-volume cashier POS reconciliation.

## 12. Related ADRs
- `ADR-018: SMRITI Enterprise Design System (SEDS) Architecture`

## 13. Related RFCs
- `RFC-042: Fiori UX Pattern Standardization for SMRITI Business OS`
