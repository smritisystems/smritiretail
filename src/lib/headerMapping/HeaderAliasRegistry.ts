/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.49
 * Created      : 2026-08-16
 * Modified     : 2026-10-09
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { SmritiFieldDefinition, MappingContext } from "./types";
import { normalizeHeader } from "./HeaderNormalizer";

export const SMRITI_ITEM_MASTER_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "style_code",
    label: "STYLE / ARTICLE CODE",
    required: true,
    aliases: [
      "style", "style code", "style no", "style number",
      "product style code", "product style", "style product code",
      "article code", "article no", "article number", "article", "style article code", "style/article code",
      "styleArticle", "design no", "model", "article_style_code", "article style code"
    ],
    description: "Parent article style or model code identifier"
  },
  {
    key: "code",
    label: "SKU CODE",
    required: true,
    aliases: [
      "sku", "sku code", "item code", "item no", "item number", "item id",
      "product code", "product no", "product number", "variant sku", "variant code",
      "common", "common code", "common no", "common sku", "matrix code", "stock no"
    ],
    description: "Unique SKU or variant code identifier"
  },
  {
    key: "name",
    label: "ITEM NAME",
    required: true,
    aliases: [
      "item", "item name", "item description", "product", "product name",
      "product description", "description"
    ],
    description: "Item title or product display description"
  },
  {
    key: "barcode",
    label: "BARCODE",
    required: true,
    aliases: [
      "barcode", "barcode no", "barcode number", "barcode code", "ean",
      "ean code", "ean13", "ean 13", "upc", "upc code"
    ],
    description: "EAN / UPC scanner barcode",
    additionalTargets: [
      { target: "sku", targetLabel: "SKU", condition: "sku_mode === 'BARCODE'", transform: "identity" }
    ]
  },
  {
    key: "brand",
    label: "BRAND",
    required: false,
    aliases: ["brand", "brand name", "manufacturer", "make", "label"],
    description: "Manufacturer or brand name"
  },
  {
    key: "imageName",
    label: "IMAGE NAME",
    required: false,
    aliases: [
      "image", "image name", "image_name", "photo", "photo name", "picture",
      "image file", "img", "filename", "product image", "sku image"
    ],
    description: "Product image filename (e.g. shoe-01.jpg)"
  },
  {
    key: "category",
    label: "CATEGORY",
    required: true,
    aliases: [
      "category", "category name", "product category", "item category",
      "group", "department", "merchandise category"
    ],
    description: "Primary merchandise category"
  },
  {
    key: "subCategory",
    label: "SUB CATEGORY",
    required: false,
    aliases: [
      "sub category", "subcategory", "sub-category", "sub category name",
      "product subcategory", "segment"
    ],
    description: "Sub-category classification"
  },
  {
    key: "size",
    label: "SIZE",
    required: false,
    aliases: ["size", "size name", "item size", "product size"],
    description: "Apparel or footwear size"
  },
  {
    key: "colour",
    label: "COLOUR",
    required: false,
    aliases: ["color", "colour", "color name", "colour name", "shade"],
    description: "Item color or shade"
  },
  {
    key: "hsnCode",
    label: "HSN CODE",
    required: false,
    aliases: [
      "hsn", "hsn code", "hsn no", "hsn number", "hsn sac", "hsn/sac"
    ],
    description: "GST HSN/SAC classification code"
  },
  {
    key: "gstPercentage",
    label: "GST %",
    required: true,
    aliases: [
      "gst", "gst %", "gst rate", "gst percentage", "tax rate", "tax %",
      "tax percentage", "tax", "product tax", "product tax %"
    ],
    description: "GST percentage rate"
  },
  {
    key: "mrp",
    label: "MRP",
    required: false,
    aliases: [
      "mrp", "maximum retail price", "retail price", "mrp price",
      "plate rate or mrp", "planned mrp", "target mrp", "list mrp", "max retail price"
    ],
    description: "Maximum Retail Price"
  },
  {
    key: "price",
    label: "SELLING PRICE",
    required: false,
    aliases: [
      "selling price", "sale price", "sales price", "selling rate",
      "sale rate", "sp", "plate rate"
    ],
    description: "Active selling price"
  },
  {
    key: "costPrice",
    label: "BUY COST",
    required: false,
    aliases: [
      "buy cost", "purchase cost", "cost price", "cost", "buying price",
      "purchase rate", "landed cost", "landed cost price"
    ],
    description: "Purchase buy cost"
  },
  {
    key: "uom",
    label: "UOM",
    required: false,
    aliases: [
      "uom", "unit", "unit of measure", "unit of measurement", "measurement unit"
    ],
    description: "Unit of measure (e.g. Pcs, Kg, Pair)"
  },
  {
    key: "stock",
    label: "STOCK",
    required: false,
    aliases: [
      "stock", "opening stock", "opening qty", "opening quantity",
      "quantity", "qty"
    ],
    description: "Opening inventory stock quantity"
  },
  {
    key: "gender",
    label: "GENDER",
    required: false,
    aliases: ["gender", "gender classification", "target gender", "section"],
    description: "Target demographic / gender"
  },
  {
    key: "vendorCode",
    label: "VENDOR CODE",
    required: false,
    aliases: ["vendor code", "vendor id", "vendor no", "vendor number"],
    description: "Supplier / Vendor identifier"
  },
  {
    key: "purchaseClass",
    label: "PURCHASE CLASS",
    required: false,
    aliases: ["purchase class", "purchase classification", "sourcing class"],
    description: "Purchase classification (e.g. SIS, Outright, Consignment)"
  },
  {
    key: "heels",
    label: "HEELS",
    required: false,
    aliases: ["heels", "heel type", "heel height"],
    description: "Footwear heel structure"
  },
  {
    key: "upperMaterial",
    label: "UPPER MATERIAL",
    required: false,
    aliases: ["upper material", "upper", "shoe upper"],
    description: "Footwear upper material"
  },
  {
    key: "outsole",
    label: "OUTSOLE",
    required: false,
    aliases: ["outsole", "sole", "sole material", "bottom sole"],
    description: "Shoe bottom outsole material"
  },
  {
    key: "imageUrl",
    label: "IMAGE LINK",
    required: false,
    aliases: ["image link", "image url", "image", "image_link", "image_url", "photo", "picture"],
    description: "Primary product image URL or code"
  },
  // Generic Attribute Slots A1..A9
  { key: "a1", label: "ATTRIBUTE 1 (A1)", required: false, aliases: ["a1", "attr 1", "attribute 1", "attribute1", "heels", "heel type"], description: "Dynamic Attribute slot 1" },
  { key: "a2", label: "ATTRIBUTE 2 (A2)", required: false, aliases: ["a2", "attr 2", "attribute 2", "attribute2", "upper", "upper material", "shoe upper"], description: "Dynamic Attribute slot 2" },
  { key: "a3", label: "ATTRIBUTE 3 (A3)", required: false, aliases: ["a3", "attr 3", "attribute 3", "attribute3", "outsole", "sole", "sole material"], description: "Dynamic Attribute slot 3" },
  { key: "a4", label: "ATTRIBUTE 4 (A4)", required: false, aliases: ["a4", "attr 4", "attribute 4", "attribute4", "gender", "target gender", "section"], description: "Dynamic Attribute slot 4" },
  { key: "a5", label: "ATTRIBUTE 5 (A5)", required: false, aliases: ["a5", "attr 5", "attribute 5", "attribute5", "vendor code", "vendor id", "supplier code"], description: "Dynamic Attribute slot 5" },
  { key: "a6", label: "ATTRIBUTE 6 (A6)", required: false, aliases: ["a6", "attr 6", "attribute 6", "attribute6", "purchase class", "purchase classification"], description: "Dynamic Attribute slot 6" },
  { key: "a7", label: "ATTRIBUTE 7 (A7)", required: false, aliases: ["a7", "attr 7", "attribute 7", "attribute7", "department", "dept", "division"], description: "Dynamic Attribute slot 7" },
  { key: "a8", label: "ATTRIBUTE 8 (A8)", required: false, aliases: ["a8", "attr 8", "attribute 8", "attribute8", "merchandise category", "merchandise cat", "mc category"], description: "Dynamic Attribute slot 8" },
  { key: "a9", label: "ATTRIBUTE 9 (A9)", required: false, aliases: ["a9", "attr 9", "attribute 9", "attribute9", "season", "fit", "pattern", "occasion"], description: "Dynamic Attribute slot 9" }
];

