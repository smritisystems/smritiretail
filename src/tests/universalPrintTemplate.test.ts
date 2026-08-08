/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Print Template Unit Tests
 * Standard     : SCS-PRINT-TEMPLATE-TESTS v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect } from "vitest";
import { UniversalPrintTemplate } from "../core/printing/models/UniversalPrintTemplate.ts";
import { UniversalLabelDocument } from "../core/printing/models/UniversalLabelDocument.ts";

const TATTLY_GOLDEN_PRN = `^XA
^SZ2^JMA^MCY^PMN^PW804^JZY^LH0,0^LRN
^XZ
^XA
^FO706,47^BY3^BCB,50,N,N^FD{barcode}^FS
^FT781,340^CI0^AAB,27,15^FD{barcode}^FS
^FT345,53^A0N,34,46^FD{brand}^FS
^FT335,340^A0N,17,23^FDMKTD.By:{brand}^FS
^FT335,351^ABN,11,7^FD81,Umerkhadi,Mumbai,400003^FS
^FO615,135^GB76,80,76^FS
^FT615,198^A0N,79,77^FR^FD{prod_size}^FS
^FT400,182^A0N,37,49^FD{prod_color}^FS
^FO410,86^GB277,46,46^FS
^FT410,124^A0N,45,43^FR^FD{style_code}^FS
^FO327,84^GB367,129,3^FS
^FO329,128^GB337,0,3^FS
^FT536,274^A0N,17,23^FD(Incl of all taxes)^FS
^FT493,251^A0N,42,56^FD{mrp_str}/-^FS
^FT410,246^A0N,28,38^FDMRP:^FS
^FT327,274^A0N,17,23^FDMFG.Dt.: {mfg_date}^FS
^FT327,290^ABN,11,7^FDNET CONTENTS:1 Pair Footwear^FS
^FT335,113^A0N,17,23^FDArt.No.^FS
^FT335,175^A0N,17,23^FDColor:^FS
^FT335,386^ABN,11,7^FDcontact@yourstore.com^FS
^FO34,125^BY2^BCN,30,N,N^FD{barcode}^FS
^FT46,181^A0N,25,34^FD{barcode}^FS
^FO37,60^GB70,67,67^FS
^FT37,114^A0N,65,72^FR^FD{prod_size}^FS
^FO116,50^GB101,30,30^FS
^FT116,76^A0N,28,38^FR^FD{prod_color}^FS
^FT37,47^A0N,28,27^FD{style_code}^FS
^FT17,159^ABB,11,7^FD{brand}^FS
^FT116,97^A0N,20,27^FDMRP:{mrp_str}/-^FS
^FT116,114^A0N,17,23^FD(Incl of all taxes)^FS
^FO33,338^BCN,30,N,N^FD{barcode}^FS
^FT45,394^A0N,25,34^FD{barcode}^FS
^FO33,275^GB70,65,65^FS
^FT33,327^A0N,62,70^FR^FD{prod_size}^FS
^FO116,263^GB101,30,30^FS
^FT116,289^A0N,28,38^FR^FD{prod_color}^FS
^FT33,260^A0N,28,27^FD{style_code}^FS
^FT16,372^ABB,11,7^FD{brand}^FS
^FT116,310^A0N,20,27^FDMRP:{mrp_str}/-^FS
^FT116,327^A0N,17,23^FD(Incl of all taxes)^FS
^FO328,308^GB367,0,3^FS
^FO328,365^GB367,0,3^FS
^PQ1,0,1,Y
^XZ`;

