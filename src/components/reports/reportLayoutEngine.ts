/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target       : Visual Report Designer Layout Engine & Matrix Pivot Transformer
 * Classification: Internal
 */

export type FieldLogicalRole = "Identifier" | "Classification" | "Attribute" | "Dimension" | "Measure";
export type AggregationType = "SUM" | "COUNT" | "AVG" | "MIN" | "MAX";
export type FormatType = "Number" | "Currency" | "Date" | "Percentage";
export type SortDirection = "None" | "Asc" | "Desc";
export type LayoutArea = "rows" | "columns" | "values" | "filters";

export interface LogicalReportField {
  id: string;
  key: string;
  label: string;
  role: FieldLogicalRole;
  datatype: "text" | "number" | "currency" | "date" | "badge";
  iconType: "text" | "number" | "date" | "doc";
  defaultAggregation: AggregationType;
  allowedAggregations: AggregationType[];
  defaultFormat: FormatType;
  category: string;
  description?: string;
}

export interface ConfiguredField {
  fieldId: string;
  key: string;
  label: string;
  customLabel?: string;
  aggregation: AggregationType;
  format: FormatType;
  showInTotal: boolean;
  sort: SortDirection;
}

export interface ReportLayoutState {
  rows: ConfiguredField[];      // Group by
  columns: ConfiguredField[];   // Pivot by / Matrix headers
  values: ConfiguredField[];    // Show as measures
  filters: ConfiguredField[];   // Optional filters
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical Field Catalog Grouped by Retail Logical Roles
// ─────────────────────────────────────────────────────────────────────────────
export const LOGICAL_CATALOG_FIELDS: LogicalReportField[] = [
  // ── 1. Identifiers ─────────────────────────────────────────────────────────
  {
    id: "id_item_code",
    key: "item_code",
    label: "Item Code",
    role: "Identifier",
    datatype: "text",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Items",
    description: "Unique master item code",
  },
  {
    id: "id_sku",
    key: "article_sku",
    label: "SKU",
    role: "Identifier",
    datatype: "text",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Items",
    description: "Stock keeping unit alphanumeric code",
  },
  {
    id: "id_barcode",
    key: "barcode",
    label: "Barcode",
    role: "Identifier",
    datatype: "text",
    iconType: "number",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Items",
    description: "Retail EAN/UPC barcode",
  },
  {
    id: "id_article_no",
    key: "article_sku",
    label: "Article No",
    role: "Identifier",
    datatype: "text",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Items",
    description: "Manufacturer style or article number",
  },
  {
    id: "id_invoice_no",
    key: "sale_invoice_no",
    label: "Invoice No",
    role: "Identifier",
    datatype: "text",
    iconType: "doc",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Sales",
    description: "Sales invoice or credit memo number",
  },

  // ── 2. Classifications ─────────────────────────────────────────────────────
  {
    id: "cls_dept",
    key: "department",
    label: "Department",
    role: "Classification",
    datatype: "text",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Items",
    description: "High-level department (e.g. Footwear, Apparel, Accessories)",
  },
  {
    id: "cls_cat",
    key: "item_category",
    label: "Category",
    role: "Classification",
    datatype: "text",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Items",
    description: "Product family category (e.g. Sports Shoes, Casuals)",
  },
  {
    id: "cls_brand",
    key: "brand",
    label: "Brand",
    role: "Classification",
    datatype: "text",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Items",
    description: "Merchandise brand name (e.g. Nike, Adidas, Puma)",
  },
  {
    id: "cls_article",
    key: "article_sku",
    label: "Article",
    role: "Classification",
    datatype: "text",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Items",
    description: "Article designation grouping style lines",
  },
  {
    id: "cls_subcat",
    key: "sub_category",
    label: "Sub Category",
    role: "Classification",
    datatype: "text",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Items",
    description: "Secondary classification granularity",
  },

  // ── 3. Attributes ──────────────────────────────────────────────────────────
  {
    id: "att_color",
    key: "color",
    label: "Color",
    role: "Attribute",
    datatype: "text",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Items",
    description: "Product shade / variant color (e.g. Black, Brown, White)",
  },
  {
    id: "att_size",
    key: "size",
    label: "Size",
    role: "Attribute",
    datatype: "text",
    iconType: "number",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Items",
    description: "Variant dimension size (e.g. 7, 8, 9, 40, 41, 42, M, L, XL)",
  },
  {
    id: "att_material",
    key: "material",
    label: "Material",
    role: "Attribute",
    datatype: "text",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Items",
    description: "Raw material composition (Leather, Mesh, Synthetic)",
  },
  {
    id: "att_season",
    key: "season",
    label: "Season",
    role: "Attribute",
    datatype: "text",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Items",
    description: "Fashion release cycle (SS26, AW26, Core)",
  },
  {
    id: "att_style_code",
    key: "style_code",
    label: "Style Code",
    role: "Attribute",
    datatype: "text",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Items",
    description: "Design style descriptor code",
  },

  // ── 4. Dimensions ──────────────────────────────────────────────────────────
  {
    id: "dim_branch",
    key: "branch_name",
    label: "Branch",
    role: "Dimension",
    datatype: "text",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Sales",
    description: "Retail outlet store location",
  },
  {
    id: "dim_customer",
    key: "customer_name",
    label: "Customer",
    role: "Dimension",
    datatype: "text",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Customers",
    description: "B2B client or retail consumer name",
  },
  {
    id: "dim_supplier",
    key: "supplier",
    label: "Supplier",
    role: "Dimension",
    datatype: "text",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Suppliers",
    description: "Vendor vendor legal commercial trade entity",
  },
  {
    id: "dim_staff",
    key: "staff_name",
    label: "Sales Staff",
    role: "Dimension",
    datatype: "text",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Sales",
    description: "Salesperson or cashier servicing the ticket",
  },
  {
    id: "dim_date",
    key: "sale_date",
    label: "Date",
    role: "Dimension",
    datatype: "date",
    iconType: "date",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Date",
    category: "Sales",
    description: "Transaction posting date",
  },
  {
    id: "dim_paymode",
    key: "payment_mode",
    label: "Payment Mode",
    role: "Dimension",
    datatype: "badge",
    iconType: "text",
    defaultAggregation: "COUNT",
    allowedAggregations: ["COUNT"],
    defaultFormat: "Number",
    category: "Sales",
    description: "Tender instrument (Cash, UPI, Card, Credit)",
  },

  // ── 5. Measures ────────────────────────────────────────────────────────────
  {
    id: "meas_qty",
    key: "quantity",
    label: "Quantity",
    role: "Measure",
    datatype: "number",
    iconType: "number",
    defaultAggregation: "SUM",
    allowedAggregations: ["SUM", "COUNT", "AVG", "MIN", "MAX"],
    defaultFormat: "Number",
    category: "Sales",
    description: "Total transacted units / pieces",
  },
  {
    id: "meas_gross",
    key: "gross_total",
    label: "Gross Total",
    role: "Measure",
    datatype: "currency",
    iconType: "number",
    defaultAggregation: "SUM",
    allowedAggregations: ["SUM", "AVG", "MIN", "MAX"],
    defaultFormat: "Currency",
    category: "Sales",
    description: "Gross invoice monetary value before tax and deductions",
  },
  {
    id: "meas_disc",
    key: "discount_amount",
    label: "Discount Amount",
    role: "Measure",
    datatype: "currency",
    iconType: "number",
    defaultAggregation: "SUM",
    allowedAggregations: ["SUM", "AVG", "MIN", "MAX"],
    defaultFormat: "Currency",
    category: "Sales",
    description: "Item promotional and customer markdown discount amount",
  },
  {
    id: "meas_tax",
    key: "tax_amount",
    label: "Tax Amount",
    role: "Measure",
    datatype: "currency",
    iconType: "number",
    defaultAggregation: "SUM",
    allowedAggregations: ["SUM", "AVG"],
    defaultFormat: "Currency",
    category: "Sales",
    description: "Output GST / VAT tax amount",
  },
  {
    id: "meas_net",
    key: "net_total",
    label: "Net Total",
    role: "Measure",
    datatype: "currency",
    iconType: "number",
    defaultAggregation: "SUM",
    allowedAggregations: ["SUM", "AVG", "MIN", "MAX"],
    defaultFormat: "Currency",
    category: "Sales",
    description: "Net realized commercial invoice settlement amount",
  },
  {
    id: "meas_cost",
    key: "valuation_cost",
    label: "Cost Amount",
    role: "Measure",
    datatype: "currency",
    iconType: "number",
    defaultAggregation: "SUM",
    allowedAggregations: ["SUM", "AVG"],
    defaultFormat: "Currency",
    category: "Inventory",
    description: "Standard or weighted acquisition cost valuation",
  },
  {
    id: "meas_margin",
    key: "margin_amount",
    label: "Margin Amount",
    role: "Measure",
    datatype: "currency",
    iconType: "number",
    defaultAggregation: "SUM",
    allowedAggregations: ["SUM", "AVG"],
    defaultFormat: "Currency",
    category: "Sales",
    description: "Gross profit margin contribution (Net Total - Cost)",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Default Layout State Preset: Sales Analysis (Brand -> Article -> Color x Size)
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_REPORT_LAYOUT: ReportLayoutState = {
  rows: [
    {
      fieldId: "cls_brand",
      key: "brand",
      label: "Brand",
      aggregation: "COUNT",
      format: "Number",
      showInTotal: true,
      sort: "Asc",
    },
    {
      fieldId: "cls_article",
      key: "article_sku",
      label: "Article",
      aggregation: "COUNT",
      format: "Number",
      showInTotal: true,
      sort: "Asc",
    },
    {
      fieldId: "att_color",
      key: "color",
      label: "Color",
      aggregation: "COUNT",
      format: "Number",
      showInTotal: true,
      sort: "None",
    },
  ],
  columns: [
    {
      fieldId: "att_size",
      key: "size",
      label: "Size",
      aggregation: "COUNT",
      format: "Number",
      showInTotal: true,
      sort: "Asc",
    },
  ],
  values: [
    {
      fieldId: "meas_qty",
      key: "quantity",
      label: "Quantity",
      aggregation: "SUM",
      format: "Number",
      showInTotal: true,
      sort: "None",
    },
    {
      fieldId: "meas_net",
      key: "net_total",
      label: "Net Total",
      aggregation: "SUM",
      format: "Currency",
      showInTotal: true,
      sort: "None",
    },
  ],
  filters: [
    {
      fieldId: "dim_date",
      key: "sale_date",
      label: "Date (This Year)",
      aggregation: "COUNT",
      format: "Date",
      showInTotal: false,
      sort: "None",
    },
    {
      fieldId: "dim_branch",
      key: "branch_name",
      label: "Branch (All)",
      aggregation: "COUNT",
      format: "Number",
      showInTotal: false,
      sort: "None",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Drag and Drop Eligibility Rules
// ─────────────────────────────────────────────────────────────────────────────
export function canFieldDropInArea(
  field: LogicalReportField,
  targetArea: LayoutArea
): { allowed: boolean; reason?: string } {
  if (targetArea === "values") {
    if (field.role !== "Measure" && field.defaultAggregation !== "COUNT") {
      return {
        allowed: false,
        reason: `${field.label} is a ${field.role}. Only Measures or countable fields can be placed in Values.`,
      };
    }
  }

  if (targetArea === "columns") {
    if (field.role === "Measure") {
      return {
        allowed: false,
        reason: "Measures cannot be used as Pivot Column headers. Place measures in 'Values'.",
      };
    }
  }

  return { allowed: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Matrix & Pivot Transformer
// Transforms flat rows into a hierarchical matrix with dynamic column pivots
// ─────────────────────────────────────────────────────────────────────────────
export interface PivotMatrixResult {
  isPivoted: boolean;
  rowHeaders: string[];
  pivotColumnValues: string[];
  measureHeaders: string[];
  treeRows: PivotTreeRow[];
  subtotals: Record<string, any>[];
  grandTotals: {
    columnTotals: Record<string, number>;
    totalQty: number;
    totalAmount: number;
  };
}

export interface PivotTreeRow {
  id: string;
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
  groupLabel?: string;
  rowKeys: Record<string, string>;
  cellValues: Record<string, number>; // key: pivotColVal (e.g. "Size 40") -> value
  totalQty: number;
  totalAmount: number;
  children?: PivotTreeRow[];
}

export function transformToPivotMatrix(
  data: Record<string, any>[],
  layout: ReportLayoutState
): PivotMatrixResult {
  const rowFields = layout.rows;
  const colFields = layout.columns;
  const valFields = layout.values;

  // If no columns are placed in 'columns', return non-pivoted tabular representation
  if (colFields.length === 0 || rowFields.length === 0) {
    return {
      isPivoted: false,
      rowHeaders: rowFields.map((f) => f.customLabel || f.label),
      pivotColumnValues: [],
      measureHeaders: valFields.map((f) => f.customLabel || f.label),
      treeRows: [],
      subtotals: [],
      grandTotals: {
        columnTotals: {},
        totalQty: 0,
        totalAmount: 0,
      },
    };
  }

  const pivotColKey = colFields[0].key; // e.g. "size"
  const pivotColLabel = colFields[0].customLabel || colFields[0].label;

  // 1. Discover all distinct pivot column values (e.g. Size 40, Size 41, Size 42)
  const distinctColValsSet = new Set<string>();
  for (const row of data) {
    const rawVal = row[pivotColKey];
    if (rawVal !== undefined && rawVal !== null && rawVal !== "-") {
      distinctColValsSet.add(String(rawVal));
    }
  }

  // Sort discovered pivot column values (e.g. 7, 8, 9, 10 or 40, 41, 42)
  const sortedColVals = Array.from(distinctColValsSet).sort((a, b) => {
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  // Ensure standard retail size defaults if data has few sizes
  const finalColVals = sortedColVals.length > 0 ? sortedColVals : ["40", "41", "42"];

  // 2. Group rows hierarchically by rowFields (e.g. Brand -> Article -> Color)
  const topGroupKey = rowFields[0].key; // e.g. "brand"
  const topGroupsMap = new Map<string, Record<string, any>[]>();

  for (const row of data) {
    let topVal = String(row[topGroupKey] || "").trim();
    if (!topVal || topVal === "-") {
      topVal = String(row.brand || row.supplier || row.customer_name || "Main Store").trim();
      if (!topVal || topVal === "-") topVal = "Main Store";
    }
    if (!topGroupsMap.has(topVal)) {
      topGroupsMap.set(topVal, []);
    }
    topGroupsMap.get(topVal)!.push(row);
  }

  const treeRows: PivotTreeRow[] = [];
  const grandColTotals: Record<string, number> = {};
  for (const cv of finalColVals) {
    grandColTotals[cv] = 0;
  }
  let grandTotalQty = 0;
  let grandTotalAmount = 0;

  for (const [groupName, groupRecords] of topGroupsMap.entries()) {
    const groupColTotals: Record<string, number> = {};
    for (const cv of finalColVals) {
      groupColTotals[cv] = 0;
    }
    let groupTotalQty = 0;
    let groupTotalAmount = 0;

    // Sub-group by subsequent row fields (e.g. article_sku + color)
    const detailKeyMap = new Map<string, {
      rowKeys: Record<string, string>;
      cellValues: Record<string, number>;
      qty: number;
      amount: number;
    }>();

    for (const rec of groupRecords) {
      const compositeKey = rowFields.map((rf) => String(rec[rf.key] || "-")).join("::");
      if (!detailKeyMap.has(compositeKey)) {
        const rowKeys: Record<string, string> = {};
        for (const rf of rowFields) {
          rowKeys[rf.key] = String(rec[rf.key] || "-");
        }
        detailKeyMap.set(compositeKey, {
          rowKeys,
          cellValues: {},
          qty: 0,
          amount: 0,
        });
      }

      const item = detailKeyMap.get(compositeKey)!;
      const rawCol = String(rec[pivotColKey] || "").trim();
      const recColVal = (rawCol && rawCol !== "-") ? rawCol : finalColVals[0];
      const recQty = parseFloat(String(rec.quantity || 0)) || 0;
      const recAmt = parseFloat(String(rec.net_total || rec.net_amount || 0)) || 0;

      item.cellValues[recColVal] = (item.cellValues[recColVal] || 0) + recQty;
      item.qty += recQty;
      item.amount += recAmt;

      groupColTotals[recColVal] = (groupColTotals[recColVal] || 0) + recQty;
      groupTotalQty += recQty;
      groupTotalAmount += recAmt;

      grandColTotals[recColVal] = (grandColTotals[recColVal] || 0) + recQty;
      grandTotalQty += recQty;
      grandTotalAmount += recAmt;
    }

    // Detail rows for this brand/group
    const childRows: PivotTreeRow[] = [];
    for (const [key, item] of detailKeyMap.entries()) {
      childRows.push({
        id: `detail-${key}`,
        rowKeys: item.rowKeys,
        cellValues: item.cellValues,
        totalQty: item.qty,
        totalAmount: item.amount,
      });
    }

    // Subtotal row for this group
    const subtotalRow: PivotTreeRow = {
      id: `subtotal-${groupName}`,
      isSubtotal: true,
      groupLabel: `${groupName} Total`,
      rowKeys: { [topGroupKey]: `${groupName} Total` },
      cellValues: groupColTotals,
      totalQty: groupTotalQty,
      totalAmount: groupTotalAmount,
      children: childRows,
    };

    treeRows.push(subtotalRow);
  }

  return {
    isPivoted: true,
    rowHeaders: rowFields.map((f) => f.customLabel || f.label),
    pivotColumnValues: finalColVals.map((v) => `${pivotColLabel} ${v}`),
    measureHeaders: ["Total Qty", "Net Total (₹)"],
    treeRows,
    subtotals: [],
    grandTotals: {
      columnTotals: grandColTotals,
      totalQty: grandTotalQty,
      totalAmount: grandTotalAmount,
    },
  };
}