const CUSTOM_ALIASES_STORAGE_KEY = "smriti_header_custom_aliases";
const REMOVED_ALIASES_STORAGE_KEY = "smriti_header_removed_aliases";
let inMemoryCustomAliases: Record<string, string[]> = {};
let inMemoryRemovedAliases: Record<string, string[]> = {};

export function getCustomAliases(): Record<string, string[]> {
  try {
    if (typeof localStorage === "undefined") {
      return inMemoryCustomAliases;
    }
    const raw = localStorage.getItem(CUSTOM_ALIASES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return inMemoryCustomAliases;
  }
}

export function getRemovedAliases(): Record<string, string[]> {
  try {
    if (typeof localStorage === "undefined") {
      return inMemoryRemovedAliases;
    }
    const raw = localStorage.getItem(REMOVED_ALIASES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return inMemoryRemovedAliases;
  }
}

export function addCustomAlias(fieldKey: string, alias: string): void {
  if (!fieldKey || !alias.trim()) return;
  const normalizedNewAlias = normalizeHeader(alias);
  const rawTrimmed = alias.trim();

  // 1. Remove from blacklist if previously deleted
  const removedMap = getRemovedAliases();
  if (removedMap[fieldKey]) {
    removedMap[fieldKey] = removedMap[fieldKey].filter(a => a !== normalizedNewAlias && a !== rawTrimmed.toLowerCase());
    inMemoryRemovedAliases = removedMap;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(REMOVED_ALIASES_STORAGE_KEY, JSON.stringify(removedMap));
      }
    } catch {}
  }

  // 2. Add to custom aliases
  const currentMap = getCustomAliases();
  const existing = currentMap[fieldKey] || [];
  if (!existing.includes(rawTrimmed)) {
    currentMap[fieldKey] = [...existing, rawTrimmed];
    inMemoryCustomAliases = currentMap;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(CUSTOM_ALIASES_STORAGE_KEY, JSON.stringify(currentMap));
      }
    } catch {}
  }
}

