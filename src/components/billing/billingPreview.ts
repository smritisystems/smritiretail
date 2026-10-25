import type { BillingLineItem, TransporterRow, AddonDeductionRow } from "./types.ts";
import { allocateProportionalDiscount } from "./discountAllocation.ts";

export interface BillingAdjustmentRequestItem {
  code: string;
  name: string;
  adjustment_type: "ADDON" | "DEDUCTION";
  rate_type: "FIXED" | "PERCENTAGE";
  rate_value: number;
  amount: number;
  timing: "PRE_TAX" | "POST_TAX";
  tax_treatment?: "COMPOSITE" | "SPECIFIC_SAC" | "EXEMPT" | "NON_TAXABLE";
  gst_rate?: number;
  sac_code?: string;
  override_reason?: string;
}

export interface BillingPreviewRequest {
  context: {
    company_id: string;
    branch_id: string;
    source_channel: string;
    sales_channel: string;
  };
  items: Array<{
    code: string;
    product_id?: string;
    quantity: number;
    unit_price: number;
    disc_pct: number;
    disc_amt: number;
    gst_rate?: number;
    hsn_code?: string;
    mrp?: number;
    is_tax_inclusive?: boolean;
  }>;
  customer_id?: string;
  customer_name?: string;
  customer_gstin?: string;
  billed_party_gstin_id?: string;
  billing_location_id?: string;
  billing_address?: string;
  delivery_location_id?: string;
  delivery_store_code?: string;
  delivery_gstin?: string;
  shipping_address?: string;
  po_reference_no?: string;
  customer_po_id?: string;
  adjustments?: BillingAdjustmentRequestItem[];
}

export interface BillingPreviewResult {
  gross_amount: number;
  discount_amount: number;
  taxable_amount: number;
  tax_total: number;
  subtotal: number;
  round_off: number;
  net_amount: number;
  total_addons?: number;
  total_deductions?: number;
  adjustments?: BillingAdjustmentRequestItem[];
  lines: Array<{
    line_no: number;
    unit_price: number;
    discount_amount: number;
    taxable_value: number;
    tax_amount: number;
    total_amount: number;
  }>;
}

export interface BillingPostingLine {
  grossAmount: number;
  discountAmount: number;
}

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function prepareBillingPostingLines(
  items: BillingLineItem[],
  billDiscount: number,
): BillingPostingLine[] {
  const grossAmounts = items.map((item) => roundCurrency(Math.max(0, item.rate * item.qty)));
  const lineDiscountAmounts = items.map((item, index) =>
    Math.min(grossAmounts[index], roundCurrency(Math.max(0, Number(item.discAmt) || 0)))
  );
  const allocations = allocateProportionalDiscount(
    grossAmounts.map((gross, index) => Math.max(0, roundCurrency(gross - lineDiscountAmounts[index]))),
    roundCurrency(billDiscount),
  );

  return items.map((_, index) => ({
    grossAmount: grossAmounts[index],
    discountAmount: roundCurrency(Math.min(
      grossAmounts[index],
      lineDiscountAmounts[index] + allocations[index],
    )),
  }));
}

