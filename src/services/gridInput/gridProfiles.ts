/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.54.0
 * Created      : 2026-10-03
 * Modified     : 2026-10-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Global Grid Input & Import Standard
 */

import { GridInputProfile, GridProfileId } from "./types";
import { SmritiFieldDefinition } from "../../lib/headerMapping/types";
import { SMRITI_ITEM_MASTER_FIELDS } from "../../lib/headerMapping/HeaderAliasRegistry";

export const BILLING_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "barcode",
    label: "BARCODE",
    required: true,
    aliases: ["barcode", "bar code", "barcode no", "ean", "ean13", "ean-13", "upc", "upc code"],
    description: "Item barcode or EAN",
  },
  {
    key: "sku",
    label: "SKU / ITEM CODE",
    required: false,
    aliases: ["sku", "sku code", "item code", "code", "article", "article no", "product code", "style code"],
    description: "Item SKU or style code",
  },
  {
    key: "name",
    label: "ITEM NAME",
    required: false,
    aliases: ["name", "item name", "product name", "description", "item description"],
    description: "Item display description",
  },
  {
    key: "quantity",
    label: "QUANTITY",
    required: false,
    aliases: ["qty", "quantity", "units", "count", "pcs"],
    description: "Billing line quantity",
  },
  {
    key: "price",
    label: "SELLING PRICE",
    required: false,
    aliases: ["price", "selling price", "rate", "sp", "sale rate", "billing rate"],
    description: "Unit selling price",
  },
  {
    key: "mrp",
    label: "MRP",
    required: false,
    aliases: ["mrp", "maximum retail price", "retail price", "catalog mrp"],
    description: "Statutory Maximum Retail Price",
  },
  {
    key: "discount",
    label: "DISCOUNT %",
    required: false,
    aliases: ["discount", "discount %", "disc", "disc %", "discount percent"],
    description: "Item discount percentage",
  },
  {
    key: "discountAmount",
    label: "DISCOUNT AMOUNT",
    required: false,
    aliases: ["discount amount", "disc amt", "disc amount", "cash discount"],
    description: "Flat line discount amount",
  },
  {
    key: "taxRate",
    label: "GST %",
    required: false,
    aliases: ["gst", "gst %", "gst rate", "tax", "tax %", "tax rate"],
    description: "Applicable GST tax percentage",
  },
  {
    key: "hsnCode",
    label: "HSN CODE",
    required: false,
    aliases: ["hsn", "hsn code", "hsn/sac"],
    description: "GST HSN classification code",
  },
  {
    key: "uom",
    label: "UOM",
    required: false,
    aliases: ["uom", "unit", "unit of measure"],
    description: "Unit of measure (e.g. Nos, Pair, Pcs)",
  },
  {
    key: "batch",
    label: "BATCH NO",
    required: false,
    aliases: ["batch", "batch no", "lot", "lot no"],
    description: "Inventory batch number",
  },
];

export const PURCHASE_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "barcode",
    label: "BARCODE",
    required: false,
    aliases: ["barcode", "bar code", "barcode no", "ean", "ean13", "upc"],
    description: "Item barcode",
  },
  {
    key: "sku",
    label: "SKU / ITEM CODE",
    required: true,
    aliases: ["sku", "item code", "code", "article", "article no", "vendor article", "product code"],
    description: "Item SKU or article code",
  },
  {
    key: "name",
    label: "ITEM NAME",
    required: false,
    aliases: ["name", "item name", "product name", "description", "material description"],
    description: "Item description",
  },
  {
    key: "size",
    label: "SIZE",
    required: false,
    aliases: ["size", "item size", "product size", "dim"],
    description: "Item size dimension",
  },
  {
    key: "color",
    label: "COLOR",
    required: false,
    aliases: ["color", "colour", "shade", "item color"],
    description: "Item color or shade",
  },
  {
    key: "quantity",
    label: "RECEIVED QTY",
    required: true,
    aliases: ["qty", "quantity", "received qty", "inward qty", "ordered qty", "units"],
    description: "Quantity received or ordered",
  },
  {
    key: "damagedQty",
    label: "DAMAGED QTY",
    required: false,
    aliases: ["damaged qty", "damaged", "damage", "shortage", "rejects"],
    description: "Damaged or rejected quantity",
  },
  {
    key: "costPrice",
    label: "COST / INVOICE RATE",
    required: false,
    aliases: ["rate", "cost", "cost price", "invoice rate", "buying price", "purchase rate", "base rate"],
    description: "Unit purchase cost or invoice rate",
  },
  {
    key: "mrp",
    label: "MRP",
    required: false,
    aliases: ["mrp", "maximum retail price", "retail price"],
    description: "Statutory MRP",
  },
  {
    key: "taxRate",
    label: "GST %",
    required: false,
    aliases: ["gst", "gst %", "gst rate", "tax", "tax %", "igst"],
    description: "Statutory GST percentage",
  },
];

