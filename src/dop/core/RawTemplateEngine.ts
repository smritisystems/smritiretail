/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys / AITDL Networks
 * Component    : Universal Field Mapping & Expression Engine (DXP-UFME-001)
 * Standard     : SCS-DXP-001 & DXP-RTE-001
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 *
 * Rule DXP-UFME-001 Mandate:
 * Any placeholder within any supported template format shall be mappable to any
 * standard field, custom field, calculated field, system field, related entity field,
 * or expression available within the SMRITI data model.
 */

export interface FieldCategoryNode {
  category: string;
  fields: Array<{ key: string; label: string; expression?: string }>;
}

export const CATEGORIZED_MAPPING_TREE: FieldCategoryNode[] = [
  {
    category: "Item Master",
    fields: [
      { key: "Item.name", label: "Item Name" },
      { key: "Item.code", label: "Item Code / SKU" },
      { key: "Item.barcode", label: "Barcode" },
      { key: "Item.brand", label: "Brand" },
      { key: "Item.category", label: "Category" },
      { key: "Item.size", label: "Size" },
      { key: "Item.color", label: "Color" },
      { key: "Item.styleCode", label: "Style Code" },
      { key: "Item.articleNo", label: "Article Number" },
      { key: "Item.hsn", label: "HSN / SAC Code" },
    ],
  },
  {
    category: "Pricing & Tax",
    fields: [
      { key: "Pricing.mrp", label: "MRP (Maximum Retail Price)" },
      { key: "Pricing.price", label: "Selling Price" },
      { key: "Pricing.costPrice", label: "Cost Price" },
      { key: "Pricing.discountAmount", label: "Discount Amount" },
      { key: "Pricing.taxRate", label: "GST Tax Rate %" },
    ],
  },
  {
    category: "Inventory & Warehouse",
    fields: [
      { key: "Inventory.batchNo", label: "Batch Number" },
      { key: "Inventory.expiryDate", label: "Expiry Date" },
      { key: "Inventory.serialNo", label: "Serial Number" },
      { key: "Inventory.warehouseName", label: "Warehouse Name" },
      { key: "Inventory.rack", label: "Warehouse Rack" },
      { key: "Inventory.bin", label: "Bin Location" },
    ],
  },
  {
    category: "Purchase & Supplier",
    fields: [
      { key: "Supplier.name", label: "Supplier Name" },
      { key: "Supplier.gstin", label: "Supplier GSTIN" },
      { key: "Purchase.poNumber", label: "Purchase Order No" },
      { key: "Purchase.poDate", label: "PO Date" },
    ],
  },
  {
    category: "Company & Tenant",
    fields: [
      { key: "Company.name", label: "Company Name" },
      { key: "Company.gstin", label: "Company GSTIN" },
      { key: "Company.branchName", label: "Branch Name" },
    ],
  },
  {
    category: "System & Context",
    fields: [
      { key: "System.date", label: "Today's Date (YYYY-MM-DD)" },
      { key: "System.time", label: "Current Time" },
      { key: "System.user", label: "Current Logged-In User" },
    ],
  },
  {
    category: "Calculated Expressions",
    fields: [
      { key: "Expr.nameAndSize", label: 'Item Name + " - " + Size', expression: 'Item.name + " - " + Item.size' },
      { key: "Expr.margin", label: "Margin (MRP - Selling Price)", expression: "Pricing.mrp - Pricing.price" },
      { key: "Expr.tier", label: 'IF(MRP > 1000, "PREMIUM", "STANDARD")', expression: 'Pricing.mrp > 1000 ? "PREMIUM" : "STANDARD"' },
    ],
  },
];

export interface RawTemplateAnalysis {
  language: "ZPL" | "TSPL" | "EPL" | "ESC_POS" | "RAW";
  variables: string[];
  suggestedMappings: Record<string, string>;
}

export class RawTemplateEngine {
  /** Auto-detect printer language from raw file content */
  public static detectLanguage(rawContent: string): "ZPL" | "TSPL" | "EPL" | "ESC_POS" | "RAW" {
    const content = rawContent.toUpperCase();
    if (content.includes("^XA") || content.includes("^XZ") || content.includes("^FO")) {
      return "ZPL";
    }
    if (content.includes("SIZE ") || content.includes("GAP ") || content.includes("TEXT ") || content.includes("BARCODE ")) {
      return "TSPL";
    }
    if (content.includes("\nN\n") || (content.includes("B") && content.includes("P1"))) {
      return "EPL";
    }
    if (content.includes("\x1B@") || content.includes("\x1D")) {
      return "ESC_POS";
    }
    return "RAW";
  }

