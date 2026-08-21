/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.1
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { AttributeDefinition } from "../types.ts";
import { SmritiFieldDefinition } from "../lib/headerMapping/types.ts";
import { ItemMasterFieldDefinition } from "../components/itemMaster/types.ts";

export type FieldSource = "core" | "dynamic";

export interface UnifiedItemField {
  id: string;
  key: string;
  label: string;
  datatype: "text" | "number" | "select" | "currency" | "date";
  required: boolean;
  defaultValue?: string | number;
  validValues?: string[];
  aliases: string[];
  groupId?: string;
  active: boolean;
  displayOrder: number;
  source: FieldSource;
  width?: string;
  align?: "left" | "right" | "center";
  attributeId?: string;
}

/**
 * Authoritative Core Standard Retail Fields Definition
 */
export const CORE_STANDARD_ITEM_FIELDS: UnifiedItemField[] = [
  {
    id: "stockNo",
    key: "code",
    label: "Stock No / SKU",
    datatype: "text",
    required: true,
    aliases: ["stock no", "sku", "sku code", "item code", "item no", "product code", "style code", "article no"],
    active: true,
    displayOrder: 1,
    source: "core",
    width: "120px"
  },
  {
    id: "barcode",
    key: "barcode",
    label: "Barcode",
    datatype: "text",
    required: true,
    aliases: ["barcode", "ean", "ean code", "ean13", "upc", "upc code", "barcode no"],
    active: true,
    displayOrder: 2,
    source: "core",
    width: "140px"
  },
  {
    id: "product",
    key: "name",
    label: "Product Name",
    datatype: "text",
    required: true,
    aliases: ["product", "item name", "product name", "item description", "description", "title"],
    active: true,
    displayOrder: 3,
    source: "core",
    width: "160px"
  },
  {
    id: "brand",
    key: "brand",
    label: "Brand",
    datatype: "text",
    required: false,
    aliases: ["brand", "brand name", "manufacturer", "make", "label"],
    active: true,
    displayOrder: 4,
    source: "core",
    width: "120px"
  },
  {
    id: "category",
    key: "category",
    label: "Category",
    datatype: "text",
    required: true,
    aliases: ["category", "category name", "product category", "department", "merchandise category", "group"],
    active: true,
    displayOrder: 5,
    source: "core",
    width: "130px"
  },
  {
    id: "subCategory",
    key: "subCategory",
    label: "Sub-Category",
    datatype: "text",
    required: false,
    aliases: ["sub category", "subcategory", "sub-category", "segment"],
    active: true,
    displayOrder: 6,
    source: "core",
    width: "130px"
  },
  {
    id: "size",
    key: "size",
    label: "Size",
    datatype: "text",
    required: false,
    aliases: ["size", "product size", "item size", "dimension"],
    active: true,
    displayOrder: 7,
    source: "core",
    width: "90px"
  },
  {
    id: "shade",
    key: "colour",
    label: "Color / Shade",
    datatype: "text",
    required: false,
    aliases: ["color", "colour", "shade", "colorway", "color name"],
    active: true,
    displayOrder: 8,
    source: "core",
    width: "110px"
  },
  {
    id: "mrp",
    key: "mrp",
    label: "MRP",
    datatype: "currency",
    required: true,
    aliases: ["mrp", "maximum retail price", "retail price", "list price"],
    active: true,
    displayOrder: 9,
    source: "core",
    align: "right",
    width: "110px"
  },
  {
    id: "sellingPrice",
    key: "price",
    label: "Selling Price",
    datatype: "currency",
    required: false,
    aliases: ["selling price", "price", "sale price", "rate", "offer price"],
    active: true,
    displayOrder: 10,
    source: "core",
    align: "right",
    width: "110px"
  },
  {
    id: "costPrice",
    key: "cost_price",
    label: "Cost Price",
    datatype: "currency",
    required: false,
    aliases: ["cost price", "cost", "purchase rate", "landing cost", "buy price"],
    active: true,
    displayOrder: 11,
    source: "core",
    align: "right",
    width: "110px"
  },
  {
    id: "productTax",
    key: "gst_percentage",
    label: "GST Rate (%)",
    datatype: "select",
    required: false,
    validValues: ["STD_18", "GST_12", "GST_5", "EXEMPT", "18", "12", "5", "0"],
    aliases: ["gst", "gst %", "tax rate", "gst percentage", "tax %", "vat"],
    active: true,
    displayOrder: 12,
    source: "core",
    width: "110px"
  },
  {
    id: "hsnCode",
    key: "hsn_code",
    label: "HSN Code",
    datatype: "text",
    required: false,
    aliases: ["hsn", "hsn code", "hsn no", "hsn/sac", "sac"],
    active: true,
    displayOrder: 13,
    source: "core",
    width: "110px"
  },
  {
    id: "uom",
    key: "uom",
    label: "UOM",
    datatype: "select",
    required: false,
    validValues: ["Pcs", "Pair", "Box", "Set", "Kg", "Mtr"],
    aliases: ["uom", "unit", "unit of measure", "measure"],
    active: true,
    displayOrder: 14,
    source: "core",
    width: "90px"
  },
  {
    id: "style",
    key: "style_code",
    label: "Style Code",
    datatype: "text",
    required: false,
    aliases: ["style", "style code", "design no", "model"],
    active: true,
    displayOrder: 15,
    source: "core",
    width: "120px"
  },
  {
    id: "itemDescription",
    key: "itemDescription",
    label: "Item Description",
    datatype: "text",
    required: false,
    aliases: ["item description", "description", "details"],
    active: true,
    displayOrder: 16,
    source: "core",
    width: "200px"
  },
  // Generic Dynamic Attribute Slots (A1..A9) configurable via Attribute Management
  { id: "attr_a1", key: "a1", label: "Attribute 1 (A1)", datatype: "text", required: false, aliases: ["a1", "attr 1", "attribute 1", "attribute1", "heels", "heel type"], active: true, displayOrder: 17, source: "core", width: "120px" },
  { id: "attr_a2", key: "a2", label: "Attribute 2 (A2)", datatype: "text", required: false, aliases: ["a2", "attr 2", "attribute 2", "attribute2", "upper", "upper material", "shoe upper"], active: true, displayOrder: 18, source: "core", width: "120px" },
  { id: "attr_a3", key: "a3", label: "Attribute 3 (A3)", datatype: "text", required: false, aliases: ["a3", "attr 3", "attribute 3", "attribute3", "outsole", "sole", "sole material"], active: true, displayOrder: 19, source: "core", width: "120px" },
  { id: "attr_a4", key: "a4", label: "Attribute 4 (A4)", datatype: "text", required: false, aliases: ["a4", "attr 4", "attribute 4", "attribute4", "gender", "target gender", "section"], active: true, displayOrder: 20, source: "core", width: "120px" },
  { id: "attr_a5", key: "a5", label: "Attribute 5 (A5)", datatype: "text", required: false, aliases: ["a5", "attr 5", "attribute 5", "attribute5", "vendor code", "vendor id", "supplier code"], active: true, displayOrder: 21, source: "core", width: "120px" },
  { id: "attr_a6", key: "a6", label: "Attribute 6 (A6)", datatype: "text", required: false, aliases: ["a6", "attr 6", "attribute 6", "attribute6", "purchase class", "purchase classification"], active: true, displayOrder: 22, source: "core", width: "120px" },
  { id: "attr_a7", key: "a7", label: "Attribute 7 (A7)", datatype: "text", required: false, aliases: ["a7", "attr 7", "attribute 7", "attribute7", "department", "dept", "division"], active: true, displayOrder: 23, source: "core", width: "120px" },
  { id: "attr_a8", key: "a8", label: "Attribute 8 (A8)", datatype: "text", required: false, aliases: ["a8", "attr 8", "attribute 8", "attribute8", "merchandise category", "merchandise cat", "mc category"], active: true, displayOrder: 24, source: "core", width: "120px" },
  { id: "attr_a9", key: "a9", label: "Attribute 9 (A9)", datatype: "text", required: false, aliases: ["a9", "attr 9", "attribute 9", "attribute9", "season", "fit", "pattern", "occasion"], active: true, displayOrder: 25, source: "core", width: "120px" }
];