export const STOCK_MOVEMENT_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "barcode",
    label: "BARCODE",
    required: false,
    aliases: ["barcode", "bar code", "barcode no", "ean", "ean13", "upc"],
    description: "Item barcode",
  },
  {
    key: "sku",
    label: "SKU / ITEM CODE",
    required: true,
    aliases: ["sku", "item code", "code", "product code"],
    description: "Item SKU or code",
  },
  {
    key: "name",
    label: "ITEM NAME",
    required: false,
    aliases: ["name", "item name", "description"],
    description: "Item description",
  },
  {
    key: "quantity",
    label: "QUANTITY",
    required: true,
    aliases: ["qty", "quantity", "transfer qty", "count", "stock"],
    description: "Movement or count quantity",
  },
  {
    key: "warehouse",
    label: "WAREHOUSE / BIN",
    required: false,
    aliases: ["warehouse", "warehouse code", "bin", "location", "from warehouse", "to warehouse"],
    description: "Target or source warehouse location",
  },
  {
    key: "batch",
    label: "BATCH NO",
    required: false,
    aliases: ["batch", "batch no", "lot", "lot no"],
    description: "Inventory batch number",
  },
  {
    key: "expiry",
    label: "EXPIRY DATE",
    required: false,
    aliases: ["expiry", "expiry date", "exp date", "exp"],
    description: "Product expiry date",
  },
];

export const BARCODE_PRINTING_FIELDS: SmritiFieldDefinition[] = [
  {
    key: "barcode",
    label: "BARCODE",
    required: true,
    aliases: ["barcode", "bar code", "barcode no", "ean", "ean13", "upc"],
    description: "Barcode to print",
  },
  {
    key: "sku",
    label: "SKU / ITEM CODE",
    required: false,
    aliases: ["sku", "item code", "code", "style code", "article"],
    description: "SKU code on label",
  },
  {
    key: "name",
    label: "ITEM NAME",
    required: false,
    aliases: ["name", "item name", "product name", "description"],
    description: "Item name on label",
  },
  {
    key: "quantity",
    label: "LABEL COPIES",
    required: false,
    aliases: ["qty", "quantity", "copies", "print copies", "count"],
    description: "Number of labels to print for this item",
  },
  {
    key: "mrp",
    label: "MRP",
    required: false,
    aliases: ["mrp", "maximum retail price", "retail price"],
    description: "MRP displayed on label",
  },
  {
    key: "price",
    label: "SELLING PRICE",
    required: false,
    aliases: ["price", "selling price", "our price", "offer price"],
    description: "Offer or selling price displayed on label",
  },
  {
    key: "size",
    label: "SIZE",
    required: false,
    aliases: ["size", "item size"],
    description: "Size on label",
  },
  {
    key: "color",
    label: "COLOR",
    required: false,
    aliases: ["color", "colour", "shade"],
    description: "Color on label",
  },
];

