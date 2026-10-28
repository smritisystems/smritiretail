/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.75.3
 * Created      : 2026-10-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "PO_MODE_CONVERSION")
 */

import type { Product } from "../../types.ts";
import type { PurchaseOrderHeader, PurchaseOrderLineItem } from "./types.ts";
import {
  SizewisePOLine,
  SizewisePOHeader,
  DEFAULT_SIZEWISE_SIZES,
  extractArticleAndColor,
} from "./PoSizewiseTab.tsx";

/**
 * findMatchingVariantProduct — Finds a catalog variant matching an article, color, and size.
 */
export function findMatchingVariantProduct(
  products: Product[],
  article: string,
  color: string,
  size: string
): Product | undefined {
  if (!products || products.length === 0) return undefined;
  const targetSku = `${article}-${color}-${size}`.toUpperCase();
  const artUpper = article.trim().toUpperCase();
  const colUpper = color.trim().toUpperCase();
  const szUpper = size.trim().toUpperCase();

  // 1. Exact SKU code or barcode match
  const exact = products.find(
    (p) =>
      (p.code || "").toUpperCase() === targetSku ||
      (p.barcode || "").toUpperCase() === targetSku
  );
  if (exact) return exact;

  // 2. Multi-attribute match (styleCode/article + color/shade + size)
  return products.find((p) => {
    const pStyle = (
      (p as any).styleCode ||
      (p as any).style ||
      (p as any).articleNo ||
      (p as any).article ||
      ""
    ).toUpperCase();
    const pColor = ((p as any).color || (p as any).shade || "").toUpperCase();
    const pSize = ((p as any).size || "").toUpperCase();
    const pName = (p.name || "").toUpperCase();

    const styleMatch =
      pStyle === artUpper ||
      pName.startsWith(artUpper) ||
      pName.includes(` ${artUpper} `) ||
      pName.includes(`${artUpper}-`);
    const colorMatch =
      pColor === colUpper ||
      pName.includes(` ${colUpper} `) ||
      pName.includes(colUpper);
    const sizeMatch =
      pSize === szUpper ||
      pName.endsWith(` ${szUpper}`) ||
      pName.endsWith(`-${szUpper}`) ||
      pName.includes(`, ${szUpper}`);

    return styleMatch && colorMatch && sizeMatch;
  });
}

/**
 * convertSizewiseToStandardLines — Expands SizewisePOLine rows into barcode-wise
 * individual PurchaseOrderLineItem rows.
 *
 * Rules:
 *  - Excludes size variants with quantity <= 0.
 *  - Sum of converted line quantities strictly equals the original Sizewise totalQty.
 *  - Maps actual barcode, SKU, and product name from catalog when available.
 *  - Preserves rate, UOM, deliveryDate, and statutory tax percent.
 */