export function buildBillingPreviewRequest(params: {
  items: BillingLineItem[];
  postingLines: BillingPostingLine[];
  companyId: string;
  branchId: string;
  salesChannel: string;
  customer?: {
    id?: string;
    name?: string;
    gstNumber?: string;
    gstin?: string;
    isTaxInclusive?: boolean;
    is_tax_inclusive?: boolean;
    taxInclusive?: boolean;
  } | null;
  billedGstin?: string | null;
  billedPartyGstinId?: string | null;
  billingLocationId?: string | null;
  billingAddress?: string | null;
  deliveryLocationId?: string | null;
  deliveryStoreCode?: string | null;
  deliveryGstin?: string | null;
  shippingAddress?: string | null;
  poReference?: string | null;
  customerPoId?: string | null;
  transporterRows?: TransporterRow[];
  addonRows?: AddonDeductionRow[];
  adjustments?: BillingAdjustmentRequestItem[];
}): BillingPreviewRequest {
  const { items, postingLines, salesChannel } = params;
  const customerTaxInclusive =
    params.customer?.isTaxInclusive
    ?? params.customer?.is_tax_inclusive
    ?? params.customer?.taxInclusive
    ?? (salesChannel.toUpperCase() === "POS_RETAIL");

  const mappedAdjustments: BillingAdjustmentRequestItem[] = params.adjustments
    ? [...params.adjustments]
    : [];

  if (!params.adjustments) {
    (params.transporterRows || []).forEach(tr => {
      const amt = Number(tr.amount) || 0;
      if (amt > 0) {
        mappedAdjustments.push({
          code: tr.code || "FREIGHT",
          name: tr.description || "Transporter Freight",
          adjustment_type: "ADDON",
          rate_type: "FIXED",
          rate_value: Number(tr.rateAmt) || Number(tr.amount) || 0,
          amount: amt,
          timing: (tr.timing === "BELOW_TAX" || tr.timing === "POST_TAX") ? "POST_TAX" : "PRE_TAX",
          tax_treatment: tr.taxTreatment || (tr.gstRate ? "SPECIFIC_SAC" : "COMPOSITE"),
          gst_rate: tr.gstRate,
          sac_code: tr.sacCode || "9965",
        });
      }
    });

    (params.addonRows || []).forEach(ar => {
      const amt = Number(ar.amount) || 0;
      if (amt > 0) {
        mappedAdjustments.push({
          code: ar.code || "ADJ",
          name: ar.description || (ar.type === "Addon" ? "Add-on" : "Deduction"),
          adjustment_type: ar.type === "Addon" ? "ADDON" : "DEDUCTION",
          rate_type: ar.rateType === "Percentage" ? "PERCENTAGE" : "FIXED",
          rate_value: Number(ar.rate) || Number(ar.amount) || 0,
          amount: amt,
          timing: (ar.timing === "BELOW_TAX" || ar.timing === "POST_TAX") ? "POST_TAX" : "PRE_TAX",
          tax_treatment: ar.taxTreatment || "COMPOSITE",
          gst_rate: ar.gstRate,
          sac_code: ar.sacCode,
        });
      }
    });
  }

  return {
    context: {
      company_id: params.companyId,
      branch_id: params.branchId,
      source_channel: salesChannel,
      sales_channel: salesChannel,
    },
    items: items.map((item, index) => ({
      code: item.stockNo || item.barcode || item.productId || "",
      ...(item.productId ? { product_id: item.productId } : {}),
      quantity: item.qty,
      unit_price: item.rate,
      disc_pct: 0,
      disc_amt: postingLines[index]?.discountAmount ?? 0,
      ...(item.gstPercentage === undefined ? {} : { gst_rate: item.gstPercentage }),
      ...(item.hsnCode ? { hsn_code: item.hsnCode } : {}),
      ...(item.mrp === undefined ? {} : { mrp: item.mrp }),
      is_tax_inclusive: item.isTaxInclusive ?? customerTaxInclusive,
    })),
    ...(params.customer?.id ? { customer_id: params.customer.id } : {}),
    ...(params.customer?.name ? { customer_name: params.customer.name } : {}),
    ...(params.billedGstin || params.customer?.gstNumber || params.customer?.gstin
      ? { customer_gstin: params.billedGstin || params.customer?.gstNumber || params.customer?.gstin }
      : {}),
    ...(params.billedPartyGstinId ? { billed_party_gstin_id: params.billedPartyGstinId } : {}),
    ...(params.billingLocationId ? { billing_location_id: params.billingLocationId } : {}),
    ...(params.billingAddress ? { billing_address: params.billingAddress } : {}),
    ...(params.deliveryLocationId ? { delivery_location_id: params.deliveryLocationId } : {}),
    ...(params.deliveryStoreCode ? { delivery_store_code: params.deliveryStoreCode } : {}),
    ...(params.deliveryGstin ? { delivery_gstin: params.deliveryGstin } : {}),
    ...(params.shippingAddress ? { shipping_address: params.shippingAddress } : {}),
    ...(params.poReference ? { po_reference_no: params.poReference } : {}),
    ...(params.customerPoId ? { customer_po_id: params.customerPoId } : {}),
    ...(mappedAdjustments.length > 0 ? { adjustments: mappedAdjustments } : {}),
  };
}