describe("UniversalPrintTemplate Unit Tests v1.0", () => {
  // 1. Template creation
  it("1. Creates UniversalPrintTemplate instance with default metadata and status", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Standard Retail Label" });

    expect(tmpl.metadata.id).toBeDefined();
    expect(tmpl.metadata.name).toBe("Standard Retail Label");
    expect(tmpl.metadata.version).toBe("1.0.0");
    expect(tmpl.status).toBe("DRAFT");
    expect(tmpl.document).toBeInstanceOf(UniversalLabelDocument);
  });

  // 2. Template serialization
  it("2. Serializes UniversalPrintTemplate to JSON cleanly", () => {
    const tmpl = new UniversalPrintTemplate({
      metadata: { id: "tmpl-101", name: "Carton Label", version: "2.1.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" },
      status: "ACTIVE",
    });
    tmpl.setFieldMapping("{barcode}", "barcode.value");

    const json = tmpl.toJSON();
    expect(json.metadata.id).toBe("tmpl-101");
    expect(json.metadata.name).toBe("Carton Label");
    expect(json.status).toBe("ACTIVE");
    expect(json.fieldMappings["{barcode}"]).toBe("barcode.value");
  });

  // 3. Template deserialization
  it("3. Deserializes JSON back into UniversalPrintTemplate instance", () => {
    const json = {
      metadata: { id: "tmpl-102", name: "Shelf Tag", version: "1.0.0", sourceFormat: "PRN_TSPL" as const, sourceType: "VISUAL_DESIGN" as const, createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" },
      source: { originalContent: "SIZE 50 mm, 25 mm\nCLS", originalFormat: "TSPL" as const },
      document: { metadata: { id: "doc-102", name: "Shelf Tag Doc", version: "1.0.0", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, dimensions: { widthMm: 50, heightMm: 25, dpi: 203, columns: 1, gapMm: 3, orientation: "PORTRAIT" as const }, media: { type: "DIE_CUT" as const, sensor: "GAP" as const }, elements: [], bindings: {}, capabilities: {} },
      fieldMappings: { "{price}": "pricing.price" },
      status: "ACTIVE" as const,
    };

    const tmpl = UniversalPrintTemplate.fromJSON(json);
    expect(tmpl.metadata.name).toBe("Shelf Tag");
    expect(tmpl.source.originalContent).toContain("SIZE 50 mm");
    expect(tmpl.fieldMappings.get("{price}")).toBe("pricing.price");
  });

  // 4. Multiple templates coexisting
  it("4. Multiple independent template instances co-exist without shared state collision", () => {
    const t1 = new UniversalPrintTemplate({ name: "Template A" });
    const t2 = new UniversalPrintTemplate({ name: "Template B" });
    const t3 = new UniversalPrintTemplate({ name: "Template C" });

    t1.setFieldMapping("{code}", "product.code");
    t2.setFieldMapping("{code}", "product.style_code");

    expect(t1.metadata.name).toBe("Template A");
    expect(t2.metadata.name).toBe("Template B");
    expect(t3.metadata.name).toBe("Template C");
    expect(t1.fieldMappings.get("{code}")).toBe("product.code");
    expect(t2.fieldMappings.get("{code}")).toBe("product.style_code");
    expect(t3.fieldMappings.has("{code}")).toBe(false);
  });

  // 5. Template versions are independent
  it("5. Bumping template version creates independent version metadata", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Versioned Template" });
    expect(tmpl.metadata.version).toBe("1.0.0");

    tmpl.bumpVersion();
    expect(tmpl.metadata.version).toBe("1.0.1");

    tmpl.bumpVersion("2.0.0");
    expect(tmpl.metadata.version).toBe("2.0.0");
  });

  // 6. Source PRN is preserved
  it("6. Original raw PRN source stream is preserved intact inside source property", () => {
    const tmpl = new UniversalPrintTemplate({
      name: "ZPL Preservation Test",
      source: { originalContent: TATTLY_GOLDEN_PRN, originalFormat: "ZPL" },
    });

    expect(tmpl.source.originalContent).toContain("^PW804");
    expect(tmpl.source.originalContent).toContain("81,Umerkhadi,Mumbai,400003");
    expect(tmpl.source.originalContent).toContain("^PQ1,0,1,Y");
  });

  // 7. UniversalLabelDocument is embedded correctly
  it("7. Embedded UniversalLabelDocument updates element geometry and dimensions", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Embedded Doc Test" });
    tmpl.document.dimensions.widthMm = 100.5;
    tmpl.document.dimensions.heightMm = 50;

    tmpl.document.addElement({
      id: "el-bcode-1",
      type: "BARCODE",
      x: 10,
      y: 10,
      width: 40,
      height: 15,
      rotation: 0,
      visible: true,
      zIndex: 1,
      symbology: "EAN13",
    });

    expect(tmpl.document.dimensions.widthMm).toBe(100.5);
    expect(tmpl.document.elements.length).toBe(1);
    expect(tmpl.document.capabilities.supportsBarcode).toBe(true);
  });

  // 8. Field mappings are independent from source PRN
  it("8. Field mappings remain editable facades independent from the raw PRN text", () => {
    const tmpl = new UniversalPrintTemplate({
      name: "Mapping Facade Test",
      source: { originalContent: "^XA^FD{style}^FS^XZ", originalFormat: "ZPL" },
    });

    tmpl.setFieldMapping("{style}", "product.style_code");
    expect(tmpl.fieldMappings.get("{style}")).toBe("product.style_code");

    // Remap {style} to custom attribute without modifying source PRN
    tmpl.setFieldMapping("{style}", "product.attributes.article_code");
    expect(tmpl.fieldMappings.get("{style}")).toBe("product.attributes.article_code");
    expect(tmpl.source.originalContent).toBe("^XA^FD{style}^FS^XZ");
  });

  // 9. Printer preferences are optional
  it("9. Printer preferences are optional and configurable", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Printer Prefs Test" });
    expect(tmpl.printerPreferences).toBeUndefined();

    tmpl.printerPreferences = { preferredLanguage: "ZPL", preferredDpi: 300 };
    expect(tmpl.printerPreferences.preferredDpi).toBe(300);
  });

  // 10. Media preferences are optional
  it("10. Media preferences are optional and configurable", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Media Prefs Test" });
    expect(tmpl.mediaPreferences).toBeUndefined();

    tmpl.mediaPreferences = { widthMm: 100, heightMm: 50, sensor: "BLACK_MARK" };
    expect(tmpl.mediaPreferences.sensor).toBe("BLACK_MARK");
  });

  // 11. Template status lifecycle
  it("11. Manages status lifecycle transitions (DRAFT -> ACTIVE -> ARCHIVED -> INVALID)", () => {
    const tmpl = new UniversalPrintTemplate({ name: "Lifecycle Template" });
    expect(tmpl.status).toBe("DRAFT");

    tmpl.status = "ACTIVE";
    expect(tmpl.status).toBe("ACTIVE");

    tmpl.status = "ARCHIVED";
    expect(tmpl.status).toBe("ARCHIVED");

    tmpl.status = "INVALID";
    expect(tmpl.status).toBe("INVALID");
  });

  // 12. Tattly PRN represented without becoming a special case
  it("12. Represents Tattly Threads ZPL PRN as a standard UniversalPrintTemplate instance", () => {
    const tmpl = new UniversalPrintTemplate({
      name: "Tattly Threads Footwear Hangtag",
      metadata: { id: "tmpl-tattly-001", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", version: "1.0.0", name: "Tattly Threads Footwear Hangtag", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" },
      source: { originalContent: TATTLY_GOLDEN_PRN, originalFormat: "ZPL" },
      mediaPreferences: { widthMm: 100.5, heightMm: 50, sensor: "GAP", orientation: "LANDSCAPE" },
      status: "ACTIVE",
    });

    tmpl.setFieldMapping("{barcode}", "barcode.value");
    tmpl.setFieldMapping("{brand}", "product.brand");
    tmpl.setFieldMapping("{style_code}", "product.style_code");
    tmpl.setFieldMapping("{prod_size}", "product.size");
    tmpl.setFieldMapping("{prod_color}", "product.color");
    tmpl.setFieldMapping("{mrp_str}", "pricing.mrp");
    tmpl.setFieldMapping("{mfg_date}", "batch.mfg_date");

    expect(tmpl.metadata.id).toBe("tmpl-tattly-001");
    expect(tmpl.fieldMappings.size).toBe(7);
    expect(tmpl.source.originalContent).toContain("^PW804");

    const layoutJSON = tmpl.toBarcodeLayoutElementsJSON();
    expect(layoutJSON.template_id).toBe("tmpl-tattly-001");
    expect(layoutJSON.prn_template).toContain("^PW804");
  });
});