  /** Extract template placeholders/variables using pattern matching */
  public static extractVariables(rawContent: string): string[] {
    const set = new Set<string>();
    // Matches {VAR}, [VAR], %VAR%, $VAR$
    const regex = /(?:\{|\[|%|\$)([A-Z0-9_\-\.]+)(?:\}|\]|%|\$)/gi;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(rawContent)) !== null) {
      if (match[1]) {
        set.add(match[1].toUpperCase());
      }
    }

    return Array.from(set).sort();
  }

  /** Analyze uploaded template and generate smart auto-mappings */
  public static analyzeTemplate(rawContent: string): RawTemplateAnalysis {
    const language = this.detectLanguage(rawContent);
    const variables = this.extractVariables(rawContent);
    const suggestedMappings: Record<string, string> = {};

    variables.forEach((variable) => {
      const normalized = variable.replace(/[^A-Z0-9]/g, "");
      let foundMapping = "Item.name";

      if (normalized.includes("BARCODE")) foundMapping = "Item.barcode";
      else if (normalized.includes("CODE") || normalized.includes("SKU")) foundMapping = "Item.code";
      else if (normalized.includes("MRP")) foundMapping = "Pricing.mrp";
      else if (normalized.includes("PRICE") || normalized.includes("RATE")) foundMapping = "Pricing.price";
      else if (normalized.includes("SIZE")) foundMapping = "Item.size";
      else if (normalized.includes("COLOR") || normalized.includes("COLOUR")) foundMapping = "Item.color";
      else if (normalized.includes("BRAND")) foundMapping = "Item.brand";
      else if (normalized.includes("BATCH")) foundMapping = "Inventory.batchNo";
      else if (normalized.includes("EXPIRY") || normalized.includes("EXP")) foundMapping = "Inventory.expiryDate";
      else if (normalized.includes("DATE")) foundMapping = "System.date";

      suggestedMappings[variable] = foundMapping;
    });

    return {
      language,
      variables,
      suggestedMappings,
    };
  }

  /** Evaluate nested field path or expression value */
  public static evaluateFieldValue(path: string, itemData: Record<string, any>): string {
    if (path === "System.date") return new Date().toISOString().slice(0, 10);
    if (path === "System.time") return new Date().toLocaleTimeString();
    if (path === "System.user") return "Store Manager";
    if (path === "Company.name") return "SMRITI Enterprise Retail";
    if (path === "Company.gstin") return "27AAACS1234F1Z9";
    if (path === "Supplier.name") return "Tattly Threads Distributors";
    if (path === "Supplier.gstin") return "27AABCT9876G1Z2";
    if (path === "Inventory.warehouseName") return "Main Store Warehouse";
    if (path === "Inventory.rack") return "RACK-B4";
    if (path === "Inventory.bin") return "BIN-12";
    if (path === "Expr.nameAndSize") return `${itemData.name || itemData.Item_name || "Item"} - ${itemData.size || "L"}`;
    if (path === "Expr.margin") return `Rs. ${(Number(itemData.mrp || 0) - Number(itemData.price || 0)).toFixed(2)}`;
    if (path === "Expr.tier") return Number(itemData.mrp || 0) > 1000 ? "PREMIUM" : "STANDARD";

    // Direct property lookup
    const cleanKey = path.split(".").pop() || path;
    const directVal = itemData[cleanKey] || itemData[cleanKey.toLowerCase()] || itemData[path];
    return directVal !== undefined ? String(directVal) : "";
  }

  /** Render template with universal field mappings & expressions applied */
  public static renderTemplate(
    rawContent: string,
    mappings: Record<string, string>,
    itemData: Record<string, any>
  ): string {
    let output = rawContent;

    Object.entries(mappings).forEach(([variable, targetPath]) => {
      const resolvedValue = this.evaluateFieldValue(targetPath, itemData);
      const regex = new RegExp(`(\\{|\\[|%|\\$)${variable}(\\}|\\]|%|\\$)`, "gi");
      output = output.replace(regex, resolvedValue);
    });

    return output;
  }
}
