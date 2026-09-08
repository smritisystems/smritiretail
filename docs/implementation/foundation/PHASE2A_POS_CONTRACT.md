# Phase 2A — POS Contract Characterization

**Status: BLOCKED**

This document is a read-only characterization of the POS checkout contract and the candidate financial authorities. No production writer was rewired or deleted.

## 1. Exact Call Graph

```text
POST /api/v1/pos/checkout
  -> backend/app/api/v1/pos.py:pos_checkout
     -> dependency get_tenant_context()
     -> dependency get_company_db()
     -> dependency require_role(CASHIER, MANAGER, SYSADMIN)
     -> POSService(db, tenant).pos_checkout(req)
        -> POSService.get_shift(req.shift_id, for_update=True)
           -> SELECT Shift WHERE id + company_id + branch_id + is_deleted=false FOR UPDATE
        -> reject unless shift.status == OPEN
        -> SELECT SalesInvoice by invoice_no + company_id + is_deleted=false
        -> for each POS line:
           -> CanonicalTransactionWriter.resolve_dual_key_for_line()
           -> SELECT Product by id + company_id + branch_id + is_deleted=false
           -> check Product.stock
           -> mutate Product.stock in memory
           -> InventoryWarehouseResolver.resolve(company_id, branch_id)
           -> build SalesInvoiceItem and StockMovement
        -> apply POS bill discount to grand_total
        -> build SalesInvoice with shift_id, company_id, branch_id, payment_mode
        -> OutboxService.record_event(target_channel=PSV_QUEUE)
        -> session.commit()
        -> on IntegrityError: rollback, re-read invoice, return cached race result
        -> refresh invoice and shift
     -> POSCheckoutResponse
```

`PaymentsEngine.process_payment()` is not called by this graph. POS `payment_mode` is stored on `sales_invoices`; no `PaymentTransaction` is created by checkout.

## 2. Writer and Call-Graph Matrix

| Writer/path | Invoice write | Stock write | Payment write | Outbox | Commit boundary | Tenant/branch behavior |
| --- | --- | --- | --- | --- | --- | --- |
| `POST /pos/checkout` -> `POSService.pos_checkout` | Direct `SalesInvoice` + items | Direct `Product.stock` mutation plus one `StockMovement` per stocked line | None; stores mode only | Yes, `PSV_QUEUE` | One commit after invoice, movement, outbox | Shift, invoice, product, movement use company/branch; warehouse resolver uses tenant |
| `UnifiedSalesLedgerService.post_sales_invoice` | Direct `SalesInvoice` + items | Creates `StockMovement`; decrements named batch if supplied; relies on DB trigger for product aggregate | None | Yes, `SALES_INVOICE_PUBLISH` | One internal commit | Header and movement use supplied company/branch; invoice idempotency query is not company-scoped |
| `SalesService.create_sales_invoice` | Direct `SalesInvoice` + items, customer/credit snapshots | FEFO allocation through `InventoryWmsService`; `atomic_mutate_batch_stock` updates batch, movement, and product aggregate | None; payment is separate | Yes, `PSV_QUEUE`; loyalty and invoice hooks also run | Flushes before stock work, then commits; rolls back on integrity/commit errors | Product query scopes company but not consistently branch; warehouse resolves tenant branch |
| `PaymentsEngine.process_payment` | None | None | Direct `PaymentTransaction` + `PaymentAllocation` | None | Independent commit | Company supplied; branch copied from request; idempotency company-scoped |
| `InventoryService.update_stock` | None | Direct `StockMovement`; product stock expected from PostgreSQL trigger | None | None | Caller controls commit | Product lookup scopes company and branch |
| `InventoryWmsService.atomic_mutate_batch_stock` | None | Batch row, `StockMovement`, and `Product.stock` aggregate | None | None | Flush only; caller controls commit | Product and batch scope company; warehouse/product/batch lookup does not consistently scope branch |

## 3. POS Invariant Comparison

