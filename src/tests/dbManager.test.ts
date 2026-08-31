/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.0
 * Created      : 2026-08-20
 * Modified     : 2026-08-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect } from "vitest";
import {
  LAUNCHPAD_CATALOG,
  getVisibleLaunchpadTiles
} from "../components/launchpad/launchpadCatalog";
import { resolveNavigation } from "../components/shell/navigationResolver";

describe("Database Manager (DB Studio) Frontend Governance", () => {
  it("should have database-manager registered in LAUNCHPAD_CATALOG", () => {
    const dbTile = LAUNCHPAD_CATALOG.find((t) => t.id === "database-manager");
    expect(dbTile).toBeDefined();
    expect(dbTile?.title).toBe("Database Manager (DB Studio)");
    expect(dbTile?.group).toBe("System & Operations");
    expect(dbTile?.roles).toEqual(["SYSADMIN"]);
  });

  it("should show database-manager tile only for SYSADMIN role", () => {
    const sysadminTiles = getVisibleLaunchpadTiles("SYSADMIN");
    expect(sysadminTiles.some((t) => t.id === "database-manager")).toBe(true);

    const cashierTiles = getVisibleLaunchpadTiles("CASHIER");
    expect(cashierTiles.some((t) => t.id === "database-manager")).toBe(false);

    const managerTiles = getVisibleLaunchpadTiles("MANAGER");
    expect(managerTiles.some((t) => t.id === "database-manager")).toBe(false);

    const nullTiles = getVisibleLaunchpadTiles(undefined);
    expect(nullTiles.some((t) => t.id === "database-manager")).toBe(false);
  });

  it("should resolve database-manager in system navigation context", () => {
    const nav = resolveNavigation({ context: "system", userRole: "SYSADMIN" });
    expect(nav.items.some((item) => item.id === "database-manager")).toBe(true);
  });
});
