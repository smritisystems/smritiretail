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
  * Modified     : 2026-09-30
  * Copyright  : © SMRITIBooks.com. All Rights Reserved.
  * License    : Proprietary Commercial Software
  * Classification: Internal
-->

# Implementation Plan: Purchase Studio Phase 4 — Backend SPIF Image Upload & WebP Persistence

## 1. Objective
Eliminate bulky in-memory base64 data URLs in Purchase Studio by integrating the backend SPIF (`SpifService`) image processing engine. When users upload article sample photographs during Purchase Order creation, images are optimized, transposed, converted to high-efficiency WebP format, persisted to disk (`static/uploads/spif-{uuid}.webp`), and served cleanly via `/api/v1/inventory/images/{filename}`.

## 2. Business Motivation
In wholesale footwear and fashion buying, merchandisers take photos of physical samples, swatches, and soles using studio cameras or phones. Inline base64 strings easily reach 2MB–10MB per line item, causing PO payload bloat, slower save operations, database bloat, and poor print rendering performance. By converting uploaded photos on-the-fly into optimized WebP images (under 60KB each, an over 99% footprint reduction), SMRITI guarantees fast, scalable, and permanent media storage while maintaining visual fidelity across digital lookbooks and statutory landscape printouts.

## 3. Scope
1. **FastAPI Backend Endpoint:**
   - Add `POST /api/v1/inventory/upload-image` endpoint to accept standalone base64 image data from authenticated users.
   - Utilize `SpifService.process_and_save_base64_image` with Pillow Lanczos resampling, EXIF auto-transposition, RGB normalization, and 80% quality WebP compression.
   - Provide multi-path fallback in `SpifService.get_image_path` to seamlessly support Docker bind-mounts and host environments.
2. **Frontend UI Integration (`PoSizewiseTab.tsx`):**
   - Replace direct raw base64 assignment with an asynchronous `apiFetchV1("/inventory/upload-image")` call.
   - Introduce live upload states: loading spinner with "Optimizing WebP...", verified server persistence badge (`✓ Persisted Server WebP`), and offline fallback handling.
   - Bind clean server URLs (`/api/v1/inventory/images/spif-xxx.webp`) across line items and composite keys.
3. **Automated Verification:**
   - Backend unit tests (`test_inventory_image_upload.py`) verifying router registration and disk persistence.
   - Vitest suite (`poSizewiseUX.test.ts`) validating URL resolution and payload reduction metrics.
   - Headless Playwright script verifying upload, toast feedback, and card lookbook rendering without opening physical browser windows.

## 4. Current State
- Phase 3 introduced the Lookbook tab and article image modal, but relied on client-side FileReader base64 strings.
- `inventory.py` only permitted image uploads attached to pre-existing `product_id` records (`POST /{product_id}/image`), which was incompatible with new sample articles in draft POs.

## 5. Gap Analysis
- **Missing General Upload Endpoint:** No standalone route existed for PO draft photo uploads.
- **Storage Disconnect:** Without server persistence, closing the browser or exporting the PO payload could result in massive JSON dumps or transient memory loss.

## 6. Architecture Impact
- Enforces SMRITI Backend System-of-Record Policy (FastAPI + Postgres canonical backend).
- Integrates SPIF (Single Point Image Factory) standard across procurement workflows.
- Retains zero breaking changes to existing PO schema: `imageUrl` and `photoUrl` strings simply store standardized relative endpoints.

## 7. Proposed Design
```text
Browser User Uploads Image (Local File)
    ↓
FileReader reads base64 dataUrl
    ↓ (Async POST /api/v1/inventory/upload-image)
FastAPI Backend (app/api/v1/inventory.py)
    ↓
SpifService.process_and_save_base64_image
    • Strip data header & b64decode
    • Pillow EXIF orientation transpose
    • Convert RGBA/P to RGB with white background
    • Lanczos thumbnail resize (max 1024x1024)
    • Save to static/uploads/spif-{uuid}.webp (quality 80)
    ↓
Return JSON: { filename, url: "/api/v1/inventory/images/...", relative_url }
    ↓
Frontend updates modal state & displays "✓ Persisted Server WebP"
    ↓
Save & Apply binds clean URL to PO lines & lookbook cards
```