export function convertSizewiseToStandardLines(
  sizewiseLines: SizewisePOLine[],
  products: Product[] = [],
  defaultTaxPercent = 5
): PurchaseOrderLineItem[] {
  if (!sizewiseLines || sizewiseLines.length === 0) return [];

  const converted: PurchaseOrderLineItem[] = [];
  let lineCounter = 1;

  for (const line of sizewiseLines) {
    if (!line.itemCode && !line.articleNo && !line.style) continue;
    if (line.totalQty <= 0) continue;

    const extracted = extractArticleAndColor(
      line.itemCode,
      line.product,
      line.articleNo || line.style,
      line.shade
    );
    const article = (extracted.article || line.articleNo || line.style || line.itemCode || "ITEM").trim();
    const color = (extracted.color || line.shade || "Standard").trim();
    const rate = line.rate || 0;
    const taxPercent = line.taxPercent !== undefined ? line.taxPercent : defaultTaxPercent;
    const unit = line.unit || "Pair";
    const brand = line.brand || "SMRITI";
    const deliveryDate = line.deliveryDate || "";

    // Extract sizes present in line.sizeQuantities
    const activeEntries = Object.entries(line.sizeQuantities || {}).filter(
      ([_, qty]) => Number(qty) > 0
    );

    // If no active sizes found but totalQty > 0, produce a single fallback line
    if (activeEntries.length === 0) {
      const gross = rate * line.totalQty;
      const taxAmount = (gross * taxPercent) / 100;
      converted.push({
        id: `line-${lineCounter}`,
        sNo: lineCounter++,
        stockNo: line.itemCode || article,
        barcode: line.barcode || "",
        product: line.product || `${article} ${color}`,
        brand,
        style: article,
        shade: color,
        size: "",
        fibre: "Cotton",
        colourBase: color,
        styling: article,
        mrp: rate * 1.3,
        rate,
        orderQty: line.totalQty,
        freeQty: 0,
        unit,
        discountPercent: 0,
        discountAmount: 0,
        value: gross,
        stockOnHand: line.stockOnHand || 0,
        taxPercent,
        taxAmount,
        addOnPercent: 0,
        addOnAmount: 0,
        totalValue: gross + taxAmount,
        originalProduct: line.originalProduct,
      });
      continue;
    }

    for (const [sz, rawQty] of activeEntries) {
      const qty = Math.max(0, Math.round(Number(rawQty)));
      if (qty <= 0) continue;

      const matchedProduct = findMatchingVariantProduct(products, article, color, sz);
      const stockNo =
        matchedProduct?.code ||
        (matchedProduct as any)?.sku ||
        (matchedProduct as any)?.stock_no ||
        `${article}-${color}-${sz}`;
      const barcode =
        matchedProduct?.barcode ||
        (line.barcode && line.itemCode === stockNo ? line.barcode : stockNo);
      const productName =
        matchedProduct?.name ||
        (line.product
          ? `${line.product}, ${sz}`
          : `${article} - ${color}, Size ${sz}`);
      const mrp = matchedProduct?.mrp || (matchedProduct as any)?.price || rate * 1.3;
      const stockOnHand = matchedProduct?.stock ?? (line.stockOnHand || 0);

      const gross = rate * qty;
      const taxAmount = (gross * taxPercent) / 100;
      const totalValue = gross + taxAmount;

      converted.push({
        id: `line-${lineCounter}`,
        sNo: lineCounter++,
        stockNo,
        barcode,
        product: productName,
        brand: matchedProduct?.brand || brand,
        style: article,
        shade: color,
        size: sz,
        fibre: (matchedProduct as any)?.attributes?.fabric_type || "Cotton",
        colourBase: color,
        styling: article,
        mrp,
        rate,
        orderQty: qty,
        freeQty: 0,
        unit: matchedProduct?.unit || unit,
        discountPercent: 0,
        discountAmount: 0,
        value: gross,
        stockOnHand,
        taxPercent,
        taxAmount,
        addOnPercent: 0,
        addOnAmount: 0,
        totalValue,
        originalProduct: matchedProduct || line.originalProduct,
      });
    }
  }

  return converted;
}

/**
 * detectSizesFromLines — Automatically identifies the size scale from item variants.
 */
export function detectSizesFromLines(
  items: PurchaseOrderLineItem[],
  fallbackSizes: string[] = DEFAULT_SIZEWISE_SIZES
): string[] {
  if (!items || items.length === 0) return fallbackSizes;

  const foundSizes = new Set<string>();
  for (const item of items) {
    let sz = (item.size || "").trim().toUpperCase();
    if (!sz || sz === "-") {
      const match = (item.stockNo || "").match(/-([A-Za-z0-9]+)$/);
      if (match) sz = match[1].toUpperCase();
    }
    if (sz && sz !== "-") foundSizes.add(sz);
  }

  // Check Footwear EU
  const euSizes = ["36", "37", "38", "39", "40", "41", "42", "43", "44"];
  if (Array.from(foundSizes).some((s) => euSizes.includes(s))) {
    return euSizes;
  }

  // Check Footwear UK
  const ukSizes = ["6", "7", "8", "9", "10", "11"];
  if (
    Array.from(foundSizes).some((s) => ukSizes.includes(s)) &&
    !Array.from(foundSizes).some((s) => Number(s) > 15)
  ) {
    return ukSizes;
  }

  // Check Apparel Alpha
  const alphaSizes = ["S", "M", "L", "XL", "XXL", "XS", "3XL"];
  if (Array.from(foundSizes).some((s) => alphaSizes.includes(s))) {
    return ["S", "M", "L", "XL", "XXL"];
  }

  if (fallbackSizes && fallbackSizes.length > 0) return fallbackSizes;
  if (foundSizes.size > 0) return Array.from(foundSizes);
  return DEFAULT_SIZEWISE_SIZES;
}

/**
 * convertStandardToSizewiseLines — Regroups individual barcode-wise PurchaseOrderLineItem
 * rows by (Article, Color) into horizontal SizewisePOLine matrix rows.
 *
 * Rules:
 *  - Groups lines having the same (article, color) into a single matrix row.
 *  - Distributes the individual line orderQty into the respective sizeQuantities[size].
 *  - Sums totalQty and recalculates netValue.
 *  - Preserves rate, taxPercent, unit, and deliveryDate.
 *  - Repeated conversions produce stable, non-duplicated structures.
 */
