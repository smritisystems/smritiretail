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

# Walkthrough: Item Master Stitch Management System Architecture & Image Resolver

**Version:** 5.3.0  
**Date:** 2026-08-21  
**Area:** Inventory & Catalog  
**Status:** Done  

---

## 1. Purpose
This walkthrough documents the full synthesis and deployment of the Item Master Stitch Management System architecture (`Itemmaster3`). It establishes a comprehensive CRUD lifecycle (Adding, Editing, Deleting Item Master), keyboard ergonomics (`Alt+1/2/3/4/5`, `F1`, `F2`, `Ctrl+S`), dynamic attribute expansion (`A1..A9`), draggable HUD, and a product image resolver with a dedicated Image Path Configuration Studio.

---

## 2. Scope
- High-Density Grid Mode with customizable frozen columns (0–6) & Classic Single-Record View Inspector.
- Session-Level Common Fields Baseline Setup (`Alt+2`).
- Dual-List Column View Configuration & Ordering (`Alt+1`).
- Multi-mode CRUD lifecycle: Adding, Editing (with non-editable greyed fields), and Deleting (with transaction protection guard).
- Keyboard Shortcuts & Guide (`F1`), Code & Barcode Generator Dialog (`F2`).
- Global Find & Replace Data utility across matrix rows and retail attributes.
- Image Filename field (`imageName`) in Item Master with live hover thumbnail preview.
- Image Path Configuration Studio under **Tools & Catalogs** for resolving local, server, or cloud CDN image assets.
- Direct PostgreSQL transactional persistence (`POST /api/v1/products/`).

---

## 3. Files Created
1. `src/components/itemMaster/SmritiItemDetailsGrid.tsx` — Dual-mode Grid & Classic View matrix with inline row actions.
2. `src/components/itemMaster/SmritiCommonFieldsSetup.tsx` — Batch baseline presets and field inclusion checklist.
3. `src/components/itemMaster/SmritiViewConfiguration.tsx` — Dual-list column selector, order manager, and frozen count selector.
4. `src/components/itemMaster/SmritiReplaceDataModal.tsx` — Global find & replace utility modal.
5. `src/components/itemMaster/SmritiCodeSelectionDialog.tsx` — SKU pattern & EAN-13 barcode generator.
6. `src/components/itemMaster/SmritiKeyboardShortcutsModal.tsx` — `F1` keyboard shortcuts guide.
7. `src/components/itemMaster/SmritiDataLoadingConfirmationModal.tsx` — Data loading confirmation modal (`Yes` load all / `No` apply filter first).
8. `src/components/itemMaster/SmritiImagePathConfigStudio.tsx` — Product image base path and extension resolver studio.
9. `src/services/imagePathConfigService.ts` — Image path resolution service with localStorage persistence.

---

## 4. Files Modified
1. `src/components/itemMaster/SmritiItemMasterWorkspace.tsx` — Unified host navigation integrating all tabs (`Alt+1..5`).
2. `src/components/itemMaster/SmritiItemCatalogGrid.tsx` — Rendered Barcode adjacent to Stock No and added hover image previews.
3. `src/components/itemMaster/SmritiAttributeManagementStudio.tsx` — Support for `A1..A9` dynamic slots and custom alias management.
4. `src/components/itemMaster/SmritiItemMasterStudio.tsx` — Corrected bulk creation API endpoint to `POST /api/v1/products/`.
5. `src/components/drilldown/ContextualInspectorHUD.tsx` — Draggable Framer Motion HUD with minimize and hide options.
6. `src/services/unifiedFieldCatalog.ts` — Added `imageName` and reordered `Barcode` immediately next to `Stock No`.
7. `src/lib/headerMapping/HeaderAliasRegistry.ts` — Registered `imageName`, `A1..A9`, and custom alias mutation helpers.

---

## 5. Architecture Decisions
- **AD-INV-501 (Separation of View Preferences vs. Database Schema):** Column selections and frozen counts are stored at the session/user level, leaving the underlying PostgreSQL schema untouched.
- **AD-INV-502 (Lightweight Image Filenames):** Only the image filename is stored on the product record, while the base directory URL is managed globally in the Image Path Config Studio.
- **AD-INV-503 (Financial Referential Integrity):** Items with historical sales or purchase movements cannot be hard-deleted; the system marks them archived/inactive.

---

## 6. Design Rationale
Retail operators require high data entry velocity without mouse dependency. Combining `Alt+1/2/3` tab jumping, `F1` shortcut discovery, `F2` barcode generation, and sticky frozen columns eliminates friction during seasonal catalog ingestion.

---

## 7. Implementation Summary
- Built high-performance spreadsheet grid in React with zero external grid library overhead.
- Implemented dual-list transfer with instant reordering and search filtering.
- Configured Image Path Resolver supporting Server (`/api/v1/products/images/`), Cloud CDN, and Local Network paths.

---

## 8. Tests Executed
- Production Vite Build (`npm run build`): 0 errors, 3,445 modules compiled in ~19.5s.
- Docker Rebuild (`docker compose up -d --build`): All containers (`smriti-db`, `smriti-api`, `smriti-web`) verified healthy.

---

## 9. Verification Results
```
 Image smritrretailnx-smriti-api Built 
 Image smritrretailnx-smriti-web Built (✓ built in 16.45s)
 Container smriti-db   Started → Healthy
 Container smriti-api  Started → Healthy
 Container smriti-web  Started
```
- **Status:** **Done**

---

## 10. Known Limitations
- High-resolution images on external CDNs require active internet connectivity or valid CORS headers if fetched across domains.

---

## 11. Future Work
- Direct drag-and-drop batch image asset uploader into the backend SPIF storage directory.

---

## 12. Related ADRs
- `ADR-041`: Platform Abstraction Layer (PAL) Interface Isolation.
- `ADR-044`: Fast Product Dynamic Attributes Persistence.

---

## 13. Related RFCs
- `RFC-INV-012`: High-Velocity Item Master Ingestion & Dynamic Matrix Format.
