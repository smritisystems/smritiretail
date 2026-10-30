<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 1.0.0
  Created      : 2026-09-30
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Implementation Plan: Purchase Studio Phase 6 — Client-Side Canvas Pre-Downscaling & Exif Auto-Rotation before SPIF Upload

**Status:** In Progress  
**Version:** 1.0.0  
**Date:** 2026-09-30  
**Capability:** `@SmritiCapability("PURCHASE", "PO_SIZEWISE_ENTRY")`  
**Area:** Purchase / Procurement  

---

## 1. Objective
Eliminate retail network bottlenecks, HTTP 413 payload rejections, and browser memory spikes when buyers ingest massive smartphone or DSLR sample photos (8MB–25MB+, 48MP–108MP) into Purchase Studio. Implement an ultra-fast client-side HTML5 Canvas pre-downscaling engine that compresses images to web-optimized dimensions (max 1600px, 85% quality) in browser memory before network transmission to the SPIF backend (`POST /api/v1/inventory/upload-image`).

---

## 2. Business Motivation
Footwear and apparel purchasers take high-resolution sample photos using modern smartphones (iPhone 15/16 Pro, Samsung S24 Ultra) with camera resolutions between 48MP and 108MP. Uploading a batch of 20 uncompressed raw photos:
- Generates over 300MB of raw image data (~400MB base64 JSON payload).
- Causes extreme latency (several minutes) on retail store cellular or Wi-Fi networks.
- Triggers HTTP 413 (Payload Too Large) or gateway timeouts on standard proxies.
- Can crash browser tabs due to multi-hundred megabyte base64 string allocations in V8 JavaScript memory.

By pre-downscaling images on the client device using hardware-accelerated Canvas 2D rendering:
- File sizes shrink from 15MB to ~200KB (>98% network payload reduction) in <100ms.
- 20 images transmit in under 3 seconds instead of 3 minutes.
- The server SPIF service receives already manageable payloads, minimizing backend CPU spikes during Lanczos WebP conversion.

---

## 3. Scope
1. **Pure Math & Canvas Downscaler Utility (`downscaleImageClientSide`):**
   - Calculate target bounding dimensions preserving exact aspect ratio up to `maxDimension = 1600px`.
   - Skip downscaling if image is already smaller than the bounding box.
   - Render to offscreen canvas with smooth image smoothing (`imageSmoothingQuality = "high"`).
   - Export optimized image as WebP (or JPEG fallback) at 85% quality.
   - Return metrics: `originalSize`, `compressedSize`, `compressionRatio`, and `dataUrl`.
2. **Integration into Single-Image Upload Flow:**
   - In `PoSizewiseTab.tsx`'s single-image modal, pass raw files through `downscaleImageClientSide` before calling `apiFetchV1`.
   - Display real-time compression pill: e.g. `12.4 MB → 215 KB (98.3% saved)`.
3. **Integration into Multi-Image Batch Queue Flow:**
   - In `handleExecuteBatchUpload`, execute client-side downscaling inside the worker pool prior to dispatching HTTP requests.
   - Display live pre-compression metrics in the Batch Review Modal status column.
4. **Unit Tests in `src/tests/poSizewiseUX.test.ts`:**
   - Tests validating bounding box aspect ratio calculations (`calculateAspectRatioFit`).
   - Tests validating compression ratio metrics and format determination.
   - Tests validating defensive fallbacks for non-image or already tiny files.
5. **Headless Playwright Visual Verification:**
   - Capture evidence of compression metrics in action without opening any physical browser windows.

---

## 4. Current State
- Phase 5 implemented batch drag-and-drop ingestion with heuristic filename matching.
- Files are read as raw base64 data URLs via `FileReader.readAsDataURL` and transmitted directly to `/api/v1/inventory/upload-image`.
- Large images (15MB+) result in large JSON payloads transmitted over the wire before server-side SPIF downscaling.

---

## 5. Gap Analysis
- **Missing Client-Side Pre-Compression:** Network payload size equals full raw camera file size.
- **Memory Overhead:** Holding 20 uncompressed 15MB base64 strings in browser state consumes >400MB of RAM.

---

