# SMRITI Retail OS — Duplication and Gaps

**Audit date:** 2026-10-23  
**Scope:** Static review. No consolidation, fixes, migrations, database queries, or application tests were run.

## Evidence

### Duplicated or overlapping billing surfaces

| Finding | Evidence | Interpretation |
|---|---|---|
| Multiple retail/desktop invoice entry points | `src/components/billing/BillingWorkspace.tsx`, `BillingTerm.tsx`, `SmritiBillingStudio.tsx`, `SmritiCreditBillingTerminal.tsx`, `src/components/standalone/StandaloneWindowView.tsx` | More than one UI can represent a billing flow. Which surfaces are active per template and whether they share identical calculations were not established. |
| Different suspension/offline behavior | `BillingTerm.tsx` contains local suspension fallback; `SmritiBillingStudio.tsx` calls `ProPosOfflineSyncEngine`; credit terminal preview uses temporary draft totals when backend preview is offline | These are separate fallback paths. Financial parity, replay semantics, and whether fallbacks can be used to complete a sale require safe tests. |
| API prefix aliases | `backend/app/main.py` mounts the sales router at `/sales-invoices`, `/sales`, `/tattly`; purchase/vendor and other routers are mounted at multiple prefixes; some entries are explicitly labeled legacy | Compatibility aliases may be intentional, but they expand test/permission/documentation scope and risk multiple interfaces to the same business operation. |
| Multiple inventory/product identity APIs | `inventory.py`, `product_identity.py`, `product_resolution.py`, `item_domain.py`, `barcode.py`, `barcodes.py`, `barcode_registry.py`; frontend uses product, SKU, barcode, variant fields | Canonical item/barcode identity exists as a stated goal but the complete write-path contract has not been compared end-to-end. |

### Integration gaps and unresolved capabilities

- **Frontend to API:** `src/lib/apiFetchV1.ts` is the documented common caller, and `src/App.tsx` calls POS profiles/shifts and inventory. Not every module’s UI calls were traced to a matching route; no contract test or live route call was run.
- **Feature configuration:** core cutover flags `USE_FASTAPI_SALES`, `USE_FASTAPI_PURCHASE`, `USE_FASTAPI_POS`, and `USE_MULTI_DB_ROUTER` default false in `backend/app/core/config.py`. Their usages are limited in the inspected source. The relationship between flags, actual frontend selection, and provisioned module manifests remains unclear.
- **Template registry:** backend capability/module registry and frontend navigation/menu registries exist, but a single verified manifest that selects modules by distributor/retail/hybrid template was not established.
- **Offline processing:** durable queue model `POSOfflineSyncQueue`, sync routes, and frontend offline queue usage exist. No deterministic replay, idempotency, conflict-resolution, or retry runtime evidence was gathered.
- **Sales-to-stock-to-payment-to-GL:** code exposes canonical sales writer, stock ledger authority, payment allocation, and accounting services. There is no observed end-to-end commit/rollback test result in this audit.
- **Wholesale/dealer:** distribution, customer PO, dealer/customer and purchase APIs exist. Trade price lists/slabs, dealer credit, collections, wholesale schemes, and channel permissions are not shown as one verified workflow.
- **Retail close/day-end:** shift model fields and POS routes exist. Cash close/variance calculations and day-end report reconciliation were not exercised.
- **E-commerce/integrations:** route/model scaffolding exists; external channel synchronization and real gateway behavior were not verified.
- **AI/forecast:** project instructions explicitly say this remains scaffolding until real transactional Postgres volume exists. Classify as placeholder for product claims.
- **Schema drift:** models and migration files provide intended structure only. The workspace has an existing modified migration `v1541_triage_quarantine_items.py`; later migrations exist. A live revision and full column/type/null/default/key/index/FK comparison were not performed.
- **Test gaps:** there are substantial test directories/configuration, including DB integration markers, but this audit did not execute tests. No claim is made that tests pass or fail.

### Schema and ledger review

Static code declares `Product.stock` a cached aggregate and `stock_movements`/`product_batch_stocks` authoritative in `backend/app/models/inventory.py` and `backend/app/services/sales_stock_authority.py`. This is a good authority statement in source, but the synchronization job and deployed values were not verified. `PaymentTransaction` and `PaymentAllocation` models exist; invoice allocations lack a declared FK in that model snippet and use generic `invoice_id`, so referential enforcement must be compared against the complete migration contract before relying on it. No schema drift is asserted from that static snippet alone.

## Prioritized findings

### P0 — Compose secrets fall back to fixed literals

**Evidence:** `docker-compose.yml` provides literal defaults for `JWT_SECRET_KEY`, `INTERNAL_SERVICE_KEY`, and `SGIP_VAULT_MASTER_KEY`.  
**Interpretation:** A deployment using the standard compose file without overriding those variables uses predictable credentials from source. That is a security risk; active deployment use was not checked.  
**Recommendation:** Require runtime-provided secrets and reject startup when absent before using this compose profile with real accounts/data.

### P2 — Billing overlap without verified parity

**Evidence:** Five billing/standalone UI surfaces and sales/POS/billing API groups coexist, with distinct local/offline/preview fallback behavior.  
**Interpretation:** Provisioning a new template without selecting one canonical behavior risks divergent pricing, tax, payment, or persistence behavior. Divergence is not proven, so this is P2 rather than a confirmed financial failure.  
**Recommendation:** Compare each surface’s submit path, tax/pricing implementation, stock posting, payment allocation, and idempotency before choosing the canonical terminal.

### P2 — Unverified schema state with migration edits in working tree

**Evidence:** Git status includes a modification to `backend/alembic/versions/v1541_triage_quarantine_items.py`; files v1542 and v1543 are present.  
**Interpretation:** The current checkout differs from HEAD in migration history. The actual database revision/schema could not be checked.  
**Recommendation:** Preserve this checkout and validate the migration chain and live isolated database schema before running any migration or provisioning a template.

## Review checklist

**Evidence:** Paths and code declarations above were inspected; no live DB evidence was available.  
**Interpretation:** Duplicates and gaps are evidence-backed at source level; integration failures remain unconfirmed.  
**Recommendation:** Treat this report as a static audit baseline and schedule a separately authorized read-only DB/schema and safe test-environment verification before implementation.