## 8. Files Created
1. `backend/tests/test_inventory_image_upload.py` — Pytest unit tests for inventory image upload and SPIF WebP processing.
2. `docs/walkthrough/purchase/evidence/sample_shoe_upload.png` — Standard test asset for automated headless upload runs.
3. `docs/walkthrough/purchase/evidence/10b_po_image_uploaded_spif_webp.png` — Headless capture of SPIF upload modal with server WebP badge.
4. `docs/walkthrough/purchase/evidence/10c_po_image_applied_lookbook.png` — Headless capture of Lookbook displaying persisted server WebP photo.
5. `docs/implementation/purchase/Purchase_Studio_Phase_4_Plan_v1.0.0.md` — This implementation plan.
6. `docs/walkthrough/purchase/Purchase_Studio_Phase_4_v1.0.0.md` — Architectural walkthrough document.

## 9. Files Modified
1. `backend/app/services/spif.py` — Storage directory auto-detection and multi-environment path resolution.
2. `backend/app/api/v1/inventory.py` — Registered `POST /upload-image` endpoint with `get_current_user` dependency.
3. `src/components/purchase/PoSizewiseTab.tsx` — Asynchronous SPIF upload integration, progress indicators, and status badges.
4. `src/tests/poSizewiseUX.test.ts` — Added tests 29 and 30 for SPIF URL resolution and payload footprint optimization.
5. `scripts/capture_purchase_studio_headless.py` — Extended headless capture pipeline to upload sample photo and capture Steps 10b/10c.
6. `docs/implementation/README.md` — Appended Phase 4 entry to master index.
7. `docs/walkthrough/README.md` — Appended Phase 4 walkthrough to master index.
8. `CHANGELOG.md` — Recorded Phase 4 capabilities under version 6.50.0.

## 10. Dependencies
- Pillow (PIL) for image manipulation.
- FastAPI + Uvicorn/Gunicorn.
- Playwright for headless visual verification.
- Vitest for frontend TypeScript unit testing.

## 11. Risks
- *Risk:* Network latency or upload failure on slow connections.
  *Mitigation:* Local dataUrl fallback ensures user is never blocked even if backend is offline.
- *Risk:* Disk exhaustion from uploaded photos.
  *Mitigation:* Lanczos resize to 1024px and WebP 80% compression limits file sizes to ~40KB–80KB per photo.

## 12. Rollback Strategy
- Revert `PoSizewiseTab.tsx` to FileReader synchronous data URL assignment.
- Remove `POST /upload-image` endpoint from `inventory.py`.

## 13. Verification Plan
1. Standalone test execution: `docker exec -e PYTHONPATH=/app smriti-api python /workspace/backend/tests/test_inventory_image_upload.py`.
2. Frontend unit tests: `npx vitest run src/tests/poSizewiseUX.test.ts` (30/30 green).
3. TypeScript validation: `npx tsc --noEmit` (0 errors).
4. Headless visual proof: `python scripts/capture_purchase_studio_headless.py` capturing 10b and 10c screenshots.

## 14. Test Plan
- Unit tests for route registration and HTTP response codes.
- Disk verification ensuring `.webp` file exists and is non-empty.
- Invariant tests verifying payload size reduction > 99%.

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

## 16. Deployment Plan
- Push code changes to `smritiNX` branch.
- Docker containers auto-mount `backend/app`; restart `smriti-api` to apply.

## 17. Status
Completed

## 18. Related ADRs
- ADR-0014: FastAPI Backend Sole System-of-Record
- ADR-0032: SPIF Media Processing & WebP Standardization

## 19. Related Walkthroughs
- `docs/walkthrough/purchase/Purchase_Studio_Phase_3_v1.0.0.md`
- `docs/walkthrough/purchase/Purchase_Studio_Phase_4_v1.0.0.md`
