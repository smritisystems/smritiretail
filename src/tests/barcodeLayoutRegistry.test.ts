/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.51
 * Created      : 2026-10-10
 * Modified     : 2026-10-10
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import {
  BUILTIN_LABEL_TEMPLATES,
  getLabelTemplate,
  renderTemplateToSvg,
  UnifiedLabelTemplate
} from "../services/barcodeLayoutRegistry";

describe("Unified Barcode Layout Registry & Client Renderer", () => {
  it("1. should register and retrieve Tattly Threads Footwear 100x50.7mm template by ID and aliases", () => {
    const tmpl = getLabelTemplate("tattly-threads-footwear-100x50.7");
    expect(tmpl).toBeDefined();
    expect(tmpl?.widthMm).toBe(100.0);
    expect(tmpl?.heightMm).toBe(50.7);

    // Test alias
    const aliasTmpl = getLabelTemplate("lay-footwear-100x50-3stub");
    expect(aliasTmpl).toBeDefined();
    expect(aliasTmpl?.id).toBe("tattly-threads-footwear-100x50.7");
  });

  it("2. should include dual counter stubs and main shoe box sections in element list", () => {
    const tmpl = getLabelTemplate("tattly-threads-footwear-100x50.7")!;
    expect(tmpl.elements.length).toBeGreaterThan(15);

    const hasStub1Barcode = tmpl.elements.some(e => e.id === "s1_barcode" && e.type === "barcode_128");
    const hasStub2Barcode = tmpl.elements.some(e => e.id === "s2_barcode" && e.type === "barcode_128");
    const hasMainBarcode = tmpl.elements.some(e => e.id === "m_barcode" && e.type === "barcode_128");
    const hasSizeBox = tmpl.elements.some(e => e.type === "inverted_box");

    expect(hasStub1Barcode).toBe(true);
    expect(hasStub2Barcode).toBe(true);
    expect(hasMainBarcode).toBe(true);
    expect(hasSizeBox).toBe(true);
  });

  it("3. should render crisp SVG preview with exact mm dimensions and item bindings", () => {
    const tmpl = getLabelTemplate("tattly-threads-footwear-100x50.7")!;
    const item = {
      code: "000006",
      barcode: "890100000006",
      name: "Tattly Threads Footwear",
      brand: "TATTLY THREADS",
      style: "CH-30-K",
      color: "BLACK",
      size: "37",
      mrp: 1199,
      price: 1199,
      companyName: "Tattly Threads",
      mfgDate: "10/26"
    };

    const svg = renderTemplateToSvg(tmpl, item);
    expect(svg).toContain("<svg");
    expect(svg).toContain('width="100mm"');
    expect(svg).toContain('height="50.7mm"');
    expect(svg).toContain("CH-30-K");
    expect(svg).toContain("BLACK");
    expect(svg).toContain("37");
    expect(svg).toContain("1199");
    expect(svg).toContain("</svg>");
  });

  it("4. should handle standard 50x25mm retail roll layout", () => {
    const retailTmpl = getLabelTemplate("retail-50x25");
    expect(retailTmpl).toBeDefined();
    expect(retailTmpl?.widthMm).toBe(50.0);
    expect(retailTmpl?.heightMm).toBe(25.0);

    const svg = renderTemplateToSvg(retailTmpl!, {
      code: "SKU1",
      barcode: "890123456789",
      brand: "SMRITI",
      mrp: 499
    });
    expect(svg).toContain('width="50mm"');
    expect(svg).toContain('height="25mm"');
    expect(svg).toContain("890123456789");
  });
});
