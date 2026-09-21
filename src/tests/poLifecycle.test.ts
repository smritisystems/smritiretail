import { describe, it, expect } from "vitest";
import {
  normalizePurchaseStatus,
  buildPurchaseOrderDetailUrl,
  buildVendor360SelectionKey,
} from "../components/purchase/poLifecycle.ts";

describe("purchase lifecycle remediation", () => {
  it("interprets the persisted backend status as confirmed/submitted lifecycle state", () => {
    expect(normalizePurchaseStatus("CONFIRMED")).toBe("Confirmed / Submitted");
    expect(normalizePurchaseStatus("Draft")).toBe("Draft");
  });

  it("builds a persisted PO lookup route from the order number", () => {
    expect(buildPurchaseOrderDetailUrl("PO-12")).toBe("/purchase/orders/PO-12");
  });

  it("creates a canonical supplier selection key for Vendor 360 navigation", () => {
    expect(buildVendor360SelectionKey("SUPP-OBX-01")).toBe("SUPP-OBX-01");
  });
});
