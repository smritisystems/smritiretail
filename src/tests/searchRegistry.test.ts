import { describe, it, expect, beforeEach } from "vitest";
import { SPK } from "../kernel/SPK.js";
import { ISearchProvider, SearchManifest } from "../kernel/public/ISearchService.js";

describe("SMRITI Universal Search & Filter Framework (SUSF) v1.0", () => {
  beforeEach(() => {
    SPK.search.saveView("item-master", {
      id: "all-items",
      label: "All Items",
      filterState: { type: "ALL" }
    });
  });

  it("registers search manifest and executes search via SPK.search facade", async () => {
    const mockManifest: SearchManifest = {
      moduleId: "customer-master",
      title: "Customer Directory Search",
      icon: "groups",
      defaultSearchFields: ["name", "mobile", "gstin"],
      categories: [
        { id: "retail", label: "Retail Customers" },
        { id: "wholesale", label: "Wholesale Dealers" },
      ],
      filterFields: [
        { key: "city", label: "City", type: "text" },
        { key: "creditLimit", label: "Credit Limit", type: "number_range" },
      ],
      defaultSavedViews: [
        { id: "top-credit", label: "High Credit Customers", filterState: { minCredit: 50000 } }
      ]
    };

    const mockProvider: ISearchProvider = {
      id: "customer-master",
      manifest: mockManifest,
      search: async (query) => {
        return {
          items: [
            { id: "cust-1", name: "Acme Retailers", city: "Mumbai" },
            { id: "cust-2", name: "Apex Traders", city: "Delhi" },
          ],
          totalCount: 2,
          executionTimeMs: 4
        };
      }
    };

    SPK.search.registerProvider(mockProvider);

    const manifest = SPK.search.getManifest("customer-master");
    expect(manifest).toBeDefined();
    expect(manifest?.title).toBe("Customer Directory Search");
    expect(manifest?.defaultSearchFields).toContain("gstin");

    const result = await SPK.search.executeSearch({
      moduleId: "customer-master",
      query: "Acme",
      category: "retail"
    });

    expect(result.totalCount).toBe(2);
    expect(result.items[0].name).toBe("Acme Retailers");

    const history = SPK.search.getHistory("customer-master");
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].query).toBe("Acme");
  });
});
