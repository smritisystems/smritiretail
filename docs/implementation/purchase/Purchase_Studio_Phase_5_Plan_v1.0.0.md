<!--
  Project      : SMRITI Retail OS
  Repository   : SMRITIRetailNX
  Organization : AITDL NETWORKS

  Founders

  * Pushpa Devi Jawahar Mallah
    * Founder & Chairperson
    * Email: founder@aitdl.com

  * Jawahar Ramkripal Mallah
    * Founder, Chief Executive Officer (CEO) & Chief Software Architect
    * Email: founder@aitdl.com

  * Websites: aitdl.com | erpnbook.com | smritibooks.com

  * Version    : 1.0.0
  * Created    : 2026-09-30
  * Modified   : 2026-09-30
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Implementation Plan: Purchase Studio Phase 5 — Multi-Image Batch Drag-and-Drop & Auto-Binding by Filename

## 1. Objective
Empower retail procurement buyers and visual merchandisers to ingest dozens of article sample photos simultaneously by introducing:
1. **Multi-Image Batch Drag-and-Drop Zone:** Native drag-and-drop and multi-file picker in Purchase Studio.
2. **Automated Filename-to-Article/Color Matching Engine (`matchImageFilenameToLines`):** Pure mathematical string parser that matches file names (e.g. `FW-NK-9921_tan.jpg`, `OXF-990-black.png`, `SND-10001_Cherry Red.jpeg`) to existing PO lines and colorways.
3. **Concurrent SPIF WebP Batch Processing:** Automated pipeline uploading matched photos to `POST /api/v1/inventory/upload-image`, converting them to optimized WebP format, and persisting to server disk.
4. **Interactive Batch Review & Mapping Table:** Permitting buyers to review auto-matched articles, manually reassign unmatched photos, inspect thumbnails, and apply all image bindings in a single click.

## 2. Business Motivation
In wholesale footwear and fashion procurement, buyers routinely receive sample photo archives (often 20 to 100 images per seasonal line) from manufacturers and factory representatives. Manually clicking on each individual line item and opening a modal to upload one photo at a time is slow, tedious, and error-prone. Filenames provided by factories almost always contain the style/article code and color name (e.g., `SND-10001_Tan.jpg`). By automatically parsing these filenames, auto-detecting the target article and color, and processing the files through the SPIF WebP server engine in batch, SMRITI slashes merchandising setup time from 30 minutes to under 10 seconds.

## 3. Scope
1. **Filename Matching Engine (`matchImageFilenameToLines`):**
   - Pure, deterministic, exported algorithm in `PoSizewiseTab.tsx`.
   - Strips file extensions and punctuation delimiters (`_`, `-`, ` `, `.`).
   - Identifies exact composite matches (both Article and Color found), article-only matches, and unmapped fallbacks.
2. **Batch Upload Dialog & Dropzone:**
   - Visual drag-and-drop overlay and multi-file input triggered via `Add Multiple Images` button in `2. Images & Articles`.
   - Batch preview drawer displaying photo thumbnails, detected article/shade badges, confidence indicators, and target line selector.
   - Live progress indicator tracking queued, optimizing, and completed WebP transformations.
3. **Bulk State Synchronization:**
   - Single-click "Apply All Mappings" updating `lines[].imageUrl` and `articleImageMap` with server WebP endpoints (`/api/v1/inventory/images/spif-*.webp`).
4. **Automated Unit & E2E Testing:**
   - New unit tests in `src/tests/poSizewiseUX.test.ts` validating filename parsing heuristics.
   - Headless Playwright script verifying multi-file drag-and-drop and batch mapping.

## 4. Current State
- Phase 4 successfully implemented single-image upload through SPIF with WebP persistence.
- "Add Multiple Images" button was a stub pointing to the first populated line.
- Ingestion of multiple sample photos required repetitive row-by-row modal interactions.

## 5. Gap Analysis
- **Missing Bulk Ingestion:** No interface exists to drop 10+ images at once.
- **Missing Smart Heuristics:** No automated bridge exists between raw file names and PO line data.