export function convertStandardToSizewiseLines(
  standardLines: PurchaseOrderLineItem[],
  sizes?: string[],
  defaultDeliveryDate = "",
  defaultTaxPercent = 5
): SizewisePOLine[] {
  if (!standardLines || standardLines.length === 0) return [];

  const effectiveSizes =
    sizes && sizes.length > 0
      ? sizes
      : detectSizesFromLines(standardLines, DEFAULT_SIZEWISE_SIZES);

  // Filter out completely blank lines
  const activeLines = standardLines.filter(
    (l) => Boolean(l.stockNo?.trim() || l.barcode?.trim()) && l.orderQty > 0
  );

  if (activeLines.length === 0) return [];

  const groups = new Map<
    string,
    {
      article: string;
      color: string;
      brand: string;
      product: string;
      unit: string;
      rate: number;
      taxPercent: number;
      deliveryDate: string;
      originalProduct?: Product;
      sizeQuantities: Record<string, number>;
      items: PurchaseOrderLineItem[];
    }
  >();

  for (const item of activeLines) {
    const rawStock = (item.stockNo || item.barcode || "").trim();
    const extracted = extractArticleAndColor(rawStock, item.product, item.style, item.shade);
    const article = (extracted.article || item.style || rawStock).trim();
    const color = (extracted.color || item.shade || item.colourBase || "Standard").trim();
    const groupKey = `${article.toUpperCase()}::${color.toUpperCase()}`;

    let group = groups.get(groupKey);
    if (!group) {
      // Clean base product name by removing trailing size suffix like ", 36" or "- 36"
      const cleanProductName = item.product
        ? item.product.replace(/,\s*[A-Za-z0-9]+$/, "").replace(/\s*-\s*[A-Za-z0-9]+$/, "").trim()
        : `${article} - ${color}`;

      const initialSizeQtys: Record<string, number> = {};
      effectiveSizes.forEach((sz) => {
        initialSizeQtys[sz] = 0;
      });

      group = {
        article,
        color,
        brand: item.brand || "",
        product: cleanProductName,
        unit: item.unit || "Pair",
        rate: item.rate || 0,
        taxPercent: item.taxPercent !== undefined ? item.taxPercent : defaultTaxPercent,
        deliveryDate: (item as any).deliveryDate || defaultDeliveryDate,
        originalProduct: item.originalProduct,
        sizeQuantities: initialSizeQtys,
        items: [],
      };
      groups.set(groupKey, group);
    }

    // Determine size of the item
    let itemSize = (item.size || "").trim().toUpperCase();
    if (!itemSize || itemSize === "-") {
      const match = rawStock.match(/-([A-Za-z0-9]+)$/);
      if (match) itemSize = match[1].toUpperCase();
    }

    if (itemSize) {
      group.sizeQuantities[itemSize] = (group.sizeQuantities[itemSize] || 0) + item.orderQty;
    } else {
      // Fallback: put into median size
      const midSize = effectiveSizes[Math.floor(effectiveSizes.length / 2)] || effectiveSizes[0];
      group.sizeQuantities[midSize] = (group.sizeQuantities[midSize] || 0) + item.orderQty;
    }

    // Accumulate items for reference
    group.items.push(item);
  }

  // Construct SizewisePOLine rows
  const result: SizewisePOLine[] = [];
  let sNoCounter = 1;

  for (const group of groups.values()) {
    const totalQty = Object.values(group.sizeQuantities).reduce((acc, q) => acc + (q || 0), 0);
    const netValue = totalQty * group.rate;
    const baseCode = `${group.article}-${group.color}`;

    result.push({
      id: `sw-line-${sNoCounter}`,
      sNo: sNoCounter++,
      itemCode: baseCode,
      articleNo: group.article,
      barcode: "",
      product: group.product,
      brand: group.brand,
      style: group.article,
      shade: group.color,
      unit: group.unit,
      sizeQuantities: group.sizeQuantities,
      totalQty,
      rate: group.rate,
      stockOnHand: 0,
      taxPercent: group.taxPercent,
      netValue,
      deliveryDate: group.deliveryDate || defaultDeliveryDate,
      originalProduct: group.originalProduct,
    });
  }

  return result;
}

/**
 * syncSizewiseHeaderToStandard — Maps header fields from Sizewise format to Standard PO Header.
 */
