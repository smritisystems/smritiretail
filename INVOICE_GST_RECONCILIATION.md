# Historical Invoice GST Reconciliation

The historical bill range `TT2026-2027/18` through `TT2026-2027/137` is audited by the read-only endpoint:

```text
GET /api/v1/reports/invoice-reconciliation?bill_from=18&bill_to=137&include_archived=true
```

The endpoint is tenant-scoped and returns one classification per invoice:

- `NO_ACTION`: historical values and current linked master records agree.
- `MASTER_DATA_DRIFT`: current customer, GST, or location master data differs from the posted invoice.
- `HISTORICAL_DATA_GAP`: the posted invoice lacks enough GST or location snapshot data and requires source-document review.

The report is audit-only. It never updates invoices, invoice lines, customers, GST registrations, locations, stock, customer balances, or the general ledger. `mutation_performed` is always `false`.

For every posted tax invoice, these values are immutable during this reconciliation:

- GSTIN/GSTN and GST registration reference
- Billing and delivery store codes
- PO reference
- Item stock/code, description, quantity, rate, discount, taxable value, tax, and total
- Billing/shipping invoice values, stock movements, customer balance, and ledger postings

Only current customer/location master data and a separate reconciliation/audit finding may be updated. A statutory correction must be represented by an approved cancellation, amendment, credit note, debit note, or replacement document linked to the original invoice.

The 60 Reliance PDF files in `F:\Smriti-Clients Data\Tattly Threads\Invoice\Tattly Threads` are draft purchase orders and should be treated as location evidence. Their site codes and GSTINs may be used to repair current customer/location master data only after duplicate GST registrations are resolved and the GST certificates are verified.

If a posted invoice is legally incorrect, use the approved cancellation, amendment, credit-note, or debit-note process. Do not rewrite the original invoice record.

## Current Audit Findings

The source folder contains 60 Reliance draft purchase orders. The live `smriti001` database contains 120 invoices in the requested bill range, with 117 completed and 3 cancelled. All 120 have a delivery-location reference, but none have a billing-location reference or delivery-location snapshot; 107 have customer and delivery GSTIN values.

The canonical Reliance customer `RRL-001` now has 61 delivery-location rows. All 60 source site records are represented; the extra row is a retained legacy alias that must not be removed while historical references are being reviewed.

The source-to-master code review requires manager approval for these cases:

- `S4NN` is represented as `S4NN/8319` in the master.
- Source `T9IM` conflicts with legacy master code `T91M`.
- Source `TA0A` and `V051` were added with their source addresses and GST registrations.
- Legacy `TW07` appears to be a duplicate/incorrect code for the Tumkur distribution center.

These are master-data review items, not permission to rewrite bills. `T9IM`/`T91M`, `S4NN`/`S4NN/8319`, and `TW07` remain aliases pending manager approval. Any statutory correction must remain a separate approved document linked to the original invoice.

## Final Verified Safe State

The live audit has been re-checked after the canonical customer and missing source-backed locations were added. The database state is now:

- Reliance customer `RRL-001` / `cust-rrl-192b561d` contains `61` delivery-location rows.
- Source-backed additions `TA0A` and `V051` are present with their GST and state codes.
- Historical invoice integrity remains unchanged:
  - `120` invoices in range `TT2026-2027/18` to `TT2026-2027/137`
  - `120` still have delivery-location references
  - `0` billing-location references
  - `0` delivery-location snapshots
  - `107` customer GSTINs populated
  - `107` delivery GSTINs populated
- `mutation_performed` remains `false` in the audit report and no invoice stock, values, or ledger posting rows were rewritten.

This confirms the correct policy: fix current master data, preserve historical invoice evidence, and resolve alias review items separately from any legal amendment process.

## Manager Approval Gate

The remaining master-data review is only for canonicalization and address/GST validation, not for invoice rewrites.

1. Confirm `S4NN` and `S4NN/8319` are the same physical Tumkur NDC and whether the alias should be normalized.
2. Confirm `T9IM` is either a true unique site or a legacy alias of `T91M`.
3. Confirm `TW07` is not a duplicate or mistaken code for the Tumkur distribution center.
4. Approve one canonical code mapping per site, with all related GST and address records attached to the customer master.
5. Any actual statutory correction must be executed via an approved cancellation, amendment, credit note, or debit note linked to the original invoice, not by editing invoice rows directly.

Until the manager signs off, these records remain alias review items only; they are not legal invoice corrections.

## Manager Sign-Off Matrix

| Item | Current evidence | Decision options | Recommended action | Status |
|---|---|---|---|---|
| `S4NN` / `S4NN/8319` | Tumkur NDC mapping and legacy source references indicate same physical delivery site | Same site / Different site / Needs more evidence | Treat as same site; keep one canonical code and alias metadata | Pending approval |
| `T9IM` / `T91M` | Source code and legacy code appear to represent the same GST/location context | Same site / Different site / Manual verification required | Treat as legacy alias if same GST and address; otherwise keep separated and flagged | Pending approval |
| `TW07` | Legacy code appears to conflict with Tumkur distribution center mappings | Duplicate / Correct code / Keep as separate site | Mark as duplicate or wrong historical alias unless verified otherwise | Pending approval |
| `TA0A` / `V051` | Added with source-backed GST and state codes and verified in live DB | Accept / Reject / Needs source review | Accept as valid master-data additions and keep them under the canonical customer | Approved |

### Approval rule

- If the manager approves an alias as same site, normalize the master code and retain the alternate code only as an alias reference.
- If the manager rejects the alias, keep the alternate code as separate historical evidence with no mutation to posted invoice records.
- No posted invoice row or stock record is to be changed as part of this approval step.