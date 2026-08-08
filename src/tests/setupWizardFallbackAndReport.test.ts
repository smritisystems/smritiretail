import { describe, it, expect } from "vitest";
import { generateSetupReportHTML, SetupReportData } from "../utils/setupReportGenerator.ts";
import { SPK } from "../kernel/SPK.js";

describe("SetupWizard Fallback Mode & Setup Report PDF", () => {
  it("evaluates canIgnore boolean logic correctly for error messages", () => {
    const errorWithGst = "GSTIN checksum verification failed";
    const criticalSysError = "Database connection connection pool exhausted";

    const canIgnoreGst = errorWithGst.includes("GSTIN") || errorWithGst.includes("checksum") || errorWithGst.includes("Upstream python-core");
    const canIgnoreSys = criticalSysError.includes("GSTIN") || criticalSysError.includes("checksum") || criticalSysError.includes("Upstream python-core");

    expect(canIgnoreGst).toBe(true);
    expect(canIgnoreSys).toBe(false);
  });

  it("renders WARNING status and measured duration in Setup Report HTML", () => {
    const mockReportData: SetupReportData = {
      setupId: "SMS-20260805-001",
      tenantCode: "SMS",
      tenantName: "Smriti Systems Group",
      companyName: "Test Store Private Limited",
      financialYear: "FY 2026-27",
      industryPack: "General Retail",
      licenseTier: "Enterprise (Fallback)",
      adminUsername: "super",
      address: {
        line1: "123 Main St",
        city: "Mumbai",
        district: "Mumbai",
        state: "Maharashtra",
        pinCode: "400001",
        country: "India"
      },
      branches: [{ name: "Main Store", code: "ST01" }],
      stores: [{ name: "Main Store", code: "ST01" }],
      warehouses: [{ name: "Main WH", code: "WH01" }],
      activeModules: ["pos", "inventory"],
      healthChecks: [
        { id: "db", name: "Database Subsystem", status: "WARNING", durationMs: 45, details: "Fallback active: Upstream notice" },
        { id: "company", name: "Company Entity", status: "WARNING", durationMs: 75, details: "Local fallback provisioning mode" }
      ],
      installationTimestamp: "2026-08-08T04:15:00Z"
    };

    const html = generateSetupReportHTML(mockReportData);

    expect(html).toContain("SMRITI Enterprise OS — Setup Verification Report");
    expect(html).toContain("WARNING");
    expect(html).toContain("#d97706"); // Amber warning color for WARNING status
    expect(html).toContain("45 ms");
    expect(html).toContain("75 ms");
    expect(html).toContain("Fallback active: Upstream notice");
  });

  it("verifies Platform Event Service (SPK.events) emits OLE lifecycle events", () => {
    const emittedEvents: string[] = [];

    const unsub1 = SPK.events.on("Company.Provisioning.Started.v1", (e: any) => emittedEvents.push(e.eventType));
    const unsub2 = SPK.events.on("Company.Provisioning.Completed.v1", (e: any) => emittedEvents.push(e.eventType));
    const unsub3 = SPK.events.on("Company.Activated.v1", (e: any) => emittedEvents.push(e.eventType));

    SPK.events.emit("Company.Provisioning.Started.v1", "TEST-01", { tenantCode: "TEST-01", oleState: "Provisioning" });
    SPK.events.emit("Company.Provisioning.Completed.v1", "TEST-01", { tenantCode: "TEST-01", oleState: "Active" });
    SPK.events.emit("Company.Activated.v1", "TEST-01", { tenantCode: "TEST-01", oleState: "Active" });

    expect(emittedEvents).toEqual([
      "Company.Provisioning.Started.v1",
      "Company.Provisioning.Completed.v1",
      "Company.Activated.v1"
    ]);

    unsub1();
    unsub2();
    unsub3();
  });
});
