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
 * Classification: WYSIWYG Visual Label Designer Thermal Print Verification Suite
 */

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { VisualLabelDesigner } from "../components/barcode/VisualLabelDesign";

describe("VisualLabelDesigner Thermal Print Suite", () => {
  it("1. renders printable thermal sticker with #root suppression and dynamic @page dimensions", () => {
    const html = renderToStaticMarkup(
      <VisualLabelDesigner />
    );

    expect(html).toContain("visual-label-designer-print-area");
    expect(html).toContain("#root");
    expect(html).toContain("display: none !important");
    expect(html).toContain("size: 100mm 50.7mm");
    expect(html).toContain("margin: 0");
    expect(html).toContain("visual-label-print-sticker");
  });

  it("2. enforces static unrolling and high precision thermal sticker dimensions", () => {
    const html = renderToStaticMarkup(
      <VisualLabelDesigner />
    );

    expect(html).toContain("position: static !important");
    expect(html).toContain("width: 100mm !important");
    expect(html).toContain("height: 50.7mm !important");
    expect(html).toContain("overflow: hidden !important");
  });
});
