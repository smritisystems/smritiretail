/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.12.0
 * Created      : 2026-08-24
 * Modified     : 2026-09-07
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { TaxHeaderBar } from "./components/TaxHeaderBar.tsx";
import { TaxInvoiceDoc } from "./components/TaxInvoiceDoc.tsx";
import { TaxInvoiceItemGrid } from "./components/TaxInvoiceItemGrid.tsx";
import { TaxFooterTabs } from "./components/TaxFooterTabs.tsx";
import { TaxStatusBar } from "./components/TaxStatusBar.tsx";
import { TaxInvoiceDocumentState, TaxInvoiceItemRow } from "./types.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { getCustomers, refreshCustomerCache } from "../../services/customerStore.ts";
import { ExportColumnDefinition } from "../export/types.ts";
import { X, Search, Zap, CheckCircle2, AlertCircle } from "lucide-react";
import { useF2Screen } from "../../context/F2DispatcherContext.tsx";
import type { LookupResult } from "../../context/F2DispatcherContext.tsx";

export interface SmritiDistributorTaxInvoiceWorkspaceProps {
  initialInvoiceId?: string;
  onExit?: () => void;
  onNotification?: (title: string, msg: string, type?: "success" | "error" | "info" | "warning") => void;
  currentUser?: { role: string; name: string } | null;
}

export const deriveCustomerInvoiceDefaults = (
  customer: any | null,
  gstRegistrations: any[] = [],
  deliveryLocations: any[] = []
) => {
  const primaryReg = gstRegistrations.find((reg: any) => reg.is_primary) || gstRegistrations[0] || null;
  const defaultDelivery = deliveryLocations.find((loc: any) => loc.is_default) || deliveryLocations[0] || null;
  const customerGstin = customer?.gstNumber || customer?.gstin || primaryReg?.gstin || "";
  const placeOfSupplyCode = defaultDelivery?.state_code || primaryReg?.state_code || "27";

  const hasCustomerProfile = !!customer && (
    !!customer.id ||
    !!customer.name ||
    !!customer.gstNumber ||
    !!customer.gstin ||
    !!customer.customerGroupId ||
    Number(customer.creditLimit ?? customer.credit_limit ?? 0) > 0
  );

  const transactionMode = hasCustomerProfile
    ? (
        primaryReg && defaultDelivery && primaryReg.state_code && defaultDelivery.state_code && primaryReg.state_code !== defaultDelivery.state_code
          ? "Interstate Sale"
          : "Tax Invoice"
      )
    : "Tax Invoice";

  return {
    billType: "Tax Invoice" as const,
    transactionMode,
    customerGstin,
    placeOfSupplyCode,
  };
};

const DEFAULT_DOC_STATE: TaxInvoiceDocumentState = {
  billType: "Tax Invoice",
  transactionMode: "Tax Invoice",
  docPrefix: "D1DS13",
  docNo: "1",
  docDate: new Date().toISOString().split("T")[0],
  customerId: "",
  customerCode: "",
  customerName: "",
  customerGstin: "",
  customerMobile: "",
  customerAddress: "",
  salesStaff: "EMP001 - Jawahar Mallah",
  items: [],
  transporterDetails: [],
  paymentDetails: [],
  addonsAndDeductions: [],
  documentRemarks: "",
  // Canonical Physical Origin / Dispatch From (Configured Tattly Threads Depot)
  dispatchFromLocationId: "wh-ngp-001",
  dispatchFromName: "Tattly Threads Nagpur Depot",
  dispatchFromAddress: "Om Sai Nagar, Kalamana, Nagpur, Maharashtra - 440029",
  dispatchFromSnapshot: {
    location_id: "wh-ngp-001",
    code: "WH-NGP",
    name: "Tattly Threads",
    location_name: "Tattly Threads Nagpur Depot",
    address_line1: "Om Sai Nagar, Kalamana",
    city: "Nagpur",
    district: "Nagpur",
    state: "Maharashtra",
    state_code: "27",
    pincode: "440029",
    gstin: "27AAXFT2508H1ZR",
  },
};

export const calculateTaxInvoiceMetrics = (
  items: TaxInvoiceItemRow[],
  addonsAndDeductions: TaxInvoiceDocumentState["addonsAndDeductions"]
) => {
  const totalQty = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const salesValue = items.reduce((sum, item) => sum + (Number(item.rate) || 0) * (Number(item.qty) || 0), 0);
  const itemDiscount = items.reduce((sum, item) => {
    const lineValue = (Number(item.rate) || 0) * (Number(item.qty) || 0);
    return sum + (Number(item.discAmt) || (lineValue * (Number(item.discPercent) || 0)) / 100);
  }, 0);
  const totalTax = items.reduce((sum, item) => {
    const lineValue = (Number(item.rate) || 0) * (Number(item.qty) || 0);
    const lineDiscount = Number(item.discAmt) || (lineValue * (Number(item.discPercent) || 0)) / 100;
    return sum + (Math.max(0, lineValue - lineDiscount) * (Number(item.gstRate) || 18)) / 100;
  }, 0);
  const totalAddons = addonsAndDeductions.filter((entry) => entry.type === "Addon")
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const totalDeductions = addonsAndDeductions.filter((entry) => entry.type === "Deduction")
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);

  return {
    itemCount: items.length,
    totalQty,
    salesValue,
    itemDiscount,
    billDiscount: 0,
    totalTax,
    totalAddons,
    totalDeductions,
    netAmount: Math.max(0, salesValue - itemDiscount + totalTax + totalAddons - totalDeductions),
  };
};

