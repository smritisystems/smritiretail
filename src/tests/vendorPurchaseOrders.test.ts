import { describe, expect, it, vi } from "vitest";
import { fetchVendorPurchaseOrders } from "../components/vendor/tabs/vendorPurchaseOrders.ts";

describe("fetchVendorPurchaseOrders", () => {
  it("queries all known supplier identifiers and combines duplicate-free results", async () => {
    const fetchBySupplier = vi.fn(async (supplierId: string) => {
      if (supplierId === "party-1") return [{ id: "po-1" }];
      if (supplierId === "legacy-1") return { items: [{ id: "po-1" }, { id: "po-2" }] };
      return [];
    });

    const result = await fetchVendorPurchaseOrders(
      { id: "party-1", code: "V001", legacySupplierId: "legacy-1" },
      fetchBySupplier,
    );

    expect(fetchBySupplier).toHaveBeenCalledTimes(4);
    expect(fetchBySupplier).toHaveBeenCalledWith("legacy-1");
    expect(fetchBySupplier).toHaveBeenCalledWith("V001");
    expect(fetchBySupplier).toHaveBeenCalledWith("sup-v001");
    expect(result.orders.map((order) => order.id)).toEqual(["po-1", "po-2"]);
    expect(result.failedIdentifiers).toEqual([]);
  });

  it("reports failed aliases without discarding orders found through another identifier", async () => {
    const fetchBySupplier = vi.fn(async (supplierId: string) => {
      if (supplierId === "party-1") return [{ id: "po-1" }];
      throw new Error(`Lookup failed for ${supplierId}`);
    });

    const result = await fetchVendorPurchaseOrders(
      { id: "party-1", code: "V001", legacySupplierId: "legacy-1" },
      fetchBySupplier,
    );

    expect(result.orders.map((order) => order.id)).toEqual(["po-1"]);
    expect(result.failedIdentifiers).toEqual(["legacy-1", "V001", "sup-v001"]);
    expect(result.identifierCount).toBe(4);
  });

  it("deduplicates equivalent supplier identifiers", async () => {
    const fetchBySupplier = vi.fn(async () => []);

    const result = await fetchVendorPurchaseOrders(
      { id: "sup-v001", code: "V001", legacySupplierId: "sup-v001" },
      fetchBySupplier,
    );

    expect(fetchBySupplier).toHaveBeenCalledTimes(2);
    expect(result.identifierCount).toBe(2);
  });
});
