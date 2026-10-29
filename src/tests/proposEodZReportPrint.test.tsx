/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.17
 * Created      : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: ProPOS EOD Register Closeout & Z-Report Print Verification Suite
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SmritiProPosEodReport } from "../components/billing/propos/ProPosEodReportVie";

describe("SmritiProPosEodReport Print Suite", () => {
  it("1. renders printable Z-Report statement with #root suppression and A4 portrait dimensions", () => {
    const html = renderToStaticMarkup(
      <SmritiProPosEodReport onCommitCloseout={vi.fn()} />
    );

    expect(html).toContain("propos-eod-printable-statement");
    expect(html).toContain("#root");
    expect(html).toContain("display: none !important");
    expect(html).toContain("size: A4 portrait");
    expect(html).toContain("margin: 10mm 12mm 12mm 12mm");
  });

  it("2. enforces unrolled static flow and complete financial reconciliation sections", () => {
    const html = renderToStaticMarkup(
      <SmritiProPosEodReport onCommitCloseout={vi.fn()} />
    );

    expect(html).toContain("position: static !important");
    expect(html).toContain("width: 100% !important");
    expect(html).toContain("Transaction Breakdown");
    expect(html).toContain("Tender Reconciliation");
    expect(html).toContain("Gross Sales Value");
    expect(html).toContain("Net Settled Revenue");
    expect(html).toContain("Cashier / Operator Signature");
    expect(html).toContain("Store Manager / Auditor Signature");
  });
});
