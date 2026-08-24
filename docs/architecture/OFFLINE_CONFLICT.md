<!--
  Project      : SMRITI Retail OS
  Author       : Jawahar Ramkripal Mallah
  Designation  : Chief Systems Architect & Creator
  Email        : support@smritibooks.com
  Websites     : smritibooks.com | erpnbook.com | aitdl.com
  Version      : 3.24.0
  Created      : 2026-08-23
  Modified     : 2026-08-23
  Copyright    : © SMRITIBooks.com. All Rights Reserved.
  License      : Proprietary Commercial Software
  Classification: Internal
-->

# SMRITI Offline Conflict Resolution Policy Matrix & Distributed Sync Protocol

**Status:** Authoritative Architecture Specification  
**Version:** v1.0  
**Effective Date:** 2026-08-23

---

## 1. Executive Summary & Design Invariants

In retail operations, point-of-sale (POS) terminals, mobile vans, and distribution sales agents must execute transactions seamlessly without active internet connectivity. When connectivity restores, concurrent transactions generated across disjoint nodes converge onto the central multi-tenant PostgreSQL database.

SMRITI strictly rejects naive **Last-Write-Wins (LWW)** because financial ledgers, tax compliance snapshots, and inventory balances represent authoritative, immutable truths that must never be silently overwritten. SMRITI implements a **5-Tier Domain-Driven Hybrid Conflict Resolution Engine**:

```
                       OFFLINE CLIENT (POS / Terminal)
                                      │
              1. Local Durable Outbox (UUIDv7 + Idempotency Key)
              2. Pre-Allocated Series Lease + Versioned Rule Snapshot
                                      │
                         [Network Sync Ingestion]
                                      ▼
             FASTAPI TRANSACTIONAL CORE (Offline Sync Router)
                                      │
                 Offline Conflict Resolution Policy Engine
                                      │
   ┌─────────────────┬──────────────────┬─────────────────┬─────────────────┐
   ▼                 ▼                  ▼                 ▼                 ▼
[Tier 1: Accept] [Tier 2: Merge]  [Tier 3: Dedupe]  [Tier 4: Reconcile] [Tier 5: Compensate]
Post to Ledger   Auto-merge       Skip redundant   Escalate to         Emit Reversal /
& Outbox         non-critical     retries via key  Review Queue        Credit Note
```

---

## 2. Five-Tier Conflict Resolution Architecture

| Tier | Name | Principle | Applicable Domains |
|---|---|---|---|
| **Tier 1** | **Strict Server Authority** | The server validates business invariants against authoritative ledger state. Deltas are posted sequentially. | Stock movements, General Ledger journal entries, GST tax breakdowns. |
| **Tier 2** | **Deterministic Automatic Merge** | Deterministic business rules merge incoming deltas without human intervention. | **Price-at-sale preservation** (historical price locked), loyalty points accretion, non-overlapping master fields. |
| **Tier 3** | **Idempotent Deduplication** | Incoming operations carry client UUID / idempotency keys; duplicate submissions are acknowledged and safely skipped. | Network retry storms, replay sync payloads, re-sent batches. |
| **Tier 4** | **Reconciliation Queue Escalation** | Incompatible concurrent states are safely isolated in a Store Manager review queue without halting client cashier checkout. | Negative stock over-allocation, credit limit breach, concurrent master identity conflicts. |
| **Tier 5** | **Versioned Rule Snapshot Binding** | Transactions lock the exact AST formula version and policy snapshot active on the client at creation time. | Pricing rules, GST intrastate/interstate determination, discount condition trees. |

---

## 3. Entity-by-Field Conflict Policy Matrix

