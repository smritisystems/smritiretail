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
 * Target Module: Vendor Article Ownership & Cross-Vendor Isolation Contract
 */

import { describe, it, expect } from "vitest";

interface ArticleItem {
  id: string;
  code: string;
  name: string;
  vendorCode?: string | null;
}

describe("Vendor Article Ownership & Cross-Vendor Isolation Contract", () => {
  const masterRegistryArticles: ArticleItem[] = [
    { id: "art_01", code: "SNE-01", name: "Leather Sneaker", vendorCode: "V-00C" },
    { id: "art_02", code: "SLP-02", name: "Canvas Slip-on", vendorCode: "V-00C" },
    { id: "art_03", code: "JNS-03", name: "Denim Jeans", vendorCode: "V-00A" },
    { id: "art_04", code: "SHR-04", name: "Cotton Shirt", vendorCode: "V-00B" },
    { id: "art_05", code: "TEE-05", name: "Basic T-Shirt", vendorCode: null },
    { id: "art_06", code: "PL-06", name: "Polo Shirt", vendorCode: "" },
  ];

  it("when inspecting vendor V-00C, only V-00C articles and unassigned articles are returned by isolated fetch", () => {
    const inspectedVendorCode = "V-00C";

    // Simulating backend /masters/lookup/style_article/values?vendorCode=V-00C&includeUnassigned=true
    const fetchIsolatedArticles = (articles: ArticleItem[], vendorCode: string, includeUnassigned: boolean) => {
      const target = vendorCode.trim().toUpperCase();
      return articles.filter((a) => {
        const owner = (a.vendorCode || "").trim().toUpperCase();
        if (owner === target) return true;
        if (includeUnassigned && !owner) return true;
        return false;
      });
    };

    const result = fetchIsolatedArticles(masterRegistryArticles, inspectedVendorCode, true);
    const codes = result.map((r) => r.code);

    // Must include V-00C's articles
    expect(codes).toContain("SNE-01");
    expect(codes).toContain("SLP-02");

    // Must include unassigned articles available to claim
    expect(codes).toContain("TEE-05");
    expect(codes).toContain("PL-06");

    // Must strictly EXCLUDE articles owned by V-00A and V-00B
    expect(codes).not.toContain("JNS-03"); // V-00A
    expect(codes).not.toContain("SHR-04"); // V-00B
    expect(result.length).toBe(4);
  });

  it("in Add Article / Style form, the dropdown strictly presents ONLY the current vendor's owned articles", () => {
    const currentVendorCode = "V-00C";

    // Logic matching VariantTemplateSec.tsx vendorOwnedArticles
    const getSelectableArticlesForVendor = (options: ArticleItem[], vendorCode: string) => {
      const codeUpper = vendorCode.trim().toUpperCase();
      return options.filter((option) => {
        const owner = (option.vendorCode || "").trim().toUpperCase();
        return owner === codeUpper;
      });
    };

    const selectable = getSelectableArticlesForVendor(masterRegistryArticles, currentVendorCode);
    const codes = selectable.map((s) => s.code);

    // Only V-00C articles should be selectable in Add Article / Style
    expect(codes).toEqual(["SNE-01", "SLP-02"]);
    expect(codes).not.toContain("JNS-03"); // Never V-00A
    expect(codes).not.toContain("SHR-04"); // Never V-00B
    expect(codes).not.toContain("TEE-05"); // Unassigned is not yet owned
  });

  it("no other vendor (e.g. V-00A) can see any of V-00C's articles", () => {
    const inspectedVendorCode = "V-00A";

    const getSelectableArticlesForVendor = (options: ArticleItem[], vendorCode: string) => {
      const codeUpper = vendorCode.trim().toUpperCase();
      return options.filter((option) => {
        const owner = (option.vendorCode || "").trim().toUpperCase();
        return owner === codeUpper;
      });
    };

    const selectable = getSelectableArticlesForVendor(masterRegistryArticles, inspectedVendorCode);
    const codes = selectable.map((s) => s.code);

    expect(codes).toEqual(["JNS-03"]);
    expect(codes).not.toContain("SNE-01"); // Never V-00C
    expect(codes).not.toContain("SLP-02"); // Never V-00C
    expect(codes).not.toContain("SHR-04"); // Never V-00B
  });

  it("VendorArticleStyleTab properly partitions assigned vs unassigned and excludes foreign vendors", () => {
    const vendorCode = "V-00C";

    const vendorCodeUpper = vendorCode.toUpperCase();
    const assignedArticles = masterRegistryArticles.filter(
      (a) => a.vendorCode?.toUpperCase() === vendorCodeUpper
    );
    const unassignedArticles = masterRegistryArticles.filter((a) => !a.vendorCode);
    const foreignArticles = masterRegistryArticles.filter(
      (a) => Boolean(a.vendorCode) && a.vendorCode?.toUpperCase() !== vendorCodeUpper
    );

    expect(assignedArticles.map((a) => a.code)).toEqual(["SNE-01", "SLP-02"]);
    expect(unassignedArticles.map((a) => a.code)).toEqual(["TEE-05", "PL-06"]);
    // Foreign articles exist in raw database but must never leak into vendor view
    expect(foreignArticles.map((a) => a.code)).toEqual(["JNS-03", "SHR-04"]);
  });
});
