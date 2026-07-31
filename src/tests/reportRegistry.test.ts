/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Report Registry (URR Phase 5 Core) Unit Tests
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 & URR Standard v1.0 Compliance
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { describe, expect, it, beforeEach } from "vitest";
import { SPK } from "../kernel/SPK.js";
import { createPlatformContext } from "../kernel/context/PlatformContext.js";
import { ReportRegistry, type ReportDefinition } from "../kernel/upr/reports/ReportRegistry.js";

describe("Universal Report Registry (URR Phase 5 Core)", () => {
  beforeEach(() => {
    ReportRegistry.clear();
  });

  it("should seed default reports (sales summary, inventory stock)", () => {
    const reports = SPK.reports.getReports();
    expect(reports.length).toBeGreaterThanOrEqual(2);

    const salesRep = SPK.reports.getReport("rep.sales_summary");
    expect(salesRep).toBeDefined();
    expect(salesRep?.category).toBe("sales");
    expect(salesRep?.columns.length).toBeGreaterThanOrEqual(5);
  });

  it("should filter reports by category", () => {
    const salesReports = SPK.reports.getReportsByCategory("sales");
    expect(salesReports.length).toBeGreaterThanOrEqual(1);
    expect(salesReports[0].id).toBe("rep.sales_summary");
  });

  it("should execute analytical report projection", () => {
    const context = createPlatformContext();
    const result = SPK.reports.executeReport("rep.sales_summary", { startDate: "2026-07-01", endDate: "2026-07-31" }, context);

    expect(result.reportId).toBe("rep.sales_summary");
    expect(result.totalRecords).toBeGreaterThan(0);
    expect(result.rows.length).toBe(2);
    expect(result.summary?.totalRevenue).toBe(4130);
  });

  it("should support dynamic registration of plugin reports", () => {
    const customReport: ReportDefinition = {
      id: "rep.jewellery_gold_sales",
      name: "Gold & Diamond Sales Register",
      category: "sales",
      entityId: "jewellery_bill",
      permissionId: "sales.pos.billing",
      exportFormats: ["excel", "pdf"],
      parameters: [{ id: "purity", label: "Gold Purity (Karat)", type: "select", defaultValue: "22K" }],
      columns: [
        { id: "billNo", label: "Invoice #", dataType: "string" },
        { id: "karat", label: "Purity", dataType: "string" },
        { id: "weightGram", label: "Net Weight (g)", dataType: "number", align: "right" },
        { id: "amount", label: "Total Amount (₹)", dataType: "currency", align: "right" }
      ]
    };

    SPK.reports.registerReport(customReport);

    const registered = SPK.reports.getReport("rep.jewellery_gold_sales");
    expect(registered).toBeDefined();
    expect(registered?.name).toBe("Gold & Diamond Sales Register");
  });
});
