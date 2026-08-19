/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-08-19
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect } from "vitest";
import { itemMasterConfig } from "../components/global/configs/itemMaster.config.tsx";
import { customerMasterConfig } from "../components/global/configs/customerMaster.config.tsx";
import { supplierMasterConfig } from "../components/global/configs/supplierMaster.config.tsx";
import { staffMasterConfig } from "../components/global/configs/staffMaster.config.tsx";
import { documentSeriesConfig } from "../components/global/configs/documentSeries.config.tsx";
import { termsEngineConfig } from "../components/global/configs/termsEngine.config.tsx";
import { posProfilesConfig } from "../components/global/configs/posProfiles.config.tsx";
import { masterLookupConfig } from "../components/global/configs/masterLookup.config.tsx";
import { approvalMatrixConfig } from "../components/global/configs/approvalMatrix.config.tsx";

describe("Item Master Server-Side Pagination Isolation & Configuration", () => {
  it("should enable serverPagination ONLY on Item Master", () => {
    expect(itemMasterConfig.serverPagination).toBe(true);
    expect(itemMasterConfig.pageSize).toBe(25);
    expect(itemMasterConfig.apiEndpoint).toBe("/api/v1/products/");
  });

  it("should NOT enable serverPagination on any other master configurations", () => {
    expect(customerMasterConfig.serverPagination).toBeFalsy();
    expect(supplierMasterConfig.serverPagination).toBeFalsy();
    expect(staffMasterConfig.serverPagination).toBeFalsy();
    expect(documentSeriesConfig.serverPagination).toBeFalsy();
    expect(termsEngineConfig.serverPagination).toBeFalsy();
    expect(posProfilesConfig.serverPagination).toBeFalsy();
    expect(masterLookupConfig.serverPagination).toBeFalsy();
    expect(approvalMatrixConfig.serverPagination).toBeFalsy();
  });

  it("should format server pagination query params accurately", () => {
    const buildQueryParams = (
      endpoint: string,
      page: number,
      pageSize: number,
      q?: string,
      sort?: string,
      order?: string,
      filters?: Record<string, any>
    ) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      if (q && q.trim()) params.set("q", q.trim());
      if (sort) {
        params.set("sort", sort);
        params.set("order", order || "asc");
      }
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined && v !== "ALL" && v !== "") {
            params.set(k, String(v));
          }
        });
      }
      const separator = endpoint.includes("?") ? "&" : "?";
      return `${endpoint}${separator}${params.toString()}`;
    };

    const url1 = buildQueryParams("/api/v1/products/", 1, 25);
    expect(url1).toBe("/api/v1/products/?page=1&page_size=25");

    const url2 = buildQueryParams("/api/v1/products/", 2, 25, "Sneaker", "price", "desc", { category: "Footwear" });
    expect(url2).toBe("/api/v1/products/?page=2&page_size=25&q=Sneaker&sort=price&order=desc&category=Footwear");
  });

  it("should calculate server pagination display bounds accurately", () => {
    const calculateBounds = (page: number, pageSize: number, total: number) => {
      if (total === 0) return { start: 0, end: 0, total: 0 };
      const start = (page - 1) * pageSize + 1;
      const end = Math.min(page * pageSize, total);
      return { start, end, total };
    };

    expect(calculateBounds(1, 25, 347)).toEqual({ start: 1, end: 25, total: 347 });
    expect(calculateBounds(2, 25, 347)).toEqual({ start: 26, end: 50, total: 347 });
    expect(calculateBounds(14, 25, 347)).toEqual({ start: 326, end: 347, total: 347 });
    expect(calculateBounds(1, 25, 0)).toEqual({ start: 0, end: 0, total: 0 });
  });

  it("should compute total_pages and navigation states deterministically", () => {
    const computeNav = (page: number, pageSize: number, total: number) => {
      const totalPages = Math.ceil(total / pageSize) || 0;
      const hasNext = page < totalPages;
      const hasPrev = page > 1;
      return { totalPages, hasNext, hasPrev };
    };

    expect(computeNav(1, 25, 347)).toEqual({ totalPages: 14, hasNext: true, hasPrev: false });
    expect(computeNav(7, 25, 347)).toEqual({ totalPages: 14, hasNext: true, hasPrev: true });
    expect(computeNav(14, 25, 347)).toEqual({ totalPages: 14, hasNext: false, hasPrev: true });
    expect(computeNav(1, 25, 0)).toEqual({ totalPages: 0, hasNext: false, hasPrev: false });
  });

  it("should safely transform paginated and raw array responses with robust secondary_barcodes fallback", () => {
    const transform = itemMasterConfig.responseTransform!;
    expect(transform).toBeDefined();

    // 1. Paginated object with null/missing secondary_barcodes
    const paginatedInput = {
      items: [
        {
          id: "prod-1",
          code: "SKU-001",
          name: "Classic Tee",
          price: "499.00",
          mrp: "799.00",
          stock: 12,
          secondary_barcodes: null
        }
      ],
      total: 1,
      page: 1,
      page_size: 25
    };
    const transformed1 = transform(paginatedInput);
    expect(transformed1).toHaveLength(1);
    expect(transformed1[0].id).toBe("prod-1");
    expect(transformed1[0].price).toBe(499);
    expect(transformed1[0].mrp).toBe(799);
    expect(transformed1[0].secondaryBarcodes).toEqual([]);

    // 2. Direct array input with valid secondary_barcodes
    const arrayInput = [
      {
        id: "prod-2",
        code: "SKU-002",
        name: "Denim Jeans",
        price: 1299,
        secondary_barcodes: ["8901234567890", "8901234567891"]
      }
    ];
    const transformed2 = transform(arrayInput);
    expect(transformed2).toHaveLength(1);
    expect(transformed2[0].id).toBe("prod-2");
    expect(transformed2[0].secondaryBarcodes).toEqual(["8901234567890", "8901234567891"]);

    // 3. Empty/undefined/invalid payload handling
    expect(transform(null)).toEqual([]);
    expect(transform(undefined)).toEqual([]);
    expect(transform({})).toEqual([]);
  });
});

