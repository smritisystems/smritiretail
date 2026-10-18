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
 * * Version    : 6.86.0
 * * Created    : 2026-09-19
 * * Modified   : 2026-10-16
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { FootwearPurchaseOrderA4, FootwearPurchaseOrderData, FootwearPurchaseOrderItem } from "../../print_engine/templates/FootwearPurchaseOrderA4";
import { StandardInvoiceA4 } from "../../print_engine/templates/StandardInvoiceA4";
import { SizePivotMatrixA4 } from "../../print_engine/templates/SizePivotMatrixA4";
import {
  PurchaseOrderPrintA4,
  PurchaseOrderPrintData,
  FootwearArticleReference,
} from "../../print_engine/templates/PurchaseOrderPrintA4";
import { DEFAULT_BUSINESS_TERMS } from "./CommercialDeliveryDrawer";
import type { PurchaseOrderHeader, PurchaseOrderLineItem, PurchaseOrderSizePivotRow } from "./types.ts";
import { getTenantCompanyContext } from "../../lib/apiFetchV1";

export interface POPrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  header: PurchaseOrderHeader;
  lineItems: PurchaseOrderLineItem[];
  sizePivotRows: PurchaseOrderSizePivotRow[];
  activeTab: string;
  vendor?: {
    id: string;
    name: string;
    code?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstin?: string;
    gst_number?: string;
    mobile?: string;
    phone?: string;
    email?: string;
    payment_terms?: string;
    payment_terms_days?: number;
    freight_terms?: string;
    commercial_terms?: any;
    commercial?: any;
  } | null;
  reprintMode?: boolean;
  initialTemplateId?: string;
}

/**
 * Case-insensitive, robust extractor for footwear attributes (Heels, Upper Material, Outsole).
 * Checks direct properties, nested originalProduct, attributes dict, and common casing/alias variations.
 */
