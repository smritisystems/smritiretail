# Change History Log

*Generated: Mon 08/17/2026*

- **Current Active Branch:** `smritiNX`
- **Last Commit Hash:** `79c23887`
- **Last Commit Message:** "fix(p0/p1): resolve all 5 test failures in gst_gateway, ecom_connectors, barcode suites"
- **Last Commit Author:** Jawahar Ramkripal Mallah (2026-08-17)

## 2026-08-17: TATTLY THREADS Tax Invoice Engine (Excel → FastAPI → PDF)
- **Scope**: Pixel-faithful statutory A4 Tax Invoice generation engine adhering to Golden Visual Authorities (TT2026-2027/72, TT2026-2027/73).
- **Batch Processing**: Ingested 30 SIS store sites from `RIL FINAL LIST.xlsx` and 1,221 lines (1,685 pairs) from `RIL_Dispatch_09-08-2026-2.xlsx`.
- **Company DB Persistence**: 30 invoices persisted in `smriti001` (TT2026-2027/74 through TT2026-2027/103) with frozen date `2026-08-14`.
- **Zero Control Plane Mutation**: Verified `smritisys` operational invoice count = 0.
- **Zero Item Grid Wrapping**: Confirmed `ITEM GRID TEXT WRAP = 0` across all 1,221 item rows.
- **Statutory Tax Calculations**: Aggregate invoice-level IGST formula implemented and verified for TT2026-2027/74, 75, 76.
- **Test Baseline**: 358 / 358 automated tests passing (186 `app/tests/` + 172 `tests/`).

