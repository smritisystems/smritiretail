/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { AttributeDefinition } from "../../types.ts";
export { serializeProductAttributes, resolveItemMasterCatalog, CORE_STANDARD_ITEM_FIELDS } from "../../services/unifiedFieldCatalog.ts";
export type { UnifiedItemField } from "../../services/unifiedFieldCatalog.ts";

export interface ItemMasterFieldDefinition {
  id: string;
  key: string;
  label: string;
  isMandatory: boolean;
  type: "text" | "number" | "select" | "currency" | "date";
  defaultValue?: string | number;
  width?: string;
  align?: "left" | "right" | "center";
  options?: string[];
  aliases?: string[];
  isDynamic?: boolean;
  attributeId?: string;
}

export interface ItemMasterCommonFieldValues {
  brand: string;
  category: string;
  subCategory: string;
  taxRate: string;
  supplier: string;
  season: string;
  status: "active" | "inactive";
  department: string;
  merchandiseCategory: string;
}

export interface ItemMasterGridRow {
  id: string;
  stockNo: string;
  barcode: string;
  product: string;
  brand: string;
  style: string;
  shade: string;
  size: string;
  itemDescription: string;
  mrp: string;
  sellingPrice: string;
  dealerPrice: string;
  costPrice: string;
  productTax: string;
  hsnCode: string;
  uom: string;
  customFields?: Record<string, string>;
  attributes?: Record<string, string>;
  isNewRow?: boolean;
  [key: string]: any;
}

export type ItemMasterActiveSubTab = "view" | "details";

export const DEFAULT_MANDATORY_FIELDS: ItemMasterFieldDefinition[] = [
  { id: "stockNo", key: "stockNo", label: "Stock No", isMandatory: true, type: "text", width: "120px" },
  { id: "product", key: "product", label: "Product", isMandatory: true, type: "text", width: "160px" },
  { id: "mrp", key: "mrp", label: "MRP", isMandatory: true, type: "currency", align: "right", width: "110px" },
];

export const ALL_AVAILABLE_ITEM_FIELDS: ItemMasterFieldDefinition[] = [
  // Mandatory core fields
  ...DEFAULT_MANDATORY_FIELDS,
  // Standard retail attributes
  { id: "barcode", key: "barcode", label: "Barcode", isMandatory: false, type: "text", width: "140px", aliases: ["UPC", "EAN", "Barcode No"] },
  { id: "brand", key: "brand", label: "Brand", isMandatory: false, type: "text", width: "120px", aliases: ["Manufacturer", "Brand Name"] },
  { id: "style", key: "style", label: "Style", isMandatory: false, type: "text", width: "120px", aliases: ["Style Code", "Model"] },
  { id: "shade", key: "shade", label: "Shade", isMandatory: false, type: "text", width: "110px", aliases: ["Color", "Colour", "Colorway"] },
  { id: "size", key: "size", label: "Size", isMandatory: false, type: "text", width: "90px", aliases: ["Product Size", "Dimension"] },
  { id: "itemDescription", key: "itemDescription", label: "Item Description", isMandatory: false, type: "text", width: "200px", aliases: ["Description", "Detail"] },
  { id: "sellingPrice", key: "sellingPrice", label: "Selling Price", isMandatory: false, type: "currency", align: "right", width: "110px", aliases: ["Price", "Sale Price"] },
  { id: "dealerPrice", key: "dealerPrice", label: "Dealer Price", isMandatory: false, type: "currency", align: "right", width: "110px", aliases: ["Wholesale Price", "Trade Price"] },
  { id: "costPrice", key: "costPrice", label: "Cost Price", isMandatory: false, type: "currency", align: "right", width: "110px", aliases: ["Purchase Rate", "Landing Cost"] },
  { id: "productTax", key: "productTax", label: "Product Tax", isMandatory: false, type: "select", width: "110px", options: ["STD_18", "GST_12", "GST_5", "EXEMPT"], aliases: ["GST %", "Tax Rate"] },
  { id: "hsnCode", key: "hsnCode", label: "HSN Code", isMandatory: false, type: "text", width: "110px", aliases: ["HSN", "HSN/SAC"] },
  { id: "category", key: "category", label: "Category", isMandatory: false, type: "text", width: "130px", aliases: ["Department", "Merchandise Category"] },
  { id: "subCategory", key: "subCategory", label: "Sub-Category", isMandatory: false, type: "text", width: "130px", aliases: ["Segment", "Subcategory"] },
  { id: "uom", key: "uom", label: "UOM", isMandatory: false, type: "select", width: "90px", options: ["Pcs", "Pair", "Box", "Set", "Kg", "Mtr"], aliases: ["Unit", "Unit of Measure"] },
  // Extended retail metadata
  { id: "manufacturer", key: "manufacturer", label: "Manufacturer", isMandatory: false, type: "text", width: "140px" },
  { id: "weight", key: "weight", label: "Weight", isMandatory: false, type: "number", align: "right", width: "90px" },
  { id: "volume", key: "volume", label: "Volume", isMandatory: false, type: "text", width: "100px" },
  { id: "binLocation", key: "binLocation", label: "Bin Location", isMandatory: false, type: "text", width: "110px", aliases: ["Aisle", "Shelf", "Rack"] },
  { id: "altBarcode", key: "altBarcode", label: "Alt Barcode", isMandatory: false, type: "text", width: "140px", aliases: ["Secondary Barcode"] },
  { id: "season", key: "season", label: "Season", isMandatory: false, type: "text", width: "110px" },
  { id: "vendorCode", key: "vendorCode", label: "Vendor Code", isMandatory: false, type: "text", width: "120px", aliases: ["Vendor ID", "Vendor No", "Supplier Code"] },
  { id: "purchaseClass", key: "purchaseClass", label: "Purchase Class", isMandatory: false, type: "text", width: "120px", aliases: ["Purchase Classification", "Sourcing Class"] },
  { id: "gender", key: "gender", label: "Gender", isMandatory: false, type: "select", width: "110px", options: ["Men", "Women", "Unisex", "Boys", "Girls", "Kids"], aliases: ["Target Gender", "Section"] },
  { id: "department", key: "department", label: "Department", isMandatory: false, type: "text", width: "130px", aliases: ["Dept", "Division", "Department Name"] },
  { id: "merchandiseCategory", key: "merchandiseCategory", label: "Merchandise Category", isMandatory: false, type: "text", width: "160px", aliases: ["Merchandise Cat", "MC Category", "Product Group"] },
  { id: "heels", key: "heels", label: "Heels", isMandatory: false, type: "select", width: "110px", options: ["Flat", "Low Heel", "Mid Heel", "High Heel", "Wedge", "Block", "Stiletto", "None"], aliases: ["Heel Type", "Heel Height", "Heel Structure"] },
  { id: "upperMaterial", key: "upperMaterial", label: "Upper Material", isMandatory: false, type: "text", width: "130px", aliases: ["Upper", "Shoe Upper", "Upper Fabric"] },
  { id: "outsole", key: "outsole", label: "Outsole", isMandatory: false, type: "text", width: "130px", aliases: ["Sole", "Sole Material", "Bottom Sole", "Outsole Material"] },
];

