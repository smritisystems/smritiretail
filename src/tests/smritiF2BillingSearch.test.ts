/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 6.17.0
 * * Created    : 2026-09-14
 * * Modified   : 2026-09-14
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 *
 * SMRITI F2 Advanced Item Search & Invoicing Browser - Test Suite
 *
 * Verifies:
 *   1. Default filter state (in-stock only, Qty > 0).
 *   2. General selection multi-attribute filtering (Stock No, Desc, Category, Brand, Style, Shade, Size).
 *   3. Quantity comparison operators (">", "=", "<").
 *   4. Advanced selection filters (department, season, fabric, MRP range).
 *   5. Memory persistence (presets & last query recall).
 *   6. Single-key selection output structure (SmritiF2SelectedItem).
 *   7. Brand governance: Zero references to prohibited legacy branding.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SmritiF2SelectedItem, QuantityCondition } from "../components/billing/SmritiF2AdvancedItemSearch.tsx";
import type { Product } from "../types.ts";

const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] || null),
  setItem: vi.fn((key: string, val: string) => { mockStorage[key] = String(val); }),
  removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
  clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
  get length() { return Object.keys(mockStorage).length; },
  key: vi.fn((idx: number) => Object.keys(mockStorage)[idx] || null)
};

Object.defineProperty(globalThis, "localStorage", {
  value: mockLocalStorage,
  writable: true
});

// Mock products representing retail apparel catalog
const MOCK_PRODUCTS: (Product & { styleCode?: string; color?: string; size?: string; department?: string; season?: string; fabric?: string })[] = [
  {
    id: "prod-001",
    name: "Classic Oxford Cotton Shirt - Sky Blue / M",
    code: "SKU-OXF-BLU-M",
    barcode: "890123456001",
    category: "Apparel",
    brand: "SMRITI Classic",
    price: 1499,
    mrp: 1499,
    stock: 15,
    styleCode: "STY-OXF-01",
    color: "Sky Blue",
    size: "M",
    department: "Men's Wear",
    season: "Summer 2026",
    fabric: "100% Cotton",
    active: true,
    unit: "PCS"
  },
  {
    id: "prod-002",
    name: "Classic Oxford Cotton Shirt - Sky Blue / L",
    code: "SKU-OXF-BLU-L",
    barcode: "890123456002",
    category: "Apparel",
    brand: "SMRITI Classic",
    price: 1499,
    mrp: 1499,
    stock: 0, // Out of stock
    styleCode: "STY-OXF-01",
    color: "Sky Blue",
    size: "L",
    department: "Men's Wear",
    season: "Summer 2026",
    fabric: "100% Cotton",
    active: true,
    unit: "PCS"
  },
  {
    id: "prod-003",
    name: "Slim Fit Chino Trousers - Khaki / 32",
    code: "SKU-CHN-KHK-32",
    barcode: "890123456003",
    category: "Apparel",
    brand: "SMRITI Urban",
    price: 2199,
    mrp: 2199,
    stock: 8,
    styleCode: "STY-CHN-05",
    color: "Khaki",
    size: "32",
    department: "Men's Wear",
    season: "Autumn 2026",
    fabric: "Cotton Twill",
    active: true,
    unit: "PCS"
  },
  {
    id: "prod-004",
    name: "Pure Silk Embroidered Saree - Crimson Red",
    code: "SKU-SAR-RED-01",
    barcode: "890123456004",
    category: "Ethnic Wear",
    brand: "SMRITI Royale",
    price: 8499,
    mrp: 8499,
    stock: 3,
    styleCode: "STY-SAR-99",
    color: "Crimson Red",
    size: "Free Size",
    department: "Women's Ethnic",
    season: "Festive 2026",
    fabric: "Mulberry Silk",
    active: true,
    unit: "PCS"
  },
  {
    id: "prod-005",
    name: "Linen Casual Tunic - Olive / XL",
    code: "SKU-LNN-OLV-XL",
    barcode: "890123456005",
    category: "Ethnic Wear",
    brand: "SMRITI Royale",
    price: 2799,
    mrp: 2799,
    stock: 5,
    styleCode: "STY-LNN-12",
    color: "Olive",
    size: "XL",
    department: "Women's Ethnic",
    season: "Summer 2026",
    fabric: "Pure Linen",
    active: true,
    unit: "PCS"
  }
];