export function syncSizewiseHeaderToStandard(
  source: Partial<SizewisePOHeader>,
  target?: Partial<PurchaseOrderHeader>
): PurchaseOrderHeader {
  const today = new Date().toISOString().split("T")[0];
  return {
    documentType: (source.documentType as any) || target?.documentType || "Purchase Order",
    prefix: source.prefix || target?.prefix || "PO",
    orderNumber: source.orderNumber || target?.orderNumber || "001",
    orderDate: source.orderDate || target?.orderDate || today,
    supplierId: source.supplierId || target?.supplierId || "",
    supplierName: source.supplierName || target?.supplierName || "",
    billTo: target?.billTo || "Main Store",
    deliveryDate: source.deliveryDate || target?.deliveryDate || today,
    leadTimeDays: source.leadTimeDays ?? target?.leadTimeDays ?? 7,
    deliveryLocation: source.deliveryLocation || target?.deliveryLocation || "Main Store (MAIN)",
    commonTaxPercent: source.commonTaxPercent ?? target?.commonTaxPercent ?? 5,
    pictureUrl: target?.pictureUrl,
    paymentTerms: source.paymentTerms || target?.paymentTerms || "30 Days",
    freightCharges: source.freightCharges || target?.freightCharges || "Paid by Supplier",
    deliveryTerms: source.deliveryTerms || target?.deliveryTerms || ((source.freightCharges || target?.freightCharges || "").toLowerCase().includes("buyer") || (source.freightCharges || target?.freightCharges || "").toLowerCase().includes("to-pay") ? "Ex-Factory" : "Door Delivery"),
    specialInstructions: source.specialInstructions || target?.specialInstructions || "",
    supplierReference: source.supplierReference || target?.supplierReference || "",
    currency: source.currency || target?.currency || "INR - Indian Rupee",
    buyer: source.buyer || target?.buyer || "",
    department: source.department || target?.department || "General Purchase",
    priceIncludesTax: target?.priceIncludesTax || false,
    freightAmount: source.freightAmount ?? target?.freightAmount ?? 0,
    otherCharges: source.otherCharges ?? target?.otherCharges ?? 0,
    policyName: target?.policyName || "General Retail",
    vendorStatus: target?.vendorStatus || "Active",
  };
}

/**
 * syncStandardHeaderToSizewise — Maps header fields from Standard format to Sizewise PO Header.
 */
export function syncStandardHeaderToSizewise(
  source: Partial<PurchaseOrderHeader>,
  target?: Partial<SizewisePOHeader>
): SizewisePOHeader {
  const today = new Date().toISOString().split("T")[0];
  return {
    documentType: source.documentType || target?.documentType || "Purchase Order",
    prefix: source.prefix || target?.prefix || "PO",
    orderNumber: source.orderNumber || target?.orderNumber || "001",
    orderDate: source.orderDate || target?.orderDate || today,
    supplierId: source.supplierId || target?.supplierId || "",
    supplierName: source.supplierName || target?.supplierName || "",
    deliveryDate: source.deliveryDate || target?.deliveryDate || today,
    leadTimeDays: source.leadTimeDays ?? target?.leadTimeDays ?? 7,
    deliveryLocation: source.deliveryLocation || target?.deliveryLocation || "Main Store (MAIN)",
    commonTaxPercent: source.commonTaxPercent ?? target?.commonTaxPercent ?? 5,
    freightAmount: source.freightAmount ?? target?.freightAmount ?? 0,
    otherCharges: source.otherCharges ?? target?.otherCharges ?? 0,
    paymentTerms: source.paymentTerms || target?.paymentTerms || "30 Days",
    freightCharges: source.freightCharges || target?.freightCharges || "Paid by Supplier",
    deliveryTerms: source.deliveryTerms || target?.deliveryTerms || ((source.freightCharges || target?.freightCharges || "").toLowerCase().includes("buyer") || (source.freightCharges || target?.freightCharges || "").toLowerCase().includes("to-pay") ? "Ex-Factory" : "Door Delivery"),
    currency: source.currency || target?.currency || "INR - Indian Rupee",
    buyer: source.buyer || target?.buyer || "",
    department: source.department || target?.department || "General Purchase",
    supplierReference: source.supplierReference || target?.supplierReference || "",
    specialInstructions: source.specialInstructions || target?.specialInstructions || "",
    remarks: target?.remarks || "",
    internalNotes: target?.internalNotes || "",
    priceList: target?.priceList || "Default Purchase Price",
  };
}
