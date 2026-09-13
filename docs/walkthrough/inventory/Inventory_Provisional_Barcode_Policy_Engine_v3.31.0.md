<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.31.0
  Created      : 2026-09-14
  Modified     : 2026-09-14
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# Walkthrough: Policy-Aware Provisional Barcode Generation & UI Alignment (v3.31.0)

## 1. Purpose
Establish an authoritative, policy-governed architecture for provisional/placeholder barcodes across SMRITI Retail OS. Retire rogue pseudo-EAN (`890...`) client-side generation, ensuring all provisional barcodes default to the canonical uppercase `S` prefix with configurable overrides (`GEN`, `SKU`, `SMRITI`, `VX`, `BRC`, or explicit bare tokens).

## 2. Scope
- **Backend Service Layer (`item_master_svc.py`)**: Evolve `generate_placeholder_barcode` into a policy-aware generator supporting configurable prefixes, explicit bare tokens, uppercase normalization, and character sanitization. Wire direct-parameter barcode assignment symmetry in `create_item`.
- **Backend API Gateway (`barcodes.py`)**: Expose `/api/v1/barcodes/placeholder` for client consumption.
- **Frontend Service Layer (`barcodePlaceholderService.ts`)**: Authoritative fetcher via `apiFetchV1` with local fallback generator mirroring backend policy.
- **Frontend Dialogs & Workspaces (`CodeSelectDlg.tsx`, `ItemDetailsGrid.tsx`)**: Retire `890...` fake EAN generation; provide UI controls for barcode prefix presets and bare token selection; use `generatePlaceholderBarcode("S")` for row duplication.
- **Automated Test Suites**: Pytest backend verification suite and Vitest frontend suite.

## 3. Files Created
- `src/services/barcodePlaceholderService.ts`: Core client service implementing policy contract, preset definitions, synchronous fallback generator, and async authoritative fetch.
- `src/tests/barcodePlaceholderService.test.ts`: Vitest test suite covering 10 policy, prefix, sanitization, and fallback scenarios.

## 4. Files Modified
- `backend/app/services/item_master_svc.py`: Implemented policy-aware `generate_placeholder_barcode(prefix="S", allow_no_prefix=True)` and direct-parameter fallback.
- `backend/app/api/v1/barcodes.py`: Added `GET /api/v1/barcodes/placeholder` endpoint.
- `backend/tests/t_item_master.py`: Added policy unit tests for default prefix, configurable prefixes, bare tokens, and sanitization.
- `src/components/itemMaster/CodeSelectDlg.tsx`: Replaced hardcoded `890...` pseudo-EAN with policy generator, updated UI labels, and added prefix configuration presets.
- `src/components/itemMaster/ItemDetailsGrid.tsx`: Replaced row duplication `890...` generation with `generatePlaceholderBarcode("S")`.

## 5. Architecture Decisions
- **Service Ownership of Barcode Identity**: Barcodes are identity artifacts governed by backend policy. The browser must never synthesize random pseudo-EAN (`890...`) numbers that impersonate statutory GS1 barcodes.
- **Canonical Default**: The canonical fallback is uppercase `S` + 12 uppercase hexadecimal characters (`S8A7F3D1B2C4E`), ensuring immediate distinction from GS1/EAN barcodes while remaining compatible with standard Code 128 / Code 39 scanners.
- **Explicit vs Accidental Bare Tokens**: Bare tokens (no prefix) are allowed only when explicitly requested (`allow_no_prefix=True` and `prefix=""` or `None`). When `allow_no_prefix=False`, an empty prefix falls back to `"S"`.
- **Immutability & Audit Trail**: Provisional placeholder barcodes are immutable once attached to an item. Replacement by statutory manufacturer barcodes must occur through auditable supersession events.

## 6. Design Rationale
Previously, `CodeSelectDlg.tsx` and `ItemDetailsGrid.tsx` generated fake `890${...}` numbers simulating GS1 India barcodes. This created operational risk in retail stores:
1. Fake EAN numbers could collide with actual manufacturer barcodes.
2. Store scanners and inventory auditors could not distinguish between items lacking physical barcodes and items with scanned manufacturer codes.
3. Decoupling the prefix policy allows tenant-specific conventions (`GEN`, `SMRITI`, `SKU`) while preserving `S` as the canonical default.

## 7. Implementation Summary
1. **Backend Generator Contract**:
   ```python
   @classmethod
   def generate_placeholder_barcode(
       cls,
       prefix: Optional[str] = "S",
       allow_no_prefix: bool = True,
   ) -> str:
       raw_token = uuid.uuid4().hex[:12].upper()
       if prefix is None or (isinstance(prefix, str) and not prefix.strip()):
           return raw_token if allow_no_prefix else f"S{raw_token}"
       clean_pfx = re.sub(r"[^A-Za-z0-9_-]", "", str(prefix).strip()).upper()
       if not clean_pfx:
           return raw_token if allow_no_prefix else f"S{raw_token}"
       return f"{clean_pfx}{raw_token}"
   ```
2. **Frontend UI Integration**:
   - `CodeSelectDlg.tsx` displays "Placeholder Barcode (Provisional)" with a "Service Policy" badge.
   - Quick preset buttons provide one-click selection for `S (Default)`, `GEN`, `SKU`, `SMRITI`, `VX`, `BRC`, and `None (Bare Token)`.
   - Operators can also enter a custom prefix.

## 8. Tests Executed
- `python -m pytest tests/t_item_master.py -k placeholder -v`
- `npx vitest run src/tests/barcodePlaceholderService.test.ts`
- `npx tsc --noEmit`
- `npm run build`

## 9. Verification Results
- **Pytest**: 2/2 tests passed in 8.44s.
- **Vitest**: 10/10 tests passed in 16ms (total run 1.13s).
- **TypeScript**: 0 errors (`tsc --noEmit` exited with code 0).
- **Vite Build**: 3,534 modules transformed, bundle built cleanly in 35.47s.

## 10. Known Limitations
- Barcode supersession workflow (promoting a placeholder to a statutory EAN-13 upon delivery verification) currently updates `barcode` directly; full event-sourced supersession ledger will be integrated in Phase 3.

## 11. Future Work
- Implement statutory barcode supersession audit event log (`ItemBarcodeSupersessionEvent`).
- Add tenant-level configuration profile in `StorePolicyStudio` to configure default placeholder prefix per company/store.

## 12. Related ADRs
- `ADR-0045`: Item Master Identity & Provisional Barcode Governance
- `ADR-0046`: Canonical Backend System of Record & Express Retirement

## 13. Related RFCs
- `RFC-2026-08`: Policy-Governed Barcode Generation Engine
