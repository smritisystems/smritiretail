/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.15
 * Created      : 2026-10-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: POS Shift Closeout & Z-Report Handover Slip Verification Suite
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SmritiProPosShiftCloseModal } from "../components/billing/propos/ProPosShiftCloseDl";

describe("SmritiProPosShiftCloseModal Architecture Suite", () => {
  it("1. renders shift close modal with #root suppression and 80mm thermal slip print standard", () => {
    const html = renderToStaticMarkup(
      <SmritiProPosShiftCloseModal
        shiftId="SHIFT-2026-10-29-001"
        registerId="REG-COUNTER-01"
        onShiftClosed={() => {}}
        onClose={() => {}}
      />
    );

    expect(html).toContain("propos-shift-close-modal-root");
    expect(html).toContain("#root");
    expect(html).toContain("display: none !important");
    expect(html).toContain("size: 80mm auto");
    expect(html).toContain("margin: 0");
    expect(html).toContain("propos-shift-close-toolbar");
    expect(html).toContain("#thermal-handover-slip");
    expect(html).toContain("SHIFT-2026-10-29-001");
  });

  it("2. enforces static flow unrolling and toolbar hidden styles", () => {
    const html = renderToStaticMarkup(
      <SmritiProPosShiftCloseModal
        shiftId="SHIFT-2026-10-29-002"
        registerId="REG-COUNTER-02"
        onShiftClosed={() => {}}
        onClose={() => {}}
      />
    );

    expect(html).toContain("propos-shift-close-sheet-wrapper");
    expect(html).toContain("propos-shift-close-toolbar");
    expect(html).toContain("position: static !important");
    expect(html).toContain("overflow: visible !important");
  });
});
