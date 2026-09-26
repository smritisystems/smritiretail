/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.32.0
 * Created      : 2026-09-26
 * Modified     : 2026-09-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { renderToString } from "react-dom/server";
import { describe, it, expect } from "vitest";

import { StandardInvoiceA4 } from "../print_engine/templates/StandardInvoiceA4";
import { GoodsReceiptNoteA4 } from "../print_engine/templates/GoodsReceiptNoteA4";
import { ThermalReceipt80mm } from "../print_engine/templates/ThermalReceipt80mm";
import { BarcodeLabel } from "../print_engine/templates/BarcodeLabel";
import { FootwearPurchaseOrderA4 } from "../print_engine/templates/FootwearPurchaseOrderA4";
import { SizePivotMatrixA4 } from "../print_engine/templates/SizePivotMatrixA4";
import LabelPrintEngine, { DEFAULT_TEMPLATE } from "../utils/labelPrintEngine";

describe("Headless Print Engine Audit — All Print Formats (No Browser)", () => {
  // Format 1: A4 Standard Tax Invoice
  describe("Format 1: StandardInvoiceA4 (A4 GST Tax Invoice)", () => {
    it("renders valid invoice payload headlessly to HTML", () => {
      const invoiceData = {
        invoiceNo: "INV-2026-9901",
        date: "2026-09-26",
        companyName: "Tattly Footwear & Apparel Pvt Ltd",
        companyAddress: "Plot 88, IMT Manesar, Gurugram, Haryana",
        companyGst: "06AAACT2934K1Z2",
        customerName: "Reliance Retail Ltd",
        customerAddress: "RCP, Navi Mumbai, Maharashtra",
        customerGst: "27AAACR0293P1ZT",
        items: [
          {
            name: "Classic Derby Shoe Tan",
            hsn: "6403",
            qty: 10,
            rate: 1500,
            gstRate: 18,
            mrp: 2999,
          },
          {
            name: "Oxford Leather Boot Black",
            hsn: "6403",
            qty: 5,
            rate: 2200,
            gstRate: 18,
            mrp: 3999,
          }
        ]
      };

      const html = renderToString(React.createElement(StandardInvoiceA4, { data: invoiceData }));
      expect(html).toContain("INV-2026-9901");
      expect(html).toContain("Tattly Footwear");
      expect(html).toContain("Reliance Retail Ltd");
      expect(html).toContain("Classic Derby Shoe Tan");
      expect(html).toContain("invoice-print-container");
    });

    it("renders empty/minimal invoice data without crashing", () => {
      const html = renderToString(React.createElement(StandardInvoiceA4, { data: {} as any }));
      expect(html).toBeDefined();
      expect(html.length).toBeGreaterThan(0);
    });
  });

  // Format 2: A4 Goods Receipt Note (GRN)
  describe("Format 2: GoodsReceiptNoteA4 (A4 Goods Receipt Note)", () => {
    it("renders complete GRN payload headlessly to HTML", () => {
      const grnData = {
        companyName: "SMRITI Logistics Hub",
        supplierName: "Agra Footwear Craft Ltd",
        poNumber: "PO-2026-880",
        supplierInvoice: "INV-AGRA-102",
        grnNo: "GRN-2026-0044",
        date: "2026-09-26",
        receivedBy: "Warehouse Lead",
        items: [
          { name: "Leather Upper Material (Sq Ft)", qty: 500 },
          { name: "Rubber Lug Soles (Pairs)", qty: 250 }
        ]
      };

      const html = renderToString(React.createElement(GoodsReceiptNoteA4, { data: grnData }));
      expect(html).toContain("GRN-2026-0044");
      expect(html).toContain("Agra Footwear Craft Ltd");
      expect(html).toContain("GOODS RECEIPT NOTE (GRN)");
      expect(html).toContain("Store Keeper");
      expect(html).toContain("Quality Inspector");
      expect(html).toContain("Authorised Signatory");
    });

    it("renders empty/minimal GRN data without crashing", () => {
      const html = renderToString(React.createElement(GoodsReceiptNoteA4, { data: {} as any }));
      expect(html).toContain("GOODS RECEIPT NOTE (GRN)");
    });
  });

  // Format 3: Thermal 80mm POS Receipt
  describe("Format 3: ThermalReceipt80mm (80mm POS Receipt)", () => {
    it("renders thermal receipt payload headlessly to HTML", () => {
      const receiptData = {
        storeName: "SMRITI FLAGSHIP STORE",
        storeAddress: "Store 4B, Phoenix Palladium, Mumbai",
        gstin: "27AAACS1234F1Z1",
        phone: "+91 22 4912 3456",
        receiptNo: "RCP-2026-8821",
        date: "2026-09-26 15:30:00",
        cashier: "Rahul V.",
        items: [
          { name: "Sneaker White 42", qty: 1, rate: 3499.00 },
          { name: "Cotton Socks 3PK", qty: 2, rate: 299.00 }
        ],
        total: 4097.00,
        paid: 4100.00,
        paymentMethod: "UPI"
      };

      const html = renderToString(React.createElement(ThermalReceipt80mm, { data: receiptData }));
      expect(html).toContain("RCP-2026-8821");
      expect(html).toContain("SMRITI FLAGSHIP STORE");
      expect(html).toContain("Sneaker White 42");
      expect(html).toContain("4097.00");
      expect(html).toContain("w-[80mm]");
    });

    it("renders empty/minimal thermal receipt data without crashing", () => {
      const html = renderToString(React.createElement(ThermalReceipt80mm, { data: {} as any }));
      expect(html).toContain("w-[80mm]");
      expect(html).toContain("SMRITI RETAIL");
    });
  });

  // Format 4: Product Barcode Label 50x25mm
  describe("Format 4: BarcodeLabel (50x25mm Barcode Shelf Tag)", () => {
    it("renders barcode label payload headlessly to HTML", () => {
      const labelData = {
        companyName: "TATTLY",
        items: [
          {
            name: "Derby Tan 42",
            rate: 2499.00,
            barcode: "8901234567890"
          }
        ]
      };

      const html = renderToString(React.createElement(BarcodeLabel, { data: labelData }));
      expect(html).toContain("TATTLY");
      expect(html).toContain("Derby Tan 42");
      expect(html).toContain("8901234567890");
      expect(html).toContain("w-[50mm]");
      expect(html).toContain("h-[25mm]");
    });

    it("renders empty/minimal label data without crashing", () => {
      const html = renderToString(React.createElement(BarcodeLabel, { data: {} as any }));
      expect(html).toContain("w-[50mm]");
    });
  });

  // Format 5: Footwear Purchase Order A4
  describe("Format 5: FootwearPurchaseOrderA4 (Euro Scale & Sizing Run)", () => {
    it("renders footwear PO payload headlessly to HTML", () => {
      const poData = {
        poNumber: "FWPO-2026-099",
        companyName: "Tattly Footwear International",
        vendorName: "Agra Leather Artisans",
        items: [
          {
            articleCode: "ART-OX-01",
            modelName: "Bespoke Oxford",
            upperMaterial: "Calf Leather",
            soleMaterial: "Vibram Rubber",
            liningMaterial: "Sheepskin",
            insoleMaterial: "OrthoLite",
            color: "Tan",
            cartons: 5,
            pairs: 60,
            ratePerPair: 25.00,
            taxRatePercent: 0,
            lineTotal: 1500.00,
            eu40: 5,
            eu41: 10,
            eu42: 15,
            eu43: 15,
            eu44: 10,
            eu45: 5
          }
        ]
      };

      const html = renderToString(React.createElement(FootwearPurchaseOrderA4, { data: poData }));
      expect(html).toContain("FWPO-2026-099");
      expect(html).toContain("Agra Leather Artisans");
      expect(html).toContain("Bespoke Oxford");
      expect(html).toContain("EU 40");
      expect(html).toContain("60 Pairs");
    });

    it("renders empty/minimal footwear PO data without crashing", () => {
      const html = renderToString(React.createElement(FootwearPurchaseOrderA4, { data: {} as any }));
      expect(html).toContain("FOOTWEAR PURCHASE ORDER");
    });
  });

  // Format 6: Size Pivot Matrix A4
  describe("Format 6: SizePivotMatrixA4 (Procurement Size Grid)", () => {
    it("renders size pivot matrix payload headlessly to HTML", () => {
      const header = {
        prefix: "PO",
        orderNumber: "889",
        orderDate: "2026-09-26",
        deliveryDate: "2026-10-15",
        supplierName: "Milan Sole Consortium",
        deliveryLocation: "Central DC Manesar",
        buyer: "Chief Purchaser",
        paymentTerms: "45 Days",
        supplierReference: "REF-MILAN-09"
      };

      const rows = [
        {
          id: "row-1",
          articleNo: "ART-801",
          product: "Derby Classic",
          color: "Cognac",
          sizeQuantities: { "40": 10, "41": 20, "42": 30, "43": 25, "44": 15 },
          totalQty: 100,
          rate: 1800,
          gstPercent: 18,
          totalValue: 212400
        }
      ];

      const html = renderToString(
        React.createElement(SizePivotMatrixA4, {
          header: header as any,
          rows: rows as any,
          currencySymbol: "₹",
          vendorName: "Milan Sole Consortium"
        })
      );

      expect(html).toContain("SIZE PIVOT MATRIX");
      expect(html).toContain("PO No: PO-889");
      expect(html).toContain("Milan Sole Consortium");
      expect(html).toContain("Derby Classic");
      expect(html).toContain("Cognac");
      expect(html).toContain("w-[210mm]");
    });
  });

  // Format 7: LabelPrintEngine (CODE128, QR_CODE, EAN13, CODE39)
  describe("Format 7: LabelPrintEngine (Multi-format Barcode Queue Engine)", () => {
    it("manages batch lifecycle, copies, reprints, and audit logging", () => {
      const job = LabelPrintEngine.createJob({
        template: DEFAULT_TEMPLATE,
        branchCode: "BR-DEL-01",
        createdBy: "SUPERVISOR",
        items: [
          { sku: "SKU-EAN-1", productName: "Item 1", mrp: 499, barcode: "8901234567890", qty: 4, copies: 1 },
          { sku: "SKU-EAN-2", productName: "Item 2", mrp: 999, barcode: "8901234567891", qty: 2, copies: 2 },
        ]
      });

      expect(job.status).toBe("QUEUED");
      expect(job.totalLabels).toBe(8); // (4*1) + (2*2) = 8
      expect(job.items).toHaveLength(2);

      const printingJob = LabelPrintEngine.startPrint(job, "OPERATOR");
      expect(printingJob.status).toBe("PRINTING");

      const completedJob = LabelPrintEngine.completePrint(printingJob, "OPERATOR");
      expect(completedJob.status).toBe("PRINTED");
      expect(completedJob.printedAt).toBeDefined();

      const reprintJob = LabelPrintEngine.reprint(completedJob, DEFAULT_TEMPLATE, "SUPERVISOR");
      expect(reprintJob.status).toBe("QUEUED");
      expect(reprintJob.isReprint).toBe(true);
      expect(reprintJob.originalJobId).toBe(completedJob.jobId);
    });
  });
});
