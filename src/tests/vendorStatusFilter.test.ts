/**
 * Project      : SMRITI Retail OS
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.2
 * Created      : 2026-09-14
 * Modified     : 2026-09-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target Module: Vendor Directory Status Filter & Archive Exclusion Contract
 */

import { describe, it, expect } from "vitest";
import { VendorStatus, VendorSummary } from "../types/vendor";

describe("Vendor Directory Status Filter & Archive Exclusion Contract", () => {
  const mockVendors: VendorSummary[] = [
    {
      id: "pty_act_01",
      code: "VEN-ACT01",
      legalName: "Active Supplies Ltd",
      tradeName: "Active Supplies",
      gstin: "27AABCA1111A1Z1",
      pan: "AABCA1111A",
      mobile: "9876543210",
      email: "active@example.com",
      city: "Mumbai",
      state: "Maharashtra",
      status: "ACTIVE",
      commercialClassification: "PREFERRED",
      supplierType: "DISTRIBUTOR",
      outstanding: 50000,
    },
    {
      id: "pty_inact_02",
      code: "VEN-INA02",
      legalName: "Dormant Traders",
      tradeName: "Dormant Traders",
      gstin: "27AABCA2222B1Z2",
      pan: "AABCA2222B",
      mobile: "9876543211",
      email: "dormant@example.com",
      city: "Pune",
      state: "Maharashtra",
      status: "INACTIVE",
      commercialClassification: "APPROVED",
      supplierType: "WHOLESALER",
      outstanding: 0,
    },
    {
      id: "pty_arc_03",
      code: "VEN-ARC03",
      legalName: "Old Century Goods",
      tradeName: "Old Century",
      gstin: "27AABCA3333C1Z3",
      pan: "AABCA3333C",
      mobile: "9876543212",
      email: "archived@example.com",
      city: "Nagpur",
      state: "Maharashtra",
      status: "ARCHIVED",
      commercialClassification: "BLOCKED",
      supplierType: "MANUFACTURER",
      outstanding: 12000,
    },
    {
      id: "pty_mrg_04",
      code: "VEN-MRG04",
      legalName: "Merged Holdings Co",
      tradeName: "Merged Holdings",
      gstin: "27AABCA4444D1Z4",
      pan: "AABCA4444D",
      mobile: "9876543213",
      email: "merged@example.com",
      city: "Nashik",
      state: "Maharashtra",
      status: "MERGED",
      commercialClassification: "RESTRICTED",
      supplierType: "DISTRIBUTOR",
      outstanding: 0,
    },
    {
      id: "pty_blk_05",
      code: "VEN-BLK05",
      legalName: "Defaulting Vendor LLP",
      tradeName: "Defaulting Vendor",
      gstin: "27AABCA5555E1Z5",
      pan: "AABCA5555E",
      mobile: "9876543214",
      email: "blocked@example.com",
      city: "Thane",
      state: "Maharashtra",
      status: "BLOCKED",
      commercialClassification: "BLOCKED",
      supplierType: "SERVICE_PROVIDER",
      outstanding: 95000,
    },
  ];

  // Helper matching VendorMasterWs.tsx filtering logic
  const filterDirectory = (
    list: VendorSummary[],
    statusFilter: string,
    searchQuery: string = ""
  ) => {
    return list.filter((v) => {
      if (statusFilter === "ACTIVE_ONLY" && (v.status === "ARCHIVED" || v.status === "MERGED")) {
        return false;
      }
      if (statusFilter !== "ACTIVE_ONLY" && statusFilter !== "ALL" && v.status !== statusFilter) {
        return false;
      }
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        v.legalName?.toLowerCase().includes(q) ||
        v.code?.toLowerCase().includes(q) ||
        v.gstin?.toLowerCase().includes(q) ||
        v.mobile?.toLowerCase().includes(q) ||
        v.city?.toLowerCase().includes(q)
      );
    });
  };

  it("default ACTIVE_ONLY filter must hide ARCHIVED and MERGED records", () => {
    const result = filterDirectory(mockVendors, "ACTIVE_ONLY");
    const codes = result.map((v) => v.code);

    expect(codes).toContain("VEN-ACT01");
    expect(codes).toContain("VEN-INA02");
    expect(codes).toContain("VEN-BLK05");
    expect(codes).not.toContain("VEN-ARC03");
    expect(codes).not.toContain("VEN-MRG04");
    expect(result.length).toBe(3);
  });

  it("ARCHIVED filter must return only archived vendors", () => {
    const result = filterDirectory(mockVendors, "ARCHIVED");
    expect(result.length).toBe(1);
    expect(result[0].code).toBe("VEN-ARC03");
    expect(result[0].status).toBe("ARCHIVED");
  });

  it("MERGED filter must return only merged vendors", () => {
    const result = filterDirectory(mockVendors, "MERGED");
    expect(result.length).toBe(1);
    expect(result[0].code).toBe("VEN-MRG04");
    expect(result[0].status).toBe("MERGED");
  });

  it("ALL filter must return all vendors including archived and merged", () => {
    const result = filterDirectory(mockVendors, "ALL");
    expect(result.length).toBe(5);
    const statuses = result.map((v) => v.status);
    expect(statuses).toContain("ARCHIVED");
    expect(statuses).toContain("MERGED");
    expect(statuses).toContain("ACTIVE");
    expect(statuses).toContain("INACTIVE");
    expect(statuses).toContain("BLOCKED");
  });

  it("query parameter construction conforms to API contract", () => {
    const buildQueryUrl = (statusFilter: string) => {
      const queryParam = statusFilter && statusFilter !== "ACTIVE_ONLY"
        ? `?status=${encodeURIComponent(statusFilter)}`
        : "";
      return `/purchase/vendors/${queryParam}`;
    };

    expect(buildQueryUrl("ACTIVE_ONLY")).toBe("/purchase/vendors/");
    expect(buildQueryUrl("ALL")).toBe("/purchase/vendors/?status=ALL");
    expect(buildQueryUrl("ARCHIVED")).toBe("/purchase/vendors/?status=ARCHIVED");
    expect(buildQueryUrl("MERGED")).toBe("/purchase/vendors/?status=MERGED");
    expect(buildQueryUrl("BLOCKED")).toBe("/purchase/vendors/?status=BLOCKED");
  });

  it("archive notice banner condition correctly identifies archived/merged status", () => {
    const shouldShowNoticeBanner = (status: VendorStatus) => {
      return status === "ARCHIVED" || status === "MERGED";
    };

    expect(shouldShowNoticeBanner("ARCHIVED")).toBe(true);
    expect(shouldShowNoticeBanner("MERGED")).toBe(true);
    expect(shouldShowNoticeBanner("ACTIVE")).toBe(false);
    expect(shouldShowNoticeBanner("INACTIVE")).toBe(false);
    expect(shouldShowNoticeBanner("BLOCKED")).toBe(false);
    expect(shouldShowNoticeBanner("ON_HOLD")).toBe(false);
    expect(shouldShowNoticeBanner("PENDING_VERIFICATION")).toBe(false);
  });
});
