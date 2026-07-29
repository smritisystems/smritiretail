/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUPAE DimensionRegistry (Universal Dimension Registry)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.1.0
 */

export interface DimensionDefinition {
  id: string;
  label: string;
  category: "Product" | "Entity" | "Location" | "Time" | "Financial";
  entityType?: string;
  field: string;
}

export const DIMENSION_REGISTRY: Record<string, DimensionDefinition> = {
  Item: { id: "Item", label: "Item SKU", category: "Product", entityType: "Item", field: "itemName" },
  Category: { id: "Category", label: "Category", category: "Product", field: "category" },
  Brand: { id: "Brand", label: "Brand", category: "Product", field: "brand" },
  Size: { id: "Size", label: "Size", category: "Product", field: "size" },
  Color: { id: "Color", label: "Color", category: "Product", field: "color" },
  Customer: { id: "Customer", label: "Customer Name", category: "Entity", entityType: "Customer", field: "customerName" },
  Supplier: { id: "Supplier", label: "Supplier Name", category: "Entity", entityType: "Supplier", field: "supplierName" },
  Warehouse: { id: "Warehouse", label: "Warehouse", category: "Location", entityType: "Warehouse", field: "warehouseName" },
  Month: { id: "Month", label: "Month", category: "Time", field: "month" },
  Quarter: { id: "Quarter", label: "Quarter", category: "Time", field: "quarter" },
  Year: { id: "Year", label: "Year", category: "Time", field: "year" }
};
