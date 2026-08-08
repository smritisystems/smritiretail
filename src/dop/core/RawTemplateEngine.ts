/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys / AITDL Networks
 * Component    : Universal Data Binding Engine (UDBE / DXP-UDBE-001)
 * Extension Of : SCS-DXP-001 (Universal Document Experience Platform v1.0)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 *
 * Rule DXP-UDBE-001 Mandate:
 * The Universal Data Binding Engine shall bind any placeholder in any template format
 * to standard fields, custom UDFs, related entity graphs, system context, functions,
 * calculated expressions, or dynamic providers without code modification.
 */

export interface FieldCategoryNode {
  category: string;
  fields: Array<{ key: string; label: string; expression?: string }>;
}

export interface IndustryTemplatePreset {
  id: string;
  name: string;
  industry: "Apparel" | "Footwear" | "Jewellery" | "Pharmacy" | "Grocery" | "Electronics";
  language: "ZPL" | "TSPL" | "EPL";
  script: string;
  defaultMappings: Record<string, string>;
}

export interface TemplateValidationReport {
  isValid: boolean;
  languageDetected: string;
  variablesCount: number;
  mappedCount: number;
  unmappedVariables: string[];
  syntaxErrors: string[];
}

export const INDUSTRY_TEMPLATE_LIBRARY: IndustryTemplatePreset[] = [
  {
    id: "apparel_dual_tag",
    name: "Apparel Dual Hangtag (ZPL 100x50mm)",
    industry: "Apparel",
    language: "ZPL",
    script: "^XA^FO50,50^A0N,35,35^FD{ITEM_NAME}^FS^FO50,90^A0N,25,25^FD{BRAND} | {SIZE}^FS^FO50,130^BY3^BCN,60,Y,N^FD{BARCODE}^FS^FO50,220^A0N,30,30^FDMRP: {MRP}^FS^XZ",
    defaultMappings: {
      ITEM_NAME: "Item.name",
      BRAND: "Item.brand",
      SIZE: "Item.size",
      BARCODE: "Item.barcode",
      MRP: "Pricing.mrp",
    },
  },
  {
    id: "footwear_box_label",
    name: "Footwear Shoe Box Label (TSPL 75x50mm)",
    industry: "Footwear",
    language: "TSPL",
    script: 'SIZE 75 mm, 50 mm\nGAP 3 mm, 0\nCLS\nTEXT 50,50,"3",0,1,1,"{ITEM_NAME}"\nTEXT 50,90,"2",0,1,1,"COLOR: {COLOR} | SIZE: {SIZE}"\nBARCODE 50,130,"128",60,1,0,2,2,"{BARCODE}"\nTEXT 50,210,"3",0,1,1,"PRICE: {PRICE}"\nPRINT 1\n',
    defaultMappings: {
      ITEM_NAME: "Item.name",
      COLOR: "Item.color",
      SIZE: "Item.size",
      BARCODE: "Item.barcode",
      PRICE: "Pricing.price",
    },
  },
  {
    id: "jewellery_dumbbell_tag",
    name: "Jewellery Dumbbell Tag (ZPL 50x15mm)",
    industry: "Jewellery",
    language: "ZPL",
    script: "^XA^FO10,10^A0N,20,20^FD{ITEM_NAME}^FS^FO10,35^A0N,18,18^FDNET: {NET_WT}g | PURITY: {PURITY}^FS^FO10,60^BY2^BCN,40,Y,N^FD{BARCODE}^FS^XZ",
    defaultMappings: {
      ITEM_NAME: "Item.name",
      NET_WT: "Inventory.rack",
      PURITY: "Item.styleCode",
      BARCODE: "Item.barcode",
    },
  },
  {
    id: "pharmacy_batch_label",
    name: "Pharmacy Batch & Expiry Label (TSPL 50x25mm)",
    industry: "Pharmacy",
    language: "TSPL",
    script: 'SIZE 50 mm, 25 mm\nGAP 2 mm, 0\nCLS\nTEXT 30,30,"2",0,1,1,"{ITEM_NAME}"\nTEXT 30,65,"2",0,1,1,"BATCH: {BATCH} | EXP: {EXPIRY}"\nBARCODE 30,100,"128",45,1,0,2,2,"{BARCODE}"\nPRINT 1\n',
    defaultMappings: {
      ITEM_NAME: "Item.name",
      BATCH: "Inventory.batchNo",
      EXPIRY: "Inventory.expiryDate",
      BARCODE: "Item.barcode",
    },
  },
];

