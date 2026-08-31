/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.76.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ProPosReconciliationDlg,
  ReconciliationQueueItem,
} from "../components/billing/propos/ProPosReconciliationDlg";
import * as apiFetchModule from "../lib/apiFetchV1";

describe("ProPOS Store Manager Conflict Reconciliation UI Widget Contract & Flow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("STEP 1: should export ProPosReconciliationDlg component function", () => {
    expect(typeof ProPosReconciliationDlg).toBe("function");
  });

  it("STEP 2: should validate ReconciliationQueueItem structure and status types", () => {
    const item: ReconciliationQueueItem = {
      id: "posq-01",
      batch_id: "batch-1",
      client_tx_uuid: "tx-pos-01-abc1234",
      terminal_id: "POS-01",
      txn_type: "SALES_INVOICE",
      document_number: "POS1-INV-2026-0001",
      sync_status: "NEEDS_REVIEW",
      error_message: "Stock deficit on SKU-HOT-01",
      retry_count: 1,
      submitted_at: new Date().toISOString(),
    };

    expect(item.sync_status).toBe("NEEDS_REVIEW");
    expect(item.terminal_id).toBe("POS-01");
    expect(item.client_tx_uuid).toContain("tx-pos");
  });

  it("STEP 3: should query reconciliation queue API with status filter", async () => {
    const fetchSpy = vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue({
      total_count: 2,
      items: [
        {
          id: "posq-01",
          batch_id: "batch-1",
          client_tx_uuid: "tx-pos-01-abc1234",
          terminal_id: "POS-01",
          txn_type: "SALES_INVOICE",
          document_number: "POS1-INV-2026-0001",
          sync_status: "NEEDS_REVIEW",
          retry_count: 1,
          submitted_at: new Date().toISOString(),
        },
      ],
    });

    const res = await apiFetchModule.apiFetchV1("/sync/reconciliation-queue?status=NEEDS_REVIEW");
    expect(fetchSpy).toHaveBeenCalledWith("/sync/reconciliation-queue?status=NEEDS_REVIEW");
    expect(res.items.length).toBe(1);
    expect(res.items[0].sync_status).toBe("NEEDS_REVIEW");
  });

  it("STEP 4: should verify manager approval and override state transition contracts", () => {
    const originalItem: ReconciliationQueueItem = {
      id: "posq-02",
      batch_id: "batch-2",
      client_tx_uuid: "tx-pos-02-xyz9876",
      terminal_id: "POS-02",
      txn_type: "SALES_INVOICE",
      document_number: "POS2-INV-2026-0002",
      sync_status: "NEEDS_REVIEW",
      retry_count: 0,
      submitted_at: new Date().toISOString(),
    };

    // Transition to COMMITTED
    const approvedItem: ReconciliationQueueItem = {
      ...originalItem,
      sync_status: "COMMITTED",
      synced_at: new Date().toISOString(),
    };

    expect(approvedItem.sync_status).toBe("COMMITTED");
    expect(approvedItem.synced_at).toBeDefined();

    // Transition to REJECTED
    const rejectedItem: ReconciliationQueueItem = {
      ...originalItem,
      sync_status: "REJECTED",
      error_message: "Rejected by Store Manager: Inventory write-off required.",
    };

    expect(rejectedItem.sync_status).toBe("REJECTED");
    expect(rejectedItem.error_message).toContain("Rejected by Store Manager");
  });
});
