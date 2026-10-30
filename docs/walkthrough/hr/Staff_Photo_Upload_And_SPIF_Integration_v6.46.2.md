<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 6.46.2
  Created      : 2026-09-29
  Modified     : 2026-09-29
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Staff Photo Upload, SPIF Optimization, and Identity Badge Integration

## 1. Purpose
This release provides end-to-end staff headshot photo management across SMRITI Retail OS. It replaces previous ad-hoc or uncompressed base64 data patterns with high-performance SPIF (SMRITI Product & Personnel Image Framework) WebP optimization, client-side downsampling, live image previews, and direct CR-80 PVC identity badge printing.

---

## 2. Scope
- **Backend API**:
  - `POST /api/v1/staff/directory/{user_id}/photo`: Receives image data, auto-orients via EXIF, converts to WebP with Lanczos downsampling via `SpifService`, persists clean relative URL into `staff_profiles.photo` and `users.photo`, and purges older local images.
  - `DELETE /api/v1/staff/directory/{user_id}/photo`: Safely purges local WebP file and clears photo reference in database.
  - `GET /api/v1/staff/photos/{filename}`: Static file serving for staff portraits with directory-traversal prevention.
- **Frontend Staff 360 Workspace (`StaffMasterWs.tsx`)**:
  - Live photo upload tile with camera/file picker in Edit Staff modal (`activeEditSubTab === "general"`).
  - Client-side `<canvas>` downsampling (maximum 500×500 px WebP) prior to transport to minimize network payload.
  - "Or paste URL" input for enterprise CDNs, intranet URLs, and cloud object storage (S3/GCS/R2).
  - Photo removal with automatic disk cleanup.
  - Enhanced **Identity** tab displaying headshot, WebP status badge, and direct "Change Photo" action.
  - Physical ID Card / Badge printing integration in `StaffPrintModal.tsx`.

---

## 3. Files Created
1. `backend/tests/test_staff_photo_upload.py`: Unit tests validating payload schema, SPIF processing, disk creation/cleanup, and router endpoint registration.
2. `docs/walkthrough/hr/Staff_Photo_Upload_And_SPIF_Integration_v6.46.2.md`: This governance walkthrough document.

---

## 4. Files Modified
1. `backend/app/api/v1/staff.py`:
   - Imported `os`, `FileResponse`, and `SpifService`.
   - Added `StaffPhotoPayload` schema.
   - Added `POST /directory/{user_id}/photo`, `DELETE /directory/{user_id}/photo`, and `GET /photos/{filename}` endpoints.
2. `src/components/staff/StaffMasterWs.tsx`:
   - Added `useRef`, `Camera`, `Trash2`, `Upload` icons from `lucide-react`.
   - Added `photoFileInputRef` and `photoUploading` state.
   - Initialized and managed `photo` in `editDraft`, `setEditDraft`, and `handleSave`.
   - Implemented `handlePhotoFileUpload` and `handleRemovePhoto`.
   - Integrated photo upload card in General Edit tab and enhanced Identity display card.

---

## 5. Architecture Decisions
1. **Lightweight Database References**: PostgreSQL tables (`staff_profiles` and `users`) store only concise URL paths (e.g. `/api/v1/staff/photos/spif-xxx.webp` or HTTPS CDN links) instead of multi-megabyte base64 strings.
2. **Dual-Tier Compression**:
   - Tier 1 (Client): HTML5 Canvas downsamples camera / smartphone uploads to 500×500 px.
   - Tier 2 (Server): `SpifService` applies EXIF orientation transpose, converts RGB channels, and compresses into optimized WebP.
3. **Storage Boundary Hygiene**: Avoids orphan images by automatically deleting old local files when a photo is updated or removed.

---

## 6. Design Rationale
A 12 MP camera photo can easily exceed 8 MB. Direct base64 storage would severely degrade database query throughput and memory usage during staff directory scans. Combining client-side canvas pre-scaling with backend SPIF WebP generation ensures all photos remain under 35 KB while maintaining sharp 300 DPI clarity for CR-80 physical identity card printing.

---

## 7. Implementation Summary
- **Client**: `src/components/staff/StaffMasterWs.tsx`
- **Server**: `backend/app/api/v1/staff.py`
- **Engine**: `backend/app/services/spif.py`
- **Testing**: `backend/tests/test_staff_photo_upload.py`

---

## 8. Tests Executed
1. `backend/tests/test_staff_photo_upload.py`: 3/3 passed in 7.37s.
2. `backend/tests/test_staff_storage_boundary.py`: 3/3 passed in 2.13s.
3. `npm run lint` (`tsc --noEmit`): 0 errors, clean exit code 0.
4. `npx vitest run`: 156 test files passed, 1094 tests passed in 43.29s.

---

## 9. Verification Results
All tests passed with zero failures. Type checking, database schema boundaries, and image conversion workflows verified.

---

## 10. Known Limitations
Local storage saves to `static/uploads/`. Multi-node container clusters without shared persistent volumes should configure enterprise S3/GCS buckets via the URL input.

---

## 11. Future Work
- Integration with live webcam streaming capture directly in browser.
- Batch photo import mapping employee codes to image files from a ZIP archive.

---

## 12. Related ADRs
- `ADR-0042`: Personnel Governance & Staff 360 Workspace Architecture
- `ADR-0056`: SPIF (SMRITI Product & Personnel Image Framework) Standards

---

## 13. Related RFCs
- `RFC-2026-08`: HR Master Data & CR-80 PVC ID Printing Specification