export const CATEGORIZED_MAPPING_TREE: FieldCategoryNode[] = [
  {
    category: "Item Master Graph",
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
    category: "Pricing & Finance",
    fields: [
      { key: "Pricing.mrp", label: "MRP (Maximum Retail Price)" },
      { key: "Pricing.price", label: "Selling Price" },
      { key: "Pricing.costPrice", label: "Cost Price" },
      { key: "Pricing.discountAmount", label: "Discount Amount" },
      { key: "Pricing.taxRate", label: "GST Tax Rate %" },
    ],
  },
  {
    category: "Inventory & Warehouse Graph",
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
    category: "Purchase Order & Supplier",
    fields: [
      { key: "Supplier.name", label: "Supplier Name" },
      { key: "Supplier.gstin", label: "Supplier GSTIN" },
      { key: "Purchase.poNumber", label: "Purchase Order No" },
      { key: "Purchase.poDate", label: "PO Date" },
    ],
  },
  {
    category: "Company & Tenant Graph",
    fields: [
      { key: "Company.name", label: "Company Name" },
      { key: "Company.gstin", label: "Company GSTIN" },
      { key: "Company.branchName", label: "Branch Name" },
    ],
  },
  {
    category: "System & Session Variables",
    fields: [
      { key: "System.date", label: "Today's Date (YYYY-MM-DD)" },
      { key: "System.time", label: "Current Time" },
      { key: "System.user", label: "Current Logged-In User" },
    ],
  },
  {
    category: "Value Provider Functions",
    fields: [
      { key: "Func.upperName", label: "Upper(Item.name)" },
      { key: "Func.lowerName", label: "Lower(Item.name)" },
      { key: "Func.formatMrp", label: "FormatCurrency(MRP)" },
      { key: "Func.formatDate", label: "FormatDate(System.date)" },
    ],
  },
  {
    category: "Calculated Expressions",
    fields: [
      { key: "Expr.nameAndSize", label: 'Item Name + " - " + Size' },
      { key: "Expr.margin", label: "Margin (MRP - Selling Price)" },
      { key: "Expr.tier", label: 'IF(MRP > 1000, "PREMIUM", "STANDARD")' },
    ],
  },
];

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
  public static analyzeTemplate(rawContent: string) {
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

  /** Universal Value Provider Evaluation (UDBE Engine) */
  public static evaluateFieldValue(path: string, itemData: Record<string, any>): string {
    const itemName = String(itemData.name || itemData.Item_name || "Item");
    const mrpVal = Number(itemData.mrp || 0);
    const priceVal = Number(itemData.price || 0);

    // Value Provider Functions
    if (path === "Func.upperName") return itemName.toUpperCase();
    if (path === "Func.lowerName") return itemName.toLowerCase();
    if (path === "Func.formatMrp") return `₹${mrpVal.toLocaleString("en-IN")}`;
    if (path === "Func.formatDate") return new Date().toLocaleDateString("en-IN");

    // System Context
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

    // Calculated Expressions
    if (path === "Expr.nameAndSize") return `${itemName} - ${itemData.size || "L"}`;
    if (path === "Expr.margin") return `₹${(mrpVal - priceVal).toFixed(2)}`;
    if (path === "Expr.tier") return mrpVal > 1000 ? "PREMIUM" : "STANDARD";

    // Direct Property Lookup
    const cleanKey = path.split(".").pop() || path;
    const directVal = itemData[cleanKey] || itemData[cleanKey.toLowerCase()] || itemData[path];
    return directVal !== undefined ? String(directVal) : "";
  }

  /** Render template with UDBE universal data binding applied */
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

  /** Run Automated Template Validation Pre-check */
  public static validateTemplate(
    rawContent: string,
    mappings: Record<string, string>
  ): TemplateValidationReport {
    const languageDetected = this.detectLanguage(rawContent);
    const variables = this.extractVariables(rawContent);
    const unmappedVariables = variables.filter((v) => !mappings[v]);
    const syntaxErrors: string[] = [];

    if (!rawContent.trim()) {
      syntaxErrors.push("Template script content is empty.");
    }
    if (languageDetected === "RAW" && !rawContent.includes("\n")) {
      syntaxErrors.push("Unrecognized printer command format.");
    }

    return {
      isValid: unmappedVariables.length === 0 && syntaxErrors.length === 0,
      languageDetected,
      variablesCount: variables.length,
      mappedCount: variables.length - unmappedVariables.length,
      unmappedVariables,
      syntaxErrors,
    };
  }
}
