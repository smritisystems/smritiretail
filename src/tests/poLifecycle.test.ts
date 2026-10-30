/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.69.0
 * Created      : 2026-07-11
 * Modified     : 2026-10-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Frontend Tests — Purchase Order Lifecycle
 */

import { describe, it, expect } from "vitest";
import {
  normalizePurchaseStatus,
  buildPurchaseOrderDetailUrl,
  buildVendor360SelectionKey,
} from "../components/purchase/poLifecycle.ts";

describe("purchase lifecycle remediation", () => {
  it("interprets the persisted backend status as confirmed/submitted lifecycle state", () => {
    expect(normalizePurchaseStatus("CONFIRMED")).toBe("Confirmed");
    expect(normalizePurchaseStatus("Draft")).toBe("Draft");
  });

  it("builds a persisted PO lookup route from the order number", () => {
    expect(buildPurchaseOrderDetailUrl("PO-12")).toBe("/purchase/orders/PO-12");
  });

  it("creates a canonical supplier selection key for Vendor 360 navigation", () => {
    expect(buildVendor360SelectionKey("SUPP-OBX-01")).toBe("SUPP-OBX-01");
  });
});