export function removeCustomAlias(fieldKey: string, alias: string): void {
  if (!fieldKey || !alias) return;
  const norm = normalizeHeader(alias);
  const raw = alias.trim().toLowerCase();

  // 1. Remove from custom aliases if present
  const currentMap = getCustomAliases();
  const existing = currentMap[fieldKey] || [];
  currentMap[fieldKey] = existing.filter(a => a.trim().toLowerCase() !== raw && normalizeHeader(a) !== norm);
  inMemoryCustomAliases = currentMap;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CUSTOM_ALIASES_STORAGE_KEY, JSON.stringify(currentMap));
    }
  } catch {}

  // 2. Add to removed aliases blacklist so default/built-in aliases are also suppressed
  const removedMap = getRemovedAliases();
  const existingRemoved = removedMap[fieldKey] || [];
  if (!existingRemoved.includes(norm) || !existingRemoved.includes(raw)) {
    removedMap[fieldKey] = Array.from(new Set([...existingRemoved, norm, raw]));
    inMemoryRemovedAliases = removedMap;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(REMOVED_ALIASES_STORAGE_KEY, JSON.stringify(removedMap));
      }
    } catch {}
  }
}

export function clearCustomAliases(): void {
  inMemoryCustomAliases = {};
  inMemoryRemovedAliases = {};
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(CUSTOM_ALIASES_STORAGE_KEY);
      localStorage.removeItem(REMOVED_ALIASES_STORAGE_KEY);
    }
  } catch {}
}

const CUSTOM_LABELS_STORAGE_KEY = "smriti_header_custom_labels";
let inMemoryCustomLabels: Record<string, string> = {};

export function getCustomFieldLabels(): Record<string, string> {
  try {
    if (typeof localStorage === "undefined") return inMemoryCustomLabels;
    const raw = localStorage.getItem(CUSTOM_LABELS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return inMemoryCustomLabels;
  }
}

export function setCustomFieldLabel(fieldKey: string, customLabel: string): void {
  if (!fieldKey) return;
  const currentMap = getCustomFieldLabels();
  if (customLabel.trim()) {
    currentMap[fieldKey] = customLabel.trim();
  } else {
    delete currentMap[fieldKey];
  }
  inMemoryCustomLabels = currentMap;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CUSTOM_LABELS_STORAGE_KEY, JSON.stringify(currentMap));
    }
  } catch {}
}

export function getSmritiItemMasterFields(customAttrs: { key: string; label: string; aliases?: string[] }[] = []): SmritiFieldDefinition[] {
  const customAliasMap = getCustomAliases();
  const removedAliasMap = getRemovedAliases();

  const baseFieldsWithCustomAliases = SMRITI_ITEM_MASTER_FIELDS.map(f => {
    const extraAliases = customAliasMap[f.key] || [];
    const removedForField = (removedAliasMap[f.key] || []).map(r => r.toLowerCase().trim());
    const combined = Array.from(new Set([...f.aliases, ...extraAliases]));
    const filtered = combined.filter(a => !removedForField.includes(a.toLowerCase().trim()) && !removedForField.includes(normalizeHeader(a)));
    return {
      ...f,
      aliases: filtered
    };
  });

  const dynamicFields: SmritiFieldDefinition[] = customAttrs.map(attr => {
    const key = attr.key.startsWith("attr_") ? attr.key : `attr_${attr.key}`;
    const extraAliases = customAliasMap[key] || [];
    const removedForField = (removedAliasMap[key] || []).map(r => r.toLowerCase().trim());
    const combined = Array.from(new Set([attr.label, attr.key, ...(attr.aliases || []), ...extraAliases]));
    const filtered = combined.filter(a => !removedForField.includes(a.toLowerCase().trim()) && !removedForField.includes(normalizeHeader(a)));
    return {
      key,
      label: attr.label.toUpperCase(),
      required: false,
      aliases: filtered,
      description: `Dynamic Item Attribute: ${attr.label}`
    };
  });

  return [...baseFieldsWithCustomAliases, ...dynamicFields];
}

