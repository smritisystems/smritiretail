/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.3.0
 * Created      : 2026-07-27
 * Copyright    : © SmritiSys. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect } from "vitest";
import { generateTSPLScript, generateZPLScript, generatePRNScript } from "../services/prnGenerator";
import { Product } from "../types";

describe("PRN Script Generator Tests", () => {
  const mockProduct: Product = {
    id: "P-101",
    code: "SKU-TSHIRT-001",
    name: "Classic Cotton T-Shirt",
    barcode: "8901234567890",
    price: 499.0,
    mrp: 699.0,
    stock: 25,
    category: "Apparel",
    brand: "SMRITI"
  };

  it("should generate valid TSPL PRN script from Item Master product", () => {
    const tspl = generateTSPLScript(mockProduct, 2, { widthMm: 50, heightMm: 25 });
    expect(tspl).toContain("SIZE 50 mm, 25 mm");
    expect(tspl).toContain("Classic Cotton T-Shirt");
    expect(tspl).toContain("8901234567890");
    expect(tspl).toContain("OUR PRICE: ₹499.00");
    expect(tspl).toContain("PRINT 2,1");
  });

  it("should generate valid ZPL PRN script from Item Master product", () => {
    const zpl = generateZPLScript(mockProduct, 3, { widthMm: 50, heightMm: 25 });
    expect(zpl).toContain("^XA");
    expect(zpl).toContain("Classic Cotton T-Shirt");
    expect(zpl).toContain("8901234567890");
    expect(zpl).toContain("PRICE: INR 499.00");
    expect(zpl).toContain("^PQ3");
    expect(zpl).toContain("^XZ");
  });

  it("should generate multi-item PRN script batch", () => {
    const batchScript = generatePRNScript(
      [
        { product: mockProduct, copies: 1 },
        {
          product: {
            id: "P-102",
            code: "SKU-JEANS-002",
            name: "Slim Fit Denim Jeans",
            barcode: "8901234567891",
            price: 1299.0,
            mrp: 1599.0,
            stock: 10,
            category: "Apparel"
          },
          copies: 2
        }
      ],
      { language: "TSPL", widthMm: 50, heightMm: 25 }
    );

    expect(batchScript).toContain("Classic Cotton T-Shirt");
    expect(batchScript).toContain("Slim Fit Denim Jeans");
    expect(batchScript).toContain("8901234567891");
    expect(batchScript).toContain("PRINT 2,1");
  });
});