| Invariant | POS checkout | Unified ledger | Sales service | Classification |
| --- | --- | --- | --- | --- |
| Shift locked and OPEN | Locks tenant/branch shift with `FOR UPDATE`, rejects non-OPEN | No shift lookup or lock | No shift lookup or lock | **B — POS-specific adapter behavior to preserve** |
| Tenant-scoped invoice number | Existing lookup scopes company, not branch; database uniqueness behavior is relied on | Uppercases number but duplicate lookup is not company-scoped | Explicit duplicate lookup scopes company, not branch; generated numbers use company/branch sequence | **D — unresolved conflict** |
| Invoice idempotency | Same active company invoice returns cached; race after commit returns cached | Existing invoice raises `ValueError`; no cached retry | Idempotency requires `idempotency_key` matching invoice id, while duplicate invoice number returns 409 | **D — unresolved conflict** |
| Exactly one movement per confirmed stock line | One movement only when Product exists and is stocked | One movement for every input line, including ad-hoc/service-like lines | One WMS movement per batch deduction, so FEFO can produce multiple movements for one invoice line | **D — unresolved conflict** |
| Variant resolution | Canonical dual-key resolver; persists resolved variant and product IDs | Does not resolve variant; uses input product/item/id fallback | Resolves product by id/code but does not assign canonical `variant_id` in the shown item construction | **A/B — canonical identity plus POS adapter behavior; policy still required** |
| Company/branch isolation | Product requires both company and branch; invoice/movement use both | Uses supplied company/branch, but idempotency lookup lacks company filter | Product requires company but not branch in the shown query; actual branch is normalized later | **D — unresolved conflict** |
| Warehouse isolation | Resolves warehouse from tenant company/branch | Accepts caller-supplied warehouse without validating ownership | Resolves warehouse from tenant unless explicitly supplied | **D — unresolved conflict** |
| Payment mode | Uppercases and stores on invoice | Stores passed value without normalization | Stores mode or CREDIT normalization | **B — POS adapter behavior, with canonical normalization needed** |
| POS shift linkage | Stores `shift_id` on invoice and returns it | Supports optional `shift_id` | Does not set `shift_id` in the shown invoice construction | **B — POS-specific behavior to preserve** |
| Atomic rollback | Invoice, items, movements, Product mutation, outbox share one commit; no payment transaction | Invoice, items, movement, batch mutation, outbox share one commit | Invoice and WMS work are intended to share transaction, but pre-flush and fallback paths complicate failure semantics | **D — unresolved conflict** |

## 4. Semantic Differences

### Tax calculation

- POS calculates tax as `quantity * price * gst_rate / 100`, quantizes line tax to four decimals, then line total to two decimals. It does not split CGST/SGST/IGST fields and does not use an inclusive-tax mode.
- Unified ledger calculates taxable value after percentage discount, quantizes taxable value to two decimals, then splits either IGST or CGST/SGST and sums the rounded components.
- Sales service uses `calculate_line_item_tax`, supports inclusive/exclusive tax, interstate determination, customer GST/location context, and stores statutory split fields.
- **Classification: D.** A canonical tax policy must be selected before rewiring. The Sales service calculation is the strongest statutory candidate; POS behavior cannot be silently changed.

### Discount calculation

- POS applies one bill-level discount after line tax and total accumulation. It changes `grand_total` only; line snapshots do not reflect the discount.
- Unified ledger applies per-line `disc_pct` before tax. It has no POS bill-level discount parameter.
- Sales service applies per-line discount during tax calculation and persists discount/taxable snapshots; its request contract has no equivalent POS bill discount field.
- **Classification: D.** Bill discount versus line discount changes tax liability and must be an explicit policy decision.

### Rounding

- POS line tax: four decimal places; line total and final totals: two decimals.
- Unified ledger rounds taxable, each tax component, and final totals to two decimals.
- Sales service delegates to its tax calculator and preserves separate tax components; exact rounding depends on the calculator's inclusive/interstate path.
- **Classification: A/D.** Monetary two-decimal persistence is canonical, but line-tax and component rounding must be fixed by policy and tests.

### Variant resolution

- POS calls `CanonicalTransactionWriter.resolve_dual_key_for_line`, rejects quarantined identity, and persists both canonical variant and legacy product identity.
- Unified ledger has no equivalent resolver and can create an ad-hoc product ID when input is incomplete.
- Sales service resolves legacy Product records but the shown `SalesInvoiceItem` construction does not persist a canonical variant ID.
- **Classification: A for canonical resolution; C for duplicate/missing behavior in the other writers.** The authority must accept a resolved identity contract and reject unresolved physical goods.

### Stock availability and decrement

