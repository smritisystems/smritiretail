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
import { getTenantCompanyContext, persistTenantContext, apiFetchV1 } from "../../lib/apiFetchV1";
import { lookupFootwearStyleMetadata } from "../../lib/footwearStyleCatalog";

const ITEM_REFERENCE_FIELD_OPTIONS = [
  { key: "color", label: "Color" },
  { key: "collectionType", label: "Collection" },
  { key: "heels", label: "Heels" },
  { key: "upperMaterial", label: "Upper Material" },
  { key: "outsole", label: "Outsole" },
] as const;

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
  customCompanyProfile?: {
    name?: string;
    address?: string;
    gstin?: string;
    pan?: string;
    city?: string;
    state?: string;
    email?: string;
    phone?: string;
  };
}

/**
 * Case-insensitive, robust extractor for footwear attributes (Heels, Upper Material, Outsole).
 * Checks direct properties, nested originalProduct, attributes dict, and common casing/alias variations.
 */
export function resolveFootwearAttributes(item: any): {
  heels: string;
  upperMaterial: string;
  outsole: string;
  collectionType: string;
} {
  if (!item) return { heels: "—", upperMaterial: "—", outsole: "—", collectionType: "—" };

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

  let heels =
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

  let upperMaterial =
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

  let outsole =
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

  let collectionType =
    findVal([
      "collectionType",
      "collection_type",
      "COLLECTION_TYPE",
      "Collection Type",
      "collection",
      "Collection",
      "COLLECTION",
      "season",
      "Season",
      "SEASON",
    ]) || "—";

  // Catalog fallback lookup if any attribute is missing / blank
  if (heels === "—" || upperMaterial === "—" || outsole === "—" || collectionType === "—") {
    const candidateKeys = [
      item.barcode,
      item.stockNo,
      item.articleNo,
      item.articleCode,
      item.style,
      item.code,
      item.itemCode,
      item.product,
      item.originalProduct?.code,
      item.originalProduct?.barcode,
      item.originalProduct?.style_code,
    ].filter(Boolean);

    for (const key of candidateKeys) {
      const meta = lookupFootwearStyleMetadata(key);
      if (meta) {
        if (heels === "—" && meta.heelType) heels = meta.heelType;
        if (upperMaterial === "—" && meta.upperMaterial) upperMaterial = meta.upperMaterial;
        if (outsole === "—" && meta.outsole) outsole = meta.outsole;
        if (collectionType === "—" && (meta as any).collectionType) collectionType = (meta as any).collectionType;
        if (heels !== "—" && upperMaterial !== "—" && outsole !== "—" && collectionType !== "—") break;
      }
    }
  }

  return { heels, upperMaterial, outsole, collectionType };
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
  customCompanyProfile,
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
    const headerCurrency = (header?.currency || "").toUpperCase();
    if (headerCurrency.includes("EUR")) return "EUR";
    if (headerCurrency.includes("USD")) return "USD";
    return "INR";
  });
  const [showPhotos, setShowPhotos] = useState<boolean>(true);
  const [imageGridSetting, setImageGridSetting] = useState<"auto" | "2" | "4">(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("smriti_po_image_grid_setting");
      if (saved === "2" || saved === "4" || saved === "auto") return saved;
    }
    return "auto";
  });
  const [selectedArticleCodes, setSelectedArticleCodes] = useState<string[] | null>(null);
  const [itemReferenceFields, setItemReferenceFields] = useState<{
    color: boolean;
    collectionType: boolean;
    heels: boolean;
    upperMaterial: boolean;
    outsole: boolean;
  }>(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("smriti_po_item_reference_fields");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return {
            color: false,
            collectionType: true,
            heels: true,
            upperMaterial: true,
            outsole: true,
            ...parsed,
          };
        } catch {
          // ignore corrupted JSON
        }
      }
    }
    return {
      color: false,
      collectionType: true,
      heels: true,
      upperMaterial: true,
      outsole: true,
    };
  });
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("portrait");
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [asyncCompanyProfile, setAsyncCompanyProfile] = useState<any>(null);

  // Proactively synchronize authoritative corporate profile if identity cache is empty
  useEffect(() => {
    if (!isOpen) return;
    const tenantCtxSnapshot = getTenantCompanyContext();
    const existingName =
      customCompanyProfile?.name ||
      asyncCompanyProfile?.name ||
      tenantCtxSnapshot.companyName ||
      (typeof localStorage !== "undefined" ? localStorage.getItem("smriti_company_name") || "" : "");

    if (!existingName) {
      apiFetchV1<any>("/company/profile")
        .then((comp) => {
          if (comp && (comp.name || comp.legal_name || comp.trade_name)) {
            setAsyncCompanyProfile(comp);
            const fullAddress = [
              comp.address_line1,
              comp.address_line2,
              comp.city,
              comp.state,
              comp.pincode,
            ].filter(Boolean).join(", ");
            persistTenantContext({
              companyName: comp.name || comp.legal_name || comp.trade_name,
              companyAddress: fullAddress || comp.address,
              companyGstin: comp.gst_number || comp.gstin,
              companyPhone: comp.phone,
              companyEmail: comp.email,
              companyLogoUrl: comp.logo_url || comp.print_logo_url,
            });
          }
        })
        .catch((err) => {
          console.warn("[POPrintPreviewModal] Notice: Authoritative company profile fetch deferred:", err);
        });
    }
  }, [isOpen, customCompanyProfile?.name]);

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

      validPivotRows.forEach((r) => {
        const art = (r.articleNo || r.product || "—").trim();
        const col = (r.color || "—").trim();
        const key = `${art.toUpperCase()}:::${col.toUpperCase()}`;

        const q40 = Number(r.sizeQuantities?.["40"] || r.sizeQuantities?.["EU 40"] || r.sizeQuantities?.["S"] || 0);
        const q41 = Number(r.sizeQuantities?.["41"] || r.sizeQuantities?.["EU 41"] || r.sizeQuantities?.["M"] || 0);
        const q42 = Number(r.sizeQuantities?.["42"] || r.sizeQuantities?.["EU 42"] || r.sizeQuantities?.["L"] || 0);
        const q43 = Number(r.sizeQuantities?.["43"] || r.sizeQuantities?.["EU 43"] || r.sizeQuantities?.["XL"] || 0);
        const q44 = Number(r.sizeQuantities?.["44"] || r.sizeQuantities?.["EU 44"] || r.sizeQuantities?.["XXL"] || 0);
        const q45 = Number(r.sizeQuantities?.["45"] || r.sizeQuantities?.["EU 45"] || 0);
        const rowPairs = Number(r.totalQty ?? (q40 + q41 + q42 + q43 + q44 + q45));
        const rate = currency === "EUR" ? (r.rate ? r.rate / fxEurToInr : 0) : Number(r.rate || 0);
        const lineTotal = +(rate * rowPairs).toFixed(2);
        const fwAttrs = resolveFootwearAttributes(r);

        if (!groupedFwMap.has(key)) {
          const cartons = rowPairs > 0 ? Math.max(1, Math.round(rowPairs / 12)) : 0;
          groupedFwMap.set(key, {
            articleCode: art,
            photoUrl: r.photoUrl || r.imageUrl || r.originalProduct?.primaryImageUrl,
            modelName: r.product || "—",
            category: r.brand || "—",
            taricCode: "64035910",
            hsnCode: "6403",
            color: col,
            size: "EU 40-45",
            colorHex: "#334155",
            finish: "—",
            upperMaterial: fwAttrs.upperMaterial,
            soleMaterial: fwAttrs.outsole,
            liningMaterial: "—",
            insoleMaterial: "—",
            ratioString: "—",
            eu40: q40,
            eu41: q41,
            eu42: q42,
            eu43: q43,
            eu44: q44,
            eu45: q45,
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
          existing.cartons = existing.pairs > 0 ? Math.max(1, Math.round(existing.pairs / 12)) : 0;
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
        const totalPairs = Number(l.orderQty || 0);
        const cartons = totalPairs > 0 ? Math.max(1, Math.round(totalPairs / 12)) : 0;
        const rate = currency === "EUR" ? (l.rate ? l.rate / fxEurToInr : 0) : Number(l.rate || 0);
        const lineTotal = +(rate * totalPairs).toFixed(2);
        const fwAttrs = resolveFootwearAttributes(l);

        return {
          articleCode: l.stockNo || l.barcode || `ART-${idx + 1}`,
          modelName: l.product || l.barcode || "—",
          category: l.brand || "—",
          taricCode: "64035910",
          hsnCode: (l as any).hsnCode || (l as any).hsn_code || "6403",
          color: l.shade || "—",
          size: l.size || "—",
          colorHex: "#1e293b",
          finish: "—",
          upperMaterial: fwAttrs.upperMaterial,
          soleMaterial: fwAttrs.outsole,
          liningMaterial: "—",
          insoleMaterial: "—",
          ratioString: "—",
          eu40: 0,
          eu41: 0,
          eu42: totalPairs,
          eu43: 0,
          eu44: 0,
          eu45: 0,
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

  const docPayloadCompanyName =
    (header as any)?.companyName ||
    (header as any)?.company_name ||
    (header.billTo && header.billTo.trim() && !["DEFAULT LOCATION", "MAIN", "DEFAULT"].includes(header.billTo.trim().toUpperCase()) ? header.billTo.trim() : "");

  const asyncAddress = asyncCompanyProfile
    ? [
        asyncCompanyProfile.address_line1,
        asyncCompanyProfile.address_line2,
        asyncCompanyProfile.city,
        asyncCompanyProfile.state,
        asyncCompanyProfile.pincode,
      ].filter(Boolean).join(", ")
    : "";

  const tenantCompanyName =
    customCompanyProfile?.name ||
    asyncCompanyProfile?.name ||
    asyncCompanyProfile?.legal_name ||
    asyncCompanyProfile?.trade_name ||
    tenantCtx.companyName ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("smriti_company_name") || "" : "") ||
    docPayloadCompanyName;

  const tenantCompanyAddress =
    customCompanyProfile?.address ||
    asyncAddress ||
    tenantCtx.companyAddress ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("smriti_company_address") || "" : "");

  const tenantCompanyGstin =
    customCompanyProfile?.gstin ||
    asyncCompanyProfile?.gst_number ||
    asyncCompanyProfile?.gstin ||
    tenantCtx.companyGstin ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("smriti_company_gstin") || "" : "");

  const tenantCompanyEmail =
    customCompanyProfile?.email ||
    asyncCompanyProfile?.email ||
    tenantCtx.companyEmail ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("smriti_company_email") || "" : "");

  const tenantCompanyPhone =
    customCompanyProfile?.phone ||
    asyncCompanyProfile?.phone ||
    tenantCtx.companyPhone ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("smriti_company_phone") || "" : "");

  const tenantCompanyPan =
    customCompanyProfile?.pan ||
    asyncCompanyProfile?.pan ||
    (tenantCompanyGstin && tenantCompanyGstin.length >= 12 ? tenantCompanyGstin.slice(2, 12) : "");

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
    dcCode: header.deliveryLocation || "MAIN",
    dcName: header.deliveryLocation || "Main Store",
    dcAddress: tenantCompanyAddress || "—",
    dcGstin: tenantCompanyGstin || "—",
    dcReceivingGate: "—",
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
    paymentTerms: header.paymentTerms || "30 Days Net",
    purchaser: header.buyer || "—",
    supplierReference: header.supplierReference || "—",
    documentStatus: header.status || (header as any)?.documentStatus || (reprintMode ? "ORIGINAL UNCHANGED" : "DRAFT"),
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
    paymentTerms: header.paymentTerms || "30 Days Net",
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
      name: tenantCompanyName || "Company Profile Not Configured",
      address: tenantCompanyAddress || "—",
      gstin: tenantCompanyGstin || "—",
      phone: tenantCompanyPhone || "—",
      email: tenantCompanyEmail || "—",
      pan: tenantCompanyPan || "—",
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
    terms: "1. Goods delivered per SATRA norms.\n2. Payment terms 120 days net from GRN date.",
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
      let lStyle = (l.style || "").trim();
      let lShade = (l.shade || l.colourBase || l.originalProduct?.color || "").trim();
      let lSize = (l.size || "").trim();

      if ((!lStyle || !lShade || !lSize) && (l.barcode || l.stockNo)) {
        const rawCode = (l.barcode || l.stockNo || "").trim();
        const parts = rawCode.split("-");
        if (parts.length >= 3) {
          const sz = parts[parts.length - 1];
          const col = parts[parts.length - 2];
          const st = parts.slice(0, parts.length - 2).join("-");
          if (!lSize && sz) lSize = sz;
          if (!lShade && col) lShade = col;
          if (!lStyle && st) lStyle = st;
        }
      }

      const art = (lStyle || l.stockNo || l.product || "Footwear Article").trim();
      const col = (lShade || "Standard").trim();
      const key = `${art.toUpperCase()}:::${col.toUpperCase()}`;
      const qty = Number(l.orderQty) || 0;
      const rate = Number(l.rate) || 0;
      const taxRate = l.taxPercent !== undefined ? Number(l.taxPercent) : (header.commonTaxPercent ?? 5);
      const lineTaxable = l.value !== undefined ? Number(l.value) : (qty * rate);
      const lineTax = l.taxAmount !== undefined ? Number(l.taxAmount) : (lineTaxable * taxRate) / 100;
      const szKey = lSize || "Standard";

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

  // All discovered unique item references from PO lines
  const allAvailableArticleReferences: FootwearArticleReference[] = useMemo(() => {
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
          collectionType: fw.collectionType !== "—" ? fw.collectionType : (header as any).collectionType || (header as any).collection_type || undefined,
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
          collectionType: fw.collectionType !== "—" ? fw.collectionType : (header as any).collectionType || (header as any).collection_type || undefined,
          imageUrl:
            l.imageUrl ||
            l.photoUrl ||
            l.originalProduct?.primaryImageUrl ||
            (l.originalProduct as any)?.image_url,
        });
      }
    });

    return Array.from(refMap.values());
  }, [sizePivotRows, lineItems, header]);

  // Filtered item references based on user selection
  const mappedItemReferences: FootwearArticleReference[] = useMemo(() => {
    if (!showPhotos) return [];
    if (!selectedArticleCodes || selectedArticleCodes.length === 0) {
      return allAvailableArticleReferences;
    }
    return allAvailableArticleReferences.filter((ref) =>
      selectedArticleCodes.includes(ref.articleNo)
    );
  }, [allAvailableArticleReferences, showPhotos, selectedArticleCodes]);

  // Determine effective image columns (2 or 4)
  const effectiveImageColumns: 2 | 4 = useMemo(() => {
    if (imageGridSetting === "2") return 2;
    if (imageGridSetting === "4") return 4;
    // auto: if 1 or 2 items -> 2 cols; if 3 or more -> 4 cols to fit single page
    return mappedItemReferences.length <= 2 ? 2 : 4;
  }, [imageGridSetting, mappedItemReferences.length]);

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

  // Resolve Vendor Profile Details with Real Fallbacks (Strict 120 Days Footwear Default)
  const rawTerms =
    (header.paymentTerms && header.paymentTerms !== "30 Days" ? header.paymentTerms : null) ||
    (vendor?.payment_terms && vendor?.payment_terms !== "30 Days" ? vendor?.payment_terms : null) ||
    (vendor?.payment_terms_days && vendor.payment_terms_days !== 30 ? `${vendor.payment_terms_days} Days` : null) ||
    (vendor?.commercial?.paymentTerms && vendor?.commercial?.paymentTerms !== "30 Days" ? vendor?.commercial?.paymentTerms : null) ||
    (vendor?.commercial_terms?.payment_terms && vendor?.commercial_terms?.payment_terms !== "30 Days" ? vendor?.commercial_terms?.payment_terms : null);

  const vendorPaymentTerms = rawTerms || "120 Days";

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
    itemReferenceFields,
    imageColumns: effectiveImageColumns,

    paymentTerms: vendorPaymentTerms,
    freightTerms: header.freightCharges || vendor?.freight_terms || "Paid by Supplier",
    currency: currency === "INR" ? `INR (${currencySymbol})` : currency,
    deliveryTerms:
      (header as any).deliveryTerms ||
      (header as any).commercialTerms?.delivery_terms ||
      (header as any)?.commercial_terms?.delivery_terms ||
      (vendor as any)?.delivery_terms ||
      (vendor as any)?.commercial?.deliveryTerms ||
      ((header.freightCharges || vendor?.freight_terms || "").toLowerCase().includes("buyer") || (header.freightCharges || vendor?.freight_terms || "").toLowerCase().includes("to-pay") ? "Ex-Factory" : "Door Delivery"),
    collectionType:
      (header as any).collectionType ||
      (header as any).collection_type ||
      (header as any).commercialTerms?.collection_type ||
      (header as any).commercial_terms?.collection_type ||
      (header as any).commercialTerms?.collectionType ||
      (header as any).commercial_terms?.collectionType ||
      (header as any).season,
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

  if (!isOpen) return null;

  const modalContent = (
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
              {(template === "smriti-sizewise" || template === "smriti-standard") && (
                <>
                  <details className="relative bg-indigo-900/60 rounded px-2 py-1 border border-indigo-700 text-[11px]">
                    <summary className="cursor-pointer text-indigo-100">Item fields</summary>
                    <div className="absolute right-0 top-full z-20 mt-1 min-w-40 rounded border border-indigo-600 bg-slate-900 p-2 shadow-xl">
                      {ITEM_REFERENCE_FIELD_OPTIONS.map((field) => (
                        <label key={field.key} className="flex items-center gap-2 whitespace-nowrap py-1 text-indigo-100 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={itemReferenceFields[field.key]}
                            onChange={(event) =>
                              setItemReferenceFields((current) => {
                                const next = {
                                  ...current,
                                  [field.key]: event.target.checked,
                                };
                                if (typeof localStorage !== "undefined") {
                                  localStorage.setItem("smriti_po_item_reference_fields", JSON.stringify(next));
                                }
                                return next;
                              })
                            }
                            className="rounded text-amber-400 focus:ring-0"
                          />
                          <span>{field.label}</span>
                        </label>
                      ))}
                    </div>
                  </details>

                  {showPhotos && (
                    <>
                      {/* Grid Density Selector: 2 vs 4 per row */}
                      <div className="flex items-center gap-1 bg-indigo-900/60 rounded px-2 py-1 border border-indigo-700 text-[11px]">
                        <span className="text-[10px] text-indigo-300">Grid:</span>
                        <select
                          id="po-preview-grid-density-select"
                          value={imageGridSetting}
                          onChange={(e) => {
                            const next = e.target.value as "auto" | "2" | "4";
                            setImageGridSetting(next);
                            if (typeof localStorage !== "undefined") {
                              localStorage.setItem("smriti_po_image_grid_setting", next);
                            }
                          }}
                          className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
                        >
                          <option value="auto" className="bg-slate-900 text-white">Auto ({effectiveImageColumns} / row)</option>
                          <option value="2" className="bg-slate-900 text-white">2 / Row (Large 138px)</option>
                          <option value="4" className="bg-slate-900 text-white">4 / Row (Fit 1 Page • 82px)</option>
                        </select>
                      </div>

                      {/* Article Image Selector */}
                      {allAvailableArticleReferences.length > 0 && (
                        <details className="relative bg-indigo-900/60 rounded px-2 py-1 border border-indigo-700 text-[11px]">
                          <summary className="cursor-pointer text-indigo-100 flex items-center gap-1">
                            <span>Photos ({mappedItemReferences.length}/{allAvailableArticleReferences.length})</span>
                          </summary>
                          <div className="absolute right-0 top-full z-30 mt-1 min-w-56 max-h-72 overflow-y-auto rounded-lg border border-indigo-600 bg-slate-900 p-2.5 shadow-2xl space-y-2">
                            <div className="flex items-center justify-between border-b border-indigo-800/80 pb-1.5 text-[10px]">
                              <span className="font-bold text-indigo-200">Select To Print</span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedArticleCodes(allAvailableArticleReferences.map(r => r.articleNo))}
                                  className="text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                                >
                                  All
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedArticleCodes(allAvailableArticleReferences.slice(0, 2).map(r => r.articleNo))}
                                  className="text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                                  title="Select first 2 for large single-page view"
                                >
                                  Top 2
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedArticleCodes(allAvailableArticleReferences.slice(0, 4).map(r => r.articleNo))}
                                  className="text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                                  title="Select first 4 for 4-in-a-row single-page view"
                                >
                                  Top 4
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedArticleCodes([])}
                                  className="text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                                >
                                  None
                                </button>
                              </div>
                            </div>
                            <div className="space-y-1">
                              {allAvailableArticleReferences.map((ref) => {
                                const isSelected = selectedArticleCodes === null
                                  ? true
                                  : selectedArticleCodes.includes(ref.articleNo);
                                return (
                                  <label key={ref.articleNo} className="flex items-center gap-2 py-1 px-1.5 rounded hover:bg-indigo-950/80 text-indigo-100 cursor-pointer text-xs">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        let currentList = selectedArticleCodes === null
                                          ? allAvailableArticleReferences.map(r => r.articleNo)
                                          : [...selectedArticleCodes];
                                        if (e.target.checked) {
                                          if (!currentList.includes(ref.articleNo)) currentList.push(ref.articleNo);
                                        } else {
                                          currentList = currentList.filter(c => c !== ref.articleNo);
                                        }
                                        setSelectedArticleCodes(currentList);
                                      }}
                                      className="rounded text-amber-400 focus:ring-0"
                                    />
                                    <span className="font-bold truncate text-slate-200">{ref.articleNo}</span>
                                    {ref.color && ref.color !== "—" && (
                                      <span className="text-[10.5px] text-indigo-300 truncate font-mono">({ref.color})</span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </details>
                      )}
                    </>
                  )}
                </>
              )}
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
    </div>
  );

  if (typeof document === "undefined" || !document?.body || typeof (document.body as any).appendChild !== "function") {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
};

export default POPrintPreviewModal;