export interface AmbiguousRule {
  normalizedTrigger: string;
  candidateKeys: string[];
  contextDefaults?: Partial<Record<MappingContext, string>>;
}

export const AMBIGUOUS_HEADER_RULES: AmbiguousRule[] = [
  {
    normalizedTrigger: "price",
    candidateKeys: ["price", "mrp", "costPrice"],
    contextDefaults: {
      ITEM_MASTER: "price",
      PURCHASE_ORDER: "costPrice",
      GRN: "costPrice",
      SALES_INVOICE: "price"
    }
  },
  {
    normalizedTrigger: "rate",
    candidateKeys: ["price", "costPrice", "mrp"],
    contextDefaults: {
      ITEM_MASTER: "price",
      PURCHASE_ORDER: "costPrice",
      GRN: "costPrice",
      SALES_INVOICE: "price"
    }
  },
  {
    normalizedTrigger: "qty",
    candidateKeys: ["stock"],
    contextDefaults: {
      ITEM_MASTER: "stock",
      PURCHASE_ORDER: "stock",
      GRN: "stock",
      SALES_INVOICE: "stock"
    }
  }
];

export const SMRITI_CUSTOMER_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "code",
    label: "CUSTOMER CODE",
    required: false,
    aliases: [
      "customer code", "customer_code", "cust_code", "cust code", "customer no",
      "customer number", "customer id", "client code", "client id", "code", "party_code"
    ],
    description: "Unique Customer code identifier"
  },
  {
    key: "name",
    label: "CUSTOMER NAME",
    required: true,
    aliases: [
      "customer name", "customer_name", "client name", "customer", "client",
      "party name", "name", "full name", "party_name"
    ],
    description: "Customer or business trade name"
  },
  {
    key: "mobile",
    label: "MOBILE NUMBER",
    required: false,
    aliases: [
      "mobile", "phone", "contact", "mobile no", "mobile number",
      "phone no", "phone number", "cell", "contact number", "contact no"
    ],
    description: "Customer primary mobile number"
  },
  {
    key: "email",
    label: "EMAIL ADDRESS",
    required: false,
    aliases: ["email", "email id", "email address", "e mail", "mail"],
    description: "Electronic mail contact address"
  },
  {
    key: "gst_number",
    label: "GST NUMBER (GSTIN)",
    required: false,
    aliases: ["gst_number", "gstin", "gst no", "gst number", "gst", "tin"],
    description: "Statutory 15-character Goods and Services Tax Identification Number"
  },
  {
    key: "pan_number",
    label: "PAN NUMBER",
    required: false,
    aliases: ["pan", "pan no", "pan number", "pan_number", "pan card"],
    description: "10-character Permanent Account Number"
  },
  {
    key: "customer_type",
    label: "CUSTOMER TYPE",
    required: false,
    aliases: ["customer_type", "type", "customer type", "party type", "segment"],
    description: "Customer classification category (RETAIL, WHOLESALE, CORPORATE)"
  },
  {
    key: "pricing_basis",
    label: "PRICING BASIS",
    required: false,
    aliases: ["pricing_basis", "pricing basis", "price basis"],
    description: "Pricing schedule policy (MRP or RATE)"
  }
];

export const SMRITI_SUPPLIER_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "code",
    label: "SUPPLIER CODE",
    required: true,
    aliases: [
      "supplier code", "supplier_code", "vendor_code", "vendor code", "vendor no",
      "vendor id", "supplier no", "supplier id", "code", "supp_code", "party_code"
    ],
    description: "Unique Supplier or Vendor code identifier"
  },
  {
    key: "name",
    label: "SUPPLIER NAME",
    required: true,
    aliases: [
      "supplier name", "supplier_name", "vendor_name", "vendor name", "supplier",
      "vendor", "party_name", "name", "company_name"
    ],
    description: "Supplier entity legal or trade name"
  },
  {
    key: "mobile",
    label: "MOBILE NUMBER",
    required: false,
    aliases: [
      "mobile", "phone", "contact", "mobile no", "mobile number",
      "phone no", "phone number", "cell", "contact number"
    ],
    description: "Supplier primary contact telephone / mobile"
  },
  {
    key: "email",
    label: "EMAIL ADDRESS",
    required: false,
    aliases: ["email", "email id", "email address", "e mail", "mail"],
    description: "Supplier contact email address"
  },
  {
    key: "gst_number",
    label: "GST NUMBER (GSTIN)",
    required: false,
    aliases: ["gst_number", "gstin", "gst no", "gst number", "gst", "tin"],
    description: "Statutory 15-character Goods and Services Tax Identification Number"
  },
  {
    key: "address",
    label: "ADDRESS",
    required: false,
    aliases: ["address", "street", "street address", "address line 1", "addr"],
    description: "Registered office or dispatch physical address"
  },
  {
    key: "city",
    label: "CITY",
    required: false,
    aliases: ["city", "town", "district"],
    description: "City or municipality location"
  },
  {
    key: "state",
    label: "STATE",
    required: false,
    aliases: ["state", "province"],
    description: "State or territorial jurisdiction"
  },
  {
    key: "pincode",
    label: "PINCODE",
    required: false,
    aliases: ["pincode", "pin code", "postal code", "zip", "zip code"],
    description: "6-digit postal index number"
  }
];