## 6. Architecture Impact
- Reuses the canonical `POST /api/v1/inventory/upload-image` endpoint created in Phase 4.
- Zero backend database schema modifications required.
- Maintains strict frontend performance by executing file processing in asynchronous queues.

## 7. Proposed Design
```text
Buyer Drops Multiple Files (e.g. 10 sample photos)
    ↓
File List Read into Memory
    ↓
matchImageFilenameToLines(filename, lines)
    • Strip extension
    • Scan for line.articleNo & line.shade
    • Return confidence: "exact_composite" | "article_only" | "none"
    ↓
Batch Upload Modal Displays Review Table:
    [Thumb] [Filename] [Matched Article] [Matched Color] [Status]
    ↓
User clicks "Upload & Auto-Bind All"
    ↓
Concurrent SPIF WebP Pipeline:
    apiFetchV1("/inventory/upload-image", { image_data })
    ↓
Disk writes: static/uploads/spif-{uuid}.webp
    ↓
Update lines[].imageUrl & articleImageMap
    ↓
Lookbook cards & Landscape print vouchers reflect all photos instantly
```

## 8. Files Created
1. `docs/implementation/purchase/Purchase_Studio_Phase_5_Plan_v1.0.0.md` — This implementation plan.
2. `docs/walkthrough/purchase/Purchase_Studio_Phase_5_v1.0.0.md` — Architectural walkthrough document.
3. `docs/walkthrough/purchase/evidence/13_po_batch_upload_modal.png` — Visual evidence showing batch upload dialog with auto-matched filenames.
4. `docs/walkthrough/purchase/evidence/14_po_batch_uploaded_lookbook.png` — Visual evidence showing lookbook after batch auto-binding.

## 9. Files Modified
1. `src/components/purchase/PoSizewiseTab.tsx` — Batch upload modal, dropzone handlers, and `matchImageFilenameToLines` engine.
2. `src/tests/poSizewiseUX.test.ts` — Added unit tests for filename parsing heuristics and batch matching.
3. `scripts/capture_purchase_studio_headless.py` — Added automated headless multi-file upload step.
4. `docs/implementation/README.md` — Appended Phase 5 entry to master index.
5. `docs/walkthrough/README.md` — Appended Phase 5 walkthrough to master index.
6. `CHANGELOG.md` — Recorded Phase 5 capabilities under version 6.52.0.

## 10. Dependencies
- FastAPI + SPIF backend service (`POST /api/v1/inventory/upload-image`).
- Vitest for frontend unit tests.
- Playwright for headless visual proof.

## 11. Risks
- *Risk:* Overwhelming browser/server if 100+ files are uploaded simultaneously.
  *Mitigation:* Concurrency limiter (chunk size of 3 parallel uploads).
- *Risk:* Ambiguous filenames matching multiple articles.
  *Mitigation:* Clear visual badges and interactive dropdown allowing manual reassignment before applying.

## 12. Rollback Strategy
- Revert `PoSizewiseTab.tsx` to single image modal behavior.

## 13. Verification Plan
1. Vitest suite: `npx vitest run src/tests/poSizewiseUX.test.ts` (all green).
2. TypeScript check: `npx tsc --noEmit` (0 errors).
3. Headless Playwright capture: `python scripts/capture_purchase_studio_headless.py`.

## 14. Test Plan
- Unit tests for filename matching:
  - Exact composite with underscores (`FW-NK-9921_Tan.jpg`).
  - Exact composite with hyphens (`OXF-990-Black.png`).
  - Exact composite with spaces (`SND-10001 Cherry Red.jpeg`).
  - Article-only matching without color (`CH-19.jpg`).
  - Unmatched fallback (`random_photo.png`).
- Concurrency limiter and state synchronization tests.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
- Push to `smritiNX` branch.

## 17. Status
In Progress

## 18. Related ADRs
- ADR-0014: FastAPI Backend Sole System-of-Record
- ADR-0032: SPIF Media Processing & WebP Standardization

## 19. Related Walkthroughs
- `docs/walkthrough/purchase/Purchase_Studio_Phase_4_v1.0.0.md`
- `docs/walkthrough/purchase/Purchase_Studio_Phase_5_v1.0.0.md`