export const DEFAULT_INITIAL_SELECTED_FIELDS: string[] = [
  "stockNo",
  "barcode",
  "product",
  "brand",
  "style",
  "shade",
  "size",
  "itemDescription",
  "mrp",
  "sellingPrice",
  "dealerPrice",
  "costPrice",
  "productTax",
  "hsnCode"
];

/**
 * Transforms an authoritative backend AttributeDefinition into an ItemMasterFieldDefinition.
 */
export function transformAttributeDefinitionToItemField(attr: AttributeDefinition): ItemMasterFieldDefinition {
  const cleanKey = attr.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const fieldId = `dyn_attr_${cleanKey}`;

  let fieldType: ItemMasterFieldDefinition["type"] = "text";
  if (attr.dataType === "number") fieldType = "number";
  else if (attr.dataType === "select" || (attr.validValues && attr.validValues.length > 0)) fieldType = "select";
  else if (attr.dataType === "date") fieldType = "date";

  return {
    id: fieldId,
    key: cleanKey,
    label: attr.label || attr.name,
    isMandatory: Boolean(attr.isMandatory),
    type: fieldType,
    options: attr.validValues || [],
    width: "130px",
    isDynamic: true,
    attributeId: attr.id,
    aliases: [attr.label, attr.name, cleanKey]
  };
}

/**
 * Combines standard base item fields with dynamic backend attributes without duplicating schemas.
 * Automatically excludes deactivated attributes (isEnabled: false) from active entry views.
 */
export function buildUnifiedItemMasterFields(
  dynamicDefinitions: AttributeDefinition[] = []
): ItemMasterFieldDefinition[] {
  const baseFields = [...ALL_AVAILABLE_ITEM_FIELDS];
  const existingKeySet = new Set(baseFields.map(f => f.key.toLowerCase()));

  const dynamicFields: ItemMasterFieldDefinition[] = [];
  dynamicDefinitions
    .filter(defn => (defn as any).isEnabled !== false && (defn as any).is_enabled !== false)
    .forEach(defn => {
      const transformed = transformAttributeDefinitionToItemField(defn);
      // Only append if not already covering a core hardcoded column
      if (!existingKeySet.has(transformed.key.toLowerCase())) {
        dynamicFields.push(transformed);
        existingKeySet.add(transformed.key.toLowerCase());
      }
    });

  return [...baseFields, ...dynamicFields];
}

export interface AttributeValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a product's attributes against authoritative backend AttributeDefinitions.
 * Enforces mandatory checks, allowed validValues options, and data type constraints.
 */
export function validateProductAttributes(
  attributes: Record<string, any>,
  definitions: AttributeDefinition[]
): AttributeValidationResult {
  const errors: string[] = [];
  const activeDefs = definitions.filter(d => (d as any).isEnabled !== false && (d as any).is_enabled !== false);

  activeDefs.forEach(def => {
    const cleanKey = def.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const val = attributes[cleanKey] ?? attributes[def.label] ?? attributes[def.name];

    // Mandatory constraint check
    if (def.isMandatory && (val === undefined || val === null || String(val).trim() === "")) {
      errors.push(`Attribute "${def.label || def.name}" is mandatory.`);
      return;
    }

    // Allowed option values constraint check
    if (val !== undefined && val !== null && String(val).trim() !== "" && def.validValues && def.validValues.length > 0) {
      const normalizedVal = String(val).trim().toLowerCase();
      const match = def.validValues.some(v => v.trim().toLowerCase() === normalizedVal);
      if (!match) {
        errors.push(`Attribute "${def.label || def.name}" has invalid value "${val}". Allowed options: ${def.validValues.join(", ")}`);
      }
    }

    // Number type constraint check
    if (val !== undefined && val !== null && String(val).trim() !== "" && def.dataType === "number") {
      if (isNaN(Number(val))) {
        errors.push(`Attribute "${def.label || def.name}" must be a valid number.`);
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