export const openCanonicalInvoicePrint = async (
  invoiceId: string,
  onNotification?: (title: string, msg: string, type?: "success" | "error" | "info" | "warning") => void,
  customApiFetch = apiFetchV1
) => {
  const printWindow = typeof window !== "undefined" && window.open ? window.open("", "_blank") : null;
  try {
    const pdf = await customApiFetch<Blob>(`/sales/invoices/${invoiceId}/pdf`);
    const pdfUrl = typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(pdf) : `blob:mock-pdf-${invoiceId}`;
    if (!printWindow) {
      if (typeof URL !== "undefined" && URL.revokeObjectURL) {
        URL.revokeObjectURL(pdfUrl);
      }
      throw new Error("The print window was blocked. Please allow pop-ups and retry.");
    }
    printWindow.location.href = pdfUrl;
    if (typeof window !== "undefined" && typeof URL !== "undefined" && URL.revokeObjectURL) {
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    }
    return { success: true, pdfUrl, printWindow };
  } catch (error: any) {
    printWindow?.close();
    onNotification?.("Print Error", error?.message || "Unable to render the canonical tax invoice PDF.", "error");
    throw error;
  }
};

export const normalizeCustomerCatalogEntry = (customer: any) => {
  if (!customer || typeof customer !== "object") {
    return null;
  }

  const id = String(
    customer.id ?? customer.customer_id ?? customer.customerId ?? customer.code ?? customer.customer_code ?? customer.mobile ?? `customer-${Math.random().toString(36).slice(2)}`
  );

  return {
    id,
    code: String(customer.code ?? customer.customer_code ?? customer.customerCode ?? ""),
    name: String(customer.name ?? customer.customer_name ?? customer.company_name ?? "Walk-in Customer"),
    mobile: String(customer.mobile ?? customer.phone ?? customer.contact_no ?? ""),
    gstin: String(customer.gstin ?? customer.gst_number ?? customer.gstNumber ?? customer.gstin_number ?? ""),
    gstNumber: String(customer.gstNumber ?? customer.gst_number ?? customer.gstin ?? customer.gstin_number ?? ""),
    customerGroupId: String(customer.customer_group_id ?? customer.customerGroupId ?? customer.group_id ?? ""),
    status: customer.status ?? "Active",
    email: customer.email ?? "",
    address: customer.address ?? customer.billing_address ?? customer.customer_address ?? "",
    city: customer.city ?? "",
    ...customer,
  };
};