export function resolveFootwearAttributes(item: any): {
  heels: string;
  upperMaterial: string;
  outsole: string;
} {
  if (!item) return { heels: "—", upperMaterial: "—", outsole: "—" };

  const attrs =
    item.attributes ||
    item.attributes_json ||
    item.originalProduct?.attributes ||
    item.originalProduct?.attributes_json ||
    {};

  const findVal = (keys: string[]): string | undefined => {
    // 1. Direct item property
    for (const k of keys) {
      if (item[k] !== undefined && item[k] !== null && String(item[k]).trim()) {
        const s = String(item[k]).trim();
        if (s !== "—" && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined") return s;
      }
    }
    // 2. originalProduct direct property
    const orig = item.originalProduct;
    if (orig) {
      for (const k of keys) {
        if (orig[k] !== undefined && orig[k] !== null && String(orig[k]).trim()) {
          const s = String(orig[k]).trim();
          if (s !== "—" && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined") return s;
        }
      }
    }
    // 3. attributes object lookup (both exact and case/slug insensitive)
    if (typeof attrs === "object" && attrs !== null) {
      const attrKeys = Object.keys(attrs);
      for (const k of keys) {
        if (attrs[k] !== undefined && attrs[k] !== null && String(attrs[k]).trim()) {
          const s = String(attrs[k]).trim();
          if (s !== "—" && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined") return s;
        }
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        const matchKey = attrKeys.find(
          (ak) => ak.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanK
        );
        if (matchKey && attrs[matchKey] !== undefined && attrs[matchKey] !== null && String(attrs[matchKey]).trim()) {
          const s = String(attrs[matchKey]).trim();
          if (s !== "—" && s.toLowerCase() !== "null" && s.toLowerCase() !== "undefined") return s;
        }
      }
    }
    return undefined;
  };

  const heels =
    findVal([
      "heelType",
      "heel_type",
      "heels",
      "HEELS",
      "HEEL_TYPE",
      "Heel Type",
      "heel",
      "Heel",
    ]) || "—";

  const upperMaterial =
    findVal([
      "upperMaterial",
      "upper_material",
      "upper",
      "UPPER",
      "Upper Material",
      "UPPER_MATERIAL",
      "upper_mat",
      "Upper",
    ]) || "—";

  const outsole =
    findVal([
      "outsoleMaterial",
      "outsole_material",
      "outsole",
      "OUTSOLE",
      "Outsole Material",
      "OUTSOLE_MATERIAL",
      "sole",
      "Sole",
      "sole_material",
    ]) || "—";

  return { heels, upperMaterial, outsole };
}

export const POPrintPreviewModal: React.FC<POPrintPreviewModalProps> = ({
  isOpen,
  onClose,
  header,
  lineItems,
  sizePivotRows,
  activeTab,
  vendor,
  reprintMode = false,
  initialTemplateId,
}) => {
  // Modal Customizer Controls State (Approved SMRITI PO Defaults)
  const [template, setTemplate] = useState<
    "smriti-sizewise" | "smriti-standard" | "footwear" | "standard" | "jobwork" | "pivot"
  >(() => {
    if (
      initialTemplateId &&
      ["smriti-sizewise", "smriti-standard", "footwear", "standard", "jobwork", "pivot"].includes(initialTemplateId)
    ) {
      return initialTemplateId as any;
    }
    try {
      const saved = localStorage.getItem("smriti_po_default_template");
      if (
        saved &&
        ["smriti-sizewise", "smriti-standard", "footwear", "standard", "jobwork", "pivot"].includes(saved)
      ) {
        return saved as any;
      }
    } catch {
      // fallback
    }
    return "smriti-sizewise";
  });

  const handleTemplateChange = (nextTpl: typeof template) => {
    setTemplate(nextTpl);
    try {
      localStorage.setItem("smriti_po_default_template", nextTpl);
    } catch {
      // ignore
    }
  };
  const [sizingScale, setSizingScale] = useState<"EURO" | "UK" | "US">("EURO");
  const [currency, setCurrency] = useState<"EUR" | "INR" | "USD">(() => {
    const headerCurrency = (header.currency || "").toUpperCase();
    if (headerCurrency.includes("EUR")) return "EUR";
    if (headerCurrency.includes("USD")) return "USD";
    return "INR";
  });
  const [showPhotos, setShowPhotos] = useState<boolean>(true);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("portrait");
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Keyboard shortcut listener: ESC to close, F9/Ctrl+P to trigger window.print
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "F9" || ((e.ctrlKey || e.metaKey) && e.key === "p")) {
        e.preventDefault();
        window.print();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Currency formatting metadata
  const currencySymbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : "₹";
  const fxEurToInr = 88.20;

  // Build active items list for Footwear PO
  let mappedFootwearItems: FootwearPurchaseOrderItem[] = [];

  if (activeTab === "pivot") {
    // Collect filled pivot rows
    const validPivotRows = sizePivotRows.filter(
      (r) => (r.articleNo && r.articleNo.trim().length > 0) || (r.product && r.product.trim().length > 0)
    );

    if (validPivotRows.length > 0) {
      const groupedFwMap = new Map<string, FootwearPurchaseOrderItem>();

      validPivotRows.forEach((r, idx) => {
        const art = (r.articleNo || `FW-ART-${100 + idx}`).trim();
        const col = (r.color || "Standard Noir / Tan").trim();
        const key = `${art.toUpperCase()}:::${col.toUpperCase()}`;

        const q40 = Number(r.sizeQuantities?.["40"] || r.sizeQuantities?.["EU 40"] || r.sizeQuantities?.["S"] || 0);
        const q41 = Number(r.sizeQuantities?.["41"] || r.sizeQuantities?.["EU 41"] || r.sizeQuantities?.["M"] || 0);
        const q42 = Number(r.sizeQuantities?.["42"] || r.sizeQuantities?.["EU 42"] || r.sizeQuantities?.["L"] || 0);
        const q43 = Number(r.sizeQuantities?.["43"] || r.sizeQuantities?.["EU 43"] || r.sizeQuantities?.["XL"] || 0);
        const q44 = Number(r.sizeQuantities?.["44"] || r.sizeQuantities?.["EU 44"] || r.sizeQuantities?.["XXL"] || 0);
        const q45 = Number(r.sizeQuantities?.["45"] || r.sizeQuantities?.["EU 45"] || 0);
        const rowPairs = r.totalQty || (q40 + q41 + q42 + q43 + q44 + q45) || 12;
        const rate = currency === "EUR" ? (r.rate ? r.rate / fxEurToInr : 22.50) : r.rate || 1999;
        const lineTotal = +(rate * rowPairs).toFixed(2);

        if (!groupedFwMap.has(key)) {
          const cartons = Math.max(1, Math.round(rowPairs / 12));
          groupedFwMap.set(key, {
            articleCode: art,
            photoUrl: r.photoUrl || r.imageUrl || r.originalProduct?.primaryImageUrl,
            modelName: r.product || "Footwear Style Line",
            category: r.brand || "Footwear Collection",
            taricCode: "64035910",
            hsnCode: "6403",
            color: col,
            size: "EU 40-45",
            colorHex: "#334155",
            finish: "Polished Finish",
            upperMaterial: "Genuine Calf Leather / Microfiber",
            soleMaterial: "Anti-Skid TPR / Goodyear Welt",
            liningMaterial: "Breathable Sweat-Absorption Mesh",
            insoleMaterial: "High-Density Memory Cushion",
            ratioString: "1 : 2 : 3 : 3 : 2 : 1 = 12 Prs/Ctn",
            eu40: q40 || cartons * 1,
            eu41: q41 || cartons * 2,
            eu42: q42 || cartons * 3,
            eu43: q43 || cartons * 3,
            eu44: q44 || cartons * 2,
            eu45: q45 || cartons * 1,
            cartons: cartons,
            pairs: rowPairs,
            ratePerPair: +rate.toFixed(2),
            taxRatePercent: Number(r.gstPercent ?? header.commonTaxPercent ?? 5),
            lineTotal: lineTotal,
          });
        } else {
          const existing = groupedFwMap.get(key)!;
          existing.eu40 = (existing.eu40 || 0) + q40;
          existing.eu41 = (existing.eu41 || 0) + q41;
          existing.eu42 = (existing.eu42 || 0) + q42;
          existing.eu43 = (existing.eu43 || 0) + q43;
          existing.eu44 = (existing.eu44 || 0) + q44;
          existing.eu45 = (existing.eu45 || 0) + q45;
          existing.pairs += rowPairs;
          existing.cartons = Math.max(1, Math.round(existing.pairs / 12));
          existing.lineTotal += lineTotal;
          if (!existing.photoUrl && (r.photoUrl || r.imageUrl)) {
            existing.photoUrl = r.photoUrl || r.imageUrl;
          }
        }
      });

      mappedFootwearItems = Array.from(groupedFwMap.values());
    }
  } else {
    // Generation tab - Standard rows
    const validLines = lineItems.filter(
      (l) => (l.stockNo && l.stockNo.trim().length > 0) || (l.barcode && l.barcode.trim().length > 0) || (l.product && l.product.trim().length > 0)
    );

    if (validLines.length > 0) {
      mappedFootwearItems = validLines.map((l, idx) => {
        const totalPairs = l.orderQty || 12;
        const cartons = Math.max(1, Math.round(totalPairs / 12));
        const rate = currency === "EUR" ? (l.rate ? l.rate / fxEurToInr : 19.50) : l.rate || 1800;
        const lineTotal = +(rate * totalPairs).toFixed(2);

        return {
          articleCode: l.stockNo || l.barcode || `FW-ART-${200 + idx}`,
          modelName: l.product || l.barcode || "Commercial Shoe Line",
          category: l.brand || "Footwear Division",
          taricCode: "64035910",
          hsnCode: "6403",
          color: l.shade || "Classic Nero",
          size: l.size || "EU 40-45",
          colorHex: "#1e293b",
          finish: "Standard Matt Finish",
          upperMaterial: "Full Grain Leather / Mesh",
          soleMaterial: "Phylon EVA / Molded Rubber",
          liningMaterial: "Anti-Bacterial Fabric",
          insoleMaterial: "Anatomic Arch Support",
          ratioString: "1 : 2 : 3 : 3 : 2 : 1 = 12 Prs/Ctn",
          eu40: cartons * 1,
          eu41: cartons * 2,
          eu42: cartons * 3,
          eu43: cartons * 3,
          eu44: cartons * 2,
          eu45: cartons * 1,
          cartons: cartons,
          pairs: totalPairs,
          ratePerPair: +rate.toFixed(2),
          taxRatePercent: Number(l.taxPercent ?? header.commonTaxPercent ?? 5),
          lineTotal: lineTotal,
        };
      });
    }
  }

  const mappedNetTotal = mappedFootwearItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const mappedTotalPairs = mappedFootwearItems.reduce((sum, item) => sum + item.pairs, 0);
  const mappedTotalCartons = mappedFootwearItems.reduce((sum, item) => sum + item.cartons, 0);

  // Resolve Business Terms
  const resolvedBusinessTerms =
    (header as any)?.businessTerms ||
    (header as any)?.business_terms ||
    (header as any)?.commercial_terms?.business_terms ||
    (vendor as any)?.commercial?.business_terms ||
    DEFAULT_BUSINESS_TERMS;

  const tenantCtx = getTenantCompanyContext();
  const tenantCompanyName = tenantCtx.companyName || (typeof localStorage !== "undefined" ? localStorage.getItem("smriti_company_name") || "" : "");
  const tenantCompanyAddress = tenantCtx.companyAddress || (typeof localStorage !== "undefined" ? localStorage.getItem("smriti_company_address") || "" : "");
  const tenantCompanyGstin = tenantCtx.companyGstin || (typeof localStorage !== "undefined" ? localStorage.getItem("smriti_company_gstin") || "" : "");
  const tenantCompanyEmail = tenantCtx.companyEmail || (typeof localStorage !== "undefined" ? localStorage.getItem("smriti_company_email") || "" : "");
  const tenantCompanyPhone = tenantCtx.companyPhone || (typeof localStorage !== "undefined" ? localStorage.getItem("smriti_company_phone") || "" : "");
  const tenantCompanyPan = tenantCompanyGstin && tenantCompanyGstin.length >= 12 ? tenantCompanyGstin.slice(2, 12) : "";

  // Construct Footwear PO Data payload
  const footwearData: FootwearPurchaseOrderData = {
    poNumber: `${header.prefix || "PO"}-${header.orderNumber || "1"}`,
    poDate: header.orderDate || new Date().toISOString().split("T")[0],
    deliveryDate: header.deliveryDate || new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0],
    companyName: tenantCompanyName,
    companySubtitle: "Footwear Sourcing & Procurement Division",
    companyAddress: tenantCompanyAddress,
    companyGstin: tenantCompanyGstin,
    companyContact: [tenantCompanyEmail, tenantCompanyPhone].filter(Boolean).join(" | "),
    vendorName: header.supplierName || vendor?.name || "Selected Supplier",
    vendorCode: header.supplierId || vendor?.code || "—",
    vendorAddress: vendor?.address || "Registered Supplier Premises",
    vendorGstin: vendor?.gstin || vendor?.gst_number || "—",
    vendorContact: vendor?.mobile || vendor?.phone || "—",
    dcCode: "DC-MAIN-01",
    dcName: "Main Store Distribution Depot",
    dcAddress: tenantCompanyAddress,
    dcGstin: tenantCompanyGstin,
    dcReceivingGate: "Gate 1 - Central Footwear Bay",
    currency: currency,
    currencySymbol: currencySymbol,
    sizingScale: sizingScale,
    showPhotos: showPhotos,
    orientation: orientation,
    items: mappedFootwearItems,
    totalCartons: mappedTotalCartons,
    totalPairs: mappedTotalPairs,
    netOrderValue: mappedNetTotal,
    netOrderValueInWords: `${currencySymbol} ${mappedNetTotal.toFixed(2)} (calculated from live PO lines)`,
    paymentTerms: header.paymentTerms || "120 Days",
    purchaser: header.buyer || "—",
    supplierReference: header.supplierReference || "—",
    documentStatus: "DRAFT",
    businessTerms: resolvedBusinessTerms,
    secondaryCurrencyTotal:
      currency === "EUR" ? "Domestic Valuation (@ ₹ 88.20 / EUR)" : undefined,
  };

  // Standard PO Data fallback for StandardInvoiceA4 component
  const standardInvoiceData = {
    documentType: template === "jobwork" ? "job-work-order" as const : "purchase-order" as const,
    supplierName: header.supplierName || vendor?.name || "Selected Supplier",
    supplierAddress: vendor?.address || "Registered Supplier Premises",
    supplierGst: vendor?.gstin || vendor?.gst_number || "—",
    supplierPhone: vendor?.mobile || vendor?.phone || "",
    deliveryLocation: header.deliveryLocation || "Main Store (MAIN)",
    deliveryDate: header.deliveryDate || "",
    paymentTerms: header.paymentTerms || "120 Days",
    supplierReference: header.supplierReference || "",
    purchaser: header.buyer || "",
    department: header.department || "General Purchase",
    specialInstructions: header.specialInstructions || "",
    isInterstate: Boolean(vendor?.state && vendor.state.trim().toLowerCase() !== "maharashtra"),
    currencySymbol,
    invoiceNo: `${header.prefix || "PO"}-${header.orderNumber || "1"}`,
    date: header.orderDate || new Date().toISOString().split("T")[0],
    dueDate: header.deliveryDate || "",
    company: {
      name: "SMRITI Retail OS",
      address: "Central Logistics Park, SMRITI Retail OS",
      gstin: "27AABCT9981K1Z2",
      phone: "+91 712 2987654",
      email: "procurement@smritibooks.com",
      pan: "AABCT9981K",
    },
    customer: {
      name: header.supplierName || vendor?.name || "Selected Supplier",
      address: vendor?.address || "Registered Supplier Premises",
      gstin: vendor?.gstin || vendor?.gst_number || "—",
      phone: vendor?.mobile || vendor?.phone || "—",
      state: vendor?.state || "Commercial State",
      stateCode: "27",
    },
    items: mappedFootwearItems.map((it, idx) => ({
      sNo: idx + 1,
      code: it.articleCode,
      name: `${it.articleCode} - ${it.modelName} | Color: ${it.color} | Size: ${it.size || "EU 40-45"}`,
      barcode: it.articleCode,
      description: `${it.articleCode} - ${it.modelName} | Color: ${it.color} | Size: ${it.size || "EU 40-45"}`,
      hsnCode: it.hsnCode || "6403",
      qty: it.pairs,
      uom: "PRS",
      mrp: it.ratePerPair * 1.5,
      unitPrice: it.ratePerPair,
      discount: 0,
      taxableAmount: it.lineTotal,
      gstRate: it.taxRatePercent,
      cgstPercent: it.taxRatePercent / 2,
      cgstAmount: (it.lineTotal * (it.taxRatePercent / 200)),
      sgstPercent: it.taxRatePercent / 2,
      sgstAmount: (it.lineTotal * (it.taxRatePercent / 200)),
      total: it.lineTotal * (1 + it.taxRatePercent / 100),
    })),
    subtotal: mappedFootwearItems.reduce((sum, item) => sum + item.lineTotal, 0),
    taxTotal: mappedFootwearItems.reduce((sum, item) => sum + item.lineTotal * (item.taxRatePercent / 100), 0),
    total: mappedFootwearItems.reduce((sum, item) => sum + item.lineTotal * (1 + item.taxRatePercent / 100), 0),
    amountInWords: "",
    terms: "1. Goods delivered per SATRA norms.\n2. Payment terms 30 days net from GRN date.",
  };

  // Date formatting helper for retail purchase orders
  const formatDisplayDate = (dStr?: string): string => {
    if (!dStr) return "";
    try {
      const parts = dStr.split("T")[0].split("-");
      if (parts.length === 3) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parts[2];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        if (monthIndex >= 0 && monthIndex < 12) {
          return `${day} ${monthNames[monthIndex]} ${year}`;
        }
      }
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dStr;
    }
  };

  // Dynamic Size Columns from Pivot Rows, Line Items, or default EU (36 - 44)
  const dynamicSizeColumns = useMemo(() => {
    const foundSizes = new Set<string>();
    sizePivotRows.forEach((r) => {
      Object.keys(r.sizeQuantities || {}).forEach((k) => {
        if (Number(r.sizeQuantities[k]) > 0 || !isNaN(Number(k))) {
          foundSizes.add(k);
        }
      });
    });
    lineItems.forEach((l) => {
      if (l.size && l.size.trim().length > 0) {
        foundSizes.add(l.size.trim());
      }
    });
    const numericSizes = Array.from(foundSizes)
      .filter((s) => !isNaN(Number(s)))
      .sort((a, b) => Number(a) - Number(b));
    if (numericSizes.length >= 3) {
      return numericSizes;
    }
    return ["36", "37", "38", "39", "40", "41", "42", "43", "44"];
  }, [sizePivotRows, lineItems]);

  // Sizewise items mapped directly from authoritative pivot rows with fallback aggregation from lineItems
  const mappedSizewiseRows = useMemo(() => {
    const validRows = sizePivotRows.filter(
      (r) =>
        (r.articleNo && r.articleNo.trim().length > 0) ||
        (r.product && r.product.trim().length > 0)
    );
    if (validRows.length > 0) {
      const groupedPivotMap = new Map<string, {
        articleNo: string;
        color: string;
        sizeQuantities: Record<string, number>;
        totalQty: number;
        rate: number;
        taxPercent: number;
        amount: number;
        taxAmount: number;
      }>();

      validRows.forEach((r) => {
        const art = (r.articleNo || r.product || "Footwear Article").trim();
        const col = (r.color || (r.originalProduct?.color) || "Standard").trim();
        const key = `${art.toUpperCase()}:::${col.toUpperCase()}`;
        const qty = Number(r.totalQty) || 0;
        const rate = Number(r.rate) || 0;
        const taxable = r.totalValue !== undefined ? Number(r.totalValue) : (qty * rate);
        const taxRate = r.gstPercent !== undefined ? Number(r.gstPercent) : (header.commonTaxPercent ?? 5);
        const taxVal = r.taxAmount !== undefined ? Number(r.taxAmount) : (taxable * taxRate) / 100;
        const rowSizeQtys = r.sizeQuantities || {};

        if (!groupedPivotMap.has(key)) {
          groupedPivotMap.set(key, {
            articleNo: art,
            color: col,
            sizeQuantities: { ...rowSizeQtys },
            totalQty: qty,
            rate: rate,
            taxPercent: taxRate,
            amount: taxable,
            taxAmount: taxVal,
          });
        } else {
          const existing = groupedPivotMap.get(key)!;
          for (const [sz, sqty] of Object.entries(rowSizeQtys)) {
            const numQty = Number(sqty) || 0;
            if (numQty > 0) {
              existing.sizeQuantities[sz] = (existing.sizeQuantities[sz] || 0) + numQty;
            }
          }
          existing.totalQty += qty;
          existing.amount += taxable;
          existing.taxAmount += taxVal;
          if (existing.rate === 0 && rate > 0) {
            existing.rate = rate;
          }
        }
      });

      return Array.from(groupedPivotMap.values()).map((g, idx) => ({
        sNo: idx + 1,
        ...g,
      }));
    }

    // Auto-group lineItems into Sizewise Matrix rows when pivot rows are not pre-populated
    const groupedMap = new Map<string, {
      articleNo: string;
      color: string;
      sizeQuantities: Record<string, number>;
      totalQty: number;
      rate: number;
      taxPercent: number;
      amount: number;
      taxAmount: number;
    }>();

    lineItems.forEach((l) => {
      const art = (l.style || l.stockNo || l.product || "Footwear Article").trim();
      const col = (l.shade || l.colourBase || l.originalProduct?.color || "Standard").trim();
      const key = `${art.toUpperCase()}:::${col.toUpperCase()}`;
      const qty = Number(l.orderQty) || 0;
      const rate = Number(l.rate) || 0;
      const taxRate = l.taxPercent !== undefined ? Number(l.taxPercent) : (header.commonTaxPercent ?? 5);
      const lineTaxable = l.value !== undefined ? Number(l.value) : (qty * rate);
      const lineTax = l.taxAmount !== undefined ? Number(l.taxAmount) : (lineTaxable * taxRate) / 100;
      const szKey = l.size ? l.size.trim() : "Standard";

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          articleNo: art,
          color: col,
          sizeQuantities: { [szKey]: qty },
          totalQty: qty,
          rate: rate,
          taxPercent: taxRate,
          amount: lineTaxable,
          taxAmount: lineTax,
        });
      } else {
        const existing = groupedMap.get(key)!;
        existing.sizeQuantities[szKey] = (existing.sizeQuantities[szKey] || 0) + qty;
        existing.totalQty += qty;
        existing.amount += lineTaxable;
        existing.taxAmount += lineTax;
        if (existing.rate === 0 && rate > 0) {
          existing.rate = rate;
        }
      }
    });

    return Array.from(groupedMap.values()).map((g, idx) => ({
      sNo: idx + 1,
      ...g,
    }));
  }, [sizePivotRows, lineItems, header.commonTaxPercent]);

  // Standard barcode-wise items mapped from lineItems
  const mappedStandardLines = useMemo(() => {
    const validLines = lineItems.filter(
      (l) =>
        (l.stockNo && l.stockNo.trim().length > 0) ||
        (l.barcode && l.barcode.trim().length > 0) ||
        (l.product && l.product.trim().length > 0)
    );
    return validLines.map((l, idx) => {
      const taxable = l.value || l.orderQty * l.rate;
      const taxRate = l.taxPercent !== undefined ? l.taxPercent : (header.commonTaxPercent ?? 18);
      const taxVal = l.taxAmount !== undefined ? l.taxAmount : (taxable * taxRate) / 100;
      return {
        sNo: l.sNo || idx + 1,
        barcode: l.barcode || l.stockNo || "—",
        articleNo: l.style || l.stockNo || l.product || "—",
        productName: l.product || "Footwear Article",
        color: l.shade || l.colourBase || (l.originalProduct?.color) || "—",
        size: l.size || "—",
        quantity: l.orderQty || 1,
        rate: l.rate,
        taxPercent: taxRate,
        taxAmount: taxVal,
        amount: taxable,
      };
    });
  }, [lineItems, header.commonTaxPercent]);

  // Item Reference Cards (2 large product cards per row)
  const mappedItemReferences: FootwearArticleReference[] = useMemo(() => {
    if (!showPhotos) return [];
    const refMap = new Map<string, FootwearArticleReference>();

    sizePivotRows.forEach((r) => {
      const art = (r.articleNo || (r as any).itemCode || (r as any).style || r.product || "").trim();
      if (art && !refMap.has(art)) {
        const fw = resolveFootwearAttributes(r);
        refMap.set(art, {
          articleNo: art,
          color: r.color || r.originalProduct?.color || "—",
          heels: fw.heels,
          upperMaterial: fw.upperMaterial,
          outsole: fw.outsole,
          imageUrl:
            r.imageUrl ||
            r.photoUrl ||
            r.originalProduct?.primaryImageUrl ||
            (r.originalProduct as any)?.image_url,
        });
      }
    });

    lineItems.forEach((l) => {
      const art = (l.style || l.stockNo || l.barcode || l.product || "").trim();
      if (art && !refMap.has(art)) {
        const fw = resolveFootwearAttributes(l);
        refMap.set(art, {
          articleNo: art,
          color: l.shade || l.colourBase || l.originalProduct?.color || "—",
          heels: fw.heels,
          upperMaterial: fw.upperMaterial,
          outsole: fw.outsole,
          imageUrl:
            l.imageUrl ||
            l.photoUrl ||
            l.originalProduct?.primaryImageUrl ||
            (l.originalProduct as any)?.image_url,
        });
      }
    });

    return Array.from(refMap.values());
  }, [sizePivotRows, lineItems, showPhotos]);

  // Order financial summary calculated directly from live lines
  const totalItemsCount =
    template === "smriti-standard"
      ? mappedStandardLines.length
      : mappedSizewiseRows.length;
  const totalUnitsCount =
    template === "smriti-standard"
      ? mappedStandardLines.reduce((s, it) => s + it.quantity, 0)
      : mappedSizewiseRows.reduce((s, it) => s + it.totalQty, 0);
  const subtotalVal =
    template === "smriti-standard"
      ? mappedStandardLines.reduce((s, it) => s + it.amount, 0)
      : mappedSizewiseRows.reduce((s, it) => s + it.amount, 0);
  const gstVal =
    template === "smriti-standard"
      ? mappedStandardLines.reduce(
          (s, it) =>
            s +
            (it.taxAmount !== undefined
              ? it.taxAmount
              : (it.amount * (it.taxPercent ?? header.commonTaxPercent ?? 18)) / 100),
          0
        )
      : mappedSizewiseRows.reduce(
          (s, it) =>
            s +
            (it.taxAmount !== undefined
              ? it.taxAmount
              : (it.amount * (it.taxPercent ?? header.commonTaxPercent ?? 18)) / 100),
          0
        );
  const grandTotalVal =
    subtotalVal +
    gstVal +
    (header.freightAmount || 0) +
    (header.otherCharges || 0);

  // Resolve Vendor Profile Details with Real Fallbacks
  const vendorPaymentTerms =
    header.paymentTerms ||
    vendor?.payment_terms ||
    (vendor?.payment_terms_days ? `${vendor.payment_terms_days} Days` : null) ||
    vendor?.commercial?.paymentTerms ||
    vendor?.commercial_terms?.payment_terms ||
    "120 Days";

  const vendorAddress =
    vendor?.address && vendor.address.trim()
      ? vendor.address.trim()
      : (vendor?.city || vendor?.state)
      ? `${vendor.city || "Mumbai"}, ${vendor.state || "Maharashtra"}${vendor.pincode ? ` - ${vendor.pincode}` : ""}`
      : "";

  const vendorGstin = vendor?.gstin || vendor?.gst_number || "";
  const vendorContact = vendor?.mobile || vendor?.phone || "";
  const vendorEmail = (vendor as any)?.email || (vendor as any)?.contacts?.[0]?.email || "";

  // Dynamic Effective GST rate calculation (footwear defaults to statutory 5%)
  const effectiveGstPct = header.commonTaxPercent !== undefined
    ? header.commonTaxPercent
    : (subtotalVal > 0 && gstVal > 0)
    ? Math.round((gstVal / subtotalVal) * 100)
    : (mappedSizewiseRows.length > 0 && mappedSizewiseRows[0].taxPercent !== undefined)
    ? mappedSizewiseRows[0].taxPercent
    : 5;

  // Extract real bill number from notes if not set in supplierReference
  const extractedBillNo =
    header.supplierReference ||
    (header as any)?.notes?.match(/Vendor Bill ([^ |]+)/)?.[1] ||
    "";

  // Payload for approved A4 template
  const approvedPrintData: PurchaseOrderPrintData = {
    mode: template === "smriti-standard" ? "standard" : "sizewise",
    companyName: tenantCompanyName,
    companyAddress: tenantCompanyAddress,
    companyGstin: tenantCompanyGstin,
    companyPan: tenantCompanyPan,
    poNumber: `${header.prefix || "PO"}-${header.orderNumber || "1"}`,
    orderDate: formatDisplayDate((header as any)?.orderDate || (header as any)?.notes?.match(/dated ([0-9-]+)/)?.[1]) || formatDisplayDate(new Date().toISOString()),
    expectedDelivery: formatDisplayDate(header.deliveryDate || (header as any)?.received_date || (header as any)?.vendor_bill_date || (header as any)?.notes?.match(/dated ([0-9-]+)/)?.[1]) || "",
    warehouse: header.deliveryLocation || "Main Store (MAIN)",
    status: (header as any)?.status || (header as any)?.documentStatus || "DRAFT",

    supplierName: header.supplierName || vendor?.name || "Selected Supplier",
    supplierCode: header.supplierId || vendor?.code || "—",
    supplierAddress: vendorAddress,
    supplierGstin: vendorGstin,
    supplierContact: vendorContact,
    supplierEmail: vendorEmail,

    sizeChartName: `Size Chart: EU (${dynamicSizeColumns[0]} - ${
      dynamicSizeColumns[dynamicSizeColumns.length - 1]
    })`,
    sizeColumns: dynamicSizeColumns,
    sizewiseItems: mappedSizewiseRows,
    standardItems: mappedStandardLines,
    itemReferences: mappedItemReferences,

    paymentTerms: vendorPaymentTerms,
    freightTerms: header.freightCharges || vendor?.freight_terms || "Paid by Supplier",
    currency: currency === "INR" ? `INR (${currencySymbol})` : currency,
    deliveryTerms: "Ex-Factory",
    supplierReference: extractedBillNo || "—",
    specialInstructions:
      header.specialInstructions ||
      "Please ensure all items are packed with size stickers and barcode labels.",
    businessTerms: resolvedBusinessTerms,

    totalItems: totalItemsCount,
    totalQuantity: totalUnitsCount,
    subtotal: subtotalVal,
    gstAmount: gstVal,
    grandTotal: grandTotalVal,
    commonTaxPercent: effectiveGstPct,

    remarks: (header as any).remarks || "",
    preparedByName: header.buyer || "",
    preparedByDate: formatDisplayDate(header.orderDate) || "",
    checkedByName: "",
    checkedByDate: "",
    authorizedSignatoryName: "",
    authorizedSignatoryDesignation: "",
    authorizedSignatoryDate: "",

    currencySymbol: currencySymbol,
    orientation: orientation,
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="print-preview-modal-root print-preview-visible fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col items-center overflow-y-auto print:static print:inset-auto print:h-auto print:w-full print:p-0 print:m-0 print:bg-white print:overflow-visible"
      role="dialog"
      aria-modal="true"
      aria-label="Purchase Order Print Preview"
    >
      {/* Top Floating Control Bar - Excluded in @media print */}
      <div className="sticky top-2 z-60 w-full max-w-5xl bg-[#1e1b4b] text-white rounded-xl shadow-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border border-indigo-500/30 print:hidden mb-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-400 text-xl">print</span>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-100 flex items-center gap-2">
              <span>Purchase Order Print Preview</span>
              {reprintMode && (
                <span className="bg-amber-400/20 text-amber-200 border border-amber-300/40 text-[9px] px-2 py-0.5 rounded font-mono font-bold">
                  REPRINT • ORIGINAL UNCHANGED
                </span>
              )}
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] px-2 py-0.5 rounded font-mono font-bold">
                {currency === "INR" ? "INDIAN RUPEE (₹)" : currency === "USD" ? "US DOLLAR ($)" : "EURO (€)"}
              </span>
            </h2>
            <p className="text-[10px] text-indigo-300 font-mono">
              PO: {header.prefix}-{header.orderNumber} • Vendor: {header.supplierName || "Apex Fabrics Ltd"}
            </p>
          </div>
        </div>

        {/* Customizer Controls Strip */}
        <div className="flex items-center gap-2 text-xs">
          {/* Template Format Selector */}
          <div className="flex items-center gap-1.5 bg-indigo-900/60 rounded px-2 py-1 border border-indigo-700">
            <span className="text-[10px] text-indigo-300">Format:</span>
            <select
              id="po-preview-template-select"
              value={template}
              onChange={(e) => handleTemplateChange(e.target.value as any)}
              className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
            >
              <option value="smriti-sizewise" className="bg-slate-900 text-white font-bold">
                SMRITI Purchase Order - Sizewise (Approved A4) [Default]
              </option>
              <option value="smriti-standard" className="bg-slate-900 text-white">
                SMRITI Purchase Order - Standard Barcode-wise (Approved A4)
              </option>
              <option value="footwear" className="bg-slate-900 text-white">
                Footwear PO (Legacy Euro Matrix)
              </option>
              <option value="standard" className="bg-slate-900 text-white">
                Standard Enterprise PO (Legacy A4)
              </option>
              <option value="jobwork" className="bg-slate-900 text-white">
                Job Work Order (Legacy A4)
              </option>
              <option value="pivot" className="bg-slate-900 text-white">
                Size Pivot Matrix (Legacy A4)
              </option>
            </select>
            {template === "smriti-sizewise" ? (
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-0.5" title="Universal default statutory print format">
                <span className="material-symbols-outlined text-[11px]">verified</span>
                DEFAULT
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleTemplateChange("smriti-sizewise")}
                className="bg-indigo-700/80 hover:bg-indigo-700 text-indigo-200 text-[9px] px-1.5 py-0.5 rounded font-mono transition"
                title="Reset to approved default template"
              >
                Reset Default
              </button>
            )}
          </div>

          {(template === "smriti-sizewise" || template === "smriti-standard" || template === "footwear") && (
            <>
              {template === "footwear" && (
                /* Sizing Scale Selector */
                <div className="flex items-center gap-1 bg-indigo-900/60 rounded px-2 py-1 border border-indigo-700">
                  <span className="text-[10px] text-indigo-300">Scale:</span>
                  <select
                    id="po-preview-scale-select"
                    value={sizingScale}
                    onChange={(e) => setSizingScale(e.target.value as any)}
                    className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="EURO" className="bg-slate-900 text-white">Euro (EU 40-45) [Default]</option>
                    <option value="UK" className="bg-slate-900 text-white">UK / India (6-11)</option>
                    <option value="US" className="bg-slate-900 text-white">US Mens (7-12)</option>
                  </select>
                </div>
              )}

              {/* Currency Selector */}
              <div className="flex items-center gap-1 bg-indigo-900/60 rounded px-2 py-1 border border-indigo-700">
                <span className="text-[10px] text-indigo-300">Currency:</span>
                <select
                  id="po-preview-currency-select"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as any)}
                  className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="INR" className="bg-slate-900 text-white">Indian Rupee (₹ - INR) [Default]</option>
                  <option value="EUR" className="bg-slate-900 text-white">Euro (€ - EUR)</option>
                  <option value="USD" className="bg-slate-900 text-white">US Dollar ($ - USD)</option>
                </select>
              </div>

              {/* Shoe Photo Toggle */}
              <label className="flex items-center gap-1 text-[11px] bg-indigo-900/60 hover:bg-indigo-900 text-indigo-100 rounded px-2 py-1 border border-indigo-700 cursor-pointer">
                <input
                  type="checkbox"
                  id="po-preview-toggle-photos"
                  checked={showPhotos}
                  onChange={(e) => setShowPhotos(e.target.checked)}
                  className="rounded text-amber-400 focus:ring-0"
                />
                <span>Shoe Photos</span>
              </label>
            </>
          )}

          {/* Orientation Selector */}
          <div className="flex items-center gap-1 bg-indigo-900/60 rounded px-1.5 py-1 border border-indigo-700">
            <span className="text-[10px] text-indigo-300">Layout:</span>
            <button
              type="button"
              id="po-preview-orientation-landscape"
              onClick={() => setOrientation("landscape")}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                orientation === "landscape"
                  ? "bg-amber-400 text-slate-950 shadow-xs"
                  : "text-indigo-200 hover:text-white"
              }`}
            >
              Landscape
            </button>
            <button
              type="button"
              id="po-preview-orientation-portrait"
              onClick={() => setOrientation("portrait")}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                orientation === "portrait"
                  ? "bg-amber-400 text-slate-950 shadow-xs"
                  : "text-indigo-200 hover:text-white"
              }`}
            >
              Portrait
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-indigo-900/60 rounded px-1.5 py-1 border border-indigo-700 text-[11px]">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
              className="hover:text-amber-400 font-bold px-1"
              title="Zoom out"
            >
              -
            </button>
            <span className="font-mono text-[10px]">{zoomLevel}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(130, z + 10))}
              className="hover:text-amber-400 font-bold px-1"
              title="Zoom in"
            >
              +
            </button>
          </div>

          {/* Print Button */}
          <button
            type="button"
            id="po-preview-print-action-btn"
            onClick={() => window.print()}
            className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-3 py-1 rounded text-xs transition-colors flex items-center gap-1 shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">print</span>
            Print
          </button>

          {/* Close Modal Button */}
          <button
            type="button"
            id="po-preview-close-modal-btn"
            onClick={onClose}
            className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-0.5"
            title="Close preview (Esc)"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            Esc
          </button>
        </div>
      </div>

      {/* Document Sheet Display Canvas with Scaled Preview */}
      <div className="print-sheet-canvas-wrapper w-full flex justify-center pb-12 print:p-0 print:m-0 print:block">
        <style>{`
          @media print {
            @page {
              size: ${orientation === "landscape" ? "A4 landscape" : "A4 portrait"};
              margin: 6mm;
            }
            #root {
              display: none !important;
            }
            html, body {
              height: auto !important;
              min-height: 0 !important;
              overflow: visible !important;
              overflow-x: visible !important;
              overflow-y: visible !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }
            .print-preview-modal-root {
              position: static !important;
              display: block !important;
              width: 100% !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              overflow-x: visible !important;
              overflow-y: visible !important;
              background: white !important;
            }
            .print-sheet-canvas-wrapper {
              display: block !important;
              width: 100% !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              overflow-x: visible !important;
              overflow-y: visible !important;
            }
            #po-print-preview-sheet-wrapper {
              position: static !important;
              display: block !important;
              width: 100% !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: visible !important;
              overflow-x: visible !important;
              overflow-y: visible !important;
              box-shadow: none !important;
              transform: none !important;
            }
          }
        `}</style>
        <div
          id="po-print-preview-sheet-wrapper"
          className="print-only-container transition-transform duration-150 origin-top shadow-2xl print:shadow-none print:transform-none print:w-full print:max-w-none print:h-auto"
          style={zoomLevel === 100 ? undefined : { transform: `scale(${zoomLevel / 100})` }}
        >
          {template === "smriti-sizewise" || template === "smriti-standard" ? (
            <PurchaseOrderPrintA4 data={approvedPrintData} />
          ) : template === "footwear" ? (
            <FootwearPurchaseOrderA4 data={footwearData} />
          ) : template === "pivot" ? (
            <SizePivotMatrixA4
              header={{
                ...header,
                paymentTerms: header.paymentTerms || "120 Days",
                businessTerms: resolvedBusinessTerms,
              }}
              rows={sizePivotRows}
              currencySymbol={currencySymbol}
              vendorName={vendor?.name}
              orientation={orientation}
            />
          ) : (
            <div className={`bg-white p-8 rounded-lg shadow-xl ${orientation === "landscape" ? "w-[297mm] min-h-[210mm]" : "w-[210mm] min-h-[297mm]"}`}>
              <StandardInvoiceA4 data={standardInvoiceData as any} />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default POPrintPreviewModal;
