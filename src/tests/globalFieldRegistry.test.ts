import { describe, it, expect } from "vitest";
import {
  getFieldMetadata,
  getGlobalFieldCatalog,
  getLookupMetadata,
  getVisibleFieldIds,
} from "../services/globalFieldRegistry.ts";

describe("Global Field Registry", () => {
  it("should resolve canonical item fields with aliases and lookup metadata", () => {
    const itemCode = getFieldMetadata("item_code");
    expect(itemCode).toBeTruthy();
    expect(itemCode?.entity).toBe("item");
    expect(itemCode?.lookupGroup).toBe("product");
    expect(itemCode?.aliases).toContain("sku");
    expect(itemCode?.displayWidthPct).toBeGreaterThanOrEqual(10);
  });

  it("should expose a complete item field catalog", () => {
    const catalog = getGlobalFieldCatalog("item");
    expect(catalog.length).toBeGreaterThan(10);
    expect(catalog.some((field) => field.fieldKey === "barcode")).toBe(true);
    expect(catalog.some((field) => field.fieldKey === "customer_name")).toBe(false);
  });

  it("should provide screen visibility rules for sales and item grid views", () => {
    const salesFields = getVisibleFieldIds("sales_order_form", "item");
    const gridFields = getVisibleFieldIds("item_master_grid", "item");

    expect(salesFields).toContain("item_code");
    expect(salesFields).toContain("barcode");
    expect(gridFields).toContain("product_name");
    expect(gridFields).toContain("selling_price");
  });

  it("should resolve F2 lookup rules for product and customer entities", () => {
    const productLookup = getLookupMetadata("product");
    const customerLookup = getLookupMetadata("customer");

    expect(productLookup?.endpoint).toContain("/universal/items");
    expect(productLookup?.insertValueKeys).toContain("item_code");
    expect(customerLookup?.endpoint).toContain("/customers");
    expect(customerLookup?.insertValueKeys).toContain("customer_name");
  });
});
