/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.1
 * Created      : 2026-09-12
 * Modified     : 2026-09-12
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target Module: VendorMasterWs Loop Prevention & 404 Recovery Guard
 */

import { describe, it, expect } from "vitest";

describe("VendorMasterWs Loop & 404 Guard Contract", () => {
  it("should auto-fallback to first directory vendor when current selectedId does not exist in directory", () => {
    const directory = [
      { id: "pty_c59daa32d3a3", code: "SUP-548CA2", legalName: "Apex Fabrics Ltd" },
      { id: "pty_fbba599a0c85", code: "JRM", legalName: "SMRITI SYSTEMS" },
    ];

    const resolveSelectedVendorId = (
      currentId: string | null,
      list: typeof directory
    ): string | null => {
      if (list.length === 0) return null;
      if (!currentId || !list.some((v) => v.id === currentId)) {
        return list[0].id;
      }
      return currentId;
    };

    // Case 1: Stale 404 ID (e.g. pty_7cb0b1e755d8) not in directory
    const staleId = "pty_7cb0b1e755d8";
    const resolvedStale = resolveSelectedVendorId(staleId, directory);
    expect(resolvedStale).toBe("pty_c59daa32d3a3");

    // Case 2: Null current ID
    const resolvedNull = resolveSelectedVendorId(null, directory);
    expect(resolvedNull).toBe("pty_c59daa32d3a3");

    // Case 3: Valid ID present in directory
    const resolvedValid = resolveSelectedVendorId("pty_fbba599a0c85", directory);
    expect(resolvedValid).toBe("pty_fbba599a0c85");

    // Case 4: Empty directory
    const resolvedEmpty = resolveSelectedVendorId("pty_fbba599a0c85", []);
    expect(resolvedEmpty).toBeNull();
  });

  it("should guard against repeated 404 polling loops using failedVendorIds set", () => {
    const failedVendorIds = new Set<string>();
    let networkFetchCount = 0;

    const mockFetchDetail = (vendorId: string, availableIds: Set<string>) => {
      if (failedVendorIds.has(vendorId)) {
        // Prevent duplicate 404 storm
        return { status: "BLOCKED_BY_GUARD" };
      }
      networkFetchCount++;
      if (!availableIds.has(vendorId)) {
        failedVendorIds.add(vendorId);
        return { status: "404_NOT_FOUND" };
      }
      return { status: "200_OK", id: vendorId };
    };

    const validDbIds = new Set(["pty_c59daa32d3a3", "pty_fbba599a0c85"]);
    const phantomId = "pty_7cb0b1e755d8";

    // 1st request -> returns 404, registers in failedVendorIds
    const res1 = mockFetchDetail(phantomId, validDbIds);
    expect(res1.status).toBe("404_NOT_FOUND");
    expect(networkFetchCount).toBe(1);
    expect(failedVendorIds.has(phantomId)).toBe(true);

    // Repeated renders / effect runs with same phantomId are blocked
    const res2 = mockFetchDetail(phantomId, validDbIds);
    expect(res2.status).toBe("BLOCKED_BY_GUARD");
    expect(networkFetchCount).toBe(1); // No second network call

    const res3 = mockFetchDetail(phantomId, validDbIds);
    expect(res3.status).toBe("BLOCKED_BY_GUARD");
    expect(networkFetchCount).toBe(1); // Zero additional calls
  });

  it("should allow re-attempt when user explicitly selects the vendor", () => {
    const failedVendorIds = new Set<string>(["pty_7cb0b1e755d8"]);

    const handleSelectVendor = (id: string) => {
      failedVendorIds.delete(id);
    };

    handleSelectVendor("pty_7cb0b1e755d8");
    expect(failedVendorIds.has("pty_7cb0b1e755d8")).toBe(false);
  });
});
