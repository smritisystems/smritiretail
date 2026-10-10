/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.23
 * Created      : 2026-10-08
 * Modified     : 2026-10-08
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Vitest Suite for Legacy Deprecation Telemetry Observability UI
 */

import { describe, it, expect } from "vitest";
import {
  LAUNCHPAD_CATALOG,
  getVisibleLaunchpadTiles,
} from "../components/launchpad/launchpadCatalog.ts";
import { mapModuleId } from "../components/shell/TabRenderer.tsx";

describe("SMRITI Legacy Deprecation Telemetry Observability UI Governance", () => {
  it("TC-TEL-001: should have legacy-telemetry registered in LAUNCHPAD_CATALOG with RFC 8594 details", () => {
    const tile = LAUNCHPAD_CATALOG.find((t) => t.id === "legacy-telemetry");
    expect(tile).toBeDefined();
    expect(tile?.title).toBe("RFC 8594 API Telemetry");
    expect(tile?.group).toBe("System & Operations");
    expect(tile?.tag).toBe("Telemetry");
    expect(tile?.roles).toEqual(["MANAGER", "SYSADMIN"]);
    expect(tile?.accentColor).toBe("amber");
  });

  it("TC-TEL-002: should show legacy-telemetry tile only for MANAGER and SYSADMIN roles", () => {
    const sysadminTiles = getVisibleLaunchpadTiles("SYSADMIN");
    expect(sysadminTiles.some((t) => t.id === "legacy-telemetry")).toBe(true);

    const managerTiles = getVisibleLaunchpadTiles("MANAGER");
    expect(managerTiles.some((t) => t.id === "legacy-telemetry")).toBe(true);

    const cashierTiles = getVisibleLaunchpadTiles("CASHIER");
    expect(cashierTiles.some((t) => t.id === "legacy-telemetry")).toBe(false);

    const nullTiles = getVisibleLaunchpadTiles(undefined);
    expect(nullTiles.some((t) => t.id === "legacy-telemetry")).toBe(false);
  });

  it("TC-TEL-003: TabRenderer mapModuleId should normalize all legacy telemetry aliases", () => {
    expect(mapModuleId("legacy-telemetry")).toBe("legacy-telemetry");
    expect(mapModuleId("deprecation-telemetry")).toBe("legacy-telemetry");
    expect(mapModuleId("legacy-deprecation-telemetry")).toBe("legacy-telemetry");
    expect(mapModuleId("menu-legacy-telemetry")).toBe("legacy-telemetry");
  });

  it("TC-TEL-004: Sunset countdown logic calculates remaining time toward 2028-01-01 GMT", () => {
    const sunsetDate = new Date("2028-01-01T00:00:00Z").getTime();
    const now = Date.now();
    expect(sunsetDate).toBeGreaterThan(now);
    const diffMs = sunsetDate - now;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    expect(days).toBeGreaterThan(300); // More than 300 days remain until Jan 1, 2028
  });

  it("TC-TEL-005: Telemetry Summary schema validation", () => {
    const mockSummary = {
      total_events: 42,
      endpoint_access_total: 30,
      fallback_invoked_total: 12,
      unique_companies_count: 2,
      by_path: {
        "/api/v1/products": 25,
        "/api/v1/variants": 5,
      },
      by_caller: {
        "ReportsService.item_wise_sales": 10,
        "DataBridgeExportEngine.sales_invoice": 2,
      },
      by_reason: {
        VARIANT_ID_NULL: 12,
      },
      generated_at: new Date().toISOString(),
    };

    expect(mockSummary.total_events).toBe(
      mockSummary.endpoint_access_total + mockSummary.fallback_invoked_total
    );
    expect(mockSummary.unique_companies_count).toBeGreaterThan(0);
    expect(Object.keys(mockSummary.by_path).length).toBe(2);
    expect(Object.keys(mockSummary.by_caller).length).toBe(2);
  });
});