- POS checks aggregate `Product.stock`, rejects insufficient stock, directly decrements it, and skips `No-stock` products.
- Unified ledger does not perform the same aggregate availability check; it mutates a named batch only when one is supplied and relies on a database trigger for aggregate stock.
- Sales service uses FEFO batch allocation and `atomic_mutate_batch_stock`; its fallback to `BATCH-OPENING` can conceal FEFO allocation failure.
- Inventory WMS explicitly validates available batch quantity and synchronizes the product aggregate.
- **Classification: A for WMS validation and ledger movement; C for direct Product mutation; D for FEFO fallback policy.**

### Batch selection

- POS does not select or mutate batches.
- Unified ledger optionally decrements the exact input batch.
- Sales service auto-selects FEFO batches when no batch is supplied and can emit multiple movements for one invoice line.
- **Classification: A for FEFO as canonical inventory policy; B for POS input/shift adapter metadata; D for movement cardinality.**

### Movement quantity and sign

- POS writes negative `quantity` for `movement_type="OUT"`.
- Unified ledger writes negative `quantity` for `movement_type="OUTWARD_SALE"`.
- WMS writes `abs(qty_delta)` and represents direction through `movement_type`; therefore an outward WMS movement is positive quantity.
- **Classification: D.** Sign convention is incompatible and must be normalized before authority convergence.

### Invoice numbering

- POS requires a client-generated `invoice_no`; no canonical sequence allocation occurs.
- Unified ledger uppercases a client-generated number.
- Sales service allocates a canonical sequence for missing/AUTO values and otherwise validates duplicates.
- **Classification: A for Sales service sequence allocation; B for POS adapter accepting a terminal-provided request key; D for collision/branch uniqueness policy.**

### Invoice identity and duplicate requests

- POS uses a random invoice primary key and invoice number as the replay identity; same company invoice number is cached.
- Unified ledger generates a random primary key and rejects an existing invoice with `ValueError`.
- Sales service separates primary invoice identity/idempotency key from document-number uniqueness and returns an existing invoice only for matching idempotency ID.
- **Classification: D.** Canonical authority needs a tenant-scoped idempotency key plus a separate document-number uniqueness rule.

### Customer and account linkage

- POS stores optional customer ID without customer validation or credit/customer snapshot handling.
- Unified ledger stores customer ID/name/GSTIN but does not perform the Sales service's customer existence or credit checks.
- Sales service validates tenant customer scope, GST/location context, credit limits, outstanding balance, and credit ledger entries.
- **Classification: A for Sales service customer/credit validation; B for POS walk-in and shift context; C for bypasses in POS/ledger.**

### Payment transaction creation

- POS creates no `PaymentTransaction`; `payment_mode` is only an invoice field.
- Unified ledger also creates no payment transaction.
- Sales service records invoice payment mode and credit ledger effects for CREDIT, but does not call `PaymentsEngine`.
- PaymentsEngine separately creates multi-tender transactions and allocations, then commits independently.
- **Classification: D.** Invoice confirmation and payment capture are currently separate transactions; POS atomicity across both is not proven.

### Shift linkage

- Only POS explicitly locks and links `shift_id` to the invoice.
- Unified ledger accepts optional shift ID but does not validate the shift.
- Sales service does not set shift linkage in the shown invoice construction.
- **Classification: B.** Shift lifecycle must remain an adapter concern, but the authority interface must receive validated shift context.

### Branch/company/warehouse resolution

- POS receives tenant context, scopes shift/product/invoice/movement, and resolves a tenant warehouse.
- Unified ledger trusts caller-provided company, branch, and warehouse values.
- Sales service resolves company state and warehouse, but product lookup is company-scoped without branch in the shown query.
- WMS scopes product/batches by company and warehouse; branch enforcement is incomplete.
- **Classification: D.** Authority must validate all supplied IDs rather than trust adapters.

### Outbox/event creation

- POS emits `POS_SALE_COMPLETED` to `PSV_QUEUE`, causation ID invoice number.
- Unified ledger emits `SALES_INVOICE_CONFIRMED` to `SALES_INVOICE_PUBLISH`, with correlation/aggregate metadata.
- Sales service emits `SALES_INVOICE_CREATED` to `PSV_QUEUE` and also invokes invoice/loyalty hooks.
- **Classification: D.** Event type, channel, payload, and causation identity need one canonical event contract with adapter metadata.

### Transaction boundaries and rollback

