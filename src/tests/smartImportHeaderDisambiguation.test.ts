/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.49
 * Created      : 2026-10-09
 * Modified     : 2026-10-09
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import { HeaderMappingEngine } from "../lib/headerMapping/HeaderMappingEngine";
import { SMRITI_ITEM_MASTER_FIELDS } from "../lib/headerMapping/HeaderAliasRegistry";
import { getUnifiedHeaderMappingFields } from "../services/unifiedFieldCatalog";
import { GridInputEngine } from "../services/gridInput/gridInputEngine";

describe("Smart Import Header Disambiguation & Style-SKU Parity (v6.70.49)", () => {
  const catalogFields = getUnifiedHeaderMappingFields([]);
  const unifiedEngine = new HeaderMappingEngine(catalogFields);
  const aliasEngine = new HeaderMappingEngine(SMRITI_ITEM_MASTER_FIELDS);

  const sampleHeaders = [
    "BARCODE NO",
    "PRODUCT STYLE CODE",
    "ITEM DESCRIPTION",
    "BRAND NAME",
    "COLOR",
    "SIZE",
    "SKU",
    "PLANNED MRP",
    "COST PRICE",
    "PRODUCT TAX",
    "HSN CODE",
    "GENDER",
    "VENDOR CODE",
    "PURCHASE CLASS",
    "DEPARTMENT",
    "MERCHANDISE CATEGORY",
    "Sub category",
    "HEELS",
    "UPPER MATERIAL",
    "OUTSOLE",
    "IMAGE LINK"
  ];

  it("maps all 21 user catalog headers cleanly without collision in unifiedEngine", () => {
    const res = unifiedEngine.mapHeaders(sampleHeaders, "ITEM_MASTER");
    expect(res.columns).toHaveLength(21);

    const mappingMap = new Map<string, string>();
    res.columns.forEach(c => {
      mappingMap.set(c.sourceHeader, c.mappedFieldKey || "");
    });

    expect(mappingMap.get("BARCODE NO")).toBe("barcode");
    expect(mappingMap.get("PRODUCT STYLE CODE")).toBe("style_code");
    expect(["name", "itemDescription"]).toContain(mappingMap.get("ITEM DESCRIPTION"));
    expect(mappingMap.get("BRAND NAME")).toBe("brand");
    expect(mappingMap.get("COLOR")).toBe("colour");
    expect(mappingMap.get("SIZE")).toBe("size");
    expect(mappingMap.get("SKU")).toBe("code");
    expect(mappingMap.get("PLANNED MRP")).toBe("mrp");
    expect(mappingMap.get("COST PRICE")).toBe("cost_price");
    expect(mappingMap.get("PRODUCT TAX")).toBe("gst_percentage");
    expect(mappingMap.get("HSN CODE")).toBe("hsn_code");
    expect(mappingMap.get("GENDER")).toBe("gender");
    expect(mappingMap.get("VENDOR CODE")).toBe("vendor_code");
    expect(mappingMap.get("PURCHASE CLASS")).toBe("purchase_class");
    expect(mappingMap.get("DEPARTMENT")).toBe("department");
    expect(mappingMap.get("MERCHANDISE CATEGORY")).toBe("MERCHANDISE_CATEGORY");
    expect(mappingMap.get("Sub category")).toBe("subCategory");
    expect(mappingMap.get("HEELS")).toBe("heel_type");
    expect(mappingMap.get("UPPER MATERIAL")).toBe("upper_material");
    expect(mappingMap.get("OUTSOLE")).toBe("outsole_material");
    expect(mappingMap.get("IMAGE LINK")).toBe("imageName");
  });

  it("maps both PRODUCT STYLE CODE and SKU without collision in SMRITI_ITEM_MASTER_FIELDS", () => {
    const res = aliasEngine.mapHeaders(sampleHeaders, "ITEM_MASTER");
    const mappingMap = new Map<string, string>();
    res.columns.forEach(c => {
      mappingMap.set(c.sourceHeader, c.mappedFieldKey || "");
    });

    expect(mappingMap.get("PRODUCT STYLE CODE")).toBe("style_code");
    expect(mappingMap.get("SKU")).toBe("code");
    expect(mappingMap.get("BARCODE NO")).toBe("barcode");
  });

  it("parses sample footwear catalog row correctly with delimited text parser", () => {
    const tsvData = `BARCODE NO\tPRODUCT STYLE CODE\tITEM DESCRIPTION\tBRAND NAME\tCOLOR\tSIZE\tSKU\tPLANNED MRP\tCOST PRICE\tPRODUCT TAX\tHSN CODE\tGENDER\tVENDOR CODE\tPURCHASE CLASS\tDEPARTMENT\tMERCHANDISE CATEGORY\tSub category\tHEELS\tUPPER MATERIAL\tOUTSOLE\tIMAGE LINK\n8904551000002\tCH-01-A\tBASIC\tTATTLY THREADS\tCREAM\t36\tCH-01-A-CREAM-36\t1899\t375\t5\t64041990\tLADIES\tA\tSIS\tLADIES FTW\tCHAPPAL\tCROSS \tSMALL PLATFORM\tSYNTHETIC\tPU\tCH-01-A`;
    const parsed = GridInputEngine.parseDelimitedText(tsvData);
    expect(parsed.matrix).toHaveLength(2);
    expect(parsed.matrix[0]).toHaveLength(21);
    expect(parsed.matrix[1][0]).toBe("8904551000002");
    expect(parsed.matrix[1][1]).toBe("CH-01-A");
    expect(parsed.matrix[1][6]).toBe("CH-01-A-CREAM-36");
  });
});
