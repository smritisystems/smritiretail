<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Version      : 6.7.1 - 6.7.2
  Created      : 2026-10-11
  Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Barcode PRN Script Library & DB Item Resolver
**Area:** Barcode Studio
**Version:** v6.7.1 (PRN Library) -> v6.7.2 (DB Resolver)
**Date:** 2026-10-11
**Commits:** cbed2a62 (v6.7.1), f00e6735 (v6.7.2)
**Author:** Jawahar Ramkripal Mallah

---

## 1. Purpose
Extend the PRN/ZPL Script Compiler Studio with two production capabilities:
1. **PRN Script Library** -- browse and one-click load any of the 14 real .prn/.blf label scripts from public/assets/prn/ into the editor.
2. **DB Item Resolver** -- search live Postgres inventory (GET /api/v1/inventory/search), pick a product, and auto-substitute all script placeholders ({barcode}, {size}, {colour}, {style_code}, {mrp}, {pkd_date}) with real values, then apply the resolved script to the editor for immediate dispatch.

---

## 2. Scope
| Area | Included |
|---|---|
| BarcodeScriptGenVi.tsx | YES -- Full: types, state, helpers, UI cards |
| GET /api/v1/inventory/search | YES -- Consumed (no backend changes needed) |
| public/assets/prn/ | YES -- 14 PRN/BLF files copied from assets/BarcodePRN/ |
| vitest barcode subset | 67/67 pass |
| vitest full suite | 1594/1594 pass |
| Backend changes | NONE required |
| New routes | NONE |

---

## 3. Files Created
| File | Purpose |
|---|---|
| public/assets/prn/TattlyThreads.prn | Tattly Threads ZPL label (6-placeholder) |
| public/assets/prn/TATTLY_BLACK_37.prn | Tattly Black size 37 |
| public/assets/prn/TATTLY_BLACK_40.prn | Tattly Black size 40 |
| public/assets/prn/TATTLY_TOUPE_37.prn | Tattly Taupe size 37 |
| public/assets/prn/TATTLY_TOUPE_42.prn | Tattly Taupe size 42 |
| public/assets/prn/TATTLY_CH-30-K_BLACK_37_CORRECTED.prn | CH-30-K corrected |
| public/assets/prn/TATTLY_SND-18-V_BLACK_37_CORRECTED.prn | SND-18-V corrected |
| public/assets/prn/smriti_labels_lay-footwear-100x50-3stub_*.prn | 3-stub footwear |
| public/assets/prn/RawPRNScript.prn | Raw PRN test script |
| public/assets/prn/Honeywell_IH2_Labels_*.prn (x2) | Honeywell IH2 layouts |
| public/assets/prn/smriti_barcodes_2026-10-08*.prn (x2) | SMRITI batch Oct-2026 |
| public/assets/prn/ModernLabelDesign_TE244.blf | TSC TE244 BLF label |
| docs/walkthrough/barcode/Barcode_PRNLibrary_DBResolver_v6.7.1-v6.7.2.md | This walkthrough |

> Note: public/assets/prn/ files are served by Vite static public/ directory.
> They cannot be staged by git add on the F:\ cloud-backup drive (filesystem deferred materialization).
> Files are present and readable at runtime via Vite dev server and production build.

---

## 4. Files Modified
| File | Change |
|---|---|
| src/components/barcode/BarcodeScriptGenVi.tsx | +391 lines across v6.7.1 and v6.7.2 |

### v6.7.1 -- PRN Library browser (+159 lines net)
- PRN_LIBRARY registry (12 entries: filename, label, language, description)
- libraryOpen / libraryLoading state
- loadLibraryScript() callback: fetch('/assets/prn/<filename>') -> set editor
- Collapsible PRN Library accordion card in right panel
- Auto-load TattlyThreads.prn on component mount
- Language colour badges: ZPL (blue) / DPL (orange) / BLF (purple) / PRN (grey)
- LOADED badge + CheckCircle2 icon on currently loaded script
- Removed unused ExternalLink import

### v6.7.2 -- DB item resolver (+232 lines net)
- New imports: Search, Database, Package, Eye, Tag, X (lucide-react)
- New types: DbItem interface, PlaceholderMap type
- New state: dbOpen, dbQuery, dbResults, dbSearching, selectedItem, resolvedScript, resolvedPreviewOpen
- searchDbItems(): GET /api/v1/inventory/search?q=<term>&limit=12
- resolveScript(): String.split().join() replacement for all 6 placeholder tokens
- handleSelectItem(): resolves immediately on item click, shows preview
- handleApplyResolvedToEditor(): writes resolved ZPL to editor, updates status
- Debounced search: 350ms setTimeout inside useEffect
- UI card: search input -> dropdown results -> resolved values chip -> dark ZPL preview -> Apply/Eye buttons