export const DistTaxInvoice: React.FC<SmritiDistributorTaxInvoiceWorkspaceProps> = ({
  initialInvoiceId,
  onExit,
  onNotification,
  currentUser,
}) => {
  const [docState, setDocState] = useState<TaxInvoiceDocumentState>(DEFAULT_DOC_STATE);
  const [isSaving, setIsSaving] = useState(false);

  // Modals & Auxiliary View states
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSkuModalOpen, setIsSkuModalOpen] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [activeAuxTab, setActiveAuxTab] = useState<"items" | "transporter" | "remarks" | "addons">("items");

  // Search state
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [skuSearchQuery, setSkuSearchQuery] = useState("");
  const [customersList, setCustomersList] = useState<any[]>([]);

  // Corporate B2B Multi-State GST, Billing & Delivery Location State
  const [customerGstRegistrations, setCustomerGstRegistrations] = useState<any[]>([]);
  const [customerDeliveryLocations, setCustomerDeliveryLocations] = useState<any[]>([]);
  const [customerBillingLocations, setCustomerBillingLocations] = useState<any[]>([]);
  const [isLoadingB2BData, setIsLoadingB2BData] = useState<boolean>(false);

  // Load customer directory from the live CRM cache/backend, never from the legacy sample fallback.
  const loadCustomers = useCallback(async () => {
    try {
      await refreshCustomerCache();
    } catch (err) {
      console.warn("Customer cache refresh failed in invoice workspace:", err);
    }

    try {
      const cached = getCustomers();
      const res = await apiFetchV1("/crm/customers");
      const sourceList = Array.isArray(res) ? res : res?.items || res?.data || [];
      const normalized = sourceList.length > 0
        ? sourceList.map(normalizeCustomerCatalogEntry).filter(Boolean)
        : cached.map(normalizeCustomerCatalogEntry).filter(Boolean);

      setCustomersList(normalized);
    } catch {
      const cached = getCustomers();
      setCustomersList(cached.map(normalizeCustomerCatalogEntry).filter(Boolean));
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // Fetch Customer B2B Corporate Multi-State GST & Locations (Full parity with BillingTerm)
  const fetchCustomerB2BData = useCallback(async (customerId: string) => {
    if (!customerId || customerId === "CUST-WALKIN") {
      setCustomerGstRegistrations([]);
      setCustomerDeliveryLocations([]);
      setCustomerBillingLocations([]);
      return;
    }
    setIsLoadingB2BData(true);
    try {
      const [regsRes, locsRes, blocRes] = await Promise.all([
        apiFetchV1(`/crm/customers/${customerId}/gst-registrations`).catch(() => []),
        apiFetchV1(`/crm/customers/${customerId}/delivery-locations`).catch(() => []),
        apiFetchV1(`/crm/customers/${customerId}/billing-locations`).catch(() => []),
      ]);

      const regs = Array.isArray(regsRes) ? regsRes : regsRes?.items || [];
      const locs = Array.isArray(locsRes) ? locsRes : locsRes?.items || [];
      const blocs = Array.isArray(blocRes) ? blocRes : blocRes?.items || [];

      setCustomerGstRegistrations(regs);
      setCustomerDeliveryLocations(locs);
      setCustomerBillingLocations(blocs);

      const primaryReg = regs.find((r: any) => r.is_primary) || (regs.length > 0 ? regs[0] : null);
      const defaultBloc = blocs.find((b: any) => b.is_default) || (blocs.length > 0 ? blocs[0] : null);
      const defaultDelLoc = locs.find((l: any) => l.is_default) || (locs.length > 0 ? locs[0] : null);

      const delSnapshot = defaultDelLoc ? {
        id: defaultDelLoc.id,
        store_code: defaultDelLoc.store_code,
        location_name: defaultDelLoc.location_name,
        address_line1: defaultDelLoc.address_line1,
        address_line2: defaultDelLoc.address_line2,
        city: defaultDelLoc.city,
        state_code: defaultDelLoc.state_code,
        state_name: defaultDelLoc.state_name || defaultDelLoc.state,
        pin_code: defaultDelLoc.pin_code || defaultDelLoc.pincode,
        delivery_gstin: defaultDelLoc.delivery_gstin || defaultDelLoc.gstin,
        contact_person: defaultDelLoc.contact_person,
        contact_phone: defaultDelLoc.contact_phone || defaultDelLoc.phone,
      } : null;

      const derivedDefaults = deriveCustomerInvoiceDefaults({
        id: customerId,
        gstNumber: primaryReg?.gstin || "",
        gstin: primaryReg?.gstin || "",
        customerGroupId: "CG-Corporate",
      }, regs, locs);

      setDocState((prev) => ({
        ...prev,
        billType: derivedDefaults.billType,
        transactionMode: derivedDefaults.transactionMode as TaxInvoiceDocumentState["transactionMode"],
        billedPartyGstinId: primaryReg?.id || prev.billedPartyGstinId || null,
        customerGstin: primaryReg?.gstin || prev.customerGstin,
        billingLocationId: defaultBloc?.id || prev.billingLocationId || null,
        billingStoreCode: defaultBloc?.billing_store_code || defaultBloc?.store_code || prev.billingStoreCode || null,
        billingAddress: defaultBloc ? [defaultBloc.address_line1, defaultBloc.city, defaultBloc.state].filter(Boolean).join(", ") : prev.billingAddress,
        deliveryLocationId: defaultDelLoc?.id || prev.deliveryLocationId || null,
        deliveryStoreCode: defaultDelLoc?.store_code || prev.deliveryStoreCode || null,
        deliveryGstin: defaultDelLoc?.delivery_gstin || defaultDelLoc?.gstin || prev.deliveryGstin || null,
        deliveryLocationSnapshot: delSnapshot || prev.deliveryLocationSnapshot || null,
        shippingAddress: defaultDelLoc ? [defaultDelLoc.address_line1, defaultDelLoc.city, defaultDelLoc.state_name || defaultDelLoc.state].filter(Boolean).join(", ") : prev.shippingAddress,
        placeOfSupplyCode: defaultDelLoc?.state_code || primaryReg?.state_code || derivedDefaults.placeOfSupplyCode || prev.placeOfSupplyCode || (prev.transactionMode === "Interstate Sale" ? "18" : "27"),
      }));
    } catch (err) {
      console.error("Error fetching customer B2B corporate locations:", err);
    } finally {
      setIsLoadingB2BData(false);
    }
  }, []);

  // Lookup product via API
  const handleLookupProduct = useCallback(async (term: string): Promise<any | null> => {
    try {
      const res = await apiFetchV1(`/products?search=${encodeURIComponent(term)}`);
      const items = Array.isArray(res) ? res : res?.items || res?.products || [];
      if (items.length > 0) {
        return items[0];
      }
    } catch {
      // Ignore network errors in lookup
    }
    return null;
  }, []);

  // Update doc state partials
  const handleDocChange = (updates: Partial<TaxInvoiceDocumentState>) => {
    setDocState((prev) => ({ ...prev, ...updates }));
  };

  // Add Item to grid
  const handleAddItem = (item: Omit<TaxInvoiceItemRow, "sNo" | "id">) => {
    setDocState((prev) => {
      const newRow: TaxInvoiceItemRow = {
        ...item,
        id: `ROW-${Date.now()}-${prev.items.length + 1}`,
        sNo: prev.items.length + 1,
      };
      return {
        ...prev,
        items: [...prev.items, newRow],
      };
    });
  };

  // Update Item in grid
  const handleUpdateItem = (index: number, updates: Partial<TaxInvoiceItemRow>) => {
    setDocState((prev) => {
      const nextItems = [...prev.items];
      if (nextItems[index]) {
        nextItems[index] = { ...nextItems[index], ...updates };
      }
      return { ...prev, items: nextItems };
    });
  };

  // Delete Item from grid
  const handleDeleteItem = (index: number) => {
    setDocState((prev) => {
      const filtered = prev.items.filter((_, i) => i !== index);
      const renumbered = filtered.map((it, i) => ({ ...it, sNo: i + 1 }));
      return { ...prev, items: renumbered };
    });
  };

  const metrics = useMemo(
    () => calculateTaxInvoiceMetrics(docState.items, docState.addonsAndDeductions),
    [docState.items, docState.addonsAndDeductions]
  );

  // Customer selection
  const handleSelectCustomer = (cust: any) => {
    const derivedDefaults = deriveCustomerInvoiceDefaults(cust, customerGstRegistrations, customerDeliveryLocations);

    setDocState((prev) => ({
      ...prev,
      billType: derivedDefaults.billType,
      transactionMode: derivedDefaults.transactionMode as TaxInvoiceDocumentState["transactionMode"],
      customerId: cust.id,
      customerCode: cust.code || cust.id,
      customerName: cust.name,
      customerGstin: cust.gstin || cust.gstNumber || derivedDefaults.customerGstin || "",
      customerMobile: cust.mobile || "",
      customerAddress: cust.address || cust.city || "",
      placeOfSupplyCode: derivedDefaults.placeOfSupplyCode || prev.placeOfSupplyCode || "27",
    }));
    setIsCustomerModalOpen(false);
    onNotification?.("Customer Attached", `Selected ${cust.name} for this invoice. Loading location accounts...`, "info");
    void fetchCustomerB2BData(cust.id);
  };

  // Save invoice
  const handleSaveInvoice = async () => {
    if (!docState.customerName.trim()) {
      onNotification?.("Customer Required", "Please select or enter a Customer before saving.", "error");
      return;
    }
    if (docState.items.length === 0) {
      onNotification?.("No Items Entered", "Please add at least one line item before saving.", "error");
      return;
    }

    setIsSaving(true);
    try {
      // Disambiguate credit mode: payment mode is CREDIT only if payment details specify Credit, NOT because it is Interstate
      const isCreditTx = docState.billType === "Credit Note"
        ? false
        : docState.paymentDetails.some(p => (p.mode || "").toUpperCase() === "CREDIT");
      const totalTendered = docState.paymentDetails.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

      const payload: any = {
        // Canonical Document Numbering: pass undefined to let backend allocate canonical sequence
        invoice_no: undefined,
        bill_type: docState.billType,
        transaction_mode: docState.transactionMode,
        is_interstate: docState.transactionMode === "Interstate Sale",
        customer_id: docState.customerId || "CUST-WALKIN",
        customer_name: docState.customerName,
        customer_gstin: docState.customerGstin,
        payment_mode: isCreditTx ? "CREDIT" : (docState.paymentDetails[0]?.mode?.toUpperCase() || "CASH"),
        paid_amount: isCreditTx ? 0 : totalTendered,
        balance_amount: isCreditTx ? metrics.netAmount : Math.max(0, metrics.netAmount - totalTendered),
        salesperson_name: docState.salesStaff,
        // Enterprise B2B Distributor Location & Statutory Fields (Full parity with BillingTerm)
        billing_location_id: docState.billingLocationId || null,
        billing_store_code: docState.billingStoreCode || null,
        billing_address: docState.billingAddress || docState.customerAddress || null,
        delivery_location_id: docState.deliveryLocationId || null,
        delivery_store_code: docState.deliveryStoreCode || null,
        delivery_gstin: docState.deliveryGstin || null,
        delivery_location_snapshot: docState.deliveryLocationSnapshot || null,
        shipping_address: docState.shippingAddress || null,
        billed_party_gstin_id: docState.billedPartyGstinId || null,
        place_of_supply_code: docState.placeOfSupplyCode || null,
        po_reference: docState.poReference || null,
        items: docState.items.map((it) => ({
          code: it.stockNo,
          name: it.itemDescription,
          price: it.rate,
          quantity: it.qty,
          disc_pct: it.discPercent,
          taxable_value: Math.max(0, (Number(it.rate) || 0) * (Number(it.qty) || 0) - (Number(it.discAmt) || 0)),
          tax_amount: Math.max(0, (Number(it.rate) || 0) * (Number(it.qty) || 0) - (Number(it.discAmt) || 0)) * (Number(it.gstRate) || 18) / 100,
          total_amount: Math.max(0, (Number(it.rate) || 0) * (Number(it.qty) || 0) - (Number(it.discAmt) || 0)) * (1 + (Number(it.gstRate) || 18) / 100),
          hsn_code: it.hsnCode,
          gst_rate: it.gstRate,
          line_no: it.sNo,
        })),
        sales_value: metrics.salesValue,
        discount_value: metrics.itemDiscount,
        tax_value: metrics.totalTax,
        net_amount: metrics.netAmount,
        grand_total: metrics.netAmount,
        rule_snapshots: {
          transaction_type: docState.transactionMode,
          // Canonical payment snapshot naming matching BillingTerm contract
          payments: docState.paymentDetails.map((p) => ({
            mode: p.mode,
            amount: p.amount,
            reference_no: p.referenceNo,
            bank_name: p.bankName,
          })),
          transporter_details: docState.transporterDetails,
          addons_and_deductions: docState.addonsAndDeductions,
        },
        remarks: docState.documentRemarks,
        status: "Submitted",
      };

      const saved = await apiFetchV1<any>("/sales/invoices", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const allocatedNumber = saved?.invoice_no || `${docState.docPrefix}-${docState.docNo}`;

      // Canonical PDF Generation & Print
      if (saved?.id) {
        void openCanonicalInvoicePrint(saved.id, onNotification).catch(() => {});
      }

      onNotification?.(
        "Tax Invoice Generated",
        `Successfully generated and committed Tax Invoice #${allocatedNumber} for ₹${metrics.netAmount.toFixed(2)}.`,
        "success"
      );

      // Advance doc number and reset line items
      setDocState((prev) => ({
        ...prev,
        docNo: String(Number(prev.docNo) + 1),
        items: [],
      }));
      setIsSettlementModalOpen(false);
    } catch (err: any) {
      onNotification?.("Save Error", err?.message || "Failed to commit Tax Invoice to PostgreSQL ledger.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isSkuModalOpen) setIsSkuModalOpen(false);
        else if (isSettlementModalOpen) setIsSettlementModalOpen(false);
        else if (isCustomerModalOpen) setIsCustomerModalOpen(false);
        else if (onExit) onExit();
      } else if (e.key === "F11") {
        e.preventDefault();
        setIsSkuModalOpen((prev) => !prev);
      } else if (e.key === "F8" || e.key === "F7") {
        e.preventDefault();
        setIsSettlementModalOpen((prev) => !prev);
      } else if (e.ctrlKey && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleSaveInvoice();
      } else if (e.ctrlKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        window.print();
      } else if (e.ctrlKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        setDocState((prev) => ({
          ...DEFAULT_DOC_STATE,
          docNo: String(Number(prev.docNo) + 1),
        }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCustomerModalOpen, isSkuModalOpen, isSettlementModalOpen, onExit, handleSaveInvoice]);

  // ─── F2 Universal Lookup Architecture v2 — Screen Registration ──
  useF2Screen({
    screenId: "DistTaxInvoice",
    defaultEntity: "customer",
    adapter: (result: LookupResult) => {
      if (result.entity === "customer") {
        setDocState((prev) => ({
          ...prev,
          customerCode: (result.record?.customer_code as string) || result.returnValue || prev.customerCode,
          customerName: result.displayValue || (result.record?.name as string) || prev.customerName,
        }));
        setIsCustomerModalOpen(false);
      } else if (result.entity === "variant" || result.entity === "item" || result.entity === "item_barcode") {
        handleAddItem({
          stockNo:         (result.record?.stock_no as string) || result.returnValue || "",
          barcode:         (result.record?.barcode as string) || "",
          itemDescription: result.displayValue || (result.record?.name as string) || "Item",
          qty:             1,
          rate:            (result.record?.selling_price as number) || (result.record?.mrp as number) || 0,
          value:           0,
          discCode:        "",
          discQty:         0,
          discPercent:     0,
          discAmt:         0,
          total:           0,
          salesStaff:      "",
          gstRate:         (result.record?.tax_percent as number) || 18,
        });
      }
    }
  });

  // Export Columns definition
  const exportColumns: ExportColumnDefinition[] = useMemo(
    () => [
      { key: "sNo", label: "S.No", width: 8, align: "center", datatype: "number" },
      { key: "stockNo", label: "Stock No", width: 16, align: "left", datatype: "text" },
      { key: "itemDescription", label: "Item Description", width: 28, align: "left", datatype: "text" },
      { key: "rate", label: "Rate (₹)", width: 12, align: "right", datatype: "currency" },
      { key: "qty", label: "Qty", width: 10, align: "right", datatype: "number" },
      { key: "value", label: "Value (₹)", width: 14, align: "right", datatype: "currency" },
      { key: "discCode", label: "Disc Code", width: 12, align: "center", datatype: "text" },
      { key: "discAmt", label: "Disc Amt (₹)", width: 12, align: "right", datatype: "currency" },
      { key: "total", label: "Total (₹)", width: 16, align: "right", datatype: "currency" },
      { key: "salesStaff", label: "Sales Staff", width: 18, align: "left", datatype: "text" },
    ],
    []
  );

  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customersList;
    const q = customerSearchQuery.toLowerCase();
    return customersList.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q) ||
        c.mobile?.includes(q) ||
        c.gstin?.toLowerCase().includes(q)
    );
  }, [customerSearchQuery, customersList]);

  // Sample Product Catalog for F11 SKU Modal
  const catalogProducts = useMemo(() => [
    { sku: "SKU-8849201", name: "Raymond Premium Wool Suiting Fabric 1.2m", category: "Fabrics / Formal", stock: "42 m", mrp: 1699, rate: 1450, tax: 18 },
    { sku: "SKU-3301944", name: "Raymond Tailored Collar Stiffener Pack", category: "Accessories", stock: "120 pcs", mrp: 820, rate: 750, tax: 18 },
    { sku: "SKU-9920152", name: "Park Avenue Executive Pure Cotton Shirt 40", category: "Apparel / Ready-Made", stock: "18 pcs", mrp: 2199, rate: 1899, tax: 12 },
    { sku: "SKU-5521098", name: "Siyaram Men Poly-Viscose Trouser Blend", category: "Fabrics / Bottom", stock: "65 m", mrp: 950, rate: 799, tax: 18 },
    { sku: "SKU-1104823", name: "Arrow Formal Slim Fit Blazer Navy 42", category: "Apparel / Formal", stock: "8 pcs", mrp: 5999, rate: 4999, tax: 12 },
  ], []);

  const filteredCatalog = useMemo(() => {
    if (!skuSearchQuery.trim()) return catalogProducts;
    const q = skuSearchQuery.toLowerCase();
    return catalogProducts.filter((p) =>
      p.sku.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }, [skuSearchQuery, catalogProducts]);

  return (
    <div className="bg-[#f4f7fb] text-slate-800 h-screen flex flex-col font-sans antialiased select-none overflow-hidden">
      {/* ── 1. Top Enterprise App Shell Header ── */}
      <TaxHeaderBar
        onNew={() =>
          setDocState((prev) => ({
            ...DEFAULT_DOC_STATE,
            docNo: String(Number(prev.docNo) + 1),
          }))
        }
        onSave={() => setIsSettlementModalOpen(true)}
        onDelete={() => {
          setDocState((prev) => ({ ...prev, items: [] }));
          onNotification?.("Draft Cleared", "Cleared all invoice item lines.", "info");
        }}
        onPrint={() => window.print()}
        onFind={() => setIsCustomerModalOpen(true)}
        onExit={onExit || (() => {})}
        isSaving={isSaving}
        exportColumns={exportColumns}
        exportData={docState.items}
        currentUser={currentUser}
      />

      {/* ── 2. Billing Workspace Controls + Context Ribbon + Popovers ── */}
      <TaxInvoiceDoc
        docState={docState}
        onChange={handleDocChange}
        onCustomerSearchOpen={() => setIsCustomerModalOpen(true)}
        onAddCustomerOpen={() => setIsCustomerModalOpen(true)}
        onImportClick={() => onNotification?.("Import Active", "Direct import queue ready.", "info")}
        onRecallClick={() => onNotification?.("Recall Active", "Previous invoice recall ready.", "info")}
        onSaveClick={() => setIsSettlementModalOpen(true)}
        onNewClick={() => {
          setCustomerGstRegistrations([]);
          setCustomerDeliveryLocations([]);
          setCustomerBillingLocations([]);
          setDocState((prev) => ({
            ...DEFAULT_DOC_STATE,
            docNo: String(Number(prev.docNo) + 1),
          }));
        }}
        onPrintClick={() => window.print()}
        netAmount={metrics.netAmount}
        customerGstRegistrations={customerGstRegistrations}
        customerDeliveryLocations={customerDeliveryLocations}
        customerBillingLocations={customerBillingLocations}
        isLoadingB2BData={isLoadingB2BData}
      />

      {/* ── 3. Main Data Grid / Auxiliary Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeAuxTab === "items" ? (
          <TaxInvoiceItemGrid
            items={docState.items}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onAddItem={handleAddItem}
            onOpenSkuSearch={() => setIsSkuModalOpen(true)}
            onLookupProduct={handleLookupProduct}
            onScanError={(barcodeOrMsg) => {
              const msg = barcodeOrMsg.includes("Stock") || barcodeOrMsg.includes("stock") || barcodeOrMsg.includes("limit") || barcodeOrMsg.includes("out of stock")
                ? barcodeOrMsg
                : `Barcode '${barcodeOrMsg}' is not registered in the Item Master. Unregistered items cannot be added to a Tax Invoice.`;
              onNotification?.(
                "Scan Notice",
                msg,
                "warning"
              );
            }}
            activeAuxTab={activeAuxTab}
            onSelectAuxTab={setActiveAuxTab}
          />
        ) : (
          <div className="flex-1 flex flex-col bg-white p-3 overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800 text-sm capitalize">
                  {activeAuxTab === "transporter" && "Transporter Details & E-Way Bill"}
                  {activeAuxTab === "remarks" && "Document Remarks & Terms"}
                  {activeAuxTab === "addons" && "Add-ons & Additional Charges"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveAuxTab("items")}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 cursor-pointer"
              >
                Back to Line Items
              </button>
            </div>
            <div className="flex-1">
              <TaxFooterTabs
                transporters={docState.transporterDetails}
                payments={docState.paymentDetails}
                addonsAndDeductions={docState.addonsAndDeductions}
                remarks={docState.documentRemarks}
                onUpdateTransporters={(t) => handleDocChange({ transporterDetails: t })}
                onUpdatePayments={(p) => handleDocChange({ paymentDetails: p })}
                onUpdateAddons={(a) => handleDocChange({ addonsAndDeductions: a })}
                onUpdateRemarks={(r) => handleDocChange({ documentRemarks: r })}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Horizontal Summary Totals Bar (Deep Navy #0c243f) ── */}
      <TaxStatusBar
        itemCount={metrics.itemCount}
        totalQty={metrics.totalQty}
        salesValue={metrics.salesValue}
        itemDiscount={metrics.itemDiscount}
        billDiscount={metrics.billDiscount}
        totalTax={metrics.totalTax}
        totalAddons={metrics.totalAddons}
        totalDeductions={metrics.totalDeductions}
        netAmount={metrics.netAmount}
      />

      {/* ── 5. Keyboard-First Function Keys Footer ── */}
      <footer className="bg-white border-t border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between text-xs select-none" data-purpose="keyboard-shortcuts-footer">
        {/* Left: Function Key Badges */}
        <div className="flex items-center space-x-3 overflow-x-auto">
          {/* F2 Customer */}
          <div
            onClick={() => setIsCustomerModalOpen(true)}
            className="flex items-center space-x-1.5 cursor-pointer hover:bg-slate-100 p-1 rounded transition"
          >
            <kbd className="px-2 py-0.5 font-bold font-mono bg-blue-100 text-blue-700 rounded border border-blue-300 text-[11px] shadow-2xs">
              F2
            </kbd>
            <span className="font-medium text-slate-700">Customer</span>
          </div>

          {/* F11 Item Entry */}
          <div
            onClick={() => setIsSkuModalOpen(true)}
            className="flex items-center space-x-1.5 cursor-pointer hover:bg-slate-100 p-1 rounded transition"
          >
            <kbd className="px-2 py-0.5 font-bold font-mono bg-blue-100 text-blue-700 rounded border border-blue-300 text-[11px] shadow-2xs">
              F11
            </kbd>
            <span className="font-medium text-slate-700">Item Entry</span>
          </div>

          {/* F6 Discounts */}
          <div className="flex items-center space-x-1.5 cursor-pointer hover:bg-slate-100 p-1 rounded transition">
            <kbd className="px-2 py-0.5 font-bold font-mono bg-blue-100 text-blue-700 rounded border border-blue-300 text-[11px] shadow-2xs">
              F6
            </kbd>
            <span className="font-medium text-slate-700">Discounts</span>
          </div>

          {/* F7/F8 Settlement */}
          <div
            onClick={() => setIsSettlementModalOpen(true)}
            className="flex items-center space-x-1.5 cursor-pointer hover:bg-slate-100 p-1 rounded transition"
          >
            <kbd className="px-2 py-0.5 font-bold font-mono bg-blue-100 text-blue-700 rounded border border-blue-300 text-[11px] shadow-2xs">
              F7/F8
            </kbd>
            <span className="font-medium text-slate-700">Settlement</span>
          </div>

          {/* F12 Suspend */}
          <div className="hidden sm:flex items-center space-x-1.5 cursor-pointer hover:bg-slate-100 p-1 rounded transition">
            <kbd className="px-2 py-0.5 font-bold font-mono bg-blue-100 text-blue-700 rounded border border-blue-300 text-[11px] shadow-2xs">
              F12
            </kbd>
            <span className="font-medium text-slate-700">Suspend</span>
          </div>

          {/* Ctrl+P Print */}
          <div
            onClick={() => window.print()}
            className="hidden md:flex items-center space-x-1.5 cursor-pointer hover:bg-slate-100 p-1 rounded transition"
          >
            <kbd className="px-2 py-0.5 font-bold font-mono bg-blue-100 text-blue-700 rounded border border-blue-300 text-[11px] shadow-2xs">
              Ctrl+P
            </kbd>
            <span className="font-medium text-slate-700">Print</span>
          </div>

          {/* Ctrl+S Save */}
          <div
            onClick={handleSaveInvoice}
            className="flex items-center space-x-1.5 cursor-pointer hover:bg-slate-100 p-1 rounded transition"
          >
            <kbd className="px-2 py-0.5 font-bold font-mono bg-blue-100 text-blue-700 rounded border border-blue-300 text-[11px] shadow-2xs">
              Ctrl+S
            </kbd>
            <span className="font-medium text-slate-700">Save</span>
          </div>
        </div>

        {/* Right: Next Step Indicator */}
        <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-md px-3 py-1 font-semibold text-xs shadow-2xs">
          <Zap className="w-3.5 h-3.5 text-emerald-600" />
          <span>
            {docState.items.length === 0
              ? "NEXT: Scan or Enter Item (F11)"
              : "NEXT: Review & Settle (F8)"}
          </span>
        </div>
      </footer>

      {/* ── MODAL 1: SKU Catalog Search Modal (F11) ── */}
      {isSkuModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-4 py-3 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Search className="w-5 h-5 text-cyan-400" />
                <h2 className="font-bold text-sm">Product Catalog SKU Search (F11)</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSkuModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  autoFocus
                  value={skuSearchQuery}
                  onChange={(e) => setSkuSearchQuery(e.target.value)}
                  placeholder="Search by SKU, Barcode, Style Code, or Item Title..."
                  className="flex-1 h-9 px-3 text-xs border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-2">SKU</th>
                      <th className="p-2">Description</th>
                      <th className="p-2">Category</th>
                      <th className="p-2 text-right">Available</th>
                      <th className="p-2 text-right">Rate (₹)</th>
                      <th className="p-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCatalog.map((prod) => (
                      <tr key={prod.sku} className="hover:bg-blue-50 transition-colors cursor-pointer">
                        <td className="p-2 font-mono font-bold text-blue-700">{prod.sku}</td>
                        <td className="p-2 font-medium">{prod.name}</td>
                        <td className="p-2 text-slate-500">{prod.category}</td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-600">{prod.stock}</td>
                        <td className="p-2 text-right font-mono font-bold">₹{prod.rate.toFixed(2)}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              handleAddItem({
                                stockNo: prod.sku,
                                itemDescription: prod.name,
                                rate: prod.rate,
                                qty: 1,
                                value: prod.rate,
                                discCode: "None",
                                discQty: 0,
                                discPercent: 0,
                                discAmt: 0,
                                total: prod.rate + (prod.rate * prod.tax) / 100,
                                salesStaff: docState.salesStaff,
                                hsnCode: "64041990",
                                gstRate: prod.tax,
                              });
                              setIsSkuModalOpen(false);
                            }}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold transition cursor-pointer"
                          >
                            Add
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setIsSkuModalOpen(false)}
                className="px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Settle & Save Modal (F8) ── */}
      {isSettlementModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-4 py-3 text-white flex items-center justify-between">
              <h2 className="font-bold text-sm flex items-center space-x-2">
                <span>Settlement Confirmation (F8)</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsSettlementModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs space-y-2">
                <div className="flex justify-between font-medium">
                  <span>Customer:</span>
                  <strong className="text-slate-900">{docState.customerName || "Walk-in Customer"}</strong>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Credit Terms:</span>
                  <strong>Net 60 Days (Assam HO)</strong>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Current Available Limit:</span>
                  <strong className="text-emerald-700 font-mono">₹3,75,000.00</strong>
                </div>
              </div>

              <div className="border-t border-b border-slate-100 py-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal Value:</span>
                  <span className="font-mono">₹{metrics.salesValue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Item &amp; Bill Discounts:</span>
                  <span className="font-mono text-amber-600">-₹{metrics.itemDiscount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Applicable Taxes (GST):</span>
                  <span className="font-mono text-emerald-600">+₹{metrics.totalTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-base text-slate-900 pt-1 border-t border-slate-200">
                  <span>Net Amount Due:</span>
                  <span className="font-mono text-blue-700 text-lg">₹{metrics.netAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Remarks / Order Reference No.</label>
                <input
                  type="text"
                  value={docState.documentRemarks}
                  onChange={(e) => handleDocChange({ documentRemarks: e.target.value })}
                  placeholder="PO-RRL-2026-0928"
                  className="h-8 w-full text-xs px-2 border border-slate-300 rounded focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Shortcut: Press <strong>F8</strong> to Confirm
              </span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSettlementModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveInvoice}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? "Submitting..." : "Confirm & Issue Invoice"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Customer Master Directory Modal (F2) ── */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-cyan-400" />
                <h2 className="text-sm font-bold">
                  Customer Master Directory (F2)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <input
                type="text"
                autoFocus
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                placeholder="Search by customer name, code, mobile, or GSTIN..."
                className="w-full h-9 px-3 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-auto p-2">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-200">
                    <th className="p-2">Code</th>
                    <th className="p-2">Customer Name</th>
                    <th className="p-2">Mobile</th>
                    <th className="p-2">GSTIN</th>
                    <th className="p-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="font-sans">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No customers match your search query.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((c) => (
                      <tr
                        key={c.id || c.code}
                        onClick={() => handleSelectCustomer(c)}
                        className="border-b border-slate-100 hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        <td className="p-2 font-mono font-bold text-blue-700">{c.code || c.id}</td>
                        <td className="p-2 font-semibold text-slate-800">{c.name}</td>
                        <td className="p-2 font-mono text-slate-600">{c.mobile || "-"}</td>
                        <td className="p-2 font-mono text-slate-600">{c.gstin || "-"}</td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectCustomer(c);
                            }}
                            className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
                          >
                            Select
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <span>Press <kbd className="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono">ESC</kbd> to close</span>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
