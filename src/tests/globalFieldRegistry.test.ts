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
    expect(itemCode?.lookupGroup).toBe("item");
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

    expect(productLookup?.endpoint).toContain("/masters/lookup/product/values");
    expect(productLookup?.insertValueKeys).toContain("name");
    expect(customerLookup?.endpoint).toContain("/customers");
    expect(customerLookup?.insertValueKeys).toContain("customer_name");
  });

  it("should route Item Master catalog fields to governed lookup types", () => {
    expect(getFieldMetadata("brand")?.lookupGroup).toBe("brand");
    expect(getFieldMetadata("style_article")?.lookupGroup).toBe("style_article");
    expect(getFieldMetadata("size")?.lookupGroup).toBe("size");
    expect(getFieldMetadata("color")?.lookupGroup).toBe("color");
    expect(getFieldMetadata("vendor_code")?.lookupGroup).toBe("vendor_code");
    expect(getLookupMetadata("brand")?.endpoint).toBe("/masters/lookup/brand/values");
    expect(getLookupMetadata("style_article")?.insertValueKeys).toContain("name");
  });

  it("should resolve organization lookups from their scoped master APIs", () => {
    expect(getFieldMetadata("branch_code")?.lookupGroup).toBe("branch");
    expect(getFieldMetadata("branch_code")?.sourceTable).toBe("branches");
    expect(getLookupMetadata("branch")?.endpoint).toBe("/masters/branch");
    expect(getLookupMetadata("store")?.endpoint).toBe("/masters/store");
    expect(getLookupMetadata("warehouse")?.endpoint).toBe("/masters/warehouse");
  });

  it("should resolve statutory catalog references from authoritative APIs", () => {
    expect(getLookupMetadata("uom")?.endpoint).toBe("/localization/uoms");
    expect(getLookupMetadata("hsn")?.endpoint).toBe("/localization/hsn-sac");
  });

  it("should resolve warehouse locations from the scoped WMS master", () => {
    expect(getLookupMetadata("location")?.endpoint).toBe("/wms/locations");
  });
});