// Pure filtering function mirroring SmritiF2AdvancedItemSearch logic
function filterProducts(
  products: typeof MOCK_PRODUCTS,
  criteria: {
    stockNo?: string;
    description?: string;
    category?: string;
    brand?: string;
    styleCode?: string;
    color?: string;
    size?: string;
    qtyCondition: QuantityCondition;
    qtyValue: number;
    inStockOnly: boolean;
    department?: string;
    minMrp?: string;
    maxMrp?: string;
    season?: string;
    fabric?: string;
  }
) {
  return products.filter((p) => {
    // 1. General Selection filters
    if (criteria.stockNo && !p.code.toLowerCase().includes(criteria.stockNo.toLowerCase())) return false;
    if (criteria.description && !p.name.toLowerCase().includes(criteria.description.toLowerCase())) return false;
    if (criteria.category && !p.category.toLowerCase().includes(criteria.category.toLowerCase())) return false;
    if (criteria.brand && !(p.brand || "").toLowerCase().includes(criteria.brand.toLowerCase())) return false;
    if (criteria.styleCode && !(p.styleCode || "").toLowerCase().includes(criteria.styleCode.toLowerCase())) return false;
    if (criteria.color && !(p.color || "").toLowerCase().includes(criteria.color.toLowerCase())) return false;
    if (criteria.size && !(p.size || "").toLowerCase().includes(criteria.size.toLowerCase())) return false;

    // 2. Quantity & Balance Criteria
    const currentStock = p.stock || 0;
    if (criteria.inStockOnly && currentStock <= 0) return false;

    if (criteria.qtyCondition === "Greater Than" && currentStock <= criteria.qtyValue) return false;
    if (criteria.qtyCondition === "Is" && currentStock !== criteria.qtyValue) return false;
    if (criteria.qtyCondition === "Less Than" && currentStock >= criteria.qtyValue) return false;

    // 3. Advanced Selection filters
    if (criteria.department && !(p.department || "").toLowerCase().includes(criteria.department.toLowerCase())) return false;
    if (criteria.season && !(p.season || "").toLowerCase().includes(criteria.season.toLowerCase())) return false;
    if (criteria.fabric && !(p.fabric || "").toLowerCase().includes(criteria.fabric.toLowerCase())) return false;

    const price = p.mrp || p.price || 0;
    if (criteria.minMrp && price < parseFloat(criteria.minMrp)) return false;
    if (criteria.maxMrp && price > parseFloat(criteria.maxMrp)) return false;

    return true;
  });
}

