import { describe, it, expect, beforeEach } from "vitest";
import { SPK, ILookupProvider, LookupManifest } from "../kernel/SPK.js";

describe("SPK.ule (Universal Lookup Engine) ADR-ULE-001 v2.3 Phase 1 Milestones", () => {
  beforeEach(() => {
    SPK.ule.saveView("ITEM", {
      id: "low-stock-items",
      name: "Low Stock SKUs",
      description: "Items below minimum safety stock level",
      createdBy: "USER-101",
      createdOn: new Date().toISOString(),
      owner: "SYSTEM",
      shared: true,
      filters: { type: "LOW_STOCK" }
    });
  });

  it("P1.1 - P1.6: Implements versioned manifests, RBAC field masking, pagination, saved views, and provider lifecycle", async () => {
    const mockManifest: LookupManifest = {
      manifestVersion: "2.3.0",
      schemaVersion: "1.0.0",
      minimumKernelVersion: "1.0.0",
      domain: "CUSTOMER",
      title: "Customer Discovery Studio",
      icon: "groups",
      defaultColumns: [
        { key: "code", label: "Customer Code", type: "text" },
        { key: "name", label: "Customer Name", type: "text" },
        { key: "city", label: "City", type: "text" }
      ],
      searchFields: ["name", "mobile", "code"],
      filterGroups: [
        {
          id: "geography",
          label: "Geographic Location",
          fields: [{ key: "city", label: "City", type: "select", options: [{ label: "Mumbai", value: "Mumbai" }] }]
        }
      ],
      sortOptions: [{ label: "Name", key: "name", order: "asc" }],
      savedViews: [
        {
          id: "vip-customers",
          name: "VIP Accounts",
          createdBy: "USER-101",
          createdOn: new Date().toISOString(),
          owner: "SYSTEM",
          shared: true,
          filters: { vip: true }
        }
      ],
      permissions: {
        readScope: "customer:read",
        costScope: "customer:read_financials"
      },
      quickActions: [
        { id: "quick-add", label: "New Customer", icon: "user-plus", permission: "customer:create", shortcut: "Ctrl+N" }
      ],
      keyboardShortcuts: { universalSearch: "F2" },
      defaultLayout: "table",
      supportedModes: ["field", "grid", "workspace", "global"],
      capabilities: {
        barcode: false,
        qr: true,
        voice: false,
        ai: true,
        bulkSelection: true,
        quickCreate: true
      }
    };

    const mockProvider: ILookupProvider = {
      domain: "CUSTOMER",
      state: "ACTIVE",
      manifest: mockManifest,
      search: async (query: string) => [
        {
          id: "c-1",
          code: "CUST-001",
          name: "Reliance Store",
          title: "Reliance Store",
          subtitle: "CUST-001 • Mumbai",
          type: "CUSTOMER",
          columns: { code: "CUST-001", name: "Reliance Store", city: "Mumbai", costPrice: 5000 },
          metadata: { city: "Mumbai", costPrice: 5000 }
        }
      ],
      getById: async (id: string) => ({
        id,
        code: "CUST-001",
        name: "Reliance Store",
        title: "Reliance Store",
        type: "CUSTOMER",
        columns: { code: "CUST-001", name: "Reliance Store" },
        metadata: { city: "Mumbai" }
      })
    };

    // 1. P1.1 & P1.2: Register Provider with Versioned Manifest
    SPK.ule.registerProvider(mockProvider);

    const manifest = SPK.ule.getManifest("CUSTOMER");
    expect(manifest).toBeDefined();
    expect(manifest?.manifestVersion).toBe("2.3.0");
    expect(manifest?.capabilities.quickCreate).toBe(true);

    // 2. P1.3: RBAC Field Masking (SYSADMIN lacks customer:read_financials by default)
    const items = await SPK.ule.search("CUSTOMER", "Reliance");
    expect(items.length).toBe(1);
    expect(items[0].metadata.costPrice).toBeUndefined(); // Masked!

    // 3. P1.4: Advanced Search with Cursor Pagination
    const searchRes = await SPK.ule.searchAdvanced({
      domain: "CUSTOMER",
      query: "Reliance",
      limit: 10,
      offset: 0
    });

    expect(searchRes.items.length).toBe(1);
    expect(searchRes.page).toBe(1);
    expect(searchRes.pageSize).toBe(10);
    expect(searchRes.hasMore).toBe(false);

    // 4. P1.5: Platform Saved Views with Auditing
    const savedViews = SPK.ule.getSavedViews("CUSTOMER");
    expect(savedViews.length).toBe(1);
    expect(savedViews[0].name).toBe("VIP Accounts");
    expect(savedViews[0].createdBy).toBe("USER-101");

    // 5. P1.6: Search History Engine
    const history = SPK.ule.getHistory("CUSTOMER");
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].query).toBe("Reliance");

    // 6. Provider Lifecycle (DISABLED State)
    SPK.ule.setProviderState("CUSTOMER", "DISABLED");
    const disabledItems = await SPK.ule.search("CUSTOMER", "Reliance");
    expect(disabledItems.length).toBe(0);
  });
});