/**
 * Resolves the complete unified item field catalog by merging Core Standard Fields
 * with active backend Dynamic Attribute Definitions.
 * Deactivated attributes (isEnabled: false) are filtered out automatically.
 */
export function resolveItemMasterCatalog(
  dynamicDefinitions: AttributeDefinition[] = []
): UnifiedItemField[] {
  const catalog: UnifiedItemField[] = [...CORE_STANDARD_ITEM_FIELDS];
  const existingKeySet = new Set(catalog.map(f => f.key.toLowerCase()));
  const existingIdSet = new Set(catalog.map(f => f.id.toLowerCase()));

  // Active dynamic attributes
  const activeDefinitions = dynamicDefinitions.filter(
    d => (d as any).isEnabled !== false && (d as any).is_enabled !== false
  );

  activeDefinitions.forEach((def, index) => {
    const cleanKey = def.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const fieldId = `dyn_attr_${cleanKey}`;

    // Deduplicate against core fields
    if (existingKeySet.has(cleanKey) || existingIdSet.has(cleanKey)) {
      return;
    }

    let datatype: UnifiedItemField["datatype"] = "text";
    if (def.dataType === "number") datatype = "number";
    else if (def.dataType === "select" || (def.validValues && def.validValues.length > 0)) datatype = "select";
    else if (def.dataType === "date") datatype = "date";

    const dynamicField: UnifiedItemField = {
      id: fieldId,
      key: cleanKey,
      label: def.label || def.name,
      datatype,
      required: Boolean(def.isMandatory),
      validValues: def.validValues || [],
      aliases: Array.from(new Set([
        def.label,
        def.name,
        cleanKey,
        def.label.toLowerCase(),
        def.name.toLowerCase()
      ])),
      active: true,
      displayOrder: (def as any).displayOrder ?? (100 + index),
      source: "dynamic",
      width: "130px",
      attributeId: def.id
    };

    catalog.push(dynamicField);
    existingKeySet.add(cleanKey);
    existingIdSet.add(fieldId);
  });

  return catalog;
}