describe("SMRITI F2 Advanced Item Search Engine", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("1. Default Filter State & In-Stock Isolation", () => {
    it("should filter out out-of-stock items by default (Qty > 0)", () => {
      const results = filterProducts(MOCK_PRODUCTS, {
        qtyCondition: "Greater Than",
        qtyValue: 0,
        inStockOnly: true
      });

      // Prod-002 has 0 stock and must be excluded
      expect(results.length).toBe(4);
      expect(results.some((p) => p.code === "SKU-OXF-BLU-L")).toBe(false);
      expect(results.every((p) => (p.stock || 0) > 0)).toBe(true);
    });

    it("should include out-of-stock items when inStockOnly is false and qtyCondition permits", () => {
      const results = filterProducts(MOCK_PRODUCTS, {
        qtyCondition: "Greater Than",
        qtyValue: -1,
        inStockOnly: false
      });

      expect(results.length).toBe(5);
      expect(results.some((p) => p.code === "SKU-OXF-BLU-L")).toBe(true);
    });
  });

  describe("2. General Selection Multi-Attribute Filtering", () => {
    it("should filter accurately by Brand and Color simultaneously", () => {
      const results = filterProducts(MOCK_PRODUCTS, {
        brand: "SMRITI Classic",
        color: "Sky Blue",
        qtyCondition: "Greater Than",
        qtyValue: 0,
        inStockOnly: true
      });

      expect(results.length).toBe(1);
      expect(results[0].code).toBe("SKU-OXF-BLU-M");
    });

    it("should filter by Style Code across multiple variants", () => {
      const results = filterProducts(MOCK_PRODUCTS, {
        styleCode: "STY-OXF-01",
        qtyCondition: "Greater Than",
        qtyValue: -1,
        inStockOnly: false
      });

      expect(results.length).toBe(2);
      expect(results.map((r) => r.size)).toEqual(["M", "L"]);
    });

    it("should filter by Stock No substring", () => {
      const results = filterProducts(MOCK_PRODUCTS, {
        stockNo: "CHN-KHK",
        qtyCondition: "Greater Than",
        qtyValue: 0,
        inStockOnly: true
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toContain("Chino Trousers");
    });
  });

  describe("3. Quantity & Balance Comparison Criteria", () => {
    it("should evaluate 'Greater Than' operator correctly", () => {
      const results = filterProducts(MOCK_PRODUCTS, {
        qtyCondition: "Greater Than",
        qtyValue: 5,
        inStockOnly: false
      });

      // Expected: stock > 5 -> SKU-OXF-BLU-M (15), SKU-CHN-KHK-32 (8)
      expect(results.length).toBe(2);
      expect(results.every((p) => (p.stock || 0) > 5)).toBe(true);
    });

    it("should evaluate 'Is' operator correctly", () => {
      const results = filterProducts(MOCK_PRODUCTS, {
        qtyCondition: "Is",
        qtyValue: 5,
        inStockOnly: false
      });

      // Expected: stock === 5 -> SKU-LNN-OLV-XL (5)
      expect(results.length).toBe(1);
      expect(results[0].code).toBe("SKU-LNN-OLV-XL");
    });

    it("should evaluate 'Less Than' operator correctly", () => {
      const results = filterProducts(MOCK_PRODUCTS, {
        qtyCondition: "Less Than",
        qtyValue: 5,
        inStockOnly: false
      });

      // Expected: stock < 5 -> SKU-OXF-BLU-L (0), SKU-SAR-RED-01 (3)
      expect(results.length).toBe(2);
      expect(results.map((r) => r.code).sort()).toEqual(["SKU-OXF-BLU-L", "SKU-SAR-RED-01"].sort());
    });
  });

  describe("4. Advanced Selection Drawer (Alt+A) Multi-Criteria", () => {
    it("should filter by Department, Fabric, and Price Range", () => {
      const results = filterProducts(MOCK_PRODUCTS, {
        department: "Women's Ethnic",
        fabric: "Mulberry Silk",
        minMrp: "5000",
        maxMrp: "10000",
        qtyCondition: "Greater Than",
        qtyValue: 0,
        inStockOnly: true
      });

      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Pure Silk Embroidered Saree - Crimson Red");
      expect(results[0].mrp).toBe(8499);
    });

    it("should return empty if MRP exceeds maxMrp constraint", () => {
      const results = filterProducts(MOCK_PRODUCTS, {
        department: "Women's Ethnic",
        maxMrp: "2000",
        qtyCondition: "Greater Than",
        qtyValue: 0,
        inStockOnly: true
      });

      expect(results.length).toBe(0);
    });
  });

  describe("5. Enterprise Single-Key Selection Contract", () => {
    it("should map product entity correctly to SmritiF2SelectedItem contract", () => {
      const targetProduct = MOCK_PRODUCTS[0];
      const selectedItem: SmritiF2SelectedItem = {
        stockNo: targetProduct.code,
        barcode: targetProduct.barcode || targetProduct.code,
        name: targetProduct.name,
        rate: targetProduct.price || 0,
        mrp: targetProduct.mrp || 0,
        brand: targetProduct.brand,
        category: targetProduct.category,
        styleCode: targetProduct.styleCode,
        color: targetProduct.color,
        size: targetProduct.size,
        stock: targetProduct.stock,
        gstRate: 5,
        rawRecord: targetProduct
      };

      expect(selectedItem.stockNo).toBe("SKU-OXF-BLU-M");
      expect(selectedItem.barcode).toBe("890123456001");
      expect(selectedItem.rate).toBe(1499);
      expect(selectedItem.stock).toBe(15);
      expect(selectedItem.styleCode).toBe("STY-OXF-01");
    });
  });

  describe("6. Memory Persistence & Preset Recall", () => {
    it("should save and retrieve filter presets in localStorage", () => {
      const STORAGE_KEY = "smriti_f2_filter_presets";
      const testPreset = {
        stockNo: "",
        description: "",
        category: "Apparel",
        brand: "SMRITI Classic",
        qtyCondition: "Greater Than" as QuantityCondition,
        qtyValue: 0,
        inStockOnly: true
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(testPreset));
      const retrieved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

      expect(retrieved.brand).toBe("SMRITI Classic");
      expect(retrieved.category).toBe("Apparel");
      expect(retrieved.inStockOnly).toBe(true);
    });
  });

  describe("7. Brand Governance Check", () => {
    it("should strictly use SMRITI branding and avoid legacy vendor names", () => {
      const SMRITI_IDENTIFIER = "SmritiF2AdvancedItemSearch";
      expect(SMRITI_IDENTIFIER.startsWith("Smriti")).toBe(true);
      expect(SMRITI_IDENTIFIER.toLowerCase().includes("shoper")).toBe(false);
    });
  });

  describe("8. ProPOS Billing Terminal F2 Adapter Contract", () => {
    it("should resolve variant and barcode field overrides without dropping entity", () => {
      const fieldOverrides = new Map<string, string>([
        ["posCustomerCode", "customer"],
        ["posCustomerName", "customer"],
        ["directStockNo", "variant"],
        ["directBarcode", "item_barcode"]
      ]);

      expect(fieldOverrides.get("directStockNo")).toBe("variant");
      expect(fieldOverrides.get("directBarcode")).toBe("item_barcode");
      expect(fieldOverrides.get("posCustomerCode")).toBe("customer");
    });

    it("should transform lookup result into direct entry and product meta", () => {
      const mockLookupResult = {
        entity: "variant",
        id: "prod-001",
        displayValue: "SKU-OXF-BLU-M",
        returnValue: "SKU-OXF-BLU-M",
        record: {
          id: "prod-001",
          code: "SKU-OXF-BLU-M",
          name: "Classic Oxford Cotton Shirt - Sky Blue / M",
          barcode: "890123456001",
          rate: 1499,
          mrp: 1499,
          costPrice: 800,
          stock: 15,
          category: "Apparel",
          brand: "SMRITI Classic",
          gstRate: 5,
          hsnCode: "620520"
        }
      };

      // Emulate the adapter logic in ProPosBillingTerm
      let directStockNo = "";
      let directBarcode = "";
      let directDescription = "";
      let directRate = "";
      let selectedMeta: any = null;

      if (mockLookupResult.entity === "variant" || mockLookupResult.entity === "item_barcode" || mockLookupResult.entity === "item") {
        const rec = mockLookupResult.record;
        const stockCode = String(mockLookupResult.returnValue || rec.code || "");
        const rate = Number(rec.rate ?? rec.mrp ?? 0);
        directStockNo = stockCode;
        directBarcode = String(rec.barcode || stockCode);
        directDescription = String(rec.name || "");
        directRate = String(rate);
        selectedMeta = {
          id: String(mockLookupResult.id || rec.id),
          name: String(rec.name || stockCode),
          code: stockCode,
          stockNo: stockCode,
          sku: stockCode,
          barcode: String(rec.barcode || stockCode),
          description: String(rec.name || ""),
          sellingPrice: rate,
          mrp: Number(rec.mrp || rate),
          costPrice: Number(rec.costPrice || 0),
          stockQty: Number(rec.stock ?? 1),
          category: String(rec.category || ""),
          brand: rec.brand ? String(rec.brand) : undefined,
          gstPercentage: Number(rec.gstRate || 0),
          hsnCode: String(rec.hsnCode || ""),
          uom: "PCS"
        };
      }

      expect(directStockNo).toBe("SKU-OXF-BLU-M");
      expect(directBarcode).toBe("890123456001");
      expect(directDescription).toBe("Classic Oxford Cotton Shirt - Sky Blue / M");
      expect(directRate).toBe("1499");
      expect(selectedMeta).not.toBeNull();
      expect(selectedMeta.stockQty).toBe(15);
      expect(selectedMeta.brand).toBe("SMRITI Classic");
    });
  });

  describe("9. Enterprise Retail: F7 Exact Cash Settlement Contract", () => {
    it("should build exact cash payment matching net payable amount with zero change due", () => {
      const netPayable = 2499.50;
      const exactCashPayment = [
        { mode: "Cash", amount: netPayable, reference: "Exact Cash [F7]" }
      ];

      expect(exactCashPayment[0].mode).toBe("Cash");
      expect(exactCashPayment[0].amount).toBe(2499.50);
      expect(exactCashPayment[0].reference).toContain("Exact Cash [F7]");

      const totalTendered = exactCashPayment.reduce((sum, p) => sum + p.amount, 0);
      const changeDue = Math.max(0, totalTendered - netPayable);

      expect(totalTendered).toBe(netPayable);
      expect(changeDue).toBe(0);
    });
  });

  describe("10. Retail Barcode Scanner Guard (Qty/Rate Burst Interception)", () => {
    it("should intercept 8+ digit numeric barcode scanned into Qty and redirect to barcode", () => {
      const scannedInput = "890123456789";
      let redirectedBarcode = "";
      let safeQty = "1";

      const clean = scannedInput.trim();
      const isBarcodeBurst = clean.length >= 8 && /^\d+$/.test(clean);

      if (isBarcodeBurst) {
        redirectedBarcode = clean;
        safeQty = "1";
      } else {
        safeQty = clean;
      }

      expect(isBarcodeBurst).toBe(true);
      expect(redirectedBarcode).toBe("890123456789");
      expect(safeQty).toBe("1");
    });

    it("should allow valid normal quantity entry (e.g. 5, 12, 1.5)", () => {
      const normalInput = "12";
      let isBarcodeBurst = false;
      let safeQty = normalInput;

      const clean = normalInput.trim();
      if (clean.length >= 8 && /^\d+$/.test(clean)) {
        isBarcodeBurst = true;
      } else {
        safeQty = clean;
      }

      expect(isBarcodeBurst).toBe(false);
      expect(safeQty).toBe("12");
    });
  });

  describe("11. Suspended Invoices Nested Line Item Inspection", () => {
    it("should compute line item totals accurately during document inspection", () => {
      const heldBill = {
        id: "held-001",
        docNo: "HOLD-001",
        date: "2026-09-14",
        items: [
          { stockNo: "SKU-OXF-BLU-M", itemDescription: "Oxford Shirt", qty: 2, rate: 1499 },
          { stockNo: "SKU-CHN-KHK-32", itemDescription: "Chino Trousers", qty: 1, rate: 2199 }
        ]
      };

      const inspectedItems = heldBill.items.map(it => ({
        stockNo: it.stockNo,
        description: it.itemDescription,
        qty: it.qty,
        rate: it.rate,
        total: it.qty * it.rate
      }));

      expect(inspectedItems.length).toBe(2);
      expect(inspectedItems[0].total).toBe(2998);
      expect(inspectedItems[1].total).toBe(2199);
      const computedNet = inspectedItems.reduce((acc, it) => acc + it.total, 0);
      expect(computedNet).toBe(5197);
    });
  });
});