---

## 5. Architecture Decisions
### A. split/join substitution (not regex)
String.split(placeholder).join(value) chosen over replaceAll()/regex because
ZPL/PRN scripts contain regex metacharacters (^, [, {) making literal replacement safer.

### B. Read-only inventory search (no new backend code)
GET /api/v1/inventory/search already returns barcode, size, color, style_code, mrp.
Zero backend changes required.

### C. pkd_date from Date.toLocaleDateString("en-IN")
Packed date filled with today's date at resolution time, formatted as "11 Oct 2026".
Not stored in DB -- always current day at print time.

### D. Static PRN files via Vite public/
fetch('/assets/prn/<file>') at runtime. Avoids bundling into JS, allows hot-swap without rebuild.

---

## 6. Design Rationale
- Collapsible accordion cards keep right panel compact; library and DB resolver hidden by default.
- Emerald colour scheme for DB resolver card distinguishes it from blue Dispatch and purple Token Identification cards.
- Immediate resolution on item click (no extra Resolve button) reduces clicks: search -> click -> see values -> Apply -> Send.

---

## 7. Implementation Summary
### v6.7.1 steps
1. Read 14 PRN/BLF filenames from assets/BarcodePRN/
2. Wrote PRN_LIBRARY registry constant
3. Added libraryOpen/libraryLoading state + loadLibraryScript() fetch helper
4. Added auto-load useEffect for TattlyThreads.prn
5. Added accordion card UI in right panel (above Status Bar)
6. Removed unused ExternalLink import
7. TSC exit 0; commit cbed2a62

### v6.7.2 steps
1. Audited TattlyThreads.prn: 6 placeholders confirmed
2. Audited ProductResponse schema: all 6 fields present
3. Added DbItem interface + PlaceholderMap type
4. Added 7 new state variables
5. Implemented searchDbItems + debounce effect
6. Implemented resolveScript + handleSelectItem + handleApplyResolvedToEditor
7. Added DB resolver accordion card UI (above Status Bar, below PRN Library)
8. TSC exit 0; commit f00e6735

---

## 8. Tests Executed
| Suite | Command | Result |
|---|---|---|
| Barcode subset | npx vitest run src/tests/barcode* | 67/67 pass, exit 0 |
| Full suite (v6.7.1) | npx vitest run | 1594/1594 pass, exit 0 |
| Full suite (v6.7.2) | npx vitest run | 1594/1594 pass, exit 0 |
| TSC (v6.7.1) | npx tsc --noEmit | exit 0 |
| TSC (v6.7.2) | npx tsc --noEmit | exit 0 |

---

## 9. Verification Results
```
Commit cbed2a62 (v6.7.1 -- PRN Library):
  TSC: exit 0
  vitest full: 1594/1594 pass

Commit f00e6735 (v6.7.2 -- DB Resolver):
  TSC: exit 0
  vitest barcode: 67/67 pass
  vitest full:    1594/1594 pass
```

---

## 10. Known Limitations
1. public/assets/prn/ files cannot be committed to git on F:\ cloud drive (deferred materialization). Must be re-copied manually on new dev environments.
2. pkd_date is always today's date; no per-copy override option.
3. resolveScript() runs against current scriptContent -- manual edits before resolution will be reflected.
4. inventory/search returns up to 12 results; no pagination in dropdown.

---

## 11. Future Work
- Add copy-count field in DB resolver: resolve then print N copies with barcode increments.
- Persist last selected DB item in localStorage alongside last loaded PRN filename.
- Add git lfs or separate asset store for PRN library to solve cloud-drive staging.
- Allow overriding pkd_date per print job.

---

## 12. Related ADRs
- ADR-007: FastAPI + Postgres as sole backend system of record
- ADR-012: React 18 + Vite frontend architecture

---

## 13. Related RFCs
- RFC-BARCODE-001: Barcode Studio Direct Print Dispatch (v6.7.0)
- RFC-BARCODE-002: PRN Script Library & DB Resolver (v6.7.1-v6.7.2)
