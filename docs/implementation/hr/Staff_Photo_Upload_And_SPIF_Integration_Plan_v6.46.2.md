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

# Implementation Plan: Staff Photo Upload, SPIF Optimization, and ID Badge Integration

## 1. Objective
Enable direct staff portrait photo uploads, client-side downsampling, SPIF WebP generation, and CR-80 PVC physical ID badge rendering across the Staff 360 Workspace without bloating PostgreSQL database backups.

---

## 2. Business Motivation
Store managers and HR administrators require high-quality photographic verification on staff badges and the Staff 360 Workspace for store security, role validation, and attendance tracking. Uncompressed base64 uploads cause massive database bloat and API latency; this architecture guarantees lightweight storage (< 35 KB per headshot) and instant loading.

---

## 3. Scope
- Backend API endpoints in `backend/app/api/v1/staff.py`:
  - `POST /api/v1/staff/directory/{user_id}/photo`
  - `DELETE /api/v1/staff/directory/{user_id}/photo`
  - `GET /api/v1/staff/photos/{filename}`
- Image processing via `backend/app/services/spif.py` (`SpifService`).
- Frontend Staff 360 Workspace in `src/components/staff/StaffMasterWs.tsx`.
- Physical ID Badge rendering integration in `src/components/staff/StaffPrintModal.tsx`.

---

## 4. Current State
Staff identity cards and badges had placeholder display code, but the Staff Edit modal lacked any file picker or photo upload interface. Line 290 of `StaffMasterWs.tsx` suppressed `data:` URIs due to lack of a standardized object storage pipeline.

---

## 5. Gap Analysis
1. Missing upload and delete endpoints in `staff.py`.
2. Missing file picker and photo preview card in `StaffMasterWs.tsx`.
3. Inability for operators to upload local files or paste external image URLs directly into staff profiles.

---

## 6. Architecture Impact
Zero database migration required. Both `staff_profiles.photo` and `users.photo` are existing `TEXT` columns. They now store standardized relative URL references (`/api/v1/staff/photos/spif-xxx.webp`) or external CDN URLs.

---

## 7. Proposed Design
1. **Client-Side**: Pre-downsample images to 500×500 px WebP via HTML5 Canvas.
2. **Server-Side**: Transpose EXIF orientation, convert RGB channels, and save as optimized `.webp` in `static/uploads/`.
3. **Serving**: Safe file response with directory-traversal prevention via `os.path.basename`.

---

## 8. Files Created
1. `backend/tests/test_staff_photo_upload.py`
2. `docs/walkthrough/hr/Staff_Photo_Upload_And_SPIF_Integration_v6.46.2.md`
3. `docs/implementation/hr/Staff_Photo_Upload_And_SPIF_Integration_Plan_v6.46.2.md`

---

## 9. Files Modified
1. `backend/app/api/v1/staff.py`
2. `src/components/staff/StaffMasterWs.tsx`
3. `docs/walkthrough/README.md`
4. `docs/implementation/README.md`
5. `CHANGELOG.md`

---

## 10. Dependencies
- Python `Pillow` (PIL) for image transcoding.
- `fastapi.responses.FileResponse` for static streaming.
- `lucide-react` icons (`Camera`, `Upload`, `Trash2`).

---

## 11. Risks
- *Risk*: Orphan image files on server storage.
  *Mitigation*: Handlers explicitly call `SpifService.delete_image_file` when replacing or deleting existing photos.

---

## 12. Rollback Strategy
Git revert commits on `backend/app/api/v1/staff.py` and `src/components/staff/StaffMasterWs.tsx`. Existing database columns remain untouched.

---

## 13. Verification Plan
- Unit tests validating Pydantic schemas, SPIF WebP file creation, and route registration.
- Boundary test checking tenant isolation.
- TypeScript compiler zero-error audit.
- Full Vitest test suite execution.

---

## 14. Test Plan
- `backend/tests/test_staff_photo_upload.py`: Verify 1×1 test image encoding and cleanup.
- `npm run lint`: Verify JSX and component typing.
- `npx vitest run`: Verify no regression across core test suites.

---

## 15. Documentation Impact
Walkthrough created and appended to `docs/walkthrough/README.md`. Implementation plan indexed in `docs/implementation/README.md`.

---

## 16. Deployment Plan
Sync via standard `git pull` on deployment targets. Ensure `static/uploads` directory has write permissions.

---

## 17. Status
**Completed**

---

## 18. Related ADRs
- `ADR-0042`: Personnel Governance & Staff 360 Workspace Architecture
- `ADR-0056`: SPIF (SMRITI Product & Personnel Image Framework) Standards

---

## 19. Related Walkthroughs
- `docs/walkthrough/hr/Staff_Photo_Upload_And_SPIF_Integration_v6.46.2.md`
