/**
 * Project      : SMRITI Retail OS
 * Module       : Universal Printing Kernel
 * Standard     : SCS-PRINT-KERNEL-002 (Universal Field Registry v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

export type FieldDomain =
  | "product"
  | "variant"
  | "barcode"
  | "pricing"
  | "attributes"
  | "batch"
  | "serial"
  | "transaction"
  | "warehouse"
  | "branch"
  | "company";

export interface CanonicalFieldDefinition {
  canonicalPath: string; // e.g. "product.brand", "product.style_code", "pricing.mrp"
  domain: FieldDomain;
  key: string; // e.g. "brand", "style_code", "mrp"
  displayName: string;
  dataType: "string" | "number" | "currency" | "date" | "boolean" | "barcode";
  description?: string;
  aliases: string[];
}

export class UniversalFieldRegistryService {
  private fieldDefinitions: Map<string, CanonicalFieldDefinition> = new Map();
  private aliasMap: Map<string, string> = new Map();

  constructor() {
    this.seedCanonicalFields();
  }

  private seedCanonicalFields(): void {
    const fields: CanonicalFieldDefinition[] = [
      // Product Domain
      {
        canonicalPath: "product.name",
        domain: "product",
        key: "name",
        displayName: "Product Name",
        dataType: "string",
        aliases: ["name", "product_name", "item_name", "title"],
      },
      {
        canonicalPath: "product.code",
        domain: "product",
        key: "code",
        displayName: "Product Code / SKU",
        dataType: "string",
        aliases: ["code", "sku", "item_code", "product_code"],
      },
      {
        canonicalPath: "product.brand",
        domain: "product",
        key: "brand",
        displayName: "Brand",
        dataType: "string",
        aliases: ["brand", "brand_name", "manufacturer", "mfg"],
      },
      {
        canonicalPath: "product.style_code",
        domain: "product",
        key: "style_code",
        displayName: "Style / Article Code",
        dataType: "string",
        aliases: ["style", "style_code", "article_no", "style_no", "model_no", "article"],
      },
      {
        canonicalPath: "product.category",
        domain: "product",
        key: "category",
        displayName: "Category",
        dataType: "string",
        aliases: ["category", "cat_name", "department"],
      },
      {
        canonicalPath: "product.color",
        domain: "product",
        key: "color",
        displayName: "Color",
        dataType: "string",
        aliases: ["color", "colour", "shade"],
      },
      {
        canonicalPath: "product.size",
        domain: "product",
        key: "size",
        displayName: "Size",
        dataType: "string",
        aliases: ["size", "size_code", "dimensions"],
      },
      {
        canonicalPath: "product.hsn_code",
        domain: "product",
        key: "hsn_code",
        displayName: "HSN / SAC Code",
        dataType: "string",
        aliases: ["hsn_code", "hsn", "sac"],
      },
      {
        canonicalPath: "product.uom",
        domain: "product",
        key: "uom",
        displayName: "Unit of Measure (UOM)",
        dataType: "string",
        aliases: ["uom", "unit", "pack_unit"],
      },

      // Barcode Domain
      {
        canonicalPath: "barcode.value",
        domain: "barcode",
        key: "value",
        displayName: "Primary Barcode",
        dataType: "barcode",
        aliases: ["barcode", "ean", "upc", "gtin", "barcode_no"],
      },

      // Pricing Domain
      {
        canonicalPath: "pricing.mrp",
        domain: "pricing",
        key: "mrp",
        displayName: "Maximum Retail Price (MRP)",
        dataType: "currency",
        aliases: ["mrp", "max_retail_price", "list_price"],
      },
      {
        canonicalPath: "pricing.price",
        domain: "pricing",
        key: "price",
        displayName: "Selling Price",
        dataType: "currency",
        aliases: ["price", "selling_price", "offer_price", "rate"],
      },
      {
        canonicalPath: "pricing.cost_price",
        domain: "pricing",
        key: "cost_price",
        displayName: "Buy / Cost Price",
        dataType: "currency",
        aliases: ["cost_price", "buy_cost", "purchase_price"],
      },
      {
        canonicalPath: "pricing.gst_percentage",
        domain: "pricing",
        key: "gst_percentage",
        displayName: "GST Percentage",
        dataType: "number",
        aliases: ["gst_percentage", "gst_rate", "tax_rate", "gst"],
      },

      // Batch & Serial Domain
      {
        canonicalPath: "batch.number",
        domain: "batch",
        key: "number",
        displayName: "Batch / Lot Number",
        dataType: "string",
        aliases: ["batch", "batch_no", "lot_no", "batch_number"],
      },
      {
        canonicalPath: "batch.mfg_date",
        domain: "batch",
        key: "mfg_date",
        displayName: "Manufacturing Date",
        dataType: "date",
        aliases: ["mfg_date", "mfg_dt", "date_of_mfg"],
      },
      {
        canonicalPath: "batch.exp_date",
        domain: "batch",
        key: "exp_date",
        displayName: "Expiry Date",
        dataType: "date",
        aliases: ["exp_date", "exp_dt", "expiry"],
      },
      {
        canonicalPath: "serial.number",
        domain: "serial",
        key: "number",
        displayName: "Serial Number",
        dataType: "string",
        aliases: ["serial", "serial_no", "sn"],
      },

      // Company & Branch Domain
      {
        canonicalPath: "company.name",
        domain: "company",
        key: "name",
        displayName: "Company Name",
        dataType: "string",
        aliases: ["company_name", "store_name", "merchant_name"],
      },
      {
        canonicalPath: "branch.name",
        domain: "branch",
        key: "name",
        displayName: "Branch / Warehouse Name",
        dataType: "string",
        aliases: ["branch_name", "location_name", "warehouse_name"],
      },
    ];

    fields.forEach((f) => this.registerField(f));
  }

  public registerField(def: CanonicalFieldDefinition): void {
    const canonical = def.canonicalPath.toLowerCase();
    this.fieldDefinitions.set(canonical, Object.freeze(def));

    // Register all aliases pointing to this canonical path
    def.aliases.forEach((alias) => {
      const lowerAlias = alias.toLowerCase().trim();
      this.aliasMap.set(lowerAlias, canonical);
      this.aliasMap.set(lowerAlias.replace(/_/g, " "), canonical);
      this.aliasMap.set(lowerAlias.replace(/\s+/g, "_"), canonical);
    });
    this.aliasMap.set(canonical, canonical);
    this.aliasMap.set(def.key.toLowerCase(), canonical);
  }

  public resolveCanonicalPath(inputPath: string): string | undefined {
    if (!inputPath) return undefined;
    const lower = inputPath.trim().toLowerCase();
    const withUnderscore = lower.replace(/\s+/g, "_");
    const withSpace = lower.replace(/_/g, " ");

    // 1. Direct match on alias map
    if (this.aliasMap.has(lower)) {
      return this.aliasMap.get(lower);
    }
    if (this.aliasMap.has(withUnderscore)) {
      return this.aliasMap.get(withUnderscore);
    }
    if (this.aliasMap.has(withSpace)) {
      return this.aliasMap.get(withSpace);
    }

    // 2. Direct match on canonical path
    if (this.fieldDefinitions.has(lower)) {
      return lower;
    }

    // 3. Nested attribute handling (e.g. "product.attributes.heels" -> "attributes.heels")
    if (lower.startsWith("product.attributes.") || lower.startsWith("attributes.")) {
      return lower.startsWith("attributes.") ? lower : lower.replace("product.", "");
    }

    return undefined;
  }

  public getFieldDefinition(path: string): Readonly<CanonicalFieldDefinition> | undefined {
    const canonical = this.resolveCanonicalPath(path);
    if (!canonical) return undefined;
    return this.fieldDefinitions.get(canonical);
  }

  public listFields(domain?: FieldDomain): ReadonlyArray<CanonicalFieldDefinition> {
    const all = Array.from(this.fieldDefinitions.values());
    if (domain) {
      return all.filter((f) => f.domain === domain);
    }
    return all;
  }
}

export const UniversalFieldRegistry = new UniversalFieldRegistryService();