export const GRID_PROFILES: Record<GridProfileId, GridInputProfile> = {
  BILLING: {
    profileId: "BILLING",
    label: "POS & Billing Transactions",
    description: "Barcode scanning, bulk billing item paste, and invoice CSV import",
    mappingContext: "SALES_INVOICE",
    allowedFields: BILLING_FIELDS,
    defaultQuantity: 1,
    requireProductResolution: true,
    atomicTransactionSafety: false, // Billing allows reviewing valid lines while highlighting unmapped
    supportedImportModes: ["APPEND", "MERGE", "REPLACE"],
    defaultImportMode: "APPEND",
    supportedDuplicatePolicies: ["MERGE_ROWS", "ADD_AS_SEPARATE_ROWS"],
    defaultDuplicatePolicy: "MERGE_ROWS",
  },
  PURCHASE: {
    profileId: "PURCHASE",
    label: "Procurement, PO & Goods Receipt (GRN)",
    description: "Supplier packing list import, purchase order sizewise grid, and GRN inward",
    mappingContext: "GRN",
    allowedFields: PURCHASE_FIELDS,
    defaultQuantity: 1,
    requireProductResolution: true,
    atomicTransactionSafety: true, // Purchase documents must be 100% valid
    supportedImportModes: ["APPEND", "MERGE", "REPLACE"],
    defaultImportMode: "MERGE",
    supportedDuplicatePolicies: ["MERGE_ROWS", "ADD_AS_SEPARATE_ROWS", "REJECT_DUPLICATE"],
    defaultDuplicatePolicy: "MERGE_ROWS",
  },
  STOCK_MOVEMENT: {
    profileId: "STOCK_MOVEMENT",
    label: "Warehouse Stock Movement & Physical Count",
    description: "Inter-branch transfers, stock count audits, and stock adjustments",
    mappingContext: "GRN",
    allowedFields: STOCK_MOVEMENT_FIELDS,
    defaultQuantity: 1,
    requireProductResolution: true,
    atomicTransactionSafety: true, // Stock movements cannot commit phantom products
    supportedImportModes: ["APPEND", "REPLACE"],
    defaultImportMode: "APPEND",
    supportedDuplicatePolicies: ["MERGE_ROWS", "ADD_AS_SEPARATE_ROWS"],
    defaultDuplicatePolicy: "MERGE_ROWS",
  },
  BARCODE_PRINTING: {
    profileId: "BARCODE_PRINTING",
    label: "Barcode & Label Printing Studio",
    description: "Batch barcode label printing from Excel clipboard or CSV",
    mappingContext: "ITEM_MASTER",
    allowedFields: BARCODE_PRINTING_FIELDS,
    defaultQuantity: 1,
    requireProductResolution: true,
    atomicTransactionSafety: false,
    supportedImportModes: ["APPEND", "REPLACE"],
    defaultImportMode: "APPEND",
    supportedDuplicatePolicies: ["MERGE_ROWS", "ADD_AS_SEPARATE_ROWS"],
    defaultDuplicatePolicy: "MERGE_ROWS",
  },
  ITEM_MASTER: {
    profileId: "ITEM_MASTER",
    label: "Authoritative Item Master Creation",
    description: "Bulk catalog creation and Excel grid article configuration",
    mappingContext: "ITEM_MASTER",
    allowedFields: SMRITI_ITEM_MASTER_FIELDS,
    defaultQuantity: 0,
    requireProductResolution: false, // New products are being created here
    atomicTransactionSafety: true,
    supportedImportModes: ["APPEND", "REPLACE"],
    defaultImportMode: "APPEND",
    supportedDuplicatePolicies: ["REJECT_DUPLICATE", "ADD_AS_SEPARATE_ROWS"],
    defaultDuplicatePolicy: "REJECT_DUPLICATE",
  },
  LOOKUP_VALUE: {
    profileId: "LOOKUP_VALUE",
    label: "System Lookups & Core Master Directory",
    description: "Bulk lookup code ingestion, Excel clipboard paste, and standard catalog presets",
    mappingContext: "ITEM_MASTER",
    allowedFields: [
      {
        key: "code",
        label: "LOOKUP CODE",
        required: true,
        aliases: ["code", "lookup code", "value code", "id", "lookup id", "key", "short code"],
        description: "Unique code for lookup value (e.g. UPI, MENS, DEPT-01)",
      },
      {
        key: "name",
        label: "LOOKUP TITLE / NAME",
        required: true,
        aliases: ["name", "title", "lookup name", "value", "value name", "display name", "label", "text"],
        description: "Display title or name for the lookup item",
      },
      {
        key: "description",
        label: "DESCRIPTION / NOTES",
        required: false,
        aliases: ["description", "notes", "desc", "details", "remark", "remarks", "comment"],
        description: "Optional notes or details",
      },
      {
        key: "active",
        label: "ACTIVE STATUS",
        required: false,
        aliases: ["active", "is_active", "status", "enabled", "live"],
        description: "Status indicator (true/false, active/inactive, 1/0)",
      },
      {
        key: "vendorCode",
        label: "VENDOR CODE",
        required: false,
        aliases: ["vendor", "vendor code", "vendor_code", "supplier", "supplier code"],
        description: "Owning vendor code (for Style/Article lookups)",
      },
      {
        key: "values",
        label: "ORDERED VALUES",
        required: false,
        aliases: ["values", "items", "ordered values", "elements", "list"],
        description: "Comma-separated list of child values (for Color/Size groups)",
      },
    ],
    defaultQuantity: 0,
    requireProductResolution: false,
    atomicTransactionSafety: true,
    supportedImportModes: ["APPEND", "MERGE"],
    defaultImportMode: "APPEND",
    supportedDuplicatePolicies: ["MERGE_ROWS", "ADD_AS_SEPARATE_ROWS", "REJECT_DUPLICATE"],
    defaultDuplicatePolicy: "MERGE_ROWS",
  },
};