export const SMRITI_PURCHASE_ORDER_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "order_no",
    label: "PO NUMBER",
    required: true,
    aliases: [
      "order_no", "order no", "po_no", "po no", "po_number", "po number",
      "purchase_order_no", "purchase order no", "purchase_order_number", "order_number", "order id"
    ],
    description: "Unique Purchase Order document reference"
  },
  {
    key: "supplier_name",
    label: "SUPPLIER / VENDOR",
    required: true,
    aliases: [
      "supplier_name", "supplier name", "supplier", "vendor", "vendor_name",
      "vendor name", "party_name", "supp_name", "supplier_code", "vendor_code"
    ],
    description: "Vendor or supplier legal trade name / code"
  },
  {
    key: "item_code",
    label: "ITEM CODE / SKU",
    required: true,
    aliases: [
      "item_code", "item code", "product_code", "product code", "sku",
      "sku_code", "article_code", "barcode", "code"
    ],
    description: "Purchased item SKU or style code"
  },
  {
    key: "item_name",
    label: "ITEM NAME",
    required: false,
    aliases: [
      "item_name", "item name", "product_name", "product name", "item", "product", "description"
    ],
    description: "Item name description"
  },
  {
    key: "quantity",
    label: "QUANTITY",
    required: true,
    aliases: [
      "quantity", "qty", "ordered_qty", "order_qty", "units", "count"
    ],
    description: "Quantity ordered"
  },
  {
    key: "cost_price",
    label: "UNIT COST PRICE",
    required: true,
    aliases: [
      "cost_price", "cost price", "rate", "cost", "unit_cost", "purchase_rate",
      "purchase_price", "price", "unit_price", "buying_price"
    ],
    description: "Agreed procurement unit rate"
  },
  {
    key: "gst_rate",
    label: "GST RATE %",
    required: false,
    aliases: [
      "gst_rate", "tax_rate", "gst %", "tax %", "gst", "tax"
    ],
    description: "Applicable Goods and Services Tax percentage"
  },
  {
    key: "notes",
    label: "NOTES / REMARKS",
    required: false,
    aliases: [
      "notes", "remarks", "narration", "comment", "description"
    ],
    description: "Commercial notes or instructions"
  }
];

export const SMRITI_GRN_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "receipt_no",
    label: "GRN NUMBER",
    required: true,
    aliases: [
      "receipt_no", "receipt no", "grn_no", "grn no", "grn_number", "grn number",
      "receipt_number", "grn", "challan_no", "inward_no"
    ],
    description: "Goods Receipt Note reference number"
  },
  {
    key: "supplier_name",
    label: "SUPPLIER / VENDOR",
    required: true,
    aliases: [
      "supplier_name", "supplier name", "supplier", "vendor", "vendor_name",
      "party_name", "supplier_code", "vendor_code"
    ],
    description: "Supplier entity reference"
  },
  {
    key: "order_no",
    label: "PO REFERENCE",
    required: false,
    aliases: [
      "order_no", "po_no", "po_number", "purchase_order_no", "order_number"
    ],
    description: "Preceding purchase order reference"
  },
  {
    key: "item_code",
    label: "ITEM CODE / SKU",
    required: true,
    aliases: [
      "item_code", "item code", "product_code", "product code", "sku", "code"
    ],
    description: "Inwarded SKU / Product code"
  },
  {
    key: "quantity_received",
    label: "RECEIVED QUANTITY",
    required: true,
    aliases: [
      "quantity_received", "received_qty", "qty_received", "quantity", "qty", "inward_qty"
    ],
    description: "Physically received stock count"
  },
  {
    key: "cost_price",
    label: "UNIT COST PRICE",
    required: false,
    aliases: [
      "cost_price", "cost price", "rate", "cost", "unit_cost", "purchase_rate"
    ],
    description: "Unit landed procurement rate"
  },
  {
    key: "batch_no",
    label: "BATCH NUMBER",
    required: false,
    aliases: [
      "batch_no", "batch no", "batch", "lot_no", "lot"
    ],
    description: "Manufacturer batch or lot identifier"
  }
];

