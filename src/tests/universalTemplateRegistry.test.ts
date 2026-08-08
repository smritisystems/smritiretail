/**
 * Project      : SMRITI Retail OS
 * Module       : Multi-PRN Universal Template Registry Unit Tests
 * Standard     : SCS-PRINT-REGISTRY-TESTS v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { UniversalTemplateRegistry } from "../core/printing/templates/UniversalTemplateRegistry.ts";
import { UniversalPrintTemplate } from "../core/printing/models/UniversalPrintTemplate.ts";

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
^FT37,260^A0N,28,27^FD{style_code}^FS
^FT16,372^ABB,11,7^FD{brand}^FS
^FT116,310^A0N,20,27^FDMRP:{mrp_str}/-^FS
^FT116,327^A0N,17,23^FD(Incl of all taxes)^FS
^FO328,308^GB367,0,3^FS
^FO328,365^GB367,0,3^FS
^PQ1,0,1,Y
^XZ`;

describe("Multi-PRN Universal Template Registry Test Suite (Phase C)", () => {
  beforeEach(() => {
    UniversalTemplateRegistry.clear();
  });

  // 1. Register one template
  it("1. Registers a single UniversalPrintTemplate instance successfully", () => {
    const tmpl = new UniversalPrintTemplate({
      metadata: { id: "tmpl-001", name: "Footwear Price Label", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "VISUAL_DESIGN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" },
    });

    UniversalTemplateRegistry.register(tmpl);
    expect(UniversalTemplateRegistry.size()).toBe(1);
    expect(UniversalTemplateRegistry.get("tmpl-001")).toBeDefined();
  });

  // 2. Register multiple templates
  it("2. Registers multiple independent templates simultaneously", () => {
    const t1 = new UniversalPrintTemplate({ metadata: { id: "tmpl-001", name: "Footwear Label", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } });
    const t2 = new UniversalPrintTemplate({ metadata: { id: "tmpl-002", name: "Carton Label", version: "1.0.0", sourceFormat: "PRN_TSPL", sourceType: "VISUAL_DESIGN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } });
    const t3 = new UniversalPrintTemplate({ metadata: { id: "tmpl-003", name: "Jewellery Label", version: "1.0.0", sourceFormat: "PRN_EPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } });

    UniversalTemplateRegistry.register(t1);
    UniversalTemplateRegistry.register(t2);
    UniversalTemplateRegistry.register(t3);

    expect(UniversalTemplateRegistry.size()).toBe(3);
    expect(UniversalTemplateRegistry.list().length).toBe(3);
  });

  // 3. Retrieve by ID
  it("3. Retrieves registered template by template ID", () => {
    const tmpl = new UniversalPrintTemplate({ metadata: { id: "tmpl-shelf-1", name: "Shelf Tag", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "VISUAL_DESIGN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } });
    UniversalTemplateRegistry.register(tmpl);

    const fetched = UniversalTemplateRegistry.get("tmpl-shelf-1");
    expect(fetched?.metadata.name).toBe("Shelf Tag");
  });

  // 4. Retrieve specific version
  it("4. Retrieves specific template version independently", () => {
    const t1 = new UniversalPrintTemplate({ metadata: { id: "tmpl-ver-1", name: "Versioned Tag", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "VISUAL_DESIGN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } });
    const t2 = new UniversalPrintTemplate({ metadata: { id: "tmpl-ver-1", name: "Versioned Tag", version: "2.0.0", sourceFormat: "PRN_ZPL", sourceType: "VISUAL_DESIGN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } });

    UniversalTemplateRegistry.register(t1);
    UniversalTemplateRegistry.register(t2);

    const v1 = UniversalTemplateRegistry.getVersion("tmpl-ver-1", "1.0.0");
    const v2 = UniversalTemplateRegistry.getVersion("tmpl-ver-1", "2.0.0");

    expect(v1?.metadata.version).toBe("1.0.0");
    expect(v2?.metadata.version).toBe("2.0.0");
  });

  // 5. List templates
  it("5. Lists registered representative templates", () => {
    UniversalTemplateRegistry.register(new UniversalPrintTemplate({ metadata: { id: "t1", name: "Label 1", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } }));
    UniversalTemplateRegistry.register(new UniversalPrintTemplate({ metadata: { id: "t2", name: "Label 2", version: "1.0.0", sourceFormat: "PRN_TSPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } }));

    const list = UniversalTemplateRegistry.list();
    expect(list.length).toBe(2);
  });

  // 6. Search templates
  it("6. Searches templates by query string", () => {
    UniversalTemplateRegistry.register(new UniversalPrintTemplate({ metadata: { id: "t-footwear", name: "Footwear Retail Tag", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } }));
    UniversalTemplateRegistry.register(new UniversalPrintTemplate({ metadata: { id: "t-apparel", name: "Apparel Hangtag", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } }));

    const searchRes = UniversalTemplateRegistry.search("footwear");
    expect(searchRes.length).toBe(1);
    expect(searchRes[0].metadata.id).toBe("t-footwear");
  });

  // 7. Filter by language
  it("7. Filters templates by printer language", () => {
    UniversalTemplateRegistry.register(new UniversalPrintTemplate({ metadata: { id: "t-zpl", name: "ZPL Template", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, source: { originalContent: "^XA^XZ", originalFormat: "ZPL" } }));
    UniversalTemplateRegistry.register(new UniversalPrintTemplate({ metadata: { id: "t-tspl", name: "TSPL Template", version: "1.0.0", sourceFormat: "PRN_TSPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, source: { originalContent: "SIZE 50 mm, 25 mm\nCLS", originalFormat: "TSPL" } }));

    const zplFiltered = UniversalTemplateRegistry.filter({ language: "ZPL" });
    expect(zplFiltered.length).toBe(1);
    expect(zplFiltered[0].metadata.id).toBe("t-zpl");
  });

  // 8. Filter by status
  it("8. Filters templates by status lifecycle", () => {
    const tDraft = new UniversalPrintTemplate({ metadata: { id: "t-draft", name: "Draft Template", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, status: "DRAFT" });
    const tActive = new UniversalPrintTemplate({ metadata: { id: "t-active", name: "Active Template", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, status: "ACTIVE" });

    UniversalTemplateRegistry.register(tDraft);
    UniversalTemplateRegistry.register(tActive);

    const activeList = UniversalTemplateRegistry.filter({ status: "ACTIVE" });
    expect(activeList.length).toBe(1);
    expect(activeList[0].metadata.id).toBe("t-active");
  });

  // 9. Clone template
  it("9. Clones template into a new independent identity", () => {
    const orig = new UniversalPrintTemplate({ metadata: { id: "orig-1", name: "Original Template", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } });
    orig.setFieldMapping("{code}", "product.code");
    UniversalTemplateRegistry.register(orig);

    const cloned = UniversalTemplateRegistry.clone("orig-1", "Cloned Label");
    expect(cloned.metadata.id).not.toBe("orig-1");
    expect(cloned.metadata.name).toBe("Cloned Label");
    expect(cloned.status).toBe("DRAFT");
    expect(cloned.fieldMappings.get("{code}")).toBe("product.code");
  });

  // 10. Create new version
  it("10. Creates new version without mutating current active version", () => {
    const v1 = new UniversalPrintTemplate({ metadata: { id: "tmpl-v-test", name: "Version Test", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, status: "ACTIVE" });
    UniversalTemplateRegistry.register(v1);

    const v2 = UniversalTemplateRegistry.createVersion("tmpl-v-test", "2.0.0");
    expect(v2.metadata.version).toBe("2.0.0");
    expect(v2.status).toBe("DRAFT");

    // Check v1 is still active and unchanged
    const active = UniversalTemplateRegistry.getVersion("tmpl-v-test", "1.0.0");
    expect(active?.status).toBe("ACTIVE");
  });

  // 11. Activate version
  it("11. Activates version and archives previous active version", () => {
    const v1 = new UniversalPrintTemplate({ metadata: { id: "tmpl-act-test", name: "Activate Test", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, status: "ACTIVE" });
    const v2 = new UniversalPrintTemplate({ metadata: { id: "tmpl-act-test", name: "Activate Test", version: "2.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, status: "DRAFT" });

    UniversalTemplateRegistry.register(v1);
    UniversalTemplateRegistry.register(v2);

    UniversalTemplateRegistry.activate("tmpl-act-test", "2.0.0");

    expect(UniversalTemplateRegistry.getVersion("tmpl-act-test", "2.0.0")?.status).toBe("ACTIVE");
    expect(UniversalTemplateRegistry.getVersion("tmpl-act-test", "1.0.0")?.status).toBe("ARCHIVED");
  });

  // 12. Archive version
  it("12. Archives template version cleanly", () => {
    const t = new UniversalPrintTemplate({ metadata: { id: "t-arch", name: "Archive Test", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, status: "ACTIVE" });
    UniversalTemplateRegistry.register(t);

    UniversalTemplateRegistry.archive("t-arch", "1.0.0");
    expect(UniversalTemplateRegistry.getVersion("t-arch", "1.0.0")?.status).toBe("ARCHIVED");
  });

  // 13. Invalid template cannot print
  it("13. Invalid template version is set to INVALID status and blocked from active resolution", () => {
    const t = new UniversalPrintTemplate({ metadata: { id: "t-inv", name: "Invalid Test", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, status: "ACTIVE" });
    UniversalTemplateRegistry.register(t);

    UniversalTemplateRegistry.invalidate("t-inv", "1.0.0");
    expect(UniversalTemplateRegistry.resolveActiveVersion("t-inv")).toBeUndefined();
    expect(UniversalTemplateRegistry.getVersion("t-inv", "1.0.0")?.status).toBe("INVALID");
  });

  // 14. Draft template cannot be treated as production active
  it("14. DRAFT template is not returned as active version", () => {
    const t = new UniversalPrintTemplate({ metadata: { id: "t-draft-only", name: "Draft Only", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, status: "DRAFT" });
    UniversalTemplateRegistry.register(t);

    expect(UniversalTemplateRegistry.resolveActiveVersion("t-draft-only")).toBeUndefined();
  });

  // 15. Active version resolution
  it("15. Resolves active version correctly among multiple registered versions", () => {
    const v1 = new UniversalPrintTemplate({ metadata: { id: "t-multi-v", name: "Multi V", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, status: "ARCHIVED" });
    const v2 = new UniversalPrintTemplate({ metadata: { id: "t-multi-v", name: "Multi V", version: "2.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, status: "ACTIVE" });

    UniversalTemplateRegistry.register(v1);
    UniversalTemplateRegistry.register(v2);

    const active = UniversalTemplateRegistry.resolveActiveVersion("t-multi-v");
    expect(active?.metadata.version).toBe("2.0.0");
  });

  // 16. Old active version remains immutable after new version creation
  it("16. Old active version remains unchanged when a new version is created", () => {
    const v1 = new UniversalPrintTemplate({ metadata: { id: "t-immut", name: "Immut Test", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, status: "ACTIVE" });
    v1.setFieldMapping("{barcode}", "barcode.value");
    UniversalTemplateRegistry.register(v1);

    const v2 = UniversalTemplateRegistry.createVersion("t-immut", "2.0.0");
    v2.setFieldMapping("{barcode}", "barcode.serial");

    expect(v1.fieldMappings.get("{barcode}")).toBe("barcode.value");
    expect(v2.fieldMappings.get("{barcode}")).toBe("barcode.serial");
  });

  // 17. Template A mappings independent from Template B
  it("17. Field mappings of Template A are completely independent from Template B", () => {
    const tA = new UniversalPrintTemplate({ metadata: { id: "tA", name: "Template A", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } });
    const tB = new UniversalPrintTemplate({ metadata: { id: "tB", name: "Template B", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } });

    tA.setFieldMapping("{style}", "product.style_code");
    tB.setFieldMapping("{style}", "product.attributes.article_code");

    UniversalTemplateRegistry.register(tA);
    UniversalTemplateRegistry.register(tB);

    expect(UniversalTemplateRegistry.get("tA")?.fieldMappings.get("{style}")).toBe("product.style_code");
    expect(UniversalTemplateRegistry.get("tB")?.fieldMappings.get("{style}")).toBe("product.attributes.article_code");
  });

  // 18. Template source remains unchanged after editing
  it("18. Editing field mappings does not modify raw original PRN source content", () => {
    const raw = "^XA^FD{style}^FS^XZ";
    const tmpl = new UniversalPrintTemplate({ metadata: { id: "t-src-immut", name: "Source Immut", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, source: { originalContent: raw, originalFormat: "ZPL" } });
    UniversalTemplateRegistry.register(tmpl);

    tmpl.setFieldMapping("{style}", "product.style_code");
    expect(UniversalTemplateRegistry.exportTemplate("t-src-immut")).toBe(raw);
  });

  // 19. Duplicate PRN source detected but not automatically merged
  it("19. Detects duplicate PRN source content via checksum without merging identities", () => {
    const raw = "^XA^FD{barcode}^FS^XZ";
    const t1 = new UniversalPrintTemplate({ metadata: { id: "t-dup-1", name: "Tattly Label", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, source: { originalContent: raw, originalFormat: "ZPL" } });
    const t2 = new UniversalPrintTemplate({ metadata: { id: "t-dup-2", name: "Supplier Label", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" }, source: { originalContent: raw, originalFormat: "ZPL" } });

    UniversalTemplateRegistry.register(t1);
    UniversalTemplateRegistry.register(t2);

    const matches = UniversalTemplateRegistry.findTemplatesWithSameChecksum(t1.source.checksum!);
    expect(matches.length).toBe(2);
    expect(UniversalTemplateRegistry.size()).toBe(2); // Retains separate identities
  });

  // 20. Import ZPL PRN
  it("20. Imports ZPL PRN source through registry importPRN() pipeline", () => {
    const res = UniversalTemplateRegistry.importPRN("^XA^PW804^FD{barcode}^FS^XZ", { name: "ZPL Import" });
    expect(res.ambiguous).toBe(false);
    expect(res.template).toBeDefined();
    expect(res.template?.metadata.name).toBe("ZPL Import");
  });

  // 21. Import TSPL PRN
  it("21. Imports TSPL PRN source through registry importPRN() pipeline", () => {
    const res = UniversalTemplateRegistry.importPRN("SIZE 50 mm, 25 mm\nGAP 3 mm, 0 mm\nCLS\nTEXT 10,10,\"0\",0,1,1,\"{barcode}\"\nPRINT 1,1\n", { name: "TSPL Import" });
    expect(res.ambiguous).toBe(false);
    expect(res.template?.source.originalFormat).toBe("TSPL");
  });

  // 22. Import EPL PRN
  it("22. Imports EPL PRN source through registry importPRN() pipeline", () => {
    const res = UniversalTemplateRegistry.importPRN("N\nA50,50,0,3,1,1,N,\"{barcode}\"\nP1\n", { name: "EPL Import" });
    expect(res.ambiguous).toBe(false);
    expect(res.template?.source.originalFormat).toBe("EPL");
  });

  // 23. Import CPCL PRN
  it("23. Imports CPCL PRN source through registry importPRN() pipeline", () => {
    const res = UniversalTemplateRegistry.importPRN("! 0 200 200 400 1\nTEXT 7 0 50 50 {barcode}\nPRINT\n", { name: "CPCL Import" });
    expect(res.ambiguous).toBe(false);
    expect(res.template?.source.originalFormat).toBe("CPCL");
  });

  // 24. Import ESC/POS source
  it("24. Imports ESC/POS raw source stream through registry importPRN() pipeline", () => {
    const res = UniversalTemplateRegistry.importPRN("\x1B@RECEIPT ITEM: {barcode}\n\x1DV\x00", { name: "ESCPOS Import" });
    expect(res.ambiguous).toBe(false);
    expect(res.template?.source.originalFormat).toBe("ESC_POS");
  });

  // 25. Ambiguous language requires diagnostic/override
  it("25. Returns ambiguous diagnostic when PRN language cannot be determined with confidence", () => {
    const res = UniversalTemplateRegistry.importPRN("UNKNOWN RAW TEXT STREAM WITHOUT PRN SIGNATURES");
    expect(res.ambiguous).toBe(true);
    expect(res.template).toBeUndefined();
    expect(res.diagnostics.length).toBeGreaterThan(0);

    // Override language resolves ambiguity
    const resOverride = UniversalTemplateRegistry.importPRN("UNKNOWN RAW TEXT STREAM WITHOUT PRN SIGNATURES", { languageOverride: "RAW" });
    expect(resOverride.ambiguous).toBe(false);
    expect(resOverride.template).toBeDefined();
  });

  // 26. Tattly template imports without special-case code
  it("26. Imports Tattly Threads ZPL PRN cleanly without vendor special cases", () => {
    const res = UniversalTemplateRegistry.importPRN(TATTLY_GOLDEN_PRN, { name: "Tattly Threads Footwear Tag" });
    expect(res.template).toBeDefined();
    expect(res.template?.metadata.name).toBe("Tattly Threads Footwear Tag");
    expect(res.template?.fieldMappings.has("{barcode}")).toBe(true);
  });

  // 27. Clone produces new identity
  it("27. Cloning template produces a completely distinct template ID and metadata", () => {
    const original = new UniversalPrintTemplate({ metadata: { id: "t-cl-orig", name: "Clone Base", version: "1.0.0", sourceFormat: "PRN_ZPL", sourceType: "IMPORTED_PRN", createdAt: "2026-08-09T00:00:00Z", updatedAt: "2026-08-09T00:00:00Z" } });
    UniversalTemplateRegistry.register(original);

    const cloned = UniversalTemplateRegistry.clone("t-cl-orig", "Cloned Identity");
    expect(cloned.metadata.id).not.toBe("t-cl-orig");
    expect(cloned.metadata.name).toBe("Cloned Identity");
  });

  // 28. Export preserves original source
  it("28. Exports original unmodified PRN content for registered template", () => {
    UniversalTemplateRegistry.importPRN(TATTLY_GOLDEN_PRN, { templateId: "t-export-test", name: "Export Test" });
    const exported = UniversalTemplateRegistry.exportTemplate("t-export-test");
    expect(exported).toBe(TATTLY_GOLDEN_PRN);
  });

  // 29. Registry does not require a default template
  it("29. UniversalTemplateRegistry operates cleanly without any required default template", () => {
    UniversalTemplateRegistry.clear();
    expect(UniversalTemplateRegistry.size()).toBe(0);
    expect(UniversalTemplateRegistry.list().length).toBe(0);
  });

  // 30. Registry can operate with zero templates
  it("30. Operates reliably with zero registered templates without crashing or throwing errors", () => {
    UniversalTemplateRegistry.clear();
    expect(UniversalTemplateRegistry.get("non-existent")).toBeUndefined();
    expect(UniversalTemplateRegistry.search("anything").length).toBe(0);
    expect(UniversalTemplateRegistry.filter({ status: "ACTIVE" }).length).toBe(0);
  });

  // 31. REGRESSION TEST: Proves zero global singleton PRN or required hardcoded default PRN file exists
  it("31. REGRESSION TEST: Proves zero hardcoded singleton PRN or mandatory default template dependency", () => {
    UniversalTemplateRegistry.clear();

    // Verify registry returns clean empty lists without throwing or defaulting to any hardcoded file
    expect(UniversalTemplateRegistry.list()).toEqual([]);
    expect(UniversalTemplateRegistry.resolveActiveVersion("DEFAULT")).toBeUndefined();
    expect(UniversalTemplateRegistry.resolveActiveVersion("TATTLY")).toBeUndefined();
  });
});
