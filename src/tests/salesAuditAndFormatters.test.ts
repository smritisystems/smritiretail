/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-08-26
 * Modified     : 2026-08-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect } from "vitest";
import { formatCurrency, formatNumber, safeNumber, safeDivision, formatDate, formatDateTime } from "../utils/formatters";
import { normalizeSalesOrder, normalizeSalesOrders, normalizeSalesOrderItem, normalizeQuotation, normalizeQuotations } from "../utils/normalizeSales";

describe("SMRITI Safe Number & Currency Formatters Audit", () => {
  it("should safely format standard numbers into INR currency", () => {
    const formatted = formatCurrency(150000);
    expect(formatted).toContain("1,50,000.00");
  });

  it("should safely format negative and decimal numbers into INR currency", () => {
    const formatted = formatCurrency(-1250.5);
    expect(formatted).toContain("1,250.50");
  });

  it("should safely format numeric strings into INR currency", () => {
    const formatted = formatCurrency("31734919.90");
    expect(formatted).toContain("3,17,34,919.90");
  });

  it("should fall back to ₹0.00 on null, undefined, empty string, NaN, and Infinity", () => {
    expect(formatCurrency(null)).toBe("₹0.00");
    expect(formatCurrency(undefined)).toBe("₹0.00");
    expect(formatCurrency("")).toBe("₹0.00");
    expect(formatCurrency(NaN)).toBe("₹0.00");
    expect(formatCurrency(Infinity)).toBe("₹0.00");
    expect(formatCurrency(-Infinity)).toBe("₹0.00");
    expect(formatCurrency("invalid-string")).toBe("₹0.00");
    expect(formatCurrency({})).toBe("₹0.00");
  });

  it("should format numbers with localized formatNumber safely", () => {
    expect(formatNumber(150000, 0)).toBe("1,50,000");
    expect(formatNumber(150000.75, 2)).toBe("1,50,000.75");
    expect(formatNumber(null, 2)).toBe("0.00");
    expect(formatNumber(undefined, 2)).toBe("0.00");
    expect(formatNumber(NaN, 2)).toBe("0.00");
    expect(formatNumber(Infinity, 2)).toBe("0.00");
  });

  it("should convert inputs to finite numbers with safeNumber", () => {
    expect(safeNumber(100)).toBe(100);
    expect(safeNumber("250.50")).toBe(250.5);
    expect(safeNumber("1,50,000.00")).toBe(150000);
    expect(safeNumber(null, 10)).toBe(10);
    expect(safeNumber(undefined, 0)).toBe(0);
    expect(safeNumber(NaN, 5)).toBe(5);
    expect(safeNumber(Infinity, 0)).toBe(0);
    expect(safeNumber(-Infinity, 0)).toBe(0);
  });

  it("should prevent Division-by-Zero and NaN with safeDivision", () => {
    expect(safeDivision(100, 2)).toBe(50);
    expect(safeDivision(100, 0)).toBe(0);
    expect(safeDivision(100, null)).toBe(0);
    expect(safeDivision(null, 10)).toBe(0);
    expect(safeDivision(undefined, undefined)).toBe(0);
    expect(safeDivision(100, 0, 99)).toBe(99);
  });

  it("should safely format dates and datetimes with fallback", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate(undefined)).toBe("-");
    expect(formatDate("invalid-date")).toBe("-");
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime(undefined)).toBe("-");
    expect(formatDateTime("invalid-date")).toBe("-");
  });
});