export const SMRITI_PURCHASE_INVOICE_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "bill_no",
    label: "BILL / INVOICE NUMBER",
    required: true,
    aliases: [
      "bill_no", "bill no", "invoice_no", "invoice no", "bill_number",
      "invoice_number", "purchase_invoice_no", "vendor_invoice_no"
    ],
    description: "Supplier commercial invoice number"
  },
  {
    key: "supplier_name",
    label: "SUPPLIER / VENDOR",
    required: true,
    aliases: [
      "supplier_name", "supplier name", "supplier", "vendor", "vendor_name", "supplier_code"
    ],
    description: "Billed vendor entity"
  },
  {
    key: "taxable_amount",
    label: "TAXABLE AMOUNT",
    required: false,
    aliases: [
      "taxable_amount", "taxable_value", "subtotal", "sub_total"
    ],
    description: "Assessable pre-tax invoice amount"
  },
  {
    key: "tax_amount",
    label: "TAX AMOUNT",
    required: false,
    aliases: [
      "tax_amount", "tax", "gst_amount", "total_tax"
    ],
    description: "Statutory tax amount"
  },
  {
    key: "total_amount",
    label: "TOTAL AMOUNT",
    required: true,
    aliases: [
      "total_amount", "grand_total", "total", "net_amount", "bill_amount", "invoice_amount"
    ],
    description: "Final invoice payable amount"
  }
];

export const SMRITI_PURCHASE_DEBIT_NOTE_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "debit_note_no",
    label: "DEBIT NOTE NUMBER",
    required: true,
    aliases: [
      "debit_note_no", "debit note no", "dn_no", "debit_note_number", "return_no"
    ],
    description: "Supplier debit note document number"
  },
  {
    key: "supplier_name",
    label: "SUPPLIER / VENDOR",
    required: true,
    aliases: [
      "supplier_name", "supplier name", "supplier", "vendor", "vendor_name"
    ],
    description: "Vendor entity subject to debit note"
  },
  {
    key: "total_debit_amount",
    label: "TOTAL DEBIT AMOUNT",
    required: true,
    aliases: [
      "total_debit_amount", "total_amount", "net_debit", "total", "debit_amount", "claim_amount"
    ],
    description: "Total debit liability reversal amount"
  },
  {
    key: "reason",
    label: "REASON / REMARKS",
    required: false,
    aliases: [
      "reason", "remarks", "notes", "narration"
    ],
    description: "Commercial return or rate correction reason"
  }
];

export const SMRITI_SALES_INVOICE_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "invoice_no",
    label: "INVOICE NUMBER",
    required: true,
    aliases: [
      "invoice_no", "invoice no", "inv_no", "inv no", "invoice_number", "invoice number",
      "bill_no", "bill no", "bill_number", "bill number", "tax_invoice_no"
    ],
    description: "Statutory tax invoice number"
  },
  {
    key: "customer_name",
    label: "CUSTOMER NAME",
    required: false,
    aliases: [
      "customer_name", "customer name", "customer", "client", "client_name", "party_name", "buyer_name", "name"
    ],
    description: "Billed customer name"
  },
  {
    key: "customer_gstin",
    label: "CUSTOMER GSTIN",
    required: false,
    aliases: [
      "customer_gstin", "gstin", "gst_no", "gst_number", "buyer_gstin", "party_gstin"
    ],
    description: "Customer statutory GSTIN"
  },
  {
    key: "item_code",
    label: "ITEM CODE / SKU",
    required: true,
    aliases: [
      "item_code", "item code", "product_code", "product code", "sku", "sku_code", "barcode", "code"
    ],
    description: "Billed item SKU or code"
  },
  {
    key: "quantity",
    label: "QUANTITY",
    required: true,
    aliases: [
      "quantity", "qty", "billed_qty", "units", "count"
    ],
    description: "Billed quantity"
  },
  {
    key: "price",
    label: "UNIT RATE / PRICE",
    required: true,
    aliases: [
      "price", "rate", "unit_price", "selling_price", "sale_rate", "selling_rate"
    ],
    description: "Unit selling rate"
  },
  {
    key: "gst_rate",
    label: "GST RATE %",
    required: false,
    aliases: [
      "gst_rate", "tax_rate", "gst %", "tax %", "gst", "tax"
    ],
    description: "GST tax rate percentage"
  },
  {
    key: "total_amount",
    label: "LINE TOTAL AMOUNT",
    required: false,
    aliases: [
      "total_amount", "line_total", "net_amount", "total", "item_total"
    ],
    description: "Total invoice line amount"
  }
];

