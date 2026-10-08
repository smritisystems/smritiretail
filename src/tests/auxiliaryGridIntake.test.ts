/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.46.2
 * Created      : 2026-10-03
 * Modified     : 2026-10-08
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { describe, it, expect } from "vitest";
import { GridInputEngine } from "../services/gridInput/gridInputEngine";

describe("Auxiliary Ingestion Surfaces Grid Intake Harmonization", () => {
  describe("1. ItemDetailsGridTab Intake Parsing", () => {
    it("parses tab-delimited item master rows with embedded commas and quotes seamlessly", () => {
      const pastedRawText = `Stock No\tProduct\tBrand\tMRP\tSelling Price\nSTK-201\t"Classic Cotton Shirt, Blue"\t"Louis Philippe"\t1999\t1499\nSTK-202\t"Formal Trousers, Black"\t"Van Heusen"\t2499\t1899`;
      const parseResult = GridInputEngine.parseDelimitedText(pastedRawText);
      expect(parseResult.delimiter).toBe("\t");
      expect(parseResult.matrix).toHaveLength(3);
      expect(parseResult.matrix[1][0]).toBe("STK-201");
      expect(parseResult.matrix[1][1]).toBe("Classic Cotton Shirt, Blue");
      expect(parseResult.matrix[1][2]).toBe("Louis Philippe");
      expect(parseResult.matrix[2][1]).toBe("Formal Trousers, Black");
    });

    it("parses CSV-pasted data in ItemDetailsGridTab with equal fidelity", () => {
      const pastedCsv = `Stock No,Product,Brand,MRP,Selling Price\nSTK-301,"Linen Blazer, Beige",Raymond,4999,3999`;
      const parseResult = GridInputEngine.parseDelimitedText(pastedCsv);
      expect(parseResult.delimiter).toBe(",");
      expect(parseResult.matrix).toHaveLength(2);
      expect(parseResult.matrix[1][1]).toBe("Linen Blazer, Beige");
      expect(parseResult.matrix[1][2]).toBe("Raymond");
    });
  });

  describe("2. SalesStudioTab Customer Delimited Parsing", () => {
    it("parses customer CSV with commas inside quoted business names", () => {
      const csvContent = `Name,Phone,Email,Company,GSTIN\n"Mallah, Jawahar",9876543210,jawahar@aitdl.com,"AITDL Networks, Inc.",27AAAAA0000A1Z5\n"Sharma, Priya",9123456780,priya@example.com,"Sharma Retailers",27BBBBB1111B1Z2`;
      const parseResult = GridInputEngine.parseDelimitedText(csvContent);
      expect(parseResult.delimiter).toBe(",");
      expect(parseResult.matrix).toHaveLength(3);
      expect(parseResult.matrix[1][0]).toBe("Mallah, Jawahar");
      expect(parseResult.matrix[1][3]).toBe("AITDL Networks, Inc.");
      expect(parseResult.matrix[2][0]).toBe("Sharma, Priya");
    });

    it("parses tab-delimited customer export from Excel clipboard", () => {
      const tsvContent = `Name\tPhone\tEmail\tCity\nRohit Verma\t9988776655\trohit@retail.com\tMumbai\nAnita Desai\t9876123450\tanita@textile.com\tSurat`;
      const parseResult = GridInputEngine.parseDelimitedText(tsvContent);
      expect(parseResult.delimiter).toBe("\t");
      expect(parseResult.matrix).toHaveLength(3);
      expect(parseResult.matrix[1][0]).toBe("Rohit Verma");
      expect(parseResult.matrix[2][3]).toBe("Surat");
    });
  });

  describe("3. Barcode Label Delimited Text Parsing", () => {
    it("parses tag printing data with quotation marks and custom rates", () => {
      const tagData = `SKU,Item Name,Barcode,Selling Price,MRP,Size,Color,Qty\nSHIRT-001,"Premium Slim Fit Shirt, White",890100000001,999,1299,38,White,5\nTROUSER-002,"Chino Pants, Navy",890100000002,1499,1899,32,Navy,10`;
      const parseResult = GridInputEngine.parseDelimitedText(tagData);
      expect(parseResult.matrix).toHaveLength(3);
      expect(parseResult.matrix[1][0]).toBe("SHIRT-001");
      expect(parseResult.matrix[1][1]).toBe("Premium Slim Fit Shirt, White");
      expect(parseResult.matrix[1][7]).toBe("5");
    });
  });

  describe("4. StandaloneWindowView Delimited Text Parsing", () => {
    it("parses pipe-delimited data for standalone invoice staging", () => {
      const pipeData = `Barcode|SKU|Item Description|Quantity|MRP|Selling Price\n890999001|ART-001|Leather Belt|2|899|699\n890999002|ART-002|Silk Tie|3|699|499`;
      const parseResult = GridInputEngine.parseDelimitedText(pipeData);
      expect(parseResult.delimiter).toBe("|");
      expect(parseResult.matrix).toHaveLength(3);
      expect(parseResult.matrix[1][0]).toBe("890999001");
      expect(parseResult.matrix[1][2]).toBe("Leather Belt");
      expect(parseResult.matrix[2][3]).toBe("3");
    });
  });
});
