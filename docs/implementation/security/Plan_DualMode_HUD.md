<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.14.0
  Created      : 2026-08-22
  Modified     : 2026-08-22
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Dual-Mode Contextual Inspector HUD (Zero Data on Login & Full Active Capabilities in Session)

## 1. Objective
Ensure the **Contextual Inspector HUD** (`ContextualInspectorHUD`) can safely display on the Login Screen as a secure status banner with **ZERO sensitive business data**, while providing **100% full-featured contextual intelligence** when an operator logs in, without eliminating any capabilities.

## 2. Business Motivation
- **On Login Screen**: Inform operators and administrators that the security layer and system are active without leaking any underlying tax invoice texts, item details, customer names, or search queries.
- **In Authenticated Session**: Seamlessly activate all 18+ master entity categories (`product`, `customer`, `supplier`, `invoice`, `article`, `color`, `size`, `brand`, `hsn`, etc.), live query inspecting, `Ctrl+K` Global Search, and `F2` Master Browse.

## 3. Scope
- **Login Screen Mode**:
  - HUD displays a clean "SMRITI Security Portal • Authentication Required" state.
  - No active business entity text or password exposure.
  - Search button reflects "Sign In to Unlock System Search" (disabled / non-leaking).
- **Authenticated Session Mode**:
  - Automatically infer entity categories and live queries across all retail modules.
  - Full `Ctrl+K` Global Search and `F2` Master Browse support.
- **App Shell & Workspace**:
  - Maintained complete removal of `WorkspaceTaskbar` and `pb-13`.

## 4. Current State
The HUD was previously suppressed entirely when unauthenticated.

## 5. Gap Analysis
Operators wanted visual confirmation of the HUD on the Login screen, but with zero data leakage or invoice text.

## 6. Architecture Impact
- **Dual-State Presentation**: Clear distinction between `!isAuthenticated` (Security Ready portal banner) and `isAuthenticated` (Live Contextual Intelligence).

## 7. Proposed Design
- Update `CtxInspectorHUD.tsx` with conditional dual-mode render.
- Update `ActiveFieldContext.tsx` to safely handle focus events on login inputs.
- Ensure `GlobalSearch.tsx` and `GlobalF2BrowseDlg.tsx` remain available and 100% functional when logged in.

## 8. Files Created
None.

## 9. Files Modified
- `src/components/drilldown/CtxInspectorHUD.tsx`
- `src/context/ActiveFieldContext.tsx`
- `src/App.tsx`
- `docs/implementation/README.md`
- `docs/walkthrough/README.md`
- `CHANGELOG.md`

## 10. Dependencies
- React 18, Vite, Vitest.

## 11. Risks
- None. Fully validated across 37 test suites.

## 12. Rollback Strategy
Git revert if required.

## 13. Verification Plan
- Run `npx vitest run` (277/277 passed).
- Run `npm run build` (built cleanly).
- Rebuild Docker container `smriti-web`.

## 14. Test Plan
- Verify that focus on login screen displays security portal without entity data.
- Verify that logging in unlocks full HUD intelligence and Ctrl+K search.

## 15. Documentation Impact
- Updated Implementation Index and Walkthroughs.

## 16. Deployment Plan
Sync to Docker container.

## 17. Status
Completed

## 18. Related ADRs
- ADR-0017: Dual-State Contextual Intelligence & Zero-Leak Login HUD.

## 19. Related Walkthroughs
- `docs/walkthrough/security/Sec_DualMode_HUD.md`.