describe("SMRITI Sales Order Normalization & Case Resilience Audit", () => {
  it("should normalize backend snake_case SalesOrder response to dual camelCase/snake_case structure", () => {
    const rawBackendOrder = {
      id: "so-tt-5182778151",
      order_no: "SO-5182778151",
      date: "2026-07-31",
      customer_name: "Reliance Retail Limited",
      tax_total: "22530.26",
      grand_total: "473135.06",
      basic_total: "450604.80",
      po_number: "5182778151",
      site_code: "1888",
      site_name: "RRL Footprint Dibrugarh",
      total_qty: "384.0000",
      billed_qty: "144.0000",
      billed_value: "177066.88",
      pending_qty: "240.0000",
      pending_value: "296068.18",
      fulfillment_status: "PARTIALLY_BILLED",
      status: "Confirmed",
      items: [
        {
          id: 18037,
          product_id: "prod-ch-18-e-brown-40",
          code: "CH-18-E-BROWN-40",
          name: "TATLD FLT CHAPPAL",
          quantity: "1.0000",
          price: "1180.48",
          gst_rate: "5.00",
          tax_amount: "59.02",
          total_amount: "1180.48",
          sr_no: 1,
          article_no: "450001",
          ean: "8904551000019",
          vendor_style: "CH-18-E",
          color: "BROWN",
          size: "40",
          uom: "EA",
        }
      ],
      allocations: [
        {
          id: "alloc-5182778151-TT2026-2027-18",
          order_id: "so-tt-5182778151",
          order_no: "SO-5182778151",
          po_number: "5182778151",
          invoice_id: "inv-tt-18",
          invoice_no: "TT2026-2027/18",
          invoice_date: "2026-08-01",
          po_quantity: "384.0000",
          po_value: "473135.06",
          billed_quantity: "144.0000",
          billed_value: "177066.88",
          pending_quantity: "240.0000",
          pending_value: "296068.18",
          status: "PARTIALLY_BILLED",
        }
      ]
    };

    const normalized = normalizeSalesOrder(rawBackendOrder);

    // Assert camelCase access
    expect(normalized.orderNo).toBe("SO-5182778151");
    expect(normalized.customerName).toBe("Reliance Retail Limited");
    expect(normalized.taxTotal).toBe(22530.26);
    expect(normalized.grandTotal).toBe(473135.06);
    expect(normalized.basicTotal).toBe(450604.8);
    expect(normalized.poNumber).toBe("5182778151");
    expect(normalized.siteCode).toBe("1888");
    expect(normalized.totalQty).toBe(384);
    expect(normalized.billedQty).toBe(144);
    expect(normalized.pendingQty).toBe(240);
    expect(normalized.fulfillmentStatus).toBe("PARTIALLY_BILLED");

    // Assert snake_case access
    expect(normalized.order_no).toBe("SO-5182778151");
    expect(normalized.customer_name).toBe("Reliance Retail Limited");
    expect(normalized.tax_total).toBe(22530.26);
    expect(normalized.grand_total).toBe(473135.06);
    expect(normalized.po_number).toBe("5182778151");

    // Assert line item normalization
    expect(normalized.items).toHaveLength(1);
    const item = normalized.items[0];
    expect(item.productId).toBe("prod-ch-18-e-brown-40");
    expect(item.product_id).toBe("prod-ch-18-e-brown-40");
    expect(item.quantity).toBe(1);
    expect(item.price).toBe(1180.48);
    expect(item.gstRate).toBe(5);
    expect(item.gst_rate).toBe(5);
    expect(item.articleNo).toBe("450001");
    expect(item.article_no).toBe("450001");
    expect(item.vendorStyle).toBe("CH-18-E");
    expect(item.vendor_style).toBe("CH-18-E");

    // Assert allocations normalization
    expect(normalized.allocations).toHaveLength(1);
    const alloc = normalized.allocations![0];
    expect(alloc.invoiceNo).toBe("TT2026-2027/18");
    expect(alloc.invoice_no).toBe("TT2026-2027/18");
    expect(alloc.billedQuantity).toBe(144);
    expect(alloc.pendingQuantity).toBe(240);
  });

  it("should normalize empty, null, or malformed Sales Orders without errors or NaN", () => {
    const emptyOrder = normalizeSalesOrder(null);
    expect(emptyOrder.orderNo).toBe("SO");
    expect(emptyOrder.taxTotal).toBe(0);
    expect(emptyOrder.grandTotal).toBe(0);
    expect(emptyOrder.items).toEqual([]);

    const malformedOrder = normalizeSalesOrder({
      orderNo: "SO-MALFORMED",
      taxTotal: "not-a-number",
      grandTotal: null,
      items: [
        null,
        { price: "invalid", quantity: undefined, totalAmount: NaN }
      ]
    });
    expect(malformedOrder.orderNo).toBe("SO-MALFORMED");
    expect(malformedOrder.taxTotal).toBe(0);
    expect(malformedOrder.grandTotal).toBe(0);
    expect(malformedOrder.items).toHaveLength(2);
    expect(malformedOrder.items[0].price).toBe(0);
    expect(malformedOrder.items[1].price).toBe(0);
    expect(malformedOrder.items[1].quantity).toBe(1);
    expect(malformedOrder.items[1].totalAmount).toBe(0);
  });

  it("should normalize arrays of sales orders safely", () => {
    expect(normalizeSalesOrders(null)).toEqual([]);
    expect(normalizeSalesOrders(undefined)).toEqual([]);
    expect(normalizeSalesOrders("not-an-array")).toEqual([]);
    expect(normalizeSalesOrders([ { order_no: "SO-01" }, { order_no: "SO-02" } ])).toHaveLength(2);
  });

  it("should normalize quotations safely", () => {
    const q = normalizeQuotation({
      quotation_no: "QT-101",
      customer_name: "John Doe",
      tax_total: "150.00",
      grand_total: "1150.00"
    });
    expect(q.quotationNo).toBe("QT-101");
    expect(q.customerName).toBe("John Doe");
    expect(q.taxTotal).toBe(150);
    expect(q.grandTotal).toBe(1150);

    expect(normalizeQuotations(null)).toEqual([]);
  });
});
