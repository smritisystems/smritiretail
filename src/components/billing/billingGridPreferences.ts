export type BillingGridView = "invoice" | "salesOrder";

export interface BillingGridColumnDefinition {
  key: string;
  label: string;
  width: string;
  fixed?: boolean;
  required?: boolean;
}

export interface BillingGridViewLayout {
  order: string[];
  visible: string[];
}

export interface BillingGridLayout {
  version: 2;
  invoice: BillingGridViewLayout;
  salesOrder: BillingGridViewLayout;
}

export const BILLING_GRID_COLUMNS: Record<BillingGridView, BillingGridColumnDefinition[]> = {
  invoice: [
    { key: "row", label: "#", width: "36px", fixed: true, required: true },
    { key: "barcode", label: "Barcode", width: "130px" },
    { key: "article", label: "Article", width: "100px" },
    { key: "color", label: "Color", width: "72px" },
    { key: "size", label: "Size", width: "58px" },
    { key: "description", label: "Item Description", width: "240px", required: true },
    { key: "rate", label: "Rate (₹)", width: "90px" },
    { key: "mrp", label: "MRP (₹)", width: "90px" },
    { key: "qty", label: "Qty", width: "72px", required: true },
    { key: "gross", label: "Gross (₹)", width: "96px" },
    { key: "discountPercent", label: "Disc %", width: "72px" },
    { key: "discountAmount", label: "Disc (₹)", width: "88px" },
    { key: "gst", label: "GST", width: "70px" },
    { key: "total", label: "Total (₹)", width: "100px" },
    { key: "salesperson", label: "Salesperson", width: "130px" },
    { key: "actions", label: "Actions", width: "48px", fixed: true },
  ],
  salesOrder: [
    { key: "select", label: "Select", width: "36px", fixed: true, required: true },
    { key: "row", label: "#", width: "36px", fixed: true, required: true },
    { key: "soNumber", label: "SO No.", width: "125px" },
    { key: "barcode", label: "Barcode", width: "145px" },
    { key: "article", label: "Article", width: "110px" },
    { key: "description", label: "Item Description", width: "190px" },
    { key: "color", label: "Color", width: "82px" },
    { key: "size", label: "Size", width: "68px" },
    { key: "soQty", label: "SO Qty", width: "78px" },
    { key: "fulfilledQty", label: "Fulfilled", width: "82px" },
    { key: "pendingQty", label: "Pending", width: "82px" },
    { key: "billQty", label: "Bill Qty", width: "92px", required: true },
    { key: "rate", label: "Rate (₹)", width: "92px" },
    { key: "discountPercent", label: "Disc %", width: "72px" },
    { key: "discountAmount", label: "Disc (₹)", width: "92px" },
    { key: "taxable", label: "Taxable (₹)", width: "104px" },
    { key: "gst", label: "GST %", width: "72px" },
    { key: "gstAmount", label: "GST (₹)", width: "92px" },
    { key: "total", label: "Total (₹)", width: "100px" },
    { key: "status", label: "Status", width: "100px", fixed: true, required: true },
  ],
};

const makeDefaultView = (columns: BillingGridColumnDefinition[]): BillingGridViewLayout => ({
  order: columns.map(column => column.key),
  visible: columns.map(column => column.key),
});

export const DEFAULT_BILLING_GRID_LAYOUT: BillingGridLayout = {
  version: 2,
  invoice: makeDefaultView(BILLING_GRID_COLUMNS.invoice),
  salesOrder: makeDefaultView(BILLING_GRID_COLUMNS.salesOrder),
};

export function normalizeBillingGridLayout(value: unknown): BillingGridLayout {
  const parsed = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const isLegacyLayout = typeof parsed.version !== "number" || parsed.version < 2;

  const normalizeView = (view: BillingGridView): BillingGridViewLayout => {
    const raw = parsed[view] && typeof parsed[view] === "object" && !Array.isArray(parsed[view])
      ? parsed[view] as Record<string, unknown>
      : {};
    const keys = BILLING_GRID_COLUMNS[view].map(column => column.key);
    const suppliedOrder = Array.isArray(raw.order)
      ? raw.order.filter((key): key is string => typeof key === "string" && keys.includes(key))
      : [];
    const order = [...new Set([...suppliedOrder, ...keys])];
    const suppliedVisible = Array.isArray(raw.visible)
      ? raw.visible.filter((key): key is string => typeof key === "string" && keys.includes(key))
      : keys;
    const required = BILLING_GRID_COLUMNS[view].filter(column => column.required).map(column => column.key);
    const newlyIntroduced = view === "salesOrder" && isLegacyLayout
      ? ["description", "discountPercent", "discountAmount", "taxable", "gstAmount"]
      : [];
    const visible = [...new Set([...suppliedVisible, ...newlyIntroduced, ...required])];
    if (visible.length === 0) visible.push(keys[0]);
    return { order, visible };
  };

  return {
    version: 2,
    invoice: normalizeView("invoice"),
    salesOrder: normalizeView("salesOrder"),
  };
}

export function getVisibleBillingGridColumns(
  view: BillingGridView,
  layout: BillingGridLayout
): BillingGridColumnDefinition[] {
  const definitions = new Map(BILLING_GRID_COLUMNS[view].map(column => [column.key, column]));
  const config = normalizeBillingGridLayout(layout)[view];
  return config.order
    .filter(key => config.visible.includes(key))
    .flatMap(key => {
      const column = definitions.get(key);
      return column ? [column] : [];
    });
}
