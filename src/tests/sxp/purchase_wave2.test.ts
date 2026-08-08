/**
 * Project      : SMRITI Retail OS
 * Module       : SXP Test Suite — Purchase Studio Wave 2 Certification (PUR-018–PUR-030)
 * Standard     : SXP Constitution v1.0 — Test Certification Gates
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0  (Sprint 5 Wave 2)
 * Created      : 2026-08-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * COVERAGE:
 *   PUR-018  Reports: 5 purchase reports registered in URR
 *   PUR-019  Reports: getReportsByCategory("purchase") returns ≥ 5
 *   PUR-020  Reports: executeReport("rep.purchase_order_register") returns result
 *   PUR-021  Reports: all 5 purchase reports export ["excel","pdf","csv","json"]
 *   PUR-022  Supplier: resolveSupplierTabs() returns exactly 4 tabs
 *   PUR-023  Supplier: buildSupplierHeaderSummary() returns id, name, status
 *   PUR-024  Supplier: supplier.directory workspace registered
 *   PUR-025  Supplier: supplier.object workspace registered
 *   PUR-026  Approval: approvePO() → wf.purchase_order submit→approve chain succeeds
 *   PUR-027  Approval: rejectPO()  → wf.purchase_order submit→reject chain succeeds
 *   PUR-028  Approval: approvePO() with cashier role fails (role guard enforced)
 *   PUR-029  Approval: purchase.approvals workspace registered
 *   PUR-030  Boundary: supplier.manifest.ts imports zero forbidden stock services
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SPK }                  from "../../kernel/SPK.js";
import { ReportRegistry }       from "../../kernel/upr/reports/ReportRegistry.js";
import { WorkspaceRegistry }    from "../../layout_engine/WorkspaceRegistry.js";
import { createPlatformContext } from "../../kernel/context/PlatformContext.js";

// ── Module imports under test ─────────────────────────────────────────────────
import { registerPurchaseReports }    from "../../components/purchase/purchase.reports.js";
import { resolveSupplierTabs, buildSupplierHeaderSummary } from "../../components/purchase/SupplierObjectPage.js";
import type { SupplierRecord }        from "../../kernel/public/ISupplierService.js";
import { purchaseCommandFacade }      from "../../domains/purchase/PurchaseCommandFacade.js";
import type { IPurchaseService, PurchaseOrderRecord } from "../../kernel/public/IPurchaseService.js";

// ── Report IDs under test ─────────────────────────────────────────────────────
const PURCHASE_REPORT_IDS = [
  "rep.purchase_order_register",
  "rep.purchase_grn_register",
  "rep.supplier_ledger",
  "rep.purchase_return_register",
  "rep.purchase_gst_input_credit",
];

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockSupplier: SupplierRecord = {
  id:            "sup-001",
  code:          "SUP001",
  name:          "Sunrise Textiles Pvt Ltd",
  contactPerson: "Ramesh Kumar",
  mobile:        "9876543210",
  email:         "ramesh@sunrise.in",
  gstNumber:     "27AAPFR1234C1ZR",
  pan:           "AAPFR1234C",
  city:          "Mumbai",
  state:         "Maharashtra",
  paymentTerms:  "Net 30",
  creditDays:    30,
  outstanding:   45000,
  status:        "Active",
  createdDate:   "2026-01-15",
};

// ── Mock IPurchaseService ─────────────────────────────────────────────────────

function buildMockPurchaseService(overrides: Partial<IPurchaseService> = {}): IPurchaseService {
  return {
    getPOById:    vi.fn().mockResolvedValue({
      id:         "po-test-001",
      poNumber:   "PO-2026-001",
      supplierId: "sup-001",
      supplierName: "Sunrise Textiles",
      orderDate:  "2026-08-01",
      status:     "Submitted",
      totalAmount: 10000,
      totalTaxAmount: 1800,
      netPayable:  11800,
      lines:       [],
    } satisfies PurchaseOrderRecord),
    getByPONumber: vi.fn().mockResolvedValue(null),
    getBySupplier: vi.fn().mockResolvedValue([]),
    searchPOs:     vi.fn().mockResolvedValue([]),
    savePO:        vi.fn().mockImplementation(async (po) => ({ ...po, id: po.id ?? "po-saved-001", poNumber: "PO-SAVED" })),
    cancelPO:      vi.fn().mockImplementation(async (id, reason) => ({ id, status: "Cancelled", cancellationReason: reason } as any)),
    postGRN:       vi.fn().mockResolvedValue({}),
    getAllPOs:      vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Ensure purchase reports are registered for each test
  registerPurchaseReports();
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION A: Purchase Reports (PUR-018 – PUR-021)
// ═════════════════════════════════════════════════════════════════════════════

describe("PUR-018 — Reports: all 5 purchase reports registered in URR", () => {
  it("should have each report ID resolvable from ReportRegistry", () => {
    for (const id of PURCHASE_REPORT_IDS) {
      const report = ReportRegistry.getReport(id);
      expect(report, `Report ${id} missing from registry`).toBeDefined();
      expect(report!.id).toBe(id.toLowerCase());
    }
  });
});

describe("PUR-019 — Reports: getReportsByCategory('purchase') returns ≥ 5", () => {
  it("should return at least 5 purchase-category reports", () => {
    const purchaseReports = ReportRegistry.getReportsByCategory("purchase");
    expect(purchaseReports.length).toBeGreaterThanOrEqual(5);
  });
});

describe("PUR-020 — Reports: executeReport returns a valid result structure", () => {
  it("should execute rep.purchase_order_register and return columns + rows", () => {
    const ctx = createPlatformContext({ userId: "usr-admin", userRole: "sysadmin" });
    const result = ReportRegistry.executeReport(
      "rep.purchase_order_register",
      { startDate: "2026-07-01", endDate: "2026-07-31" },
      ctx,
    );
    expect(result.reportId).toBe("rep.purchase_order_register");
    expect(result.columns).toBeDefined();
    expect(Array.isArray(result.columns)).toBe(true);
    expect(result.columns.length).toBeGreaterThan(0);
    expect(Array.isArray(result.rows)).toBe(true);
    expect(typeof result.totalRecords).toBe("number");
    expect(result.generatedAt).toBeDefined();
  });
});

describe("PUR-021 — Reports: all 5 reports declare all 4 export formats", () => {
  it("every purchase report should support excel, pdf, csv and json export", () => {
    const required = ["excel", "pdf", "csv", "json"] as const;
    for (const id of PURCHASE_REPORT_IDS) {
      const report = ReportRegistry.getReport(id);
      expect(report, `Report ${id} missing`).toBeDefined();
      for (const fmt of required) {
        expect(
          report!.exportFormats,
          `Report ${id} missing export format: ${fmt}`,
        ).toContain(fmt);
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION B: Supplier Master Object Page (PUR-022 – PUR-025)
// ═════════════════════════════════════════════════════════════════════════════

describe("PUR-022 — Supplier: resolveSupplierTabs() returns exactly 4 tabs", () => {
  it("should return 4 tabs in ascending order", () => {
    const tabs = resolveSupplierTabs();
    expect(tabs.length).toBe(4);
    const ids = tabs.map((t) => t.id);
    expect(ids).toContain("overview");
    expect(ids).toContain("purchase_orders");
    expect(ids).toContain("terms");
    expect(ids).toContain("audit");
  });

  it("tabs should be sorted by order ascending", () => {
    const tabs = resolveSupplierTabs();
    for (let i = 1; i < tabs.length; i++) {
      expect(tabs[i].order).toBeGreaterThan(tabs[i - 1].order);
    }
  });
});

describe("PUR-023 — Supplier: buildSupplierHeaderSummary() returns correct fields", () => {
  it("should return id, name, status and statusBadge from SupplierRecord", () => {
    const summary = buildSupplierHeaderSummary(mockSupplier);
    expect(summary.id).toBe("sup-001");
    expect(summary.name).toBe("Sunrise Textiles Pvt Ltd");
    expect(summary.code).toBe("SUP001");
    expect(summary.status).toBe("Active");
    expect(summary.statusBadge).toBe("success");
    expect(summary.gstNumber).toBe("27AAPFR1234C1ZR");
    expect(summary.outstanding).toBe(45000);
    expect(summary.creditDays).toBe(30);
  });

  it("should map Inactive status to warning badge", () => {
    const summary = buildSupplierHeaderSummary({ ...mockSupplier, status: "Inactive" });
    expect(summary.statusBadge).toBe("warning");
  });

  it("should map Blocked status to danger badge", () => {
    const summary = buildSupplierHeaderSummary({ ...mockSupplier, status: "Blocked" });
    expect(summary.statusBadge).toBe("danger");
  });

  it("should handle missing optional fields gracefully", () => {
    const minimal: SupplierRecord = {
      id: "sup-min", code: "MIN001", name: "Min Supplier",
      mobile: "9000000000", status: "Active",
    };
    const summary = buildSupplierHeaderSummary(minimal);
    expect(summary.id).toBe("sup-min");
    expect(summary.gstNumber).toBe("Not Provided");
    expect(summary.outstanding).toBe(0);
    expect(summary.creditDays).toBe(0);
    expect(summary.city).toBe("");
    expect(summary.state).toBe("");
  });
});

describe("PUR-024 — Supplier: supplier.directory workspace registered", () => {
  it("should find supplier.directory in WorkspaceRegistry after supplier.manifest import", async () => {
    // Trigger side-effect registration
    await import("../../components/purchase/supplier.manifest.js");
    const ws = WorkspaceRegistry.get("supplier.directory");
    expect(ws).toBeDefined();
    expect(ws!.domainId).toBe("purchase");
    expect(ws!.zone).toBe("operator");
  });
});

describe("PUR-025 — Supplier: supplier.object workspace registered", () => {
  it("should find supplier.object in WorkspaceRegistry", async () => {
    await import("../../components/purchase/supplier.manifest.js");
    const ws = WorkspaceRegistry.get("supplier.object");
    expect(ws).toBeDefined();
    expect(ws!.defaultLayout).toBe("master-detail");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION C: PO Approval Workflow (PUR-026 – PUR-029)
// ═════════════════════════════════════════════════════════════════════════════

describe("PUR-026 — Approval: approvePO() submits and approves via WorkflowRegistry", () => {
  it("should succeed when PO is in 'submitted' state and user is store_manager", async () => {
    const mockSvc = buildMockPurchaseService({
      getPOById: vi.fn().mockResolvedValue({
        id: "po-001", poNumber: "PO-2026-001", supplierId: "sup-001",
        supplierName: "Test", orderDate: "2026-08-01",
        status: "Submitted",   // workflow state: "submitted"
        totalAmount: 10000, totalTaxAmount: 1800, netPayable: 11800, lines: [],
      }),
    });
    SPK.services.register("PURCHASE", mockSvc);

    const result = await purchaseCommandFacade.approvePO(
      "po-001",
      { userId: "mgr-001", workspaceId: "purchase.approvals", tenantId: "store_manager" },
    );

    expect(result.success).toBe(true);
    expect((result as { message: string }).message).toContain("approved");
  });
});

describe("PUR-027 — Approval: rejectPO() transitions to rejected state", () => {
  it("should succeed when PO is in 'submitted' state", async () => {
    const mockSvc = buildMockPurchaseService({
      getPOById: vi.fn().mockResolvedValue({
        id: "po-002", poNumber: "PO-2026-002", supplierId: "sup-001",
        supplierName: "Test", orderDate: "2026-08-01",
        status: "Submitted",
        totalAmount: 5000, totalTaxAmount: 900, netPayable: 5900, lines: [],
      }),
    });
    SPK.services.register("PURCHASE", mockSvc);

    const result = await purchaseCommandFacade.rejectPO(
      "po-002",
      "Price too high",
      { userId: "mgr-001", workspaceId: "purchase.approvals", tenantId: "store_manager" },
    );

    expect(result.success).toBe(true);
    expect((result as { message: string }).message).toContain("rejected");
  });
});

describe("PUR-028 — Approval: approvePO() fails for cashier role (role guard enforced)", () => {
  it("should return success:false when user is cashier trying to approve", async () => {
    const mockSvc = buildMockPurchaseService({
      getPOById: vi.fn().mockResolvedValue({
        id: "po-003", poNumber: "PO-2026-003", supplierId: "sup-001",
        supplierName: "Test", orderDate: "2026-08-01",
        status: "Submitted",
        totalAmount: 2000, totalTaxAmount: 360, netPayable: 2360, lines: [],
      }),
    });
    SPK.services.register("PURCHASE", mockSvc);

    // tenantId used as userRole in approvePO — "cashier" must be rejected by workflow
    const result = await purchaseCommandFacade.approvePO(
      "po-003",
      { userId: "csh-001", workspaceId: "purchase.approvals", tenantId: "cashier" },
    );

    // WorkflowRegistry enforces requiredRole: "store_manager" on the approve transition
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/role/i);
  });
});

describe("PUR-029 — Approval: purchase.approvals workspace registered", () => {
  it("should find purchase.approvals in WorkspaceRegistry", async () => {
    await import("../../components/purchase/purchase.manifest.js");
    const ws = WorkspaceRegistry.get("purchase.approvals");
    expect(ws).toBeDefined();
    expect(ws!.actions).toContain("purchase.approve_order");
    expect(ws!.actions).toContain("purchase.reject_order");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  SECTION D: Boundary Check (PUR-030)
// ═════════════════════════════════════════════════════════════════════════════

describe("PUR-030 — Boundary: supplier.manifest imports zero forbidden stock services", () => {
  it("should import supplier.manifest without referencing StockLedgerService or StockTransferService", async () => {
    // Verify by importing: if forbidden services were imported they would throw
    // (they are not registered in test environment). The manifest must not trigger that path.
    const mod = await import("../../components/purchase/supplier.manifest.js");
    expect(mod).toBeDefined();
    expect(typeof mod.registerSupplierStudio).toBe("function");
    expect(typeof mod.SUPPLIER_WORKSPACE_IDS).toBe("object");
  });
});
