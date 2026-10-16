/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.87.0
 * Created      : 2026-10-16
 * Modified     : 2026-10-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect, vi } from "vitest";
import { LAUNCHPAD_CATALOG } from "../components/launchpad/launchpadCatalog.ts";
import { resolveNavigation } from "../components/shell/navigationResolver.ts";

describe("Procurement & Reports Architecture Integration Audit", () => {
  it("should have report-designer and purchase tiles in LAUNCHPAD_CATALOG", () => {
    const reportTile = LAUNCHPAD_CATALOG.find((t) => t.id === "report-designer");
    const purchaseTile = LAUNCHPAD_CATALOG.find((t) => t.id === "purchase");

    expect(reportTile).toBeDefined();
    expect(reportTile?.group).toBe("Finance & Ledgers");
    expect(reportTile?.roles).toContain("MANAGER");

    expect(purchaseTile).toBeDefined();
    expect(purchaseTile?.group).toBe("Retail Operations");
    expect(purchaseTile?.tag).toBe("Procurement");
  });

  it("should resolve Purchase & Procurement navigation context with operational items", () => {
    const nav = resolveNavigation({ context: "purchase" });
    expect(nav.context).toBe("purchase");
    expect(nav.contextLabel).toBe("Purchase & Procurement");

    const itemIds = nav.items.map((i) => i.id);
    expect(itemIds).toContain("purchase");
    expect(itemIds).toContain("grn");
    expect(itemIds).toContain("supplier-mgmt");
    expect(itemIds).toContain("approval-matrix");
    expect(itemIds).toContain("reports");
  });

  it("should resolve BI Reports & Analytics navigation context with central studio", () => {
    const nav = resolveNavigation({ context: "reports" });
    expect(nav.context).toBe("reports");
    expect(nav.contextLabel).toBe("BI Reports & Analytics");

    const itemIds = nav.items.map((i) => i.id);
    expect(itemIds).toContain("report-designer");
    expect(itemIds).toContain("business-ledger");
    expect(itemIds).toContain("audit-logs");
  });
});