| Domain / Entity | Specific Conflict Scenario | Risk Level | Applied Tier | Resolution Strategy | Automated Compensation Action |
|---|---|---|---|---|---|
| **Sales & POS Invoices** | Two offline terminals sell the last unit ($Qty=1$) of identical SKU | **Critical** | **Tier 1 + 4** | Terminal 1 posts authoritative stock decrement; Terminal 2 posts invoice with `ACCEPTED_WARN` or escalates to `NEEDS_REVIEW` | Generates stock deficit discrepancy journal / triggers stock audit reconciliation |
| **Document Numbering** | Multiple terminals generate sequential offline invoice numbers | **Critical** | **Tier 3** | Pre-allocated terminal series leases (e.g. `POS1-INV-...`, `POS2-INV-...`) ensure zero key collision | Server registers terminal prefix; validates gapless ordering per terminal |
| **Pricing & Promotions** | HQ updates central price book while terminal sells item at old price | **Medium** | **Tier 2 + 5** | **Price-at-Sale Preservation**: Server honors transaction price; stores original `governance_snapshot_id` | Computes pricing variance for managerial reporting; never retroactively reprices historical sale |
| **Customer Credit Limit** | Multiple offline sales push customer ledger balance past credit ceiling | **High** | **Tier 4** | Sales are accepted; account balance updated; credit breach flagged as `ACCEPTED_WARN` in review queue | Notifies credit controller; locks subsequent credit approvals until payment |
| **Master Data (Party/Item)** | Concurrent edit of customer address or item description across devices | **Medium** | **Tier 2** | Field-level merge for non-overlapping attributes; newest valid timestamp for overlapping fields | Audit trail entry created in `compliance_immutable_audit_logs` |
| **Payment Settlement** | Duplicate offline cash/digital payment recorded under network flutter | **High** | **Tier 3** | Idempotency key lookup on `payment_transactions` prevents duplicate cash ledger debit | Skips duplicate; returns existing server payment reference |
| **Rule & Policy Drift** | Client created sale under Rule v1.2 while server deployed Rule v1.3 | **High** | **Tier 5** | Reproducibility binding: server validates against snapshot v1.2, preserving tax and discount calculations | Historical audit compliance preserved permanently |

---

## 4. Detailed Synchronization Protocol & State Machine

```
              ┌──────────────────────────┐
              │ Client Generates Offline │
              │   Transaction Payload    │
              └─────────────┬────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │ Durable Queue Ingestion  │
              │ (pos_offline_sync_queue) │
              └─────────────┬────────────┘
                            │
              ┌─────────────▼────────────┐
              │ Idempotency Key Check    │
              └──────┬────────────┬──────┘
         Exists      │            │ New
    ┌────────────────┘            └─────────────────┐
    ▼                                               ▼
[DEDUPLICATED]                             [Evaluate Invariants]
(Return existing ID)                                │
                           ┌────────────────────────┴────────────────────────┐
                           ▼                                                 ▼
                  [Invariants Valid]                                 [Conflict Detected]
                           │                                                 │
                  ┌────────┴────────┐                               ┌────────┴────────┐
                  ▼                 ▼                               ▼                 ▼
             [ACCEPTED]      [ACCEPTED_WARN]                  [NEEDS_REVIEW]    [REJECTED]
            (Post Ledger)   (Post + Flag Alert)              (Queue Escalation) (Malformed/Denied)
```

---

## 5. Structured Sync Diagnostics & Response Contracts

Every synced operation returns an explicit, machine-readable result adhering to `SyncResolutionResult`:

```json
{
  "item_id": "client-uuid-001",
  "status": "ACCEPTED_WARN",
  "conflict_category": "INVENTORY_STOCK",
  "resolution_strategy": "AUTO_MERGE_DELTA",
  "server_entity_id": "inv_srv_991823",
  "diagnostics": [
    {
      "field": "stock_balance",
      "client_assumption": 1.0,
      "server_truth": 0.0,
      "action_taken": "Posted sale with stock deficit warning; flagged for inventory reconciliation."
    }
  ],
  "governance_snapshot_id": "gov_snap_v1.2",
  "timestamp": "2026-08-23T17:00:00Z"
}
```

---

## 6. Implementation Governance & Audit Invariant

1. **No Silent Overwrites**: Every non-trivial conflict must emit an immutable SHA-256 compliance audit log in `compliance_immutable_audit_logs`.
2. **Reconciliation Queue Visibility**: The Store Manager / Back-Office workspace must have real-time visibility into all items marked `NEEDS_REVIEW` or `ACCEPTED_WARN`.
3. **Physical Hardware Independence**: The conflict resolution engine executes server-side within the transactional core (`backend/app/services/conflict_engine.py`) and is verifiable via automated soak-test suites.
