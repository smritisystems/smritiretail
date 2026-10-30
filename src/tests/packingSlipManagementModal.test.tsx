/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.14
 * Created      : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Packing Slip Management Modal Verification Suite
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PackingSlipManagementModal } from "../components/billing/modals/PackingSlipManagementModal";

describe("Packing Slip Management Modal Architecture Suite", () => {
  it("1. returns empty markup when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <PackingSlipManagementModal
        isOpen={false}
        onClose={() => {}}
      />
    );
    expect(html).toBe("");
  });

  it("2. renders modal shell and header when isOpen is true", () => {
    const html = renderToStaticMarkup(
      <PackingSlipManagementModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(html).toContain("packing-slip-modal-root");
    expect(html).toContain("B2B Packing Slips Studio");
    expect(html).toContain("PACKING-FIRST WORKFLOW");
  });

  it("3. embeds @media print CSS with #root { display: none !important; } and unrolled flow", () => {
    const html = renderToStaticMarkup(
      <PackingSlipManagementModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(html).toContain("@media print");
    expect(html).toContain("#root");
    expect(html).toContain("display: none !important");
    expect(html).toContain(".packing-slip-modal-root");
    expect(html).toContain("position: static !important");
    expect(html).toContain(".packing-slip-toolbar");
    expect(html).toContain(".packing-slip-sheet-wrapper");
    expect(html).toContain(".packing-slip-printable-content");
  });

  it("4. excludes toolbars and search header via packing-slip-toolbar class", () => {
    const html = renderToStaticMarkup(
      <PackingSlipManagementModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    expect(html).toContain("packing-slip-toolbar");
    expect(html).toContain("Search by Slip #, Order, Customer...");
  });
});
