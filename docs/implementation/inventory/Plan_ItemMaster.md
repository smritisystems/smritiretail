<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 5.3.0
  Created      : 2026-08-21
  Modified     : 2026-08-21
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Item Master Stitch Management System Architecture & Image Resolver

**Version:** 5.3.0  
**Date:** 2026-08-21  
**Area:** Inventory & Catalog  
**Status:** Completed  

---

## 1. Objective
Establish a unified, high-speed, enterprise-grade Item Master Management suite synthesizing `Itemmaster3` Stitch architecture, dynamic attributes expansion (`A1..A9`), full CRUD lifecycles (Adding, Editing, Deleting), keyboard navigation, and an image path resolution engine.

---

## 2. Business Motivation
Retailers managing apparel, footwear, and consumer goods require swift catalog onboarding, batch data edits, and visual product verification without database clutter or manual path typing.

---

## 3. Scope
- Dual-mode Grid & Classic View inspector.
- Dual-list Column View Configuration & Ordering (`Alt+1`).
- Common Fields Baseline Setup (`Alt+2`).
- Item Details Matrix (`Alt+3`).
- Keyboard Shortcuts Reference (`F1`) and SKU/Barcode generator (`F2`).
- Global Find & Replace Data utility.
- Product Image Filename Field (`imageName`) with hover thumbnail preview.
- Image Path Configuration Studio under Tools & Catalogs.
- Direct PostgreSQL transactional persistence (`POST /api/v1/products/`).

---

## 4. Current State
Previous iterations handled basic item grids but lacked granular column reordering, frozen column count toggles, image path resolvers, and structured Add/Edit/Delete lifecycle safeguards.

---

## 5. Gap Analysis
- Missing visual thumbnail hover preview in dense spreadsheet mode.
- Lack of centralized base path/CDN configuration for image assets.
- Need for explicit non-editable field styling in Edit mode and financial transaction guards in Delete mode.

---

## 6. Architecture Impact
Dependencies point inward only:
```text
UI (SmritiItemMasterWorkspace, ItemDetGrid, SmritiImagePathConfigStudio)
    ↓
Platform Abstraction Layer (PAL & ImagePathConfigService)
    ↓
FastAPI Transactional Backend (POST /api/v1/products/)
    ↓
PostgreSQL Database
```

---

## 7. Proposed Design
- Lightweight filename storage (`imageName = "shoe-01"`) on product records.
- Client-side resolver combining global base path + default extension.
- Session-level view layout customization (`localStorage`).

---

## 8. Files Created
1. `src/components/itemMaster/ItemDetGrid.tsx`
2. `src/components/itemMaster/SmritiCommonFieldsSetup.tsx`
3. `src/components/itemMaster/ViewConfig.tsx`
4. `src/components/itemMaster/ReplaceDataDlg.tsx`
5. `src/components/itemMaster/CodeSelectDlg.tsx`
6. `src/components/itemMaster/KeyboardKeysDlg.tsx`
7. `src/components/itemMaster/DataLoadingConfirm.tsx`
8. `src/components/itemMaster/ImagePathConfigStu.tsx`
9. `src/services/imagePathConfig.ts`

---

## 9. Files Modified
1. `src/components/itemMaster/ItemMasterWs.tsx`
2. `src/components/itemMaster/ItemCatGrid.tsx`
3. `src/components/itemMaster/AttrMgmtStudio.tsx`
4. `src/components/itemMaster/ItemMasterStudio.tsx`
5. `src/components/drilldown/CtxInspectorHUD.tsx`
6. `src/services/unifiedFieldCatalog.ts`
7. `src/lib/headerMapping/HeaderAliasRegistry.ts`

---

## 10. Dependencies
- React 18, Lucide React, Tailwind CSS / Vanilla CSS, FastAPI, PostgreSQL.

---

## 11. Risks
- Broken image URLs if operators configure an invalid CDN base path.
- *Mitigation:* Live interactive tester inside Image Path Config Studio displays real-time preview before saving.

---

## 12. Rollback Strategy
- Configuration stored in `localStorage` can be reset to factory defaults with one click in the studio.

---

## 13. Verification Plan
- Unit and type checking with Vite production build.
- Live Docker compose container rebuild and validation.

---

## 14. Test Plan
- Verify `Alt+1..5` tab navigation.
- Verify `F1` shortcuts dialog and `F2` code generation.
- Verify hover preview on image thumbnails.
- Verify database commit via `POST /api/v1/products/`.

---

## 15. Documentation Impact
- Updated `CHANGELOG.md`, `RELEASE_NOTES.md`, `docs/walkthrough/README.md`, and `docs/implementation/README.md`.

---

## 16. Deployment Plan
- Containerized deployment via Docker Compose (`docker compose up -d --build`).

---

## 17. Status
**Completed** (Verified and live).

---

## 18. Related ADRs
- `ADR-041`: Platform Abstraction Layer (PAL).
- `ADR-044`: Fast Product Dynamic Attributes Persistence.

---

## 19. Related Walkthroughs
- `docs/walkthrough/inventory/Inv_ItemMaster_2.md`.