- POS has one commit around invoice, items, product mutation, movement, and outbox. Payment is outside it because no payment is created.
- Unified ledger commits internally and expires the session. Callers cannot compose it into a larger transaction.
- Sales service flushes invoice before stock mutation, then commits later; exceptions roll back the session, but independent payment commits remain outside its transaction.
- PaymentsEngine always commits internally, preventing atomic composition with invoice posting.
- **Classification: D.** The authority must support a caller-controlled unit of work and one outer commit.

## 5. Classification Summary

| Class | Findings |
| --- | --- |
| A — canonical behavior to preserve | Tenant Company DB boundary; immutable invoice/tax snapshots; WMS stock validation; stock movement audit; Sales service customer/credit validation; canonical document sequence; outbox auditability |
| B — POS adapter behavior to preserve | Shift lock/open check; cashier/terminal context; POS payment mode; client terminal request identity; validated `shift_id` linkage; bill-level discount input until policy resolves it |
| C — duplicate financial behavior to move | POS direct Product mutation; Unified ledger ad-hoc identity fallback; Sales service and ledger independent invoice writes; duplicate outbox event contracts; direct payment writes outside PaymentsEngine |
| D — unresolved policy conflict | Tax/discount/rounding; movement sign; movement cardinality under FEFO; invoice idempotency semantics; payment atomicity; branch/warehouse validation; event contract |
| E — test/environment defect | `tests/t_sales_ledger.py` assumes `smriti002` exists; current focused run fails during fixture setup with `asyncpg.exceptions.InvalidCatalogNameError` before ledger assertions execute |

## 6. Required Tests Before Rewiring

1. POS closed-shift rejection while another checkout attempts the same locked shift.
2. Same invoice request replay returns the original invoice and creates no additional movement, item, outbox event, or payment.
3. Same document number with a different payload has an explicit conflict result.
4. Concurrent same-invoice submissions produce one invoice and one movement per stocked line.
5. Zero, fractional, and mixed-GST lines prove tax, discount, and rounding policy.
6. Variant resolution proves canonical variant and legacy product linkage, quarantine rejection, and unresolved identity rejection.
7. No-stock/service lines prove movement cardinality.
8. FEFO multi-batch allocation proves the approved movement cardinality and quantity/sign convention.
9. Company, branch, warehouse, product, batch, customer, and shift cross-tenant attempts fail closed.
10. Payment capture failure proves whether invoice and stock roll back, or documents the approved saga boundary.
11. Outbox failure proves invoice, stock, and event atomicity.
12. Sales ledger, POS, and Sales service produce equivalent canonical snapshots for the same fixture.
13. Repair the missing `smriti002` test environment or make the fixture disposable before running the full ledger suite.

## 7. Proposed POS-to-Authority Interface

This is an interface proposal only; it was not implemented in Phase 2A.

```python
@dataclass(frozen=True)
class PosPostingContext:
    company_id: str
    branch_id: str
    warehouse_id: str
    shift_id: str
    cashier_id: str | None
    terminal_id: str | None
    payment_mode: str
    request_id: str
    invoice_no: str

@dataclass(frozen=True)
class PosLineInput:
    product_id: str
    code: str
    name: str
    quantity: Decimal
    unit_price: Decimal
    gst_rate: Decimal
    variant_id: str | None
    batch_no: str | None
    hsn_code: str | None

class CanonicalSalesAuthority(Protocol):
    async def post_pos_sale(
        self,
        *,
        session: AsyncSession,
        context: PosPostingContext,
        customer_id: str | None,
        customer_name: str | None,
        lines: Sequence[PosLineInput],
        bill_discount: BillDiscount | None,
    ) -> PosPostingResult:
        """Validate, calculate, post invoice/stock/outbox, and return replay-safe result."""
```

Required authority guarantees:

- Validate the already-locked OPEN shift and all tenant IDs.
- Resolve canonical item identity before any stock or invoice write.
- Apply one approved tax/discount/rounding policy.
- Produce one defined movement contract per approved stock line.
- Use a tenant/branch-scoped idempotency key and separate document number.
- Optionally stage payment in the same unit of work; otherwise return an explicit payment saga boundary.
- Do not commit internally when called inside a larger transaction; the outer coordinator owns commit/rollback.
- Emit one canonical event with POS metadata rather than a separate financial event schema.

## 8. Gate Result

**BLOCKED.** Characterization is complete, but implementation boundary is not proven because financial semantic conflicts remain unresolved. No production writer should be rewired until the policy decisions in Section 4 are approved and the tests in Section 6 pass.