export const SMRITI_SALES_ORDER_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "order_no",
    label: "ORDER NUMBER",
    required: true,
    aliases: [
      "order_no", "order no", "so_no", "so no", "so_number", "so number",
      "sales_order_no", "sales order no", "sales_order_number", "order_number", "order id"
    ],
    description: "Sales Order document number"
  },
  {
    key: "customer_name",
    label: "CUSTOMER NAME",
    required: false,
    aliases: [
      "customer_name", "customer name", "customer", "client", "client_name", "party_name", "name"
    ],
    description: "Customer entity name"
  },
  {
    key: "item_code",
    label: "ITEM CODE / SKU",
    required: true,
    aliases: [
      "item_code", "item code", "product_code", "product code", "sku", "sku_code", "barcode", "code"
    ],
    description: "Ordered item SKU or code"
  },
  {
    key: "quantity",
    label: "QUANTITY",
    required: true,
    aliases: [
      "quantity", "qty", "ordered_qty", "units", "count"
    ],
    description: "Ordered quantity"
  },
  {
    key: "price",
    label: "UNIT PRICE",
    required: true,
    aliases: [
      "price", "rate", "unit_price", "selling_price", "sale_rate"
    ],
    description: "Agreed selling price"
  },
  {
    key: "gst_rate",
    label: "GST RATE %",
    required: false,
    aliases: [
      "gst_rate", "tax_rate", "gst %", "tax %", "gst", "tax"
    ],
    description: "Applicable GST tax rate"
  }
];

export const SMRITI_SALES_RETURN_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "return_no",
    label: "RETURN NUMBER",
    required: true,
    aliases: [
      "return_no", "return no", "sr_no", "sr no", "return_number", "return number",
      "credit_note_no", "credit note no", "credit_note_number", "cn_no"
    ],
    description: "Sales return document number"
  },
  {
    key: "original_invoice_no",
    label: "ORIGINAL INVOICE NUMBER",
    required: false,
    aliases: [
      "original_invoice_no", "invoice_no", "invoice no", "orig_invoice_no", "inv_no", "bill_no"
    ],
    description: "Original sales invoice reference"
  },
  {
    key: "item_code",
    label: "ITEM CODE / SKU",
    required: true,
    aliases: [
      "item_code", "item code", "product_code", "product code", "sku", "sku_code", "barcode", "code"
    ],
    description: "Returned item SKU or code"
  },
  {
    key: "quantity",
    label: "RETURNED QUANTITY",
    required: true,
    aliases: [
      "quantity", "qty", "returned_qty", "units", "count"
    ],
    description: "Quantity returned"
  },
  {
    key: "price",
    label: "UNIT REFUND PRICE",
    required: true,
    aliases: [
      "price", "rate", "unit_price", "selling_price", "return_rate"
    ],
    description: "Unit refund rate"
  },
  {
    key: "reason",
    label: "RETURN REASON",
    required: false,
    aliases: [
      "reason", "remarks", "notes", "narration", "comment"
    ],
    description: "Reason for return or credit note"
  }
];

export const SMRITI_STOCK_TRANSFER_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "transfer_no",
    label: "TRANSFER NUMBER",
    required: true,
    aliases: [
      "transfer_no", "transfer no", "sto_no", "sto no", "transfer_number", "transfer number", "document_no", "doc_no"
    ],
    description: "Stock transfer order document reference"
  },
  {
    key: "source_warehouse",
    label: "SOURCE WAREHOUSE",
    required: true,
    aliases: [
      "source_warehouse", "source warehouse", "source_warehouse_code", "from_warehouse", "from warehouse", "source_godown", "from_godown", "source_location"
    ],
    description: "Originating warehouse code or name"
  },
  {
    key: "dest_warehouse",
    label: "DESTINATION WAREHOUSE",
    required: true,
    aliases: [
      "dest_warehouse", "dest warehouse", "dest_warehouse_code", "to_warehouse", "to warehouse", "destination_warehouse", "dest_godown", "to_godown", "dest_location"
    ],
    description: "Destination warehouse code or name"
  },
  {
    key: "item_code",
    label: "ITEM CODE / SKU",
    required: true,
    aliases: [
      "item_code", "item code", "product_code", "product code", "sku", "barcode", "code"
    ],
    description: "Transferred item SKU or barcode"
  },
  {
    key: "item_name",
    label: "ITEM NAME",
    required: false,
    aliases: [
      "item_name", "item name", "product_name", "product", "description"
    ],
    description: "Transferred item description"
  },
  {
    key: "batch_no",
    label: "BATCH NUMBER",
    required: false,
    aliases: [
      "batch_no", "batch no", "batch", "lot_no", "lot"
    ],
    description: "Specific inventory lot or batch number"
  },
  {
    key: "quantity",
    label: "QUANTITY DISPATCHED",
    required: true,
    aliases: [
      "quantity", "qty", "quantity_dispatched", "dispatched_qty", "units", "count"
    ],
    description: "Dispatched transfer quantity"
  },
  {
    key: "unit_cost",
    label: "UNIT COST PRICE",
    required: false,
    aliases: [
      "unit_cost", "unit cost", "cost_price", "rate", "cost", "price"
    ],
    description: "Unit inventory cost for transfer valuation"
  },
  {
    key: "status",
    label: "TRANSFER STATUS",
    required: false,
    aliases: [
      "status", "transfer_status", "state"
    ],
    description: "Transfer workflow state (DRAFT, DISPATCHED, RECEIVED)"
  },
  {
    key: "transporter_name",
    label: "TRANSPORTER / CARRIER",
    required: false,
    aliases: [
      "transporter_name", "transporter", "carrier", "transport_company"
    ],
    description: "Logistics freight provider"
  },
  {
    key: "lr_number",
    label: "LR / TRACKING NUMBER",
    required: false,
    aliases: [
      "lr_number", "lr no", "lr_no", "consignment_no", "tracking_no", "docket_no"
    ],
    description: "Lorry receipt or shipment tracking number"
  },
  {
    key: "vehicle_number",
    label: "VEHICLE NUMBER",
    required: false,
    aliases: [
      "vehicle_number", "vehicle no", "truck_no", "vehicle_id"
    ],
    description: "Transport motor vehicle registration number"
  },
  {
    key: "e_way_bill_no",
    label: "E-WAY BILL NUMBER",
    required: false,
    aliases: [
      "e_way_bill_no", "eway_bill_no", "eway_bill", "ewaybill", "ewb_no"
    ],
    description: "Statutory GST e-way bill number"
  },
  {
    key: "notes",
    label: "NOTES / REMARKS",
    required: false,
    aliases: [
      "notes", "remarks", "narration", "comment"
    ],
    description: "Operational shipment notes"
  }
];

