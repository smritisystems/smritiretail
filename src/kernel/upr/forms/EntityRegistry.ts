/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Entity Registry (UEDF / UFR-001)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & UFR Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export type FieldDataType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "decimal"
  | "json"
  | "enum"
  | "relation";

export interface EntityFieldMetadata {
  id: string;                 // Field property key (e.g. "sku", "name", "selling_price")
  label: string;              // Human readable label
  dataType: FieldDataType;    // Underlying storage data type
  isPrimaryKey?: boolean;
  isRequired?: boolean;
  isUnique?: boolean;
  defaultValue?: any;
  options?: Array<{ label: string; value: any }>;
  targetEntity?: string;      // Related entity name for relational fields
}

export interface EntityMetadata {
  id: string;                 // Entity identifier (e.g. "product", "customer", "supplier")
  name: string;               // Display name (e.g. "Product SKU")
  domainId: string;           // Domain relationship (e.g. "inventory", "sales", "purchase")
  tableName?: string;         // Database table name
  fields: EntityFieldMetadata[];
  version: string;
}

export class EntityRegistryService {
  private entities: Map<string, Readonly<EntityMetadata>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultEntities();
  }

  private seedDefaultEntities() {
    const defaults: EntityMetadata[] = [
      {
        id: "product",
        name: "Product Item Master",
        domainId: "inventory",
        tableName: "products",
        version: "1.0.0",
        fields: [
          { id: "id", label: "Product ID", dataType: "string", isPrimaryKey: true, isRequired: true },
          { id: "sku", label: "SKU / Barcode", dataType: "string", isRequired: true, isUnique: true },
          { id: "name", label: "Product Name", dataType: "string", isRequired: true },
          { id: "category", label: "Category", dataType: "enum", isRequired: true },
          { id: "brand", label: "Brand", dataType: "string" },
          { id: "unit", label: "Unit of Measure (UOM)", dataType: "enum" },
          { id: "mrpi", label: "MRP (₹)", dataType: "decimal", isRequired: true },
          { id: "rsp", label: "Retail Sale Price (RSP)", dataType: "decimal", isRequired: true },
          { id: "cost_price", label: "Cost Price (₹)", dataType: "decimal" },
          { id: "hsn", label: "HSN / SAC Code", dataType: "string" },
          { id: "is_active", label: "Active Status", dataType: "boolean", defaultValue: true }
        ]
      },
      {
        id: "customer",
        name: "Customer Profile",
        domainId: "sales",
        tableName: "customers",
        version: "1.0.0",
        fields: [
          { id: "id", label: "Customer ID", dataType: "string", isPrimaryKey: true, isRequired: true },
          { id: "code", label: "Customer Code", dataType: "string", isRequired: true, isUnique: true },
          { id: "name", label: "Customer Name", dataType: "string", isRequired: true },
          { id: "phone", label: "Mobile Number", dataType: "string", isRequired: true },
          { id: "email", label: "Email Address", dataType: "string" },
          { id: "loyalty_tier", label: "Loyalty Tier", dataType: "enum" },
          { id: "credit_limit", label: "Credit Limit (₹)", dataType: "decimal" }
        ]
      },
      {
        id: "supplier",
        name: "Supplier Master",
        domainId: "purchase",
        tableName: "suppliers",
        version: "1.0.0",
        fields: [
          { id: "id", label: "Supplier ID", dataType: "string", isPrimaryKey: true, isRequired: true },
          { id: "name", label: "Supplier Name", dataType: "string", isRequired: true },
          { id: "gst", label: "GSTIN", dataType: "string" },
          { id: "outstanding", label: "Outstanding (₹)", dataType: "decimal" }
        ]
      },
      {
        id: "invoice",
        name: "Sales Invoice",
        domainId: "sales",
        tableName: "invoices",
        version: "1.0.0",
        fields: [
          { id: "id", label: "Invoice ID", dataType: "string", isPrimaryKey: true, isRequired: true },
          { id: "invoice_no", label: "Invoice Number", dataType: "string", isRequired: true },
          { id: "customer_name", label: "Customer Name", dataType: "string" },
          { id: "grand_total", label: "Grand Total (₹)", dataType: "decimal" }
        ]
      },
      {
        id: "warehouse",
        name: "Warehouse Facility",
        domainId: "inventory",
        tableName: "warehouses",
        version: "1.0.0",
        fields: [
          { id: "id", label: "Warehouse ID", dataType: "string", isPrimaryKey: true, isRequired: true },
          { id: "name", label: "Warehouse Name", dataType: "string", isRequired: true },
          { id: "location", label: "Location", dataType: "string" }
        ]
      },
      {
        id: "batch",
        name: "Item Batch",
        domainId: "inventory",
        tableName: "item_batches",
        version: "1.0.0",
        fields: [
          { id: "id", label: "Batch ID", dataType: "string", isPrimaryKey: true, isRequired: true },
          { id: "batch_no", label: "Batch Number", dataType: "string", isRequired: true },
          { id: "expiry_date", label: "Expiry Date", dataType: "date" }
        ]
      },
      {
        id: "serial",
        name: "Item Serial Number",
        domainId: "inventory",
        tableName: "item_serials",
        version: "1.0.0",
        fields: [
          { id: "id", label: "Serial ID", dataType: "string", isPrimaryKey: true, isRequired: true },
          { id: "serial_no", label: "Serial Number", dataType: "string", isRequired: true },
          { id: "status", label: "Status", dataType: "string" }
        ]
      }
    ];

    defaults.forEach((e) => this.registerEntity(e));
  }

  public registerEntity(entity: EntityMetadata): void {
    const payload = Object.freeze({ ...entity, id: entity.id.toLowerCase() });
    this.entities.set(payload.id, payload);
    this.emitChange();
  }

  public getEntity(id: string): Readonly<EntityMetadata> | undefined {
    if (!id) return undefined;
    return this.entities.get(id.toLowerCase());
  }

  public getEntities(): ReadonlyArray<Readonly<EntityMetadata>> {
    return Array.from(this.entities.values());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.entities.clear();
    this.seedDefaultEntities();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const EntityRegistry = new EntityRegistryService();