/**
 * Converts the unified field catalog into ItemMasterFieldDefinitions for ItemMasterEntryView
 */
export function getUnifiedItemMasterFields(
  dynamicDefinitions: AttributeDefinition[] = []
): ItemMasterFieldDefinition[] {
  const catalog = resolveItemMasterCatalog(dynamicDefinitions);

  return catalog.map(f => ({
    id: f.id,
    key: f.key,
    label: f.label,
    isMandatory: f.required,
    type: f.datatype,
    options: f.validValues,
    width: f.width || "120px",
    align: f.align,
    aliases: f.aliases,
    isDynamic: f.source === "dynamic",
    attributeId: f.attributeId
  }));
}

/**
 * Converts the unified field catalog into SmritiFieldDefinitions for HeaderMappingEngine
 */
export function getUnifiedHeaderMappingFields(
  dynamicDefinitions: AttributeDefinition[] = []
): SmritiFieldDefinition[] {
  const catalog = resolveItemMasterCatalog(dynamicDefinitions);

  return catalog.map(f => ({
    key: f.source === "dynamic" ? `attr_${f.key}` : f.key,
    label: f.label.toUpperCase(),
    required: f.required,
    aliases: f.aliases,
    description: f.source === "dynamic" ? `Dynamic Item Attribute: ${f.label}` : `Standard Field: ${f.label}`
  }));
}

/**
 * Serializes item attributes into canonical JSON structure for Product.attributes
 */
export function serializeProductAttributes(
  itemData: Record<string, any>,
  dynamicDefinitions: AttributeDefinition[] = []
): Record<string, any> {
  const activeDefinitions = dynamicDefinitions.filter(
    d => (d as any).isEnabled !== false && (d as any).is_enabled !== false
  );

  const attributesPayload: Record<string, any> = {
    ...(itemData.customFields || {}),
    ...(itemData.attributes || {})
  };

  // Extract canonical keys for dynamic attributes
  activeDefinitions.forEach(def => {
    const cleanKey = def.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const dynId = `dyn_attr_${cleanKey}`;

    const rawVal = 
      itemData[cleanKey] ?? 
      itemData[dynId] ?? 
      itemData[def.name] ?? 
      itemData[def.label] ??
      itemData.customFields?.[cleanKey] ?? 
      itemData.customFields?.[dynId] ??
      itemData.attributes?.[cleanKey] ??
      itemData.attributes?.[def.name];

    if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== "") {
      attributesPayload[cleanKey] = String(rawVal).trim();
    }
  });

  // Standard inherited attributes
  if (itemData.brand) attributesPayload.brand = String(itemData.brand).trim();
  if (itemData.category) attributesPayload.category = String(itemData.category).trim();
  if (itemData.subCategory) attributesPayload.subCategory = String(itemData.subCategory).trim();
  if (itemData.size) attributesPayload.size = String(itemData.size).trim();
  if (itemData.colour || itemData.shade || itemData.color) {
    attributesPayload.color = String(itemData.colour || itemData.shade || itemData.color).trim();
  }
  if (itemData.uom) attributesPayload.uom = String(itemData.uom).trim();

  return attributesPayload;
}