export const SMRITI_STOCK_AUDIT_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "audit_no",
    label: "AUDIT NUMBER",
    required: true,
    aliases: [
      "audit_no", "audit no", "count_no", "count no", "adjustment_no", "audit_number", "document_no", "doc_no"
    ],
    description: "Physical audit or cycle count reference number"
  },
  {
    key: "warehouse",
    label: "WAREHOUSE",
    required: true,
    aliases: [
      "warehouse", "warehouse_code", "warehouse_name", "godown", "location", "store"
    ],
    description: "Audited warehouse facility code or name"
  },
  {
    key: "item_code",
    label: "ITEM CODE / SKU",
    required: true,
    aliases: [
      "item_code", "item code", "product_code", "product code", "sku", "barcode", "code"
    ],
    description: "Audited product SKU or barcode"
  },
  {
    key: "item_name",
    label: "ITEM NAME",
    required: false,
    aliases: [
      "item_name", "item name", "product_name", "product", "description"
    ],
    description: "Product description"
  },
  {
    key: "batch_no",
    label: "BATCH NUMBER",
    required: false,
    aliases: [
      "batch_no", "batch no", "batch", "lot_no", "lot"
    ],
    description: "Counted inventory batch reference"
  },
  {
    key: "system_qty",
    label: "SYSTEM / BOOK QUANTITY",
    required: false,
    aliases: [
      "system_qty", "system qty", "book_qty", "book stock", "current_stock", "expected_qty"
    ],
    description: "Book stock quantity prior to audit"
  },
  {
    key: "counted_qty",
    label: "PHYSICAL COUNTED QUANTITY",
    required: true,
    aliases: [
      "counted_qty", "counted qty", "physical_qty", "actual_qty", "physical stock", "counted"
    ],
    description: "Actual physical stock counted on site"
  },
  {
    key: "unit_cost",
    label: "UNIT COST",
    required: false,
    aliases: [
      "unit_cost", "unit cost", "cost_price", "rate", "cost"
    ],
    description: "Unit inventory valuation cost"
  },
  {
    key: "discrepancy_reason",
    label: "DISCREPANCY REASON",
    required: false,
    aliases: [
      "discrepancy_reason", "reason", "discrepancy", "variance_reason", "cause"
    ],
    description: "Variance classification (DAMAGED, EXPIRED, THEFT_LOSS, SURPLUS_FOUND, COUNTING_ERROR)"
  },
  {
    key: "audit_type",
    label: "AUDIT TYPE",
    required: false,
    aliases: [
      "audit_type", "type", "count_type"
    ],
    description: "Audit classification (CYCLE_COUNT, FULL, SPOT_CHECK)"
  },
  {
    key: "status",
    label: "AUDIT STATUS",
    required: false,
    aliases: [
      "status", "audit_status"
    ],
    description: "Workflow state (DRAFT, IN_PROGRESS, COMPLETED)"
  },
  {
    key: "notes",
    label: "AUDIT NOTES",
    required: false,
    aliases: [
      "notes", "remarks", "narration", "comment"
    ],
    description: "Stock auditor notes and reconciliation details"
  }
];



