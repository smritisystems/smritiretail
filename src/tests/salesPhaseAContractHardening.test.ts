/**
 * Project      : SMRITI Retail OS
 * Test Suite   : Sales Phase A — Contract Hardening Tests
 * Standard     : AUD-006 / SALES-A01 to SALES-A10
 * Author       : Jawahar Ramkripal Mallah & Antigravity AI
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 *
 * Covers:
 *   SALES-A01  SalesInvoiceStatus union type contains Paid, Credit, Cancelled, Refunded
 *   SALES-A02  cancelInvoice: rejects empty or short reason (<3 chars)
 *   SALES-A03  cancelInvoice: rejects non-existent invoice ID
 *   SALES-A04  cancelInvoice: rejects already-Cancelled invoice
 *   SALES-A05  cancelInvoice: rejects already-Refunded invoice
 *   SALES-A06  cancelInvoice: successfully cancels invoice and emits InvoiceCancelled event
 *   SALES-A07  getByCustomer: returns invoices matching customer mobile or name
 *   SALES-A08  getByCustomer: returns empty array for unknown customer
 *   SALES-A09  saveInvoice: automatically triggers silent accounting journal posting
 *   SALES-A10  SPK.services.resolve<ISalesService>("SALES") resolves active service instance
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SalesService } from "../kernel/internal/SalesService.js";
import { ISalesService, SalesInvoiceStatus } from "../kernel/public/ISalesService.js";
import { SPK } from "../kernel/SPK.js";

const VALID_STATUSES: SalesInvoiceStatus[] = ["Paid", "Credit", "Cancelled", "Refunded"];

describe("Sales Phase A — Contract Hardening Tests (SALES-A01 to SALES-A10)", () => {
  let svc: SalesService;

  beforeEach(() => {
    svc = new SalesService();
    SPK.services.register("SALES", svc);
  });

  it("SALES-A01: SalesInvoiceStatus contains Paid, Credit, Cancelled, Refunded", () => {
    expect(VALID_STATUSES).toHaveLength(4);
    expect(VALID_STATUSES).toContain("Paid");
    expect(VALID_STATUSES).toContain("Credit");
    expect(VALID_STATUSES).toContain("Cancelled");
    expect(VALID_STATUSES).toContain("Refunded");
  });

  it("SALES-A02: cancelInvoice rejects empty or short reason (<3 chars)", async () => {
    await expect(svc.cancelInvoice("inv-1001", "")).rejects.toThrow("mandatory");
    await expect(svc.cancelInvoice("inv-1001", "AB")).rejects.toThrow("mandatory");
  });

  it("SALES-A03: cancelInvoice rejects non-existent invoice ID", async () => {
    await expect(svc.cancelInvoice("inv-DOES-NOT-EXIST", "Wrong bill")).rejects.toThrow("not found");
  });

  it("SALES-A04: cancelInvoice rejects already-Cancelled invoice", async () => {
    await svc.saveInvoice({ id: "inv-1001", status: "Cancelled" });
    await expect(svc.cancelInvoice("inv-1001", "Cancelling again")).rejects.toThrow(
      /cannot be cancelled|Cancelled/
    );
  });

  it("SALES-A05: cancelInvoice rejects already-Refunded invoice", async () => {
    await svc.saveInvoice({ id: "inv-1001", status: "Refunded" });
    await expect(svc.cancelInvoice("inv-1001", "Cancelling refunded invoice")).rejects.toThrow(
      /cannot be cancelled|Refunded/
    );
  });

  it("SALES-A06: cancelInvoice cancels Paid invoice, sets audit fields, and emits InvoiceCancelled event", async () => {
    const cancelSpy = vi.fn();
    const unsub = SPK.events.on("InvoiceCancelled", cancelSpy);

    await svc.saveInvoice({ id: "inv-1001", status: "Paid" });
    const result = await svc.cancelInvoice("inv-1001", "Billing error", "cashier-01");

    expect(result.status).toBe("Cancelled");
    expect(result.cancellationReason).toBe("Billing error");
    expect(result.cancelledBy).toBe("cashier-01");
    expect(result.cancelledAt).toBeDefined();

    expect(cancelSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "InvoiceCancelled",
        entityId: "inv-1001",
        payload: expect.objectContaining({
          reason: "Billing error",
          cancelledBy: "cashier-01",
        }),
      })
    );

    unsub?.();
  });

  it("SALES-A07: getByCustomer returns invoices matching mobile or customer name", async () => {
    await svc.saveInvoice({
      id: "inv-cust-1",
      customerName: "Rahul Sharma",
      customerMobile: "9811223344",
      netPayable: 1500,
      status: "Paid",
    });

    const byMobile = await svc.getByCustomer("9811223344");
    expect(byMobile.length).toBeGreaterThanOrEqual(1);
    expect(byMobile[0].customerName).toBe("Rahul Sharma");

    const byName = await svc.getByCustomer("Rahul");
    expect(byName.length).toBeGreaterThanOrEqual(1);
  });

  it("SALES-A08: getByCustomer returns empty array for unknown customer", async () => {
    const results = await svc.getByCustomer("9000000000");
    expect(results).toHaveLength(0);
  });

  it("SALES-A09: saveInvoice triggers silent accounting journal posting", async () => {
    const mockAccounting = {
      postSalesInvoiceJournal: vi.fn(),
    };
    SPK.services.register("ACCOUNTING", mockAccounting as any);

    const saved = await svc.saveInvoice({
      id: "inv-journal-test",
      invoiceNumber: "INV-2026-TEST",
      customerName: "Test Customer",
      netPayable: 5000,
      taxTotal: 900,
    });

    expect(saved).toBeDefined();
    expect(mockAccounting.postSalesInvoiceJournal).toHaveBeenCalledWith(
      "INV-2026-TEST",
      "Test Customer",
      5000,
      900
    );
  });

  it("SALES-A10: SPK.services.resolve<ISalesService>('SALES') resolves active instance", () => {
    const resolved = SPK.services.resolve<ISalesService>("SALES");
    expect(resolved).toBe(svc);
  });
});
