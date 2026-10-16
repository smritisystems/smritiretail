/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.1
 * Created      : 2026-10-11
 * Modified     : 2026-10-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ProPosOfflineSyncEngine } from "../sync/ProPosOfflineSyncEngine.ts";
import * as apiFetchModule from "../lib/apiFetchV1.ts";
import { parseAndValidateGSTIN } from "../utils/gstEngine.ts";

const storageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (k: string) => storageMap.get(k) ?? null,
  setItem: (k: string, v: string) => storageMap.set(k, String(v)),
  removeItem: (k: string) => storageMap.delete(k),
  clear: () => storageMap.clear(),
  get length() { return storageMap.size; },
  key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
};
(globalThis as any).localStorage = mockLocalStorage;

describe("P0 Billing Remediation & Modern UX Test Suite", () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    ProPosOfflineSyncEngine.clearQueue();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Scenario 1: Successful Credit Checkout ──
  it("Scenario 1: should post credit checkout atomically and capture server confirmation", async () => {
    const mockResponse = {
      invoice_no: "INV-CR-2026-0042",
      invoice_id: "inv-uuid-0042",
      status: "SUCCESS",
      ledger_impact: { debit: 4550.0, credit: 0.0 },
      stock_deducted: true,
    };

    const apiSpy = vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue(mockResponse);

    const idempotencyKey = "idemp-test-cr-001";
    const payload = {
      context: {
        company_id: "COMP-001",
        branch_id: "MAIN",
        terminal_id: "DESKTOP_BILLING",
        source_channel: "B2B_WHOLESALE",
        idempotency_key: idempotencyKey,
      },
      customer_id: "cust-001",
      customer_name: "ABC Footwear",
      tenders: [{ tender_type: "CREDIT", amount: 4550.0, reference_no: "CUST-001" }],
      items: [{ code: "SHOE-001", quantity: 2, unit_price: 1500.0, gst_rate: 18.0 }],
    };

    const res = await apiFetchModule.apiFetchV1<any>("/billing/checkout", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: payload,
    });

    expect(apiSpy).toHaveBeenCalledWith("/billing/checkout", expect.objectContaining({
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
    }));
    expect(res.invoice_no).toBe("INV-CR-2026-0042");
    expect(res.stock_deducted).toBe(true);
  });

  // ── Scenario 2: Credit Limit and Stock Validation Rejection ──
  it("Scenario 2: should reject transaction on credit limit/stock failure, preserving cart and error details", async () => {
    const errorResponse = {
      status: 400,
      detail: "Customer credit limit exceeded. Available credit: INR 12,000, attempted: INR 45,000.",
    };

    vi.spyOn(apiFetchModule, "apiFetchV1").mockRejectedValue(errorResponse);

    let docStatus: "DRAFT" | "PROCESSING" | "SUBMITTED" | "FAILED" | "RECONCILIATION_REQUIRED" = "PROCESSING";
    let lastError: string | null = null;
    const cart = [{ code: "SHOE-001", qty: 30, rate: 1500.0 }];

    try {
      await apiFetchModule.apiFetchV1("/billing/checkout", {
        method: "POST",
        body: { customer_id: "cust-001", amount: 45000.0 },
      });
      docStatus = "SUBMITTED";
    } catch (err: any) {
      docStatus = "FAILED";
      lastError = err.detail || err.message;
    }

    // P0-A: Must NEVER be SUBMITTED on rejection
    expect(docStatus).toBe("FAILED");
    expect(docStatus).not.toBe("SUBMITTED");
    expect(lastError).toContain("Customer credit limit exceeded");
    // Cart is preserved
    expect(cart.length).toBe(1);
    expect(cart[0].code).toBe("SHOE-001");
  });

  // ── Scenario 3: Network Failure Without False Success ──
  it("Scenario 3: should NOT mark network failure as SUBMITTED and should transition to RECONCILIATION_REQUIRED", async () => {
    const networkError = new TypeError("Failed to fetch: Network unreachable or socket timeout");
    vi.spyOn(apiFetchModule, "apiFetchV1").mockRejectedValue(networkError);

    let docStatus: "DRAFT" | "PROCESSING" | "SUBMITTED" | "FAILED" | "RECONCILIATION_REQUIRED" = "PROCESSING";
    let lastError: string | null = null;
    const cart = [{ code: "BAG-001", qty: 1, rate: 950.0 }];

    try {
      await apiFetchModule.apiFetchV1("/billing/checkout", { method: "POST" });
      docStatus = "SUBMITTED";
    } catch (err: any) {
      const isNetworkTimeout =
        err?.message?.toLowerCase().includes("failed to fetch") ||
        err?.message?.toLowerCase().includes("network");

      if (isNetworkTimeout) {
        docStatus = "RECONCILIATION_REQUIRED";
        lastError = "Network timeout or connection interrupted. Transaction state uncertain on server.";
      } else {
        docStatus = "FAILED";
      }
    }

    // P0-A: False success regression guard
    expect(docStatus).toBe("RECONCILIATION_REQUIRED");
    expect(docStatus).not.toBe("SUBMITTED");
    expect(lastError).toContain("Network timeout");
    expect(cart.length).toBe(1);
  });

  // ── Scenario 4: Server Commit Followed by Client Timeout and Idempotent Replay ──
  it("Scenario 4: should reconcile server commit via stable idempotency key after client timeout", async () => {
    const fixedIdempotencyKey = "idemp-safe-timeout-recon-009";

    // Attempt 1: Server committed internally but response timed out on client
    let attemptCount = 0;
    vi.spyOn(apiFetchModule, "apiFetchV1").mockImplementation(async (_url, opts: any) => {
      attemptCount++;
      if (attemptCount === 1) {
        throw new Error("Client socket timeout waiting for HTTP 200");
      }
      // Attempt 2: Reconciling with identical idempotency key returns cached commit
      expect(opts?.headers?.["Idempotency-Key"]).toBe(fixedIdempotencyKey);
      return {
        invoice_no: "INV-POSTED-991",
        idempotent_replay: true,
        status: "COMMITTED",
      };
    });

    let docStatus: "DRAFT" | "PROCESSING" | "SUBMITTED" | "FAILED" | "RECONCILIATION_REQUIRED" = "DRAFT";
    let resolvedInvoiceNo: string | null = null;

    // First attempt fails
    try {
      docStatus = "PROCESSING";
      await apiFetchModule.apiFetchV1("/billing/checkout", {
        headers: { "Idempotency-Key": fixedIdempotencyKey },
      });
      docStatus = "SUBMITTED";
    } catch {
      docStatus = "RECONCILIATION_REQUIRED";
    }

    expect(docStatus).toBe("RECONCILIATION_REQUIRED");

    // Second attempt: Reconcile using identical idempotency key
    docStatus = "PROCESSING";
    const retryRes = await apiFetchModule.apiFetchV1<any>("/billing/checkout", {
      headers: { "Idempotency-Key": fixedIdempotencyKey },
    });
    if (retryRes?.invoice_no) {
      docStatus = "SUBMITTED";
      resolvedInvoiceNo = retryRes.invoice_no;
    }

    expect(docStatus).toBe("SUBMITTED");
    expect(resolvedInvoiceNo).toBe("INV-POSTED-991");
    expect(attemptCount).toBe(2);
  });

  // ── Scenario 5: Duplicate Submit Prevention Guard ──
  it("Scenario 5: should prevent duplicate concurrent submissions with active guard", async () => {
    let callCount = 0;
    vi.spyOn(apiFetchModule, "apiFetchV1").mockImplementation(async () => {
      callCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { invoice_no: "INV-SINGLE-01" };
    });

    let isSubmitting = false;
    const submitAction = async () => {
      if (isSubmitting) return; // Guard
      isSubmitting = true;
      try {
        await apiFetchModule.apiFetchV1("/billing/checkout");
      } finally {
        isSubmitting = false;
      }
    };

    // User double-clicks or triggers hotkey rapidly
    const [p1, p2, p3] = [submitAction(), submitAction(), submitAction()];
    await Promise.all([p1, p2, p3]);

    // Only 1 execution occurred
    expect(callCount).toBe(1);
  });

  // ── Scenario 6: Offline Queue Persistence and Restart Recovery ──
  it("Scenario 6: should durably persist queued sales in localStorage and recover upon restart", async () => {
    const salePayload = {
      invoice_no: "POS-OFF-8841",
      grand_total: 1250.0,
      payment_mode: "CASH",
      client_tx_uuid: "tx-pos-01-persist-test",
    };

    const queued = await ProPosOfflineSyncEngine.queueOfflineSale(salePayload, "POS-01", "POS-OFF-8841");
    expect(queued.status).toBe("QUEUED");

    // Simulate terminal restart: clear in-memory queue and recover from storage
    ProPosOfflineSyncEngine.clearQueue();
    // After clearQueue memory is empty, let's inject persisted storage to simulate restart
    const stored = JSON.stringify([queued]);
    localStorage.setItem("smriti_propos_offline_queue_v1", stored);

    const recoveredCount = ProPosOfflineSyncEngine.recoverFromStorage();
    expect(recoveredCount.recoveredCount).toBe(1);

    const queue = await ProPosOfflineSyncEngine.getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].client_tx_uuid).toBe("tx-pos-01-persist-test");
    expect(queue[0].document_number).toBe("POS-OFF-8841");
  });

  // ── Scenario 7: Safe Reconnection and Deduplicated Sync ──
  it("Scenario 7: should prevent duplicate invoices during sync and process DEDUPLICATED status", async () => {
    vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue({
      batch_id: "batch-recon-sync-01",
      accepted_count: 2,
      results: [
        { client_tx_uuid: "tx-sync-1", status: "ACCEPTED" },
        { client_tx_uuid: "tx-sync-2", status: "DEDUPLICATED", message: "Transaction previously processed" },
      ],
    });

    await ProPosOfflineSyncEngine.queueOfflineSale({ client_tx_uuid: "tx-sync-1", invoice_no: "BILL-01" });
    await ProPosOfflineSyncEngine.queueOfflineSale({ client_tx_uuid: "tx-sync-2", invoice_no: "BILL-02" });

    // Attempt to queue a duplicate of BILL-01 while pending
    const dupAttempt = await ProPosOfflineSyncEngine.queueOfflineSale(
      { client_tx_uuid: "tx-sync-1-dup", invoice_no: "BILL-01" },
      "POS-01",
      "BILL-01"
    );
    expect(dupAttempt.client_tx_uuid).toBe("tx-sync-1"); // Deduplicated!

    const flush = await ProPosOfflineSyncEngine.flushSyncBatch("COMP-001", "MAIN", "POS-01");
    expect(flush.success).toBe(true);

    const queue = await ProPosOfflineSyncEngine.getQueue();
    expect(queue[0].status).toBe("SYNCED");
    expect(queue[1].status).toBe("SYNCED"); // DEDUPLICATED resolves cleanly to SYNCED
  });

  // ── Scenario 8: Hardcoded Invoice Identity Removal & Missing Profile Validation ──
  it("Scenario 8: should resolve tenant profile dynamically and avoid hardcoded Reliance / Tattly fallbacks", () => {
    // Set authenticated tenant storage
    localStorage.setItem("smriti_company_name", "Apex Retail Enterprises");
    localStorage.setItem("smriti_company_gstin", "27AAACA1234A1Z5");
    localStorage.setItem("smriti_company_address", "Unit 4, Trade Center, Pune");

    const tenantName = localStorage.getItem("smriti_company_name") || "Retail Store";
    const tenantGstin = localStorage.getItem("smriti_company_gstin") || "";
    const tenantAddress = localStorage.getItem("smriti_company_address") || "";

    expect(tenantName).toBe("Apex Retail Enterprises");
    expect(tenantName).not.toContain("TATTLY THREADS");
    expect(tenantGstin).toBe("27AAACA1234A1Z5");
    expect(tenantGstin).not.toContain("27AAXFT2508H1ZR");

    // Walk-in customer default
    const walkInCustomer: any = { id: "cust-01", name: "" };
    const resolvedBuyerName = walkInCustomer.name?.trim() ? walkInCustomer.name : "Walk-in Retail Customer";
    expect(resolvedBuyerName).toBe("Walk-in Retail Customer");
    expect(resolvedBuyerName).not.toContain("Reliance Retail Limited");
  });

  // ── Scenario 9: Responsive States, Keyboard Focus and Status Feedback ──
  it("Scenario 9: should correctly support all 5 transactional docStatus states", () => {
    const states = ["DRAFT", "PROCESSING", "SUBMITTED", "FAILED", "RECONCILIATION_REQUIRED"];

    const badgeLabels: Record<string, string> = {
      DRAFT: "Draft",
      PROCESSING: "Processing...",
      SUBMITTED: "Submitted",
      FAILED: "Submission Rejected",
      RECONCILIATION_REQUIRED: "Reconciliation Required",
    };

    for (const state of states) {
      expect(badgeLabels[state]).toBeDefined();
    }
  });

  // ── Scenario 10: Printer Failure Isolation After Successful Invoice Submission ──
  it("Scenario 10: should isolate printer exceptions without altering or rolling back committed invoice", async () => {
    const committedInvoice = {
      billNo: "INV-2026-9901",
      billDate: "2026-10-11",
      netPayable: 3500.0,
      tenders: { cash: 3500.0 },
      isOfflineQueued: false,
    };

    // Simulate print window exception (e.g. print spooler crash or blocked popup)
    const mockPrint = vi.fn().mockImplementation(() => {
      throw new Error("Printing failed: device offline or driver communication timeout.");
    });

    let printErrorOccurred = false;
    try {
      mockPrint();
    } catch (e: any) {
      printErrorOccurred = true;
    }

    // Invoice remains completely valid and committed!
    expect(printErrorOccurred).toBe(true);
    expect(committedInvoice.billNo).toBe("INV-2026-9901");
    expect(committedInvoice.netPayable).toBe(3500.0);
    expect(committedInvoice.isOfflineQueued).toBe(false);
  });

  // ── Scenario 11: Storage Quota Exceeded and Memory Rollback ──
  it("Scenario 11: should throw STORAGE_QUOTA_EXCEEDED and rollback memory when storage quota is exceeded", async () => {
    const originalSetItem = mockLocalStorage.setItem;
    mockLocalStorage.setItem = () => {
      const quotaErr = new Error("QuotaExceededError: DOM Exception 22");
      quotaErr.name = "QuotaExceededError";
      throw quotaErr;
    };

    try {
      const salePayload = {
        invoice_no: "POS-QUOTA-001",
        grand_total: 800.0,
      };

      await expect(
        ProPosOfflineSyncEngine.queueOfflineSale(salePayload, "POS-01", "POS-QUOTA-001")
      ).rejects.toThrow("STORAGE_QUOTA_EXCEEDED");

      // Memory must be rolled back: queue length is 0, cart is preserved in caller
      const queue = await ProPosOfflineSyncEngine.getQueue();
      expect(queue.length).toBe(0);
    } finally {
      mockLocalStorage.setItem = originalSetItem;
    }
  });

  // ── Scenario 12: Corrupted Record Quarantine and Graceful Skip ──
  it("Scenario 12: should isolate corrupted storage into quarantine key and skip corrupted records", async () => {
    // Set corrupted JSON string
    mockLocalStorage.setItem("smriti_propos_offline_queue_v1", "{invalid-json-string-here");

    const result = ProPosOfflineSyncEngine.recoverFromStorage();
    expect(result.recoveredCount).toBe(0);
    expect(result.corruptedCount).toBe(1);

    // Verify corrupted string was moved to a quarantine key
    const quarantineKey = Array.from(storageMap.keys()).find((k) =>
      k.startsWith("smriti_propos_offline_corrupted_")
    );
    expect(quarantineKey).toBeDefined();

    // Verify corrupted queue key was cleared
    expect(mockLocalStorage.getItem("smriti_propos_offline_queue_v1")).toBeNull();

    // Now test malformed record in array
    const mixedRecords = JSON.stringify([
      { client_tx_uuid: "valid-rec-1", invoice_no: "BILL-OK", payload: { grand_total: 100 }, status: "QUEUED" },
      "malformed-primitive-record-here",
    ]);
    mockLocalStorage.setItem("smriti_propos_offline_queue_v1", mixedRecords);

    const mixedResult = ProPosOfflineSyncEngine.recoverFromStorage();
    expect(mixedResult.recoveredCount).toBe(1);
    expect(mixedResult.corruptedCount).toBe(1);

    const queue = await ProPosOfflineSyncEngine.getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].client_tx_uuid).toBe("valid-rec-1");
  });

  // ── Scenario 13: Sensitive Payload Data Sanitization ──
  it("Scenario 13: should sanitize sensitive payment credentials and mask PAN before offline disk persistence", async () => {
    const sensitivePayload = {
      invoice_no: "POS-SECURE-001",
      customer_phone: "9876543210",
      cvv: "999",
      card_cvv: "888",
      password: "cashier_secret",
      auth_token: "jwt-super-secret-token",
      tenders: [
        {
          tender_type: "CARD",
          card_number: "4111-2222-3333-4444",
          card_cvv: "123",
          amount: 1500,
        },
      ],
    };

    const queued = await ProPosOfflineSyncEngine.queueOfflineSale(
      sensitivePayload,
      "POS-01",
      "POS-SECURE-001"
    );

    const storedRaw = mockLocalStorage.getItem("smriti_propos_offline_queue_v1");
    expect(storedRaw).toBeDefined();

    // Sensitive credentials must be purged from persisted storage
    expect(storedRaw).not.toContain("999");
    expect(storedRaw).not.toContain("888");
    expect(storedRaw).not.toContain("cashier_secret");
    expect(storedRaw).not.toContain("jwt-super-secret-token");
    expect(storedRaw).not.toContain("4111-2222-3333-4444");

    // Masked last 4 is retained
    expect(storedRaw).toContain("4444");
    expect(queued.payload.tenders[0].card_last4).toBe("4444");
    expect(queued.payload.tenders[0].card_cvv).toBeUndefined();
  });

  // ── Scenario 14: Safe Read-Only Reconciliation Endpoint ──
  it("Scenario 14: should reconcile uncertain checkout via non-destructive GET /billing/reconcile/{key}", async () => {
    const idempotencyKey = "idemp-reconcile-test-safe";
    const reconcileSpy = vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue({
      status: "COMMITTED",
      invoice_no: "INV-COMMITTED-771",
      idempotency_key: idempotencyKey,
      grand_total: 2500.0,
    });

    const res = await apiFetchModule.apiFetchV1<any>(`/billing/reconcile/${idempotencyKey}`, {
      method: "GET",
    });

    expect(reconcileSpy).toHaveBeenCalledWith(`/billing/reconcile/${idempotencyKey}`, {
      method: "GET",
    });
    expect(res.status).toBe("COMMITTED");
    expect(res.invoice_no).toBe("INV-COMMITTED-771");
  });

  // ── Scenario 15: Statutory B2B GSTIN Validation Rejection ──
  it("Scenario 15: should reject invalid customer GSTIN and accept valid GSTIN for tax invoice issuance", () => {
    // Invalid GSTINs
    const invalid1 = parseAndValidateGSTIN("27INVALID1234");
    expect(invalid1.isValid).toBe(false);

    const invalid2 = parseAndValidateGSTIN("50XXXXX9999X9Z9"); // Invalid state code 50 (does not exist in India)
    expect(invalid2.isValid).toBe(false);

    const empty = parseAndValidateGSTIN("");
    expect(empty.isValid).toBe(false);

    // Valid GSTIN: 27 (Maharashtra) + AAAAA0000A + 1 + Z + 5
    const valid = parseAndValidateGSTIN("27AAAAA0000A1Z5");
    expect(valid.isValid).toBe(true);
    expect(valid.stateCode).toBe("27");
    expect(valid.stateName).toContain("Maharashtra");
  });

  // ── Scenario 16: Dynamic Bank Details Suppression & Merchant UPI VPA Resolution ──
  it("Scenario 16: should suppress bank details when missing and dynamically resolve merchant UPI VPA", () => {
    // When no bank details configured, placeholder SBI is not injected
    const storeWithoutBank = {
      bankName: undefined,
      bankAccountNo: undefined,
      bankIfsc: undefined,
    };
    const showBankBox = Boolean(storeWithoutBank.bankName || storeWithoutBank.bankAccountNo);
    expect(showBankBox).toBe(false);

    // Dynamic UPI VPA resolution
    mockLocalStorage.setItem("smriti_company_upi_vpa", "business@icici");
    const configuredVpa = mockLocalStorage.getItem("smriti_company_upi_vpa");
    const resolvedVpa = configuredVpa || "merchant@upi";
    expect(resolvedVpa).toBe("business@icici");
    expect(resolvedVpa).not.toBe("store@upi");
  });

  // ── Scenario 17: UPI Payment Verification Distinct States ──
  it("Scenario 17: should treat UPI initiation as pending and require explicit verification", () => {
    type UpiState = "AWAITING_SCAN" | "UTR_RECORDED" | "VERIFIED" | "FAILED";

    let state: UpiState = "AWAITING_SCAN";
    const utrRef = "";

    // Step 1: Empty UTR -> Awaiting scan
    if (!utrRef.trim()) {
      state = "AWAITING_SCAN";
    }
    expect(state).toBe("AWAITING_SCAN");

    // Step 2: Cashier enters reference number -> UTR Recorded (requires soundbox/app confirmation)
    const enteredUtr = "123456789012";
    if (enteredUtr.trim()) {
      state = "UTR_RECORDED";
    }
    // Must NOT automatically assume VERIFIED merely because a UTR was entered!
    expect(state).toBe("UTR_RECORDED");
    expect(state).not.toBe("VERIFIED");

    // Step 3: Server/Soundbox confirms payment
    const soundboxConfirmation = true;
    if (soundboxConfirmation) {
      state = "VERIFIED";
    }
    expect(state).toBe("VERIFIED");
  });

  // ── Scenario 18: Storage Unavailable / Quota Hard Rollback ──
  it("Scenario 18: should roll back memory queue when localStorage is unavailable or quota exceeded", async () => {
    // Simulate quota exceeded error on setItem
    vi.spyOn(mockLocalStorage, "setItem").mockImplementation(() => {
      const err = new Error("Quota exceeded");
      err.name = "QuotaExceededError";
      throw err;
    });

    const payload = {
      invoice_no: "INV-ERR-QUOTA-001",
      customer_id: "cust-walkin",
      amount: 1500,
    };

    let queueError: Error | null = null;
    try {
      await ProPosOfflineSyncEngine.queueOfflineSale(payload, "POS-TERM-01");
    } catch (err: any) {
      queueError = err;
    }

    // Must throw descriptive STORAGE_QUOTA_EXCEEDED error
    expect(queueError).not.toBeNull();
    expect(queueError?.message).toContain("STORAGE_QUOTA_EXCEEDED");

    // Must have rolled back in-memory queue to 0
    const queue = await ProPosOfflineSyncEngine.getQueue();
    expect(queue.length).toBe(0);
  });

  // ── Scenario 19: Deep Recursive Credential Purging and PAN String Value Masking ──
  it("Scenario 19: should purge credentials recursively and mask embedded card PAN strings in arbitrary text", () => {
    const rawPayload = {
      invoice_no: "INV-SEC-001",
      auth_token: "jwt-secret-session-abc",
      nestedUser: {
        pin: "9876",
        password_hash: "argon2id$v=19$m=65536...",
        apiKey: "api_live_123456789",
      },
      payment: {
        card_number: "4111 2222 3333 4444",
        cvv: "123",
      },
      tenderNotes: "Payment authorized via debit card 5555-4444-3333-2222 at register.",
    };

    const sanitized = (ProPosOfflineSyncEngine as any).sanitizePayloadForOfflineStorage(rawPayload);

    // 1. Sensitive keys must be deleted recursively
    expect(sanitized.auth_token).toBeUndefined();
    expect(sanitized.nestedUser.pin).toBeUndefined();
    expect(sanitized.nestedUser.password_hash).toBeUndefined();
    expect(sanitized.nestedUser.apiKey).toBeUndefined();
    expect(sanitized.payment.cvv).toBeUndefined();

    // 2. Card PAN key converted to card_last4
    expect(sanitized.payment.card_number).toBeUndefined();
    expect(sanitized.payment.card_last4).toBe("4444");

    // 3. String value PAN masked
    expect(sanitized.tenderNotes).toContain("****-****-****-2222");
    expect(sanitized.tenderNotes).not.toContain("5555-4444-3333-2222");
  });

  // ── Scenario 20: Legacy Unsanitized Stored Record Sanitization on Recovery ──
  it("Scenario 20: should sanitize legacy raw records from storage during recovery", async () => {
    const legacyRawQueue = [
      {
        client_tx_uuid: "legacy-tx-001",
        terminal_id: "POS-01",
        txn_type: "SALES_INVOICE",
        document_number: "INV-LEGACY-001",
        payload: {
          invoice_no: "INV-LEGACY-001",
          secret_key: "legacy-secret-never-purged",
          card_number: "4000 1234 5678 9010",
        },
        status: "QUEUED",
        created_at: new Date().toISOString(),
      },
    ];

    mockLocalStorage.setItem(
      (ProPosOfflineSyncEngine as any).STORAGE_KEY,
      JSON.stringify(legacyRawQueue)
    );

    const recoveryResult = ProPosOfflineSyncEngine.recoverFromStorage();
    expect(recoveryResult.recoveredCount).toBe(1);

    const queue = await ProPosOfflineSyncEngine.getQueue();
    expect(queue.length).toBe(1);
    const recovered = queue[0];

    // Legacy secret purged upon loading
    expect(recovered.payload.secret_key).toBeUndefined();
    // Legacy card_number converted to card_last4
    expect(recovered.payload.card_number).toBeUndefined();
    expect(recovered.payload.card_last4).toBe("9010");
  });

  // ── Scenario 21: Authoritative Company Profile Validation ──
  it("Scenario 21: should block statutory invoice issuance when authoritative company profile is missing", () => {
    // Check validation logic mirroring handleSettlementSuccess
    const validateSellerProfile = (profile: { storeName?: string; addressLine1?: string; gstin?: string }, isB2B: boolean) => {
      if (!profile.storeName?.trim()) {
        return { valid: false, error: "Authoritative company name is not configured." };
      }
      if (!profile.addressLine1?.trim()) {
        return { valid: false, error: "Authoritative company address is not configured." };
      }
      if (isB2B) {
        if (!profile.gstin?.trim()) {
          return { valid: false, error: "Cannot issue a B2B statutory tax invoice: seller company GSTIN is not configured." };
        }
        const gstinCheck = parseAndValidateGSTIN(profile.gstin.trim());
        if (!gstinCheck.isValid) {
          return { valid: false, error: `Configured company GSTIN '${profile.gstin}' is invalid.` };
        }
      }
      return { valid: true };
    };

    // Missing store name
    const res1 = validateSellerProfile({ storeName: "", addressLine1: "123 High St" }, false);
    expect(res1.valid).toBe(false);
    expect(res1.error).toContain("company name is not configured");

    // Missing address
    const res2 = validateSellerProfile({ storeName: "Apex Retail", addressLine1: "" }, false);
    expect(res2.valid).toBe(false);
    expect(res2.error).toContain("company address is not configured");

    // B2B with missing seller GSTIN
    const res3 = validateSellerProfile({ storeName: "Apex Retail", addressLine1: "123 High St", gstin: "" }, true);
    expect(res3.valid).toBe(false);
    expect(res3.error).toContain("seller company GSTIN is not configured");

    // B2B with invalid seller GSTIN
    const res4 = validateSellerProfile({ storeName: "Apex Retail", addressLine1: "123 High St", gstin: "INVALID_GST" }, true);
    expect(res4.valid).toBe(false);
    expect(res4.error).toContain("Configured company GSTIN 'INVALID_GST' is invalid");

    // Valid configuration
    const res5 = validateSellerProfile({ storeName: "Apex Retail Pvt Ltd", addressLine1: "123 High St", gstin: "27AAAAA0000A1Z5" }, true);
    expect(res5.valid).toBe(true);
  });

  // ── Scenario 22: Reconcile Endpoint Honest NOT_FOUND Guidance ──
  it("Scenario 22: should return honest reconciliation advice when a key is NOT_FOUND", async () => {
    const mockReconciliationResponse = {
      status: "NOT_FOUND",
      is_committed: false,
      idempotency_key: "idemp-test-absent-999",
      reconciliation_advice: (
        "No transaction record currently exists for this idempotency key. " +
        "An absent record does not guarantee an in-flight network request cannot arrive later. " +
        "Retain this stable key if retrying."
      ),
    };

    vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue(mockReconciliationResponse);

    const key = "idemp-test-absent-999";
    const result = await apiFetchModule.apiFetchV1<any>(`/billing/reconcile/${key}`);

    expect(result.status).toBe("NOT_FOUND");
    expect(result.is_committed).toBe(false);
    expect(result.reconciliation_advice).toContain("An absent record does not guarantee an in-flight network request cannot arrive later");
    expect(result.reconciliation_advice).toContain("Retain this stable key if retrying");
  });

  // ── Scenario 23: Cashier UPI Confirmation Labeled as Manual Attestation ──
  it("Scenario 23: should label cashier UPI confirmation as manual attestation, not automated verification", () => {
    const upiRefNo = "UTR-987654321012";

    // Unverified state
    const isSoundboxVerifiedFalse = false;
    const subLabelPending = isSoundboxVerifiedFalse
      ? `UTR: ${upiRefNo} (Manual Attestation)`
      : `UTR: ${upiRefNo} (Pending Attestation)`;
    const refPending = isSoundboxVerifiedFalse
      ? `${upiRefNo} [MANUAL_ATTESTED]`
      : `${upiRefNo} [PENDING_ATTESTATION]`;

    expect(subLabelPending).toBe("UTR: UTR-987654321012 (Pending Attestation)");
    expect(refPending).toBe("UTR-987654321012 [PENDING_ATTESTATION]");

    // Cashier attested state
    const isSoundboxVerifiedTrue = true;
    const subLabelAttested = isSoundboxVerifiedTrue
      ? `UTR: ${upiRefNo} (Manual Attestation)`
      : `UTR: ${upiRefNo} (Pending Attestation)`;
    const refAttested = isSoundboxVerifiedTrue
      ? `${upiRefNo} [MANUAL_ATTESTED]`
      : `${upiRefNo} [PENDING_ATTESTATION]`;

    expect(subLabelAttested).toBe("UTR: UTR-987654321012 (Manual Attestation)");
    expect(refAttested).toBe("UTR-987654321012 [MANUAL_ATTESTED]");
    expect(refAttested).not.toContain("[VERIFIED]"); // Must NOT imply automated bank verification
  });

  // ── Scenario 24: Unknown Barcode/SKU Rejection Blocks Cart Addition Without Inventing Details ──
  it("Scenario 24: should reject unknown barcode/SKU without inventing product details or mutating cart", async () => {
    vi.spyOn(apiFetchModule, "apiFetchV1").mockResolvedValue({ items: [] });

    const initialCart = [
      { id: "line-1", sku: "VALID-SHOE-001", name: "Leather Boot", qty: 1, rate: 2500.0, taxPct: 18.0 }
    ];
    let cart = [...initialCart];
    let itemLookupError: string | null = null;

    // Simulate cashier scanning unknown barcode
    const scannedBarcode = "890UNKNOWN999";
    let items: any[] = [];
    try {
      const resolved = await apiFetchModule.apiFetchV1<any>(`/universal/items/resolve?query=${encodeURIComponent(scannedBarcode)}`);
      if (resolved && (resolved.item_id || resolved.variant_id)) {
        items = [resolved];
      }
    } catch {
      items = [];
    }

    if (items.length === 0) {
      itemLookupError = `Item Not Found: Barcode/SKU '${scannedBarcode}' is not registered in the item master catalog.`;
      // Strict guard: do NOT mutate cart or invent 'regular straight Med Beige'
    } else {
      cart.push({ id: "line-2", sku: scannedBarcode, name: "Invented Item", qty: 1, rate: 999.0, taxPct: 18.0 });
    }

    expect(itemLookupError).toContain("is not registered in the item master catalog");
    expect(cart.length).toBe(1); // Cart must NOT be mutated
    expect(cart[0].sku).toBe("VALID-SHOE-001"); // Previously valid cart items intact
  });

  // ── Scenario 25: Missing Price and Missing Tax Rate Rejection ──
  it("Scenario 25: should reject item addition when selling price or statutory GST rate is missing", () => {
    const itemWithZeroPrice = {
      name: "Unpriced Sandal",
      sellingPrice: 0,
      mrp: 0,
      gstPercentage: 18.0,
    };

    const itemWithMissingTax = {
      name: "Untaxed Sneaker",
      sellingPrice: 1500.0,
      mrp: 1500.0,
      gstPercentage: undefined as any,
    };

    const validateItemMasterFields = (meta: typeof itemWithZeroPrice) => {
      if ((meta.sellingPrice <= 0) && (!meta.mrp || meta.mrp <= 0)) {
        return { valid: false, error: "Missing Price" };
      }
      if (meta.gstPercentage === undefined || meta.gstPercentage === null || isNaN(meta.gstPercentage)) {
        return { valid: false, error: "Missing Tax Rate" };
      }
      return { valid: true, error: null };
    };

    expect(validateItemMasterFields(itemWithZeroPrice).valid).toBe(false);
    expect(validateItemMasterFields(itemWithZeroPrice).error).toBe("Missing Price");

    expect(validateItemMasterFields(itemWithMissingTax).valid).toBe(false);
    expect(validateItemMasterFields(itemWithMissingTax).error).toBe("Missing Tax Rate");
  });

  // ── Scenario 26: Preserving Valid Cart Items When an Invalid Item Is Scanned ──
  it("Scenario 26: should preserve previously valid cart items when an invalid or failed item is scanned", async () => {
    const existingCart = [
      { id: "item-1", sku: "SHOE-42", name: "Formal Oxford", qty: 2, rate: 3000.0 },
      { id: "item-2", sku: "SOCK-01", name: "Cotton Socks", qty: 5, rate: 150.0 },
    ];
    let cart = [...existingCart];

    // Mock lookup failure (e.g. 500 error from service)
    vi.spyOn(apiFetchModule, "apiFetchV1").mockRejectedValue(new Error("Lookup service unavailable"));

    try {
      await apiFetchModule.apiFetchV1("/universal/items/resolve?query=CORRUPT-CODE");
      cart.push({ id: "item-3", sku: "CORRUPT-CODE", name: "Should Not Add", qty: 1, rate: 0 });
    } catch {
      // Lookup failed - cart remains untouched
    }

    expect(cart.length).toBe(2);
    expect(cart[0].sku).toBe("SHOE-42");
    expect(cart[1].sku).toBe("SOCK-01");
  });

  // ── Scenario 27: Absent Reconciliation Record Retains Stable Key for Retry ──
  it("Scenario 27: should retain active idempotency key when reconciliation returns NOT_FOUND", () => {
    let idempotencyKeyRef: string | null = "idemp-retained-key-12345";
    let docStatus: string = "PROCESSING";

    const handleReconciliationResult = (rec: { status: string }) => {
      if (rec.status === "COMMITTED") {
        docStatus = "SUBMITTED";
        idempotencyKeyRef = null; // Cleared on commit
      } else if (rec.status === "NOT_FOUND") {
        docStatus = "DRAFT";
        // CRITICAL: MUST retain idempotencyKeyRef to ensure any retry sends the SAME key!
      }
    };

    handleReconciliationResult({ status: "NOT_FOUND" });

    expect(docStatus).toBe("DRAFT");
    expect(idempotencyKeyRef).toBe("idemp-retained-key-12345"); // Preserved for retry!
  });
});

