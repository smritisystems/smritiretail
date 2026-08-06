/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys / AITDL Networks
 * Component    : Universal Document Builder Registry (DXP-BLD-001 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Document Type: SMRITI Constitutional Standard
 * Ownership    : SMRITI Retail OS Architecture Team
 * Copyright    : © Jawahar Ramkripal Mallah. All Rights Reserved.
 *
 * DXP-BLD-001 Compliance Declaration
 * Principle    : Document Model Normalization — Decouples raw business entity objects
 *                (SalesInvoices, GRNs, Items, Vouchers) from UI renderers by transforming them
 *                into a normalized IDxpDocumentModel contract.
 */

import { DxpDocumentType, IDxpDocumentModel } from "../models/DxpTypes.ts";
import { DemoDataRegistry } from "../../kernel/config/SmritiDemoDataRegistry.js";

export interface IDxpDocumentBuilder {
  documentType: DxpDocumentType;
  title: string;
  build(rawEntity: any): IDxpDocumentModel;
}

class DocumentBuilderRegistryManager {
  private builders: Map<DxpDocumentType, IDxpDocumentBuilder> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    // Invoice Builder
    this.register({
      documentType: "INVOICE",
      title: "Tax Invoice Document Builder",
      build: (raw) => ({
        documentType: "INVOICE",
        documentNo: raw.invoiceNo || raw.documentNo || "INV-2026-0001",
        date: raw.date || new Date().toISOString().split("T")[0],
        company: {
          name: raw.companyName || raw.company?.name || DemoDataRegistry.company().name,
          address: raw.companyAddress || raw.company?.address || DemoDataRegistry.getFormattedCompanyAddress(),
          gstin: raw.companyGstin || raw.company?.gstin || DemoDataRegistry.company().gstin,
          phone: raw.companyPhone || raw.company?.phone || DemoDataRegistry.company().phone,
        },
        customer: {
          name: raw.customerName || raw.customer?.name || "Cash Customer",
          mobile: raw.customerMobile || raw.customer?.mobile || "",
          gstin: raw.customerGstin || raw.customer?.gstin || "",
        },
        items: (raw.items || []).map((i: any) => ({
          name: i.name || i.itemName || "General Item",
          sku: i.sku || i.itemCode || "",
          barcode: i.barcode || "",
          qty: Number(i.qty || i.quantity || 1),
          rate: Number(i.rate || i.price || 0),
          amount: Number(i.amount || (i.qty || 1) * (i.rate || 0)),
          hsnCode: i.hsnCode || "84716060",
          cgstAmount: Number(i.cgstAmount || 0),
          sgstAmount: Number(i.sgstAmount || 0),
          igstAmount: Number(i.igstAmount || 0),
        })),
        subtotal: Number(raw.subtotal || 0),
        taxTotal: Number(raw.tax || raw.taxTotal || 0),
        grandTotal: Number(raw.total || raw.grandTotal || 0),
        paymentMethod: raw.paymentMethod || "CASH",
        cashier: raw.cashier || "System",
      }),
    });

    // Receipt Builder
    this.register({
      documentType: "RECEIPT",
      title: "Thermal Receipt Document Builder",
      build: (raw) => ({
        documentType: "RECEIPT",
        documentNo: raw.invoiceNo || raw.receiptNo || "RCT-2026-0001",
        date: raw.date || new Date().toISOString().split("T")[0],
        company: {
          name: raw.companyName || DemoDataRegistry.company().name,
          phone: raw.companyPhone || DemoDataRegistry.company().phone,
        },
        customer: {
          name: raw.customerName || "Retail Shopper",
        },
        items: (raw.items || []).map((i: any) => ({
          name: i.name || "Product Item",
          qty: Number(i.qty || 1),
          rate: Number(i.rate || 0),
          amount: Number(i.amount || (i.qty || 1) * (i.rate || 0)),
        })),
        subtotal: Number(raw.subtotal || 0),
        taxTotal: Number(raw.tax || 0),
        grandTotal: Number(raw.total || 0),
        paymentMethod: raw.paymentMethod || "UPI",
        cashier: raw.cashier || "Terminal 1",
      }),
    });

    // Barcode Label Builder
    this.register({
      documentType: "BARCODE_LABEL",
      title: "Product Barcode Label Builder",
      build: (raw) => ({
        documentType: "BARCODE_LABEL",
        documentNo: raw.invoiceNo || "LABEL-001",
        date: raw.date || new Date().toISOString().split("T")[0],
        company: { name: raw.companyName || DemoDataRegistry.company().name },
        items: (raw.items || [{ name: "Demo SKU Product", rate: 1299.0, barcode: "8901234567890" }]).map((i: any) => ({
          name: i.name || "Demo SKU Product",
          barcode: i.barcode || "8901234567890",
          rate: Number(i.rate || i.price || 0),
          qty: 1,
          amount: Number(i.rate || 0),
        })),
        subtotal: Number(raw.total || 1299.0),
        taxTotal: 0,
        grandTotal: Number(raw.total || 1299.0),
      }),
    });
  }

  public register(builder: IDxpDocumentBuilder): void {
    this.builders.set(builder.documentType, builder);
  }

  public get(type: DxpDocumentType): IDxpDocumentBuilder | undefined {
    return this.builders.get(type);
  }

  public build(type: DxpDocumentType, rawEntity: any): IDxpDocumentModel {
    const builder = this.get(type);
    if (builder) {
      return builder.build(rawEntity);
    }
    // Fallback default normalization
    return {
      documentType: type,
      documentNo: rawEntity.documentNo || rawEntity.invoiceNo || "DOC-2026-0001",
      date: rawEntity.date || new Date().toISOString().split("T")[0],
      company: { name: rawEntity.companyName || rawEntity.company?.name || DemoDataRegistry.company().name },
      customer: { name: rawEntity.customerName || "Customer" },
      items: rawEntity.items || [],
      subtotal: Number(rawEntity.subtotal || 0),
      taxTotal: Number(rawEntity.tax || 0),
      grandTotal: Number(rawEntity.total || rawEntity.grandTotal || 0),
    };
  }
}

export const DocumentBuilderRegistry = new DocumentBuilderRegistryManager();