## 6. Architecture Impact
```text
[Raw Camera Photo: 15 MB, 8000x6000]
         ↓
Browser Memory (HTML5 Canvas 2D)
downscaleImageClientSide(file, { maxDimension: 1600, quality: 0.85 })
         ↓
[Optimized Client WebP/JPEG: ~220 KB, 1600x1200] (>98% Reduction)
         ↓
POST /api/v1/inventory/upload-image (Fast ~150ms HTTP transfer)
         ↓
Server SPIF WebP Storage: static/uploads/spif-{uuid}.webp
```
- Zero database changes.
- Zero breaking API changes to `/api/v1/inventory/upload-image`.
- Network bandwidth reduced by 98% per upload.

---

## 7. Proposed Design

### Function Signature
```typescript
export interface ClientDownscaleResult {
  dataUrl: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  reductionPercentage: number;
  width: number;
  height: number;
}

export function calculateAspectRatioFit(
  srcWidth: number,
  srcHeight: number,
  maxDimension: number
): { width: number; height: number }

export async function downscaleImageClientSide(
  file: File | Blob,
  maxDimension?: number,
  quality?: number
): Promise<ClientDownscaleResult>
```

---

## 8. Files Created
1. `docs/implementation/purchase/Purchase_Studio_Phase_6_Plan_v1.0.0.md` — This implementation plan.
2. `docs/walkthrough/purchase/Purchase_Studio_Phase_6_v1.0.0.md` — Architectural walkthrough document.
3. `docs/walkthrough/purchase/evidence/15_po_client_downscaled_upload.png` — Visual evidence showing client downscaling telemetry.

---

## 9. Files Modified
1. `src/components/purchase/PoSizewiseTab.tsx` — Client-side canvas downscaler, telemetry display, and upload flow integration.
2. `src/tests/poSizewiseUX.test.ts` — Added unit tests for canvas dimension calculations and compression metrics.
3. `scripts/capture_purchase_studio_headless.py` — Added automated headless verification step for downscaling telemetry.
4. `docs/implementation/README.md` — Appended Phase 6 to master index.
5. `docs/walkthrough/README.md` — Appended Phase 6 to master index.
6. `CHANGELOG.md` — Recorded Phase 6 features under version `6.53.0`.

---

## 10. Dependencies
- Native browser `HTMLCanvasElement`, `Image`, and `FileReader`.
- FastAPI + SPIF backend service (`POST /api/v1/inventory/upload-image`).
- Vitest for mathematical unit tests.
- Playwright for headless visual proof.

---

## 11. Risks
- *Risk:* Browser security restrictions or corrupted image files causing canvas failures.
  *Mitigation:* Wrapped in robust `try...catch` with automatic fallback to original file raw base64.
- *Risk:* Animated GIFs losing animation frames if drawn to canvas.
  *Mitigation:* Bypass canvas downscaling for `image/gif` and SVGs, preserving original asset.

---

## 12. Rollback Strategy
- Bypass canvas downscaling step and directly read original file via `FileReader.readAsDataURL(file)`.

---

## 13. Verification Plan
1. Vitest suite: `npx vitest run src/tests/poSizewiseUX.test.ts` (all green).
2. TypeScript check: `npx tsc --noEmit` (0 errors).
3. Headless Playwright capture: `python scripts/capture_purchase_studio_headless.py`.

---

## 14. Test Plan
- Unit tests:
  - Downscaling down from 4000×3000 to max 1600: expects 1600×1200.
  - Bypassing smaller image (800×600 with max 1600): retains 800×600.
  - Portrait orientation (3000×4000): expects 1200×1600.
  - Square orientation (3000×3000): expects 1600×1600.
  - Compression ratio mathematical formula verification.
- Headless verification:
  - Capture modal with downscaling badge and verify seamless SPIF server persistence.

---

## 15. Documentation Impact
- Update `docs/implementation/README.md`.
- Update `docs/walkthrough/README.md`.
- Update `CHANGELOG.md`.

---

## 16. Deployment Plan
- Commit and push to `smritiNX` branch.

---

## 17. Status
In Progress

---

## 18. Related ADRs
- `ADR-0014: FastAPI Backend Sole System-of-Record`
- `ADR-0032: SPIF Media Processing & WebP Standardization`
- `ADR-PS5-02: Bounded Concurrency Worker Pool`

---

## 19. Related Walkthroughs
- `docs/walkthrough/purchase/Purchase_Studio_Phase_4_v1.0.0.md`
- `docs/walkthrough/purchase/Purchase_Studio_Phase_5_v1.0.0.md`
- `docs/walkthrough/purchase/Purchase_Studio_Phase_6_v1.0.0.md`
