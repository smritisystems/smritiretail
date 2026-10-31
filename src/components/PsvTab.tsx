/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 3.17.0
 * * Created    : 2026-07-10
 * * Modified   : 2026-10-19
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 *
 * Author: Jawahar Ramkripal Mallah
 *
 * UX Revision 3.17.0 — PSV Sales Tax Invoice Quantity Reconciliation & Goods Receiving.
 * Integrates Document Qty, Physically Received Qty, Pending Approval Qty, Approved Qty,
 * Shortage Qty, Excess Qty, and Quality Rejections across Catalog Dimensions (Style/Article, Color, Size, Item).
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  PSVParty,
  PSVPartySkuTracking,
  PSVQuantityReconciliationItem,
  PSVQuantityReconciliationSummary,
  PSVQuantityReconciliationResponse,
} from "../types";
import {
  computeSkuLyingWithPartner,
  computeSkuSellThrough,
} from "../services/partnerSellThru.ts";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";

/* ─────────────────────────────────────────────────────────
   PROP TYPES
───────────────────────────────────────────────────────── */
interface PsvTabProps {
  psvParties: PSVParty[];
  currentUser?: { role: string; name: string } | null;
}

type PSVReceiptScan = { barcode: string; disposition: "accepted" | "rejected" };

interface PSVReceiptLineDraft {
  received_qty: number;
  rejected_qty: number;
  rejection_reason: string;
  sku_confirmation: string;
  scans: PSVReceiptScan[];
  prefilledBarcode: string;
  barcodePrefillConfirmed: boolean;
  hasScanCorrection: boolean;
  scanCorrectionReason: string;
}

interface PSVReceiptInvoiceLinePayload {
  invoice_line_id: string;
  sku: string;
  style_code?: string;
  color?: string;
  size?: string;
  received_qty: number;
  rejected_qty: number;
  rejection_reason?: string;
  scanned_barcode_counts: Record<string, number>;
  prefilled_barcode_counts: Record<string, number>;
}

function emptyReceiptDraft(): PSVReceiptLineDraft {
  return {
    received_qty: 0,
    rejected_qty: 0,
    rejection_reason: "",
    sku_confirmation: "",
    scans: [],
    prefilledBarcode: "",
    barcodePrefillConfirmed: false,
    hasScanCorrection: false,
    scanCorrectionReason: "",
  };
}

function getPsvItemDisplayName(item: PSVQuantityReconciliationItem | null | undefined): string {
  if (!item) return "Invoice item";
  const productName = item.product_name.trim();
  const itemCode = item.sku.trim();
  if (!itemCode || !productName.toUpperCase().endsWith(itemCode.toUpperCase())) {
    return productName || "Invoice item";
  }
  return productName.slice(0, -itemCode.length).replace(/[\s|·:–—-]+$/, "").trim() || "Invoice item";
}

type PSVReceiptMode = "prefill" | "csv" | "scan";
type PSVReceiptDisplayMode = "compact" | "wide" | "fullscreen";
type PSVOverviewDataView = "stores" | "articles" | "sizes" | "colors";
const MAX_CSV_BARCODE_UNITS = 10000;
type PSVReceiptColumn = "article" | "color" | "size" | "scanned" | "rejected" | "reason" | "verification";

const getSkuSentQty = (sku: PSVPartySkuTracking) => sku.billedQty ?? sku.invoicedQty;
const getSkuSoldQty = (sku: PSVPartySkuTracking) => sku.soldQty ?? sku.confirmedSoldQty;
const getSkuReturnedQty = (sku: PSVPartySkuTracking) => sku.returnedStockQty ?? sku.returnedQty;
const getPartyCityState = (party: PSVParty) =>
  [party.city?.trim(), party.state?.trim()].filter(Boolean).join(", ") || "—";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  return rows;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>): void {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────────────────────────
   HELPERS — Plain-language signals
───────────────────────────────────────────────────────── */

/** Returns an emoji + colour class for a party's health status */
function statusSignal(status: PSVParty["status"]) {
  switch (status) {
    case "Healthy":
      return { emoji: "🟢", label: "All Good", cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
    case "Monitor":
      return { emoji: "🟡", label: "Keep Watch", cls: "text-amber-400 bg-amber-500/10 border-amber-500/30" };
    case "Critical":
      return { emoji: "🔴", label: "Needs Action", cls: "text-rose-400 bg-rose-500/10 border-rose-500/30" };
    case "SOLD_OUT":
      return { emoji: "⚫", label: "Sold Out", cls: "text-gray-400 bg-gray-500/10 border-gray-500/30" };
    default:
      return { emoji: "🔵", label: "Check Stock", cls: "text-blue-400 bg-blue-500/10 border-blue-500/30" };
  }
}

/** Plain-language explanation of sell-through % */
function sellThroughMessage(pct: number): string {
  if (pct >= 80) return "Excellent — most goods have sold ✅";
  if (pct >= 50) return "Good — about half has sold";
  if (pct >= 25) return "Slow — less than half has sold";
  return "Very slow — most goods are still sitting";
}

/** Plain-language colour for sell-through badge */
function sellThroughColour(pct: number): string {
  if (pct >= 70) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
  if (pct >= 40) return "bg-amber-500/20 text-amber-400 border-amber-500/40";
  return "bg-rose-500/20 text-rose-400 border-rose-500/40";
}

/** Weeks of cover colour */
function weeksColour(weeks: number): string {
  if (weeks >= 4) return "text-emerald-400";
  if (weeks >= 2) return "text-amber-400";
  return "text-rose-400";
}

/** Visual pill for PSV quantity reconciliation status */
function reconStatusBadge(status: PSVQuantityReconciliationItem["reconciliation_status"]) {
  switch (status) {
    case "RECONCILED":
      return {
        emoji: "✅",
        label: "Reconciled",
        cls: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
      };
    case "SHORTAGE":
      return {
        emoji: "⚠️",
        label: "Shortage",
        cls: "text-rose-400 bg-rose-500/15 border-rose-500/40 font-semibold",
      };
    case "EXCESS":
      return {
        emoji: "📦",
        label: "Excess",
        cls: "text-purple-400 bg-purple-500/15 border-purple-500/40",
      };
    case "PENDING_APPROVAL":
      return {
        emoji: "⏳",
        label: "Pending Approval",
        cls: "text-amber-300 bg-amber-500/20 border-amber-400/50 animate-pulse font-semibold",
      };
    case "UNRECEIVED":
      return {
        emoji: "🕒",
        label: "Not Received",
        cls: "text-slate-400 bg-slate-500/15 border-slate-500/30",
      };
    case "HAS_REJECTIONS":
      return {
        emoji: "🛑",
        label: "Rejections",
        cls: "text-rose-300 bg-rose-500/20 border-rose-500/50 font-semibold",
      };
    default:
      return {
        emoji: "⚪",
        label: status,
        cls: "text-theme-muted bg-theme-surface-3 border-theme-divider",
      };
  }
}

/** Plain-language guidance for the Tip card */
function tipForParty(p: PSVParty): { icon: string; title: string; body: string } {
  if (p.status === "Critical") {
    return {
      icon: "🚨",
      title: "Stock Not Selling — Take Action Now",
      body:
        "Too much stock is sitting unsold. Call the distributor and ask why. Consider offering a discount, a combo deal, or moving goods to a busier shop.",
    };
  }
  if (p.status === "Monitor") {
    return {
      icon: "👀",
      title: "Keep an Eye — Sales Slightly Slow",
      body:
        "Sales are below normal. Check if the distributor needs more visibility (display, promotions). Monitor for the next 3–5 days before taking action.",
    };
  }
  if (p.status === "SOLD_OUT") {
    return {
      icon: "📦",
      title: "Stock Finished — Reorder if Needed",
      body:
        "All goods at this distributor have sold. If demand is still there, send a fresh invoice. If not, no action needed.",
    };
  }
  return {
    icon: "✅",
    title: "Everything is Running Fine",
    body:
      "Sales are healthy. Stock is moving at a good pace. No action needed — continue with your normal replenishment cycle.",
  };
}

/* ─────────────────────────────────────────────────────────
   SUB-COMPONENT — Metric Tile (reusable)
───────────────────────────────────────────────────────── */
function MetricTile({
  icon,
  label,
  value,
  sub,
  valueClass = "text-theme-body",
  badge,
  badgeCls = "bg-blue-500/10 text-blue-400 border-blue-500/20",
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  badge?: string;
  badgeCls?: string;
}) {
  return (
    <div className="bg-theme-surface-3/50 rounded-xl p-4 border border-theme-divider flex flex-col gap-1 shadow-sm hover:border-theme-divider/80 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xl">{icon}</span>
        {badge && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badgeCls}`}>
            {badge}
          </span>
        )}
      </div>
      <span className="text-[10px] uppercase tracking-wider text-theme-muted font-semibold mt-1">
        {label}
      </span>
      <span className={`text-lg font-bold font-mono ${valueClass}`}>{value}</span>
      {sub && <span className="text-[11px] text-theme-muted leading-snug">{sub}</span>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────── */
export const PsvTab: React.FC<PsvTabProps> = ({ psvParties, currentUser }) => {
  const isReadOnly =
    currentUser?.role === "Report User" || currentUser?.role === "REPORT_USER";

  const isManagerOrAdmin =
    currentUser?.role === "Manager" ||
    currentUser?.role === "MANAGER" ||
    currentUser?.role === "Admin" ||
    currentUser?.role === "ADMIN";

  // Sub-Tab: "overview" (Distributor stock) vs "reconciliation" (Invoice & Receiving Reconciliation)
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "reconciliation">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("psv_receive_invoice")
      ? "reconciliation"
      : "overview"
  );

  const [selectedPartyId, setSelectedPartyId] = useState<string>(
    psvParties[0]?.id || ""
  );
  const [search, setSearch] = useState("");
  const [overviewDataView, setOverviewDataView] = useState<PSVOverviewDataView>("stores");
  const hasMounted = useRef(false);

  // Reconciliation State
  const [reconData, setReconData] = useState<PSVQuantityReconciliationResponse | null>(null);
  const [loadingRecon, setLoadingRecon] = useState<boolean>(false);
  const [reconError, setReconError] = useState<string | null>(null);
  const [reconPartyFilter, setReconPartyFilter] = useState<string>("");
  const [reconSearch, setReconSearch] = useState<string>("");
  const [reconStatusFilter, setReconStatusFilter] = useState<string>("ALL");
  const [reconDiscrepancyOnly, setReconDiscrepancyOnly] = useState<boolean>(false);

  // Receive Modal State
  const [receiveModalOpen, setReceiveModalOpen] = useState<boolean>(false);
  const [receiveDisplayMode, setReceiveDisplayMode] = useState<PSVReceiptDisplayMode>("compact");
  const [receiveInvoiceItems, setReceiveInvoiceItems] = useState<PSVQuantityReconciliationItem[]>([]);
  const [isLoadingReceiveInvoice, setIsLoadingReceiveInvoice] = useState(false);
  const [selectedItemForReceive, setSelectedItemForReceive] = useState<PSVQuantityReconciliationItem | null>(null);
  const [isSubmittingReceipt, setIsSubmittingReceipt] = useState<boolean>(false);
  const [approvingEventId, setApprovingEventId] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeScanError, setBarcodeScanError] = useState<string | null>(null);
  const [scannedBarcodeCounts, setScannedBarcodeCounts] = useState<Record<string, number>>({});
  const [hasBarcodeScanCorrection, setHasBarcodeScanCorrection] = useState(false);
  const [scanCorrectionReason, setScanCorrectionReason] = useState("");
  const [useBarcodeScanning, setUseBarcodeScanning] = useState(false);
  const [skuConfirmation, setSkuConfirmation] = useState("");
  const [receiptLineDrafts, setReceiptLineDrafts] = useState<Record<string, PSVReceiptLineDraft>>({});
  const [expandedBarcodeLineIds, setExpandedBarcodeLineIds] = useState<Record<string, boolean>>({});
  const [barcodeEntryValues, setBarcodeEntryValues] = useState<Record<string, string>>({});
  const [barcodeEntryErrors, setBarcodeEntryErrors] = useState<Record<string, string>>({});
  const [additionalScanRows, setAdditionalScanRows] = useState<string[]>([]);
  const [additionalScanValues, setAdditionalScanValues] = useState<Record<string, string>>({});
  const [additionalScanErrors, setAdditionalScanErrors] = useState<Record<string, string>>({});
  const [showReceiptColumnsMenu, setShowReceiptColumnsMenu] = useState(false);
  const [receiptColumnVisibility, setReceiptColumnVisibility] = useState<Record<PSVReceiptColumn, boolean>>({
    article: true,
    color: true,
    size: true,
    scanned: true,
    rejected: true,
    reason: true,
    verification: true,
  });
  const [shadowStockExpanded, setShadowStockExpanded] = useState(true);
  const additionalScanRowSequence = useRef(0);
  const [receiveMode, setReceiveMode] = useState<PSVReceiptMode>("prefill");
  const [scanDisposition, setScanDisposition] = useState<"accepted" | "rejected">("accepted");
  const [csvImportError, setCsvImportError] = useState<string | null>(null);
  const [csvImportSummary, setCsvImportSummary] = useState<string | null>(null);
  const [receiveValidationError, setReceiveValidationError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const popoutInvoiceId = useRef<string | null>(
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("psv_receive_invoice")
      : null
  );
  const popoutInvoiceHandled = useRef(false);

  // Form Fields for Receive Modal
  const [receiveForm, setReceiveForm] = useState({
    invoice_id: "",
    invoice_no: "",
    party_id: "",
    party_name: "",
    received_qty: 0,
    rejected_qty: 0,
    rejection_reason: "",
    receipt_reference: "",
    remarks: "",
    auto_approve: false,
  });

  // F-10: flip hasMounted after first render so audit skips auto-selection
  useEffect(() => {
    hasMounted.current = true;
  }, []);

  // Auto-select first party when list loads
  useEffect(() => {
    if (!selectedPartyId && psvParties.length > 0) {
      setSelectedPartyId(psvParties[0].id);
    }
  }, [psvParties, selectedPartyId]);

  const activeParty = psvParties.find((p) => p.id === selectedPartyId);

  const receivingParty = psvParties.find((party) => party.id === receiveForm.party_id);
  const receiveShadowStockRows = receiveInvoiceItems.map((item) => ({
    item,
    tracking: receivingParty?.skuTracking?.find(
      (row) => row.sku.trim().toUpperCase() === item.sku.trim().toUpperCase()
    ),
  }));
  const receiptColumnOptions: Array<{ key: PSVReceiptColumn; label: string }> = [
    { key: "article", label: "Article" },
    { key: "color", label: "Color" },
    { key: "size", label: "Size" },
    { key: "scanned", label: "Scanned" },
    { key: "rejected", label: "Rejected" },
    { key: "reason", label: "Rejection reason" },
    { key: "verification", label: "Verification" },
  ];
  const getReceiptDraft = (item: PSVQuantityReconciliationItem) =>
    receiptLineDrafts[item.invoice_line_id] ?? emptyReceiptDraft();
  const getScannedCounts = (draft: PSVReceiptLineDraft) =>
    draft.scans.reduce<Record<string, number>>((counts, scan) => {
      counts[scan.barcode] = (counts[scan.barcode] ?? 0) + 1;
      return counts;
    }, {});
  const getLineQuantity = (draft: PSVReceiptLineDraft, disposition: "accepted" | "rejected") =>
    draft.scans.length > 0
      ? draft.scans.filter((scan) => scan.disposition === disposition).length
      : disposition === "accepted" ? draft.received_qty : draft.rejected_qty;
  const updateReceiptDraft = (
    lineId: string,
    update: (draft: PSVReceiptLineDraft) => PSVReceiptLineDraft
  ) => {
    setReceiptLineDrafts((drafts) => {
      const current = drafts[lineId] ?? emptyReceiptDraft();
      return { ...drafts, [lineId]: update(current) };
    });
  };
  const getRemainingQty = (item: PSVQuantityReconciliationItem) =>
    Math.max(0, item.document_qty - item.received_qty);
  const selectedItemBarcodes = selectedItemForReceive?.barcodes ?? [];
  const totalScannedBarcodeQty = Object.values(scannedBarcodeCounts).reduce((total, count) => total + count, 0);
  const remainingInvoiceQty = selectedItemForReceive ? getRemainingQty(selectedItemForReceive) : 0;
  const hasReceiptQtyDiscrepancy = Boolean(
    selectedItemForReceive &&
    receiveForm.received_qty + receiveForm.rejected_qty > 0 &&
    receiveForm.received_qty + receiveForm.rejected_qty !== remainingInvoiceQty
  );
  const manualSkuConfirmed = Boolean(
    selectedItemForReceive &&
    skuConfirmation.trim().toUpperCase() === selectedItemForReceive.sku.trim().toUpperCase()
  );
  const receiveHasDiscrepancy = receiveInvoiceItems.some((item) => {
    const draft = getReceiptDraft(item);
    const enteredQty = getLineQuantity(draft, "accepted") + getLineQuantity(draft, "rejected");
    return enteredQty > 0 && enteredQty !== getRemainingQty(item);
  });

  // F-10: audit only on explicit user selection after mount
  useEffect(() => {
    if (hasMounted.current && activeParty) {
      recordAuditAction(
        "TRANSACTION_VIEW",
        "psv_parties",
        activeParty.id,
        `Viewed PSV partner details: ${activeParty.name}`
      );
    }
  }, [activeParty]);

  // Load Reconciliation Data from Backend
  const fetchReconciliation = useCallback(async () => {
    setLoadingRecon(true);
    setReconError(null);
    try {
      const params: Record<string, any> = {};
      if (reconPartyFilter) {
        params.party_id = reconPartyFilter;
      }
      if (reconStatusFilter && reconStatusFilter !== "ALL") {
        params.reconciliation_status = reconStatusFilter;
      }
      if (reconDiscrepancyOnly) {
        params.has_discrepancy = true;
      }
      const data = await apiFetchV1<PSVQuantityReconciliationResponse>("/psv/reconciliation", { params });
      setReconData(data);
    } catch (err: any) {
      console.error("[PSV] Failed to fetch quantity reconciliation:", err);
      setReconError(err.message || "Failed to load reconciliation records");
    } finally {
      setLoadingRecon(false);
    }
  }, [reconPartyFilter, reconStatusFilter, reconDiscrepancyOnly]);

  // Trigger fetch when switching to reconciliation tab or changing query filters
  useEffect(() => {
    if (activeSubTab === "reconciliation") {
      fetchReconciliation();
    }
  }, [activeSubTab, fetchReconciliation]);

  // Approve a pending stock event (Manager/Admin action)
  const handleApproveEvent = async (eventId: string, itemName: string) => {
    if (isReadOnly) return;
    try {
      setApprovingEventId(eventId);
      await apiFetchV1(`/psv/events/${eventId}/approve`, {
        method: "PATCH",
      });
      recordAuditAction(
        "APPROVE",
        "psv_stock_events",
        eventId,
        `Manager approved inward stock receipt event: ${eventId} for item: ${itemName}`
      );
      await fetchReconciliation();
    } catch (err: any) {
      alert("Approval failed: " + (err.message || "Unknown error"));
    } finally {
      setApprovingEventId(null);
    }
  };

  // Open receiving for the entire invoice so all lines can be reconciled in one transaction.
  const openReceiveModal = async (item: PSVQuantityReconciliationItem) => {
    setReceiveDisplayMode("compact");
    setReceiveForm({
      invoice_id: item.invoice_id,
      invoice_no: item.invoice_no,
      party_id: item.party_id,
      party_name: item.party_name,
      received_qty: 0,
      rejected_qty: 0,
      rejection_reason: "",
      receipt_reference: "",
      remarks: "",
      auto_approve: false,
    });
    setReceiveInvoiceItems([]);
    setReceiptLineDrafts({});
    setExpandedBarcodeLineIds({});
    setBarcodeEntryValues({});
    setBarcodeEntryErrors({});
    setAdditionalScanRows([]);
    setAdditionalScanValues({});
    setAdditionalScanErrors({});
    setReceiptColumnVisibility({
      article: true,
      color: true,
      size: true,
      scanned: true,
      rejected: true,
      reason: true,
      verification: true,
    });
    setShadowStockExpanded(true);
    setShowReceiptColumnsMenu(false);
    setReceiveMode("prefill");
    setScanDisposition("accepted");
    setBarcodeInput("");
    setBarcodeScanError(null);
    setCsvImportError(null);
    setCsvImportSummary(null);
    setReceiveValidationError(null);
    setReceiveModalOpen(true);
    setIsLoadingReceiveInvoice(true);
    try {
      const response = await apiFetchV1<PSVQuantityReconciliationResponse>("/psv/reconciliation", {
        params: { invoice_id: item.invoice_id, limit: 1000 },
      });
      const invoiceItems = response.items.filter((line) => line.invoice_id === item.invoice_id);
      if (response.summary.total_items > invoiceItems.length) {
        throw new Error("This invoice has more than 1,000 lines. Receiving was stopped to avoid a partial invoice.");
      }
      if (!invoiceItems.length) {
        throw new Error("No invoice lines were returned for receiving.");
      }
      setReceiveInvoiceItems(invoiceItems);
      setReceiptLineDrafts(Object.fromEntries(
        invoiceItems.map((line) => [line.invoice_line_id, {
          ...emptyReceiptDraft(),
          received_qty: getRemainingQty(line),
          prefilledBarcode: line.barcodes?.[0] ?? "",
        }])
      ));
    } catch (error: any) {
      console.error("[PSV] Failed to load invoice lines for bulk receiving:", error);
      setReceiveValidationError(error.message || "Failed to load all invoice items.");
    } finally {
      setIsLoadingReceiveInvoice(false);
    }
  };

  const openReceiveInNewWindow = () => {
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set("tab", "psv");
    url.searchParams.set("psv_receive_invoice", receiveForm.invoice_id);
    const popup = window.open(
      url.toString(),
      "_blank",
      "popup,width=1440,height=960,resizable=yes,scrollbars=yes"
    );
    if (!popup) {
      setReceiveValidationError("The new window was blocked. Allow pop-ups for this site and try again.");
      return;
    }
    popup.focus();
  };

  useEffect(() => {
    const invoiceId = popoutInvoiceId.current;
    if (!invoiceId || popoutInvoiceHandled.current) return;
    popoutInvoiceHandled.current = true;

    const openInvoice = async () => {
      try {
        const response = await apiFetchV1<PSVQuantityReconciliationResponse>("/psv/reconciliation", {
          params: { invoice_id: invoiceId, limit: 1000 },
        });
        const item = response.items.find((line) => line.invoice_id === invoiceId);
        if (!item) throw new Error("The requested invoice could not be found for receiving.");
        await openReceiveModal(item);
      } catch (error: any) {
        console.error("[PSV] Failed to open invoice receiving in a new window:", error);
        window.alert(error.message || "Failed to open invoice receiving.");
      } finally {
        const url = new URL(window.location.href);
        url.searchParams.delete("psv_receive_invoice");
        window.history.replaceState(window.history.state, "", url);
      }
    };

    void openInvoice();
  }, []);

  const recordInvoiceBarcodeScan = (value: string, preferredLineId?: string) => {
    const barcode = value.trim().toUpperCase();
    if (!barcode) return false;
    const matches = receiveInvoiceItems.filter((item) =>
      (!preferredLineId || item.invoice_line_id === preferredLineId) &&
      (item.barcodes ?? []).some((knownBarcode) => knownBarcode.trim().toUpperCase() === barcode)
    );
    const distinctSkus = new Set(matches.map((item) => item.sku.trim().toUpperCase()));
    if (matches.length === 0 || distinctSkus.size > 1) {
      setBarcodeScanError(
        preferredLineId
          ? "This barcode is not registered to this invoice item."
          : distinctSkus.size > 1
            ? "This barcode matches multiple invoice lines. Ask a manager to resolve the duplicate barcode."
            : "This barcode does not match an item on this invoice."
      );
      return false;
    }
    const scanEligibleMatches = matches.filter((item) => !getReceiptDraft(item).barcodePrefillConfirmed);
    if (!scanEligibleMatches.length) {
      setBarcodeScanError("Clear the confirmed barcode prefill before scanning this item.");
      return false;
    }
    const matchedItem = scanEligibleMatches.find((item) => {
      const currentScans = receiptLineDrafts[item.invoice_line_id]?.scans.length ?? 0;
      return currentScans < getRemainingQty(item);
    }) ?? scanEligibleMatches[0];
    updateReceiptDraft(matchedItem.invoice_line_id, (draft) => ({
      ...draft,
      scans: [...draft.scans, { barcode, disposition: scanDisposition }],
    }));
    setBarcodeScanError(null);
    setReceiveValidationError(null);
    return true;
  };

  const handleBarcodeScan = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (recordInvoiceBarcodeScan(barcodeInput)) setBarcodeInput("");
  };

  const handleLineBarcodeScan = (
    event: React.KeyboardEvent<HTMLInputElement>,
    item: PSVQuantityReconciliationItem
  ) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const value = barcodeEntryValues[item.invoice_line_id] ?? "";
    if (recordInvoiceBarcodeScan(value, item.invoice_line_id)) {
      setBarcodeEntryValues((values) => ({ ...values, [item.invoice_line_id]: "" }));
      setBarcodeEntryErrors((errors) => ({ ...errors, [item.invoice_line_id]: "" }));
    } else {
      setBarcodeEntryErrors((errors) => ({
        ...errors,
        [item.invoice_line_id]: "Code not registered to this item.",
      }));
    }
  };

  const handleAdditionalBarcodeScan = (rowId: string, value: string) => {
    if (recordInvoiceBarcodeScan(value)) {
      setAdditionalScanValues((values) => ({ ...values, [rowId]: "" }));
      setAdditionalScanErrors((errors) => ({ ...errors, [rowId]: "" }));
    } else {
      setAdditionalScanErrors((errors) => ({
        ...errors,
        [rowId]: "Scan a barcode registered to an item on this invoice.",
      }));
    }
  };

  const undoInvoiceBarcodeScan = (item: PSVQuantityReconciliationItem, barcode: string) => {
    updateReceiptDraft(item.invoice_line_id, (draft) => {
      let scanIndex = -1;
      for (let index = draft.scans.length - 1; index >= 0; index -= 1) {
        if (draft.scans[index].barcode === barcode) {
          scanIndex = index;
          break;
        }
      }
      if (scanIndex < 0) return draft;
      return {
        ...draft,
        scans: draft.scans.filter((_, index) => index !== scanIndex),
        hasScanCorrection: true,
      };
    });
  };

  const undoBarcodeScan = (barcode: string) => {
    if (!scannedBarcodeCounts[barcode]) return;
    setScannedBarcodeCounts((counts) => {
      const updated = { ...counts };
      if (updated[barcode] <= 1) delete updated[barcode];
      else updated[barcode] -= 1;
      return updated;
    });
    setHasBarcodeScanCorrection(true);
  };

  const setRejectedQty = (rejectedQty: number) => {
    setReceiveForm((form) => ({
      ...form,
      rejected_qty: rejectedQty,
      received_qty: useBarcodeScanning
        ? Math.max(0, totalScannedBarcodeQty - rejectedQty)
        : form.received_qty,
    }));
  };

  const prefillRemainingQuantities = () => {
    setReceiptLineDrafts((drafts) => Object.fromEntries(receiveInvoiceItems.map((item) => {
      const draft = drafts[item.invoice_line_id] ?? emptyReceiptDraft();
      const scannedAcceptedQty = draft.scans.filter((scan) => scan.disposition === "accepted").length;
      return [item.invoice_line_id, {
        ...draft,
        received_qty: draft.scans.length > 0
          ? scannedAcceptedQty
          : Math.max(0, getRemainingQty(item) - draft.rejected_qty),
      }];
    })));
    setReceiveValidationError(null);
  };

  const prefillRegisteredBarcodes = () => {
    setReceiptLineDrafts((drafts) => Object.fromEntries(receiveInvoiceItems.map((item) => {
      const draft = drafts[item.invoice_line_id] ?? emptyReceiptDraft();
      const registeredBarcodes = item.barcodes ?? [];
      const selectedBarcode = registeredBarcodes.some(
        (barcode) => barcode.trim().toUpperCase() === draft.prefilledBarcode.trim().toUpperCase()
      )
        ? draft.prefilledBarcode
        : registeredBarcodes[0] ?? "";
      if (!registeredBarcodes.length || draft.scans.length || !selectedBarcode) {
        return [item.invoice_line_id, draft];
      }
      return [item.invoice_line_id, {
        ...draft,
        received_qty: Math.max(0, getRemainingQty(item) - draft.rejected_qty),
        prefilledBarcode: selectedBarcode,
        barcodePrefillConfirmed: true,
      }];
    })));
    setReceiveValidationError(null);
  };

  const downloadReceiptCsvTemplate = () => {
    const headers = [
      "invoice_line_id",
      "sku",
      "sku_confirmation",
      "barcode",
      "qty",
      "disposition",
      "received_qty",
      "rejected_qty",
      "rejection_reason",
    ];
    const rows = receiveInvoiceItems.map((item) => [
      item.invoice_line_id,
      item.sku,
      "",
      "",
      "",
      (item.barcodes ?? []).length > 0 ? "" : getRemainingQty(item),
      "",
      "",
      "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${receiveForm.invoice_no || "PSV-invoice"}-receiving-template.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importReceiptCsv = async (file: File) => {
    setCsvImportError(null);
    setCsvImportSummary(null);
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error("CSV has no receipt rows.");
      const headers = rows[0].map((header) => header.trim().toLowerCase());
      if (new Set(headers).size !== headers.length) {
        throw new Error("CSV contains duplicate column names.");
      }
      const allowedHeaders = new Set([
        "invoice_line_id", "sku", "sku_confirmation", "barcode", "qty", "quantity",
        "disposition", "received_qty", "rejected_qty", "rejection_reason",
      ]);
      const unsupportedHeaders = headers.filter((header) => !allowedHeaders.has(header));
      if (unsupportedHeaders.length) {
        throw new Error(`Unsupported CSV columns: ${unsupportedHeaders.join(", ")}.`);
      }
      if (headers.includes("qty") && headers.includes("quantity")) {
        throw new Error('Use either "qty" or "quantity", not both.');
      }
      if (!headers.includes("barcode") &&
        !(headers.includes("invoice_line_id") && headers.includes("sku_confirmation"))) {
        throw new Error('CSV must include a "barcode" column or invoice_line_id with product-code confirmation for items without a registered barcode.');
      }
      const column = Object.fromEntries(headers.map((header, index) => [header, index]));
      const byLineId = new Map(receiveInvoiceItems.map((item) => [item.invoice_line_id, item]));
      const importedDrafts = Object.fromEntries(receiveInvoiceItems.map((item) => [
        item.invoice_line_id,
        emptyReceiptDraft(),
      ])) as Record<string, PSVReceiptLineDraft>;
      const seenManualLines = new Set<string>();
      const errors: string[] = [];
      let acceptedRows = 0;
      let importedBarcodeUnits = 0;
      const valueAt = (row: string[], key: string) => row[column[key]]?.trim() ?? "";
      const parseQuantity = (value: string, label: string) => {
        if (!value) return 0;
        const quantity = Number(value);
        if (!Number.isSafeInteger(quantity) || quantity < 0) {
          throw new Error(`${label} must be a whole number greater than or equal to zero.`);
        }
        return quantity;
      };

      rows.slice(1).forEach((row, index) => {
        const rowNumber = index + 2;
        try {
          if (row.every((value) => !value.trim())) return;
          const lineId = valueAt(row, "invoice_line_id");
          const barcode = valueAt(row, "barcode").toUpperCase();
          const sku = valueAt(row, "sku");
          let item = lineId ? byLineId.get(lineId) : undefined;
          if (lineId && !item) throw new Error(`Row ${rowNumber}: unknown invoice line ID.`);
          if (item && sku && sku.toUpperCase() !== item.sku.trim().toUpperCase()) {
            throw new Error(`Row ${rowNumber}: item code does not match the selected invoice line.`);
          }

          if (barcode) {
            const barcodeCandidates = item
              ? [item]
              : receiveInvoiceItems.filter((candidate) =>
                (candidate.barcodes ?? []).some((known) => known.trim().toUpperCase() === barcode)
              );
            const matchingCandidates = barcodeCandidates.filter((candidate) =>
              (candidate.barcodes ?? []).some((known) => known.trim().toUpperCase() === barcode)
            );
            const distinctSkus = new Set(matchingCandidates.map((candidate) => candidate.sku.trim().toUpperCase()));
            if (matchingCandidates.length === 0) {
              throw new Error(`Row ${rowNumber}: barcode is not registered to an invoice item.`);
            }
            if (distinctSkus.size > 1) {
              throw new Error(`Row ${rowNumber}: barcode matches multiple invoice items; include invoice_line_id after resolving the duplicate.`);
            }
            item = matchingCandidates.find((candidate) =>
              importedDrafts[candidate.invoice_line_id].scans.length < getRemainingQty(candidate)
            ) ?? matchingCandidates[0];
            if (!item) throw new Error(`Row ${rowNumber}: barcode could not be matched to an invoice line.`);
            if (sku && sku.toUpperCase() !== item.sku.trim().toUpperCase()) {
              throw new Error(`Row ${rowNumber}: item code does not match the registered barcode's invoice item.`);
            }
            if (valueAt(row, "received_qty") || valueAt(row, "rejected_qty")) {
              throw new Error(`Row ${rowNumber}: use qty with a barcode; received_qty/rejected_qty are only for items without registered barcodes.`);
            }
            const quantityHeader = headers.includes("qty") ? "qty" : "quantity";
            const quantityValue = valueAt(row, quantityHeader);
            const quantity = quantityValue
              ? parseQuantity(quantityValue, `Row ${rowNumber} ${quantityHeader}`)
              : 1;
            if (quantity < 1) {
              throw new Error(`Row ${rowNumber}: barcode qty must be at least 1.`);
            }
            if (importedBarcodeUnits + quantity > MAX_CSV_BARCODE_UNITS) {
              throw new Error(`CSV barcode quantity exceeds the ${MAX_CSV_BARCODE_UNITS.toLocaleString("en-IN")} unit import limit.`);
            }
            const dispositionValue = valueAt(row, "disposition").toLowerCase();
            const disposition = dispositionValue || "accepted";
            if (disposition !== "accepted" && disposition !== "rejected") {
              throw new Error(`Row ${rowNumber}: disposition must be "accepted" or "rejected".`);
            }
            if (disposition === "rejected") {
              const reason = valueAt(row, "rejection_reason");
              if (!reason) {
                throw new Error(`Row ${rowNumber}: rejection_reason is required for rejected barcode units.`);
              }
            }
            let quantityToAssign = quantity;
            const assignments: Array<{ candidate: PSVQuantityReconciliationItem; quantity: number }> = [];
            for (const candidate of matchingCandidates) {
              if (quantityToAssign === 0) break;
              const candidateDraft = importedDrafts[candidate.invoice_line_id];
              const availableQty = Math.max(0, getRemainingQty(candidate) - candidateDraft.scans.length);
              const assignedQty = lineId ? quantityToAssign : Math.min(quantityToAssign, availableQty);
              if (assignedQty > 0) {
                assignments.push({ candidate, quantity: assignedQty });
                quantityToAssign -= assignedQty;
              }
            }
            if (quantityToAssign > 0) {
              const excessCandidate = lineId
                ? matchingCandidates[0]
                : assignments[0]?.candidate ?? matchingCandidates[0];
              const existingAssignment = assignments.find((assignment) =>
                assignment.candidate.invoice_line_id === excessCandidate.invoice_line_id
              );
              if (existingAssignment) existingAssignment.quantity += quantityToAssign;
              else assignments.push({ candidate: excessCandidate, quantity: quantityToAssign });
            }
            for (const assignment of assignments) {
              const draft = importedDrafts[assignment.candidate.invoice_line_id];
              if (disposition === "rejected") {
                const reason = valueAt(row, "rejection_reason");
                if (draft.rejection_reason && draft.rejection_reason !== reason) {
                  throw new Error(`Row ${rowNumber}: use one rejection_reason per invoice line.`);
                }
                draft.rejection_reason = reason;
              }
              for (let unit = 0; unit < assignment.quantity; unit += 1) {
                draft.scans.push({ barcode, disposition });
              }
            }
            importedBarcodeUnits += quantity;
          } else {
            if (!item) throw new Error(`Row ${rowNumber}: invoice_line_id is required for an item without a registered barcode.`);
            if ((item.barcodes ?? []).length > 0) {
              if (valueAt(row, "received_qty") || valueAt(row, "rejected_qty") || valueAt(row, "qty") || valueAt(row, "quantity")) {
                throw new Error(`Row ${rowNumber}: barcode-enabled items require a registered barcode for each received unit.`);
              }
              return;
            }
            if (valueAt(row, "disposition")) {
              throw new Error(`Row ${rowNumber}: disposition is only used with a registered barcode.`);
            }
            if (valueAt(row, "qty") || valueAt(row, "quantity")) {
              throw new Error(`Row ${rowNumber}: qty is only used with a registered barcode.`);
            }
            const draft = importedDrafts[item.invoice_line_id];
            if (seenManualLines.has(lineId)) {
              throw new Error(`Row ${rowNumber}: items without a registered barcode must appear once in the CSV.`);
            }
            seenManualLines.add(lineId);
            if (valueAt(row, "sku_confirmation").toUpperCase() !== item.sku.trim().toUpperCase()) {
              throw new Error(`Row ${rowNumber}: enter the exact product code in sku_confirmation.`);
            }
            draft.sku_confirmation = valueAt(row, "sku_confirmation");
            draft.received_qty = parseQuantity(valueAt(row, "received_qty"), `Row ${rowNumber} received_qty`);
            draft.rejected_qty = parseQuantity(valueAt(row, "rejected_qty"), `Row ${rowNumber} rejected_qty`);
            draft.rejection_reason = valueAt(row, "rejection_reason");
            if (draft.rejected_qty > 0 && !draft.rejection_reason) {
              throw new Error(`Row ${rowNumber}: rejection_reason is required when rejected_qty is above zero.`);
            }
          }
          acceptedRows += 1;
        } catch (error: any) {
          errors.push(error.message || `Row ${rowNumber}: invalid data.`);
        }
      });

      if (errors.length) throw new Error(errors.slice(0, 8).join("\n"));
      receiveInvoiceItems.forEach((item) => {
        const draft = importedDrafts[item.invoice_line_id];
        if ((item.barcodes ?? []).length > 0 && draft.scans.length > 0) {
          draft.received_qty = draft.scans.filter((scan) => scan.disposition === "accepted").length;
        }
      });
      setReceiptLineDrafts(importedDrafts);
      setCsvImportSummary(
        `Imported ${acceptedRows} CSV row${acceptedRows === 1 ? "" : "s"}${importedBarcodeUnits ? `, including ${importedBarcodeUnits} barcode-verified unit${importedBarcodeUnits === 1 ? "" : "s"}` : ""}. Review the receipt before saving.`
      );
      setReceiveValidationError(null);
    } catch (error: any) {
      console.error("[PSV] Receipt CSV import failed:", error);
      setCsvImportError(error.message || "Could not read the receiving CSV.");
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  };

  // Submit every entered line in one invoice receipt request.
  const handleReceiveSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payloadItems: PSVReceiptInvoiceLinePayload[] = [];
    const validationErrors: string[] = [];
    const correctionNotes: string[] = [];
    let hasQuantityDiscrepancy = false;
    let receivedTotal = 0;
    let rejectedTotal = 0;

    receiveInvoiceItems.forEach((item) => {
      const draft = getReceiptDraft(item);
      const registeredBarcodes = item.barcodes ?? [];
      const receivedQty = getLineQuantity(draft, "accepted");
      const rejectedQty = getLineQuantity(draft, "rejected");
      const totalQty = receivedQty + rejectedQty;
      if (totalQty <= 0) return;
      if (registeredBarcodes.length > 0) {
        if (draft.scans.length > 0) {
          const scannedAcceptedQty = draft.scans.filter((scan) => scan.disposition === "accepted").length;
          if (draft.received_qty !== scannedAcceptedQty) {
            validationErrors.push(`${getPsvItemDisplayName(item)}: accepted quantity must match the accepted barcode scans (${scannedAcceptedQty}).`);
            return;
          }
          const scannedRejectedQty = draft.scans.filter((scan) => scan.disposition === "rejected").length;
          if (draft.rejected_qty !== scannedRejectedQty) {
            validationErrors.push(`${getPsvItemDisplayName(item)}: rejected quantity must match the rejected barcode scans (${scannedRejectedQty}).`);
            return;
          }
          const invalidBarcode = draft.scans.find((scan) =>
            !registeredBarcodes.some((known) => known.trim().toUpperCase() === scan.barcode)
          );
          if (invalidBarcode) {
            validationErrors.push(`${getPsvItemDisplayName(item)}: a scanned barcode is not registered to this invoice item.`);
            return;
          }
          if (draft.scans.length !== totalQty) {
            validationErrors.push(`${getPsvItemDisplayName(item)}: scan total must equal accepted plus rejected quantity.`);
            return;
          }
        } else if (draft.barcodePrefillConfirmed) {
          if (!registeredBarcodes.some(
            (barcode) => barcode.trim().toUpperCase() === draft.prefilledBarcode.trim().toUpperCase()
          )) {
            validationErrors.push(`${getPsvItemDisplayName(item)}: select a registered barcode before confirming its prefill.`);
            return;
          }
        } else {
          validationErrors.push(`${getPsvItemDisplayName(item)}: scan the units or confirm a registered barcode prefill.`);
          return;
        }
      } else if (draft.sku_confirmation.trim().toUpperCase() !== item.sku.trim().toUpperCase()) {
        validationErrors.push(`${getPsvItemDisplayName(item)}: confirm the product code before recording quantities.`);
        return;
      }
      if (draft.hasScanCorrection && !draft.scanCorrectionReason.trim()) {
        validationErrors.push(`${getPsvItemDisplayName(item)}: explain why a scan was undone.`);
        return;
      }
      if (rejectedQty > 0 && !draft.rejection_reason.trim()) {
        validationErrors.push(`${getPsvItemDisplayName(item)}: select a rejection reason.`);
        return;
      }
      if (totalQty !== getRemainingQty(item)) hasQuantityDiscrepancy = true;
      const barcodeCounts = getScannedCounts(draft);
      const prefilledBarcodeCounts = draft.barcodePrefillConfirmed && draft.scans.length === 0
        ? { [draft.prefilledBarcode.trim().toUpperCase()]: totalQty }
        : {};
      if (draft.scanCorrectionReason.trim()) {
        correctionNotes.push(`${getPsvItemDisplayName(item)}: ${draft.scanCorrectionReason.trim()}`);
      }
      payloadItems.push({
        invoice_line_id: item.invoice_line_id,
        sku: item.sku,
        style_code: item.style_code || undefined,
        color: item.color || undefined,
        size: item.size || undefined,
        received_qty: receivedQty,
        rejected_qty: rejectedQty,
        rejection_reason: draft.rejection_reason || undefined,
        scanned_barcode_counts: barcodeCounts,
        prefilled_barcode_counts: prefilledBarcodeCounts,
      });
      receivedTotal += receivedQty;
      rejectedTotal += rejectedQty;
    });

    if (validationErrors.length) {
      setReceiveValidationError(validationErrors.slice(0, 8).join("\n"));
      return;
    }
    if (!payloadItems.length) {
      setReceiveValidationError("Enter quantities or scan barcodes for at least one invoice item.");
      return;
    }
    if (hasQuantityDiscrepancy && !receiveForm.remarks.trim()) {
      setReceiveValidationError("Add a receiving remark explaining the difference from the invoice balance.");
      return;
    }
    if ([receiveForm.remarks, ...correctionNotes].join("; ").length > 1000) {
      setReceiveValidationError("Receipt remarks and barcode correction notes must fit within 1,000 characters.");
      return;
    }
    if (!receiveForm.invoice_id) {
      setReceiveValidationError("Invoice ID is missing.");
      return;
    }

    setReceiveValidationError(null);
    setIsSubmittingReceipt(true);
    try {
      await apiFetchV1("/psv/receive-invoice", {
        method: "POST",
        body: {
          invoice_id: receiveForm.invoice_id,
          party_id: receiveForm.party_id || undefined,
          receipt_reference: receiveForm.receipt_reference || undefined,
          remarks: [
            receiveForm.remarks,
            correctionNotes.length ? `Barcode scan corrections: ${correctionNotes.join("; ")}` : "",
          ].filter(Boolean).join("; ") || undefined,
          auto_approve: receiveForm.auto_approve,
          items: payloadItems,
        },
      });
      recordAuditAction(
        "TRANSACTION_CREATE",
        "psv_stock_events",
        receiveForm.invoice_id,
        `Recorded bulk inward receipt for invoice ${receiveForm.invoice_no}: ${payloadItems.length} lines, accepted=${receivedTotal}, rejected=${rejectedTotal}`
      );
      setReceiveModalOpen(false);
      setReceiveInvoiceItems([]);
      setReceiptLineDrafts({});
      await fetchReconciliation();
    } catch (error: any) {
      console.error("[PSV] Inward receipt submission failed:", error);
      setReceiveValidationError(`Failed to record receipt: ${error.message || "Unknown error"}`);
    } finally {
      setIsSubmittingReceipt(false);
    }
  };

  // Filtered reconciliation items based on local search
  const filteredReconItems = useMemo(() => {
    if (!reconData?.items) return [];
    if (!reconSearch.trim()) return reconData.items;
    const q = reconSearch.toLowerCase().trim();
    return reconData.items.filter((item) => {
      return (
        item.invoice_no.toLowerCase().includes(q) ||
        item.party_name.toLowerCase().includes(q) ||
        (item.store_code && item.store_code.toLowerCase().includes(q)) ||
        item.product_name.toLowerCase().includes(q) ||
        item.barcodes?.some((barcode) => barcode.toLowerCase().includes(q)) ||
        item.sku.toLowerCase().includes(q) ||
        (item.style_code && item.style_code.toLowerCase().includes(q)) ||
        (item.color && item.color.toLowerCase().includes(q)) ||
        (item.size && item.size.toLowerCase().includes(q))
      );
    });
  }, [reconData?.items, reconSearch]);

  // Filtered & searched party list
  const filteredParties = useMemo(() => {
    if (!search.trim()) return psvParties;
    const q = search.toLowerCase();
    return psvParties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.storeNameSnapshot ?? "").toLowerCase().includes(q) ||
        (p.city ?? "").toLowerCase().includes(q) ||
        (p.state ?? "").toLowerCase().includes(q) ||
        (p.storeCode ?? "").toLowerCase().includes(q)
    );
  }, [psvParties, search]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);

  const tip = activeParty ? tipForParty(activeParty) : null;
  const dimensionRows = useMemo(() => {
    const groups = new Map<string, {
      label: string;
      skuCount: Set<string>;
      stockQty: number;
      sentQty: number;
      soldQty: number;
      returnedQty: number;
    }>();
    for (const sku of activeParty?.skuTracking ?? []) {
      const label = (overviewDataView === "sizes" ? sku.size : sku.color)?.trim() || "Not specified";
      const group = groups.get(label) ?? {
        label,
        skuCount: new Set<string>(),
        stockQty: 0,
        sentQty: 0,
        soldQty: 0,
        returnedQty: 0,
      };
      group.skuCount.add(sku.sku);
      group.stockQty += computeSkuLyingWithPartner(sku);
      group.sentQty += Number(getSkuSentQty(sku) || 0);
      group.soldQty += Number(getSkuSoldQty(sku) || 0);
      group.returnedQty += Number(getSkuReturnedQty(sku) || 0);
      groups.set(label, group);
    }
    return [...groups.values()].map((group) => ({
      ...group,
      skuCount: group.skuCount.size,
    })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [activeParty?.skuTracking, overviewDataView]);

  const exportPsvReport = () => {
    if (overviewDataView === "stores") {
      const headers = ["Store Code", "Store Name", "City", "State", "Stock Left", "Sold Units", "Sold %", "Weeks Left", "Locked Capital", "Health"];
      const rows = filteredParties.map((party) => [
        party.storeCode || "",
        party.storeNameSnapshot || party.name,
        party.city || "",
        party.state || "",
        Number(party.stockCount || 0),
        (party.skuTracking ?? []).reduce((total, sku) => total + Number(getSkuSoldQty(sku) || 0), 0),
        Number(party.sellThrough || 0).toFixed(1),
        Number(party.weeksOfCover || 0).toFixed(1),
        Number(party.capitalLocked || 0),
        party.status,
      ]);
      downloadCsv("psv-store-stock-report.csv", [headers, ...rows]);
      return;
    }
    if (overviewDataView === "articles") {
      const headers = ["Store Code", "Store Name", "Article", "Style Code", "Color", "Size", "SKU", "Stock Left", "Sent", "Sold", "Returned", "Sell Through %", "Sell-through Signal"];
      const rows = (activeParty?.skuTracking ?? []).map((sku) => {
        const sellThrough = computeSkuSellThrough(sku);
        return [
          activeParty?.storeCode || "",
          activeParty?.storeNameSnapshot || activeParty?.name || "",
          sku.productName,
          sku.styleCode || "",
          sku.color || "",
          sku.size || "",
          sku.sku,
          computeSkuLyingWithPartner(sku),
          getSkuSentQty(sku),
          getSkuSoldQty(sku),
          getSkuReturnedQty(sku),
          sellThrough.toFixed(1),
          getSkuSentQty(sku) <= 0 ? "No sales data" : sellThrough < 20 ? "Low sell-through" : sellThrough < 50 ? "Moderate sell-through" : "High sell-through",
        ];
      });
      downloadCsv("psv-article-stock-report.csv", [headers, ...rows]);
      return;
    }
    const dimensionLabel = overviewDataView === "sizes" ? "Size" : "Color";
    const headers = ["Store Code", "Store Name", dimensionLabel, "SKU Count", "Projected Stock", "Sent", "Sold", "Returned"];
    const rows = dimensionRows.map((row) => [
      activeParty?.storeCode || "",
      activeParty?.storeNameSnapshot || activeParty?.name || "",
      row.label,
      row.skuCount,
      row.stockQty,
      row.sentQty,
      row.soldQty,
      row.returnedQty,
    ]);
    downloadCsv(`psv-${overviewDataView}-stock-report.csv`, [headers, ...rows]);
  };

  /* ── EMPTY STATE ── */
  if (psvParties.length === 0 && !loadingRecon) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
        <span className="text-6xl">📦</span>
        <h3 className="text-xl font-semibold text-theme-body">No Distributors Added Yet</h3>
        <p className="text-sm text-theme-muted max-w-xs">
          Once you start sending goods to distributors or retail partners, their
          stock position will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── READ-ONLY BANNER ── */}
      {isReadOnly && (
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-2 text-amber-400 text-sm">
          <span className="text-lg">👁️</span>
          <span>
            <span className="font-bold">View-Only Mode.</span> You can see all
            data but cannot make any changes or approvals.
          </span>
        </div>
      )}

      {/* ── PAGE HEADER & SUB-TAB NAVIGATION ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-theme-divider">
        <div>
          <h3 className="font-display font-bold text-2xl text-theme-body flex items-center gap-2">
            <span>📦</span> Party Stock Visibility (PSV)
          </h3>
          <p className="text-sm text-theme-muted mt-0.5">
            Real-time distributor stock velocity, invoice reconciliation, and inward physical goods receiving.
          </p>
        </div>

        {/* Sub-Tab Selector Buttons */}
        <div className="flex items-center gap-2 bg-theme-surface-2 p-1 rounded-xl border border-theme-divider self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab("overview")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSubTab === "overview"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                : "text-theme-muted hover:text-theme-body hover:bg-theme-surface-3"
            }`}
          >
            <span>📊</span> Distributor Stock Tracker
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("reconciliation")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeSubTab === "reconciliation"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                : "text-theme-muted hover:text-theme-body hover:bg-theme-surface-3"
            }`}
          >
            <span>📑</span> Invoice & Receiving Reconciliation
            {reconData?.summary && reconData.summary.discrepancy_count > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/30 text-rose-300 font-bold">
                {reconData.summary.discrepancy_count}
              </span>
            )}
            {reconData?.summary && reconData.summary.pending_approval_count > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-300 font-bold">
                {reconData.summary.pending_approval_count}
              </span>
            )}
          </button>
        </div>
      </div>

      {receiveModalOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm ${receiveDisplayMode === "fullscreen" ? "p-0" : "p-2 sm:p-4"}`}>
          <div
            className={`bg-theme-surface-1 border border-theme-divider shadow-2xl overflow-hidden flex flex-col ${
              receiveDisplayMode === "fullscreen" ? "rounded-none" : "rounded-xl"
            }`}
            style={{
              width: receiveDisplayMode === "fullscreen"
                ? "100vw"
                : receiveDisplayMode === "wide" ? "min(98vw, 92rem)" : "min(94vw, 72rem)",
              height: receiveDisplayMode === "fullscreen"
                ? "100vh"
                : receiveDisplayMode === "wide" ? "min(94vh, 62rem)" : "min(88vh, 52rem)",
              minWidth: "min(20rem, 100vw)",
              minHeight: "min(18rem, 100vh)",
              maxWidth: "100vw",
              maxHeight: "100vh",
              resize: receiveDisplayMode === "fullscreen" ? "none" : "both",
            }}
          >
            <div className="px-4 py-3 border-b border-theme-divider flex items-center justify-between gap-3 bg-theme-surface-2">
              <div>
                <h4 className="font-bold text-base text-theme-body flex items-center gap-2">
                  <span>📥</span> Bulk Invoice Item Receiving
                </h4>
                <p className="text-[11px] text-theme-muted mt-0.5">
                  Invoice <span className="font-mono text-blue-400 font-semibold">{receiveForm.invoice_no}</span>
                  {" · "}{receiveInvoiceItems.length} items
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="hidden text-[9px] text-theme-muted lg:inline">Drag corner to resize</span>
                <button
                  type="button"
                  onClick={() => setReceiveDisplayMode("compact")}
                  className={`rounded-md px-2 py-1.5 text-[10px] font-medium ${receiveDisplayMode === "compact" ? "bg-blue-600 text-white" : "text-theme-muted hover:bg-theme-surface-3 hover:text-theme-body"}`}
                  aria-label="Use compact receiving window"
                  aria-pressed={receiveDisplayMode === "compact"}
                  title="Compact size"
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => setReceiveDisplayMode("wide")}
                  className={`rounded-md px-2 py-1.5 text-[10px] font-medium ${receiveDisplayMode === "wide" ? "bg-blue-600 text-white" : "text-theme-muted hover:bg-theme-surface-3 hover:text-theme-body"}`}
                  aria-label="Use wide receiving window"
                  aria-pressed={receiveDisplayMode === "wide"}
                  title="Wide size"
                >
                  Wide
                </button>
                <button
                  type="button"
                  onClick={() => setReceiveDisplayMode(receiveDisplayMode === "fullscreen" ? "wide" : "fullscreen")}
                  className="rounded-md p-1.5 text-theme-muted hover:bg-theme-surface-3 hover:text-theme-body"
                  aria-label={receiveDisplayMode === "fullscreen" ? "Exit full screen" : "Open full screen"}
                  title={receiveDisplayMode === "fullscreen" ? "Exit full screen" : "Full screen"}
                >
                  {receiveDisplayMode === "fullscreen" ? "⊡" : "⛶"}
                </button>
                <button
                  type="button"
                  onClick={openReceiveInNewWindow}
                  className="rounded-md p-1.5 text-theme-muted hover:bg-theme-surface-3 hover:text-theme-body"
                  aria-label="Open receiving in a new window"
                  title="Open in a new window"
                >
                  ↗
                </button>
                <button
                  type="button"
                  onClick={() => setReceiveModalOpen(false)}
                  className="rounded-md p-1.5 text-theme-muted hover:bg-theme-surface-3 hover:text-theme-body"
                  aria-label="Close bulk receiving"
                  title="Close"
                >
                  ✕
                </button>
              </div>
            </div>

            {isLoadingReceiveInvoice ? (
              <div className="flex-1 p-12 text-center text-sm text-theme-muted animate-pulse">Loading all invoice items…</div>
            ) : (
              <form onSubmit={handleReceiveSubmit} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg border border-theme-divider bg-theme-surface-2 p-2">
                    <span className="block text-[9px] uppercase text-theme-muted">Invoice Lines</span>
                    <strong className="text-sm text-theme-body">{receiveInvoiceItems.length}</strong>
                  </div>
                  <div className="rounded-lg border border-theme-divider bg-theme-surface-2 p-2">
                    <span className="block text-[9px] uppercase text-theme-muted">Barcode Required</span>
                    <strong className="text-sm text-blue-300">
                      {receiveInvoiceItems.filter((item) => (item.barcodes ?? []).length > 0).length}
                    </strong>
                  </div>
                  <div className="rounded-lg border border-theme-divider bg-theme-surface-2 p-2">
                    <span className="block text-[9px] uppercase text-theme-muted">Label Check</span>
                    <strong className="text-sm text-amber-300">
                      {receiveInvoiceItems.filter((item) => (item.barcodes ?? []).length === 0).length}
                    </strong>
                  </div>
                  <div className="rounded-lg border border-theme-divider bg-theme-surface-2 p-2">
                    <span className="block text-[9px] uppercase text-theme-muted">Lines Entered</span>
                    <strong className="text-sm text-emerald-300">
                      {receiveInvoiceItems.filter((item) => {
                        const draft = getReceiptDraft(item);
                        return (item.barcodes ?? []).length > 0
                          ? draft.scans.length > 0 || draft.barcodePrefillConfirmed
                          : draft.received_qty + draft.rejected_qty > 0;
                      }).length}
                    </strong>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-b border-theme-divider pb-3">
                  {([
                    ["prefill", "1. Prefill & Edit"],
                    ["csv", "2. CSV Upload"],
                    ["scan", "3. Scan All Barcodes"],
                  ] as const).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setReceiveMode(mode);
                        setReceiveValidationError(null);
                      }}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        receiveMode === mode
                          ? "bg-blue-600 text-white"
                          : "border border-theme-divider bg-theme-surface-2 text-theme-muted hover:text-theme-body"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {receiveMode === "prefill" && (
                  <section className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-[10px] text-blue-100">
                    <p className="min-w-[220px] flex-1">
                      Accepted quantity is prefilled to the invoice balance and editable. Choose barcode prefill to confirm the exact registered code without scanning; it is recorded as receiver-confirmed, not as a physical scan.
                    </p>
                    <button
                      type="button"
                      onClick={prefillRegisteredBarcodes}
                      disabled={!receiveInvoiceItems.some((item) => (item.barcodes ?? []).length > 0)}
                      className="rounded-md border border-blue-300/30 bg-blue-500/20 px-3 py-1.5 font-semibold text-blue-100 hover:bg-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Prefill barcodes + balance
                    </button>
                  </section>
                )}

                {receiveMode === "csv" && (
                  <section className="rounded-xl border border-violet-500/30 bg-violet-950/10 p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-semibold text-theme-body">Import receiving CSV</h5>
                        <p className="text-[10px] text-theme-muted mt-1">
                          Barcode-only: one code per row counts as one accepted unit. Add qty/quantity to count multiple units; disposition defaults to accepted. Rejected units need a reason. Items without a registered barcode need product-label confirmation and quantities.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={downloadReceiptCsvTemplate}
                          className="rounded-lg border border-theme-divider bg-theme-surface-2 px-3 py-2 text-[10px] font-semibold text-theme-body hover:bg-theme-surface-3"
                        >
                          Download CSV Template
                        </button>
                        <button
                          type="button"
                          onClick={() => csvInputRef.current?.click()}
                          className="rounded-lg bg-violet-600 px-3 py-2 text-[10px] font-semibold text-white hover:bg-violet-500"
                        >
                          Choose CSV
                        </button>
                        <input
                          ref={csvInputRef}
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void importReceiptCsv(file);
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-theme-muted">
                      CSV import replaces the current draft. The template includes all invoice lines; leave barcode and qty blank for untouched barcode items. You may upload a barcode-only file, or use barcode plus qty/quantity for counted units.
                    </p>
                    {csvImportSummary && <p role="status" className="text-[11px] text-emerald-300">{csvImportSummary}</p>}
                    {csvImportError && <pre role="alert" className="whitespace-pre-wrap text-[11px] text-rose-300">{csvImportError}</pre>}
                  </section>
                )}

                {receiveMode === "scan" && (
                  <section className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-3 space-y-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="flex-1 min-w-[220px]">
                        <span className="mb-1 block text-[10px] font-semibold text-theme-body">Scan any barcode on this invoice</span>
                        <input
                          ref={barcodeInputRef}
                          type="text"
                          autoFocus
                          inputMode="none"
                          autoComplete="off"
                          aria-label="Scan invoice barcode"
                          placeholder="Scan barcode and press Enter"
                          value={barcodeInput}
                          onChange={(event) => setBarcodeInput(event.target.value)}
                          onKeyDown={handleBarcodeScan}
                          className="w-full rounded-lg border border-theme-divider bg-theme-surface-2 px-3 py-2 text-sm font-mono text-theme-body focus:border-emerald-500 focus:outline-none"
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-[10px] font-semibold text-theme-body">Scanned unit is</span>
                        <select
                          value={scanDisposition}
                          onChange={(event) => setScanDisposition(event.target.value as "accepted" | "rejected")}
                          className="rounded-lg border border-theme-divider bg-theme-surface-2 px-3 py-2 text-xs text-theme-body"
                        >
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Damaged / Rejected</option>
                        </select>
                      </label>
                    </div>
                    {barcodeScanError && <p role="alert" className="text-[11px] text-rose-400">{barcodeScanError}</p>}
                    <p className="text-[10px] text-theme-muted">
                      Every scan is matched to exactly one line on this invoice. Use the accepted/rejected selector before scanning; rejected units need a reason below.
                    </p>
                  </section>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const rowId = `extra-scan-${additionalScanRowSequence.current++}`;
                        setAdditionalScanRows((rows) => [...rows, rowId]);
                        setAdditionalScanValues((values) => ({ ...values, [rowId]: "" }));
                        setReceiveMode("prefill");
                      }}
                      className="rounded-lg border border-theme-divider bg-theme-surface-2 px-3 py-2 text-[10px] font-semibold text-theme-body hover:bg-theme-surface-3"
                    >
                      + Add Row
                    </button>
                    <button
                      type="button"
                      onClick={prefillRemainingQuantities}
                      className="rounded-lg border border-theme-divider bg-theme-surface-2 px-3 py-2 text-[10px] font-semibold text-theme-body hover:bg-theme-surface-3"
                    >
                      ↔ Auto Fill Balance
                    </button>
                    <label className="flex items-center gap-1.5 rounded-lg border border-theme-divider bg-theme-surface-2 px-2.5 py-2 text-[10px] text-theme-body">
                      Scan as
                      <select
                        value={scanDisposition}
                        onChange={(event) => setScanDisposition(event.target.value as "accepted" | "rejected")}
                        className="bg-transparent font-semibold focus:outline-none"
                      >
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </label>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowReceiptColumnsMenu((show) => !show)}
                      aria-expanded={showReceiptColumnsMenu}
                      className="rounded-lg border border-theme-divider bg-theme-surface-2 px-3 py-2 text-[10px] font-semibold text-theme-body hover:bg-theme-surface-3"
                    >
                      ⚙ Columns⌄
                    </button>
                    {showReceiptColumnsMenu && (
                      <div className="absolute right-0 top-full z-20 mt-1 min-w-44 rounded-lg border border-theme-divider bg-theme-surface-1 p-2 shadow-xl">
                        {receiptColumnOptions.map(({ key, label }) => (
                          <label key={key} className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[10px] text-theme-body hover:bg-theme-surface-2">
                            <input
                              type="checkbox"
                              checked={receiptColumnVisibility[key]}
                              onChange={(event) => setReceiptColumnVisibility((visibility) => ({
                                ...visibility,
                                [key]: event.target.checked,
                              }))}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_250px]">
                <div className="overflow-x-auto rounded-xl border border-theme-divider">
                  <table className="w-full min-w-[1120px] text-left text-xs">
                    <thead className="bg-theme-surface-2">
                      <tr className="border-b border-theme-divider">
                        <th className="px-2 py-2 text-[10px] uppercase text-theme-muted">#</th>
                        <th className="px-2 py-2 text-[10px] uppercase text-theme-muted">Barcode <span className="text-rose-400">*</span></th>
                        {receiptColumnVisibility.article && <th className="px-2 py-2 text-[10px] uppercase text-theme-muted">Article</th>}
                        {receiptColumnVisibility.color && <th className="px-2 py-2 text-[10px] uppercase text-theme-muted">Color</th>}
                        {receiptColumnVisibility.size && <th className="px-2 py-2 text-[10px] uppercase text-theme-muted">Size</th>}
                        <th className="px-2 py-2 text-right text-[10px] uppercase text-theme-muted">Due</th>
                        {receiptColumnVisibility.scanned &&                         <th className="px-2 py-2 text-right text-[10px] uppercase text-theme-muted">Scan / prefill</th>}
                        <th className="px-2 py-2 text-right text-[10px] uppercase text-theme-muted">Accepted</th>
                        {receiptColumnVisibility.rejected && <th className="px-2 py-2 text-right text-[10px] uppercase text-theme-muted">Rejected</th>}
                        {receiptColumnVisibility.reason && <th className="px-2 py-2 text-[10px] uppercase text-theme-muted">Rejection reason</th>}
                        {receiptColumnVisibility.verification && <th className="px-2 py-2 text-[10px] uppercase text-theme-muted">Verification</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/50">
                      {receiveInvoiceItems.map((item) => {
                        const draft = getReceiptDraft(item);
                        const barcodes = item.barcodes ?? [];
                        const acceptedQty = getLineQuantity(draft, "accepted");
                        const rejectedQty = getLineQuantity(draft, "rejected");
                        const barcodeCounts = getScannedCounts(draft);
                        const scannedAcceptedQty = draft.scans.filter((scan) => scan.disposition === "accepted").length;
                        const scannedRejectedQty = draft.scans.filter((scan) => scan.disposition === "rejected").length;
                        const prefillMatches = draft.barcodePrefillConfirmed && barcodes.some(
                          (barcode) => barcode.trim().toUpperCase() === draft.prefilledBarcode.trim().toUpperCase()
                        );
                        const verificationMatches = barcodes.length > 0
                          ? prefillMatches || (
                            draft.scans.length > 0 &&
                            draft.received_qty === scannedAcceptedQty &&
                            draft.rejected_qty === scannedRejectedQty
                          )
                          : draft.sku_confirmation.trim().toUpperCase() === item.sku.trim().toUpperCase();
                        return (
                          <tr key={item.invoice_line_id} className="align-top">
                            <td className="px-3 py-3">
                              <span className="font-mono text-theme-muted">{receiveInvoiceItems.indexOf(item) + 1}</span>
                            </td>
                            <td className="px-2 py-2">
                              {barcodes.length > 0 ? (
                                <div className="min-w-36 space-y-1">
                                  <input
                                    type="text"
                                    inputMode="none"
                                    autoComplete="off"
                                    value={barcodeEntryValues[item.invoice_line_id] ?? ""}
                                    onChange={(event) => {
                                      setBarcodeEntryValues((values) => ({
                                        ...values,
                                        [item.invoice_line_id]: event.target.value,
                                      }));
                                      setBarcodeEntryErrors((errors) => ({
                                        ...errors,
                                        [item.invoice_line_id]: "",
                                      }));
                                    }}
                                    onKeyDown={(event) => handleLineBarcodeScan(event, item)}
                                    placeholder={draft.barcodePrefillConfirmed ? "Clear prefill to scan" : "Scan / Enter"}
                                    aria-label={`Scan barcode for ${getPsvItemDisplayName(item)}`}
                                    disabled={draft.barcodePrefillConfirmed}
                                    className="w-full rounded-md border border-theme-divider bg-theme-surface-2 px-2 py-2 font-mono text-[10px] text-theme-body focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                  />
                                  {barcodeEntryErrors[item.invoice_line_id] && (
                                    <span role="alert" className="block text-[9px] text-rose-300">
                                      {barcodeEntryErrors[item.invoice_line_id]}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setExpandedBarcodeLineIds((expanded) => ({
                                      ...expanded,
                                      [item.invoice_line_id]: !expanded[item.invoice_line_id],
                                    }))}
                                    aria-expanded={Boolean(expandedBarcodeLineIds[item.invoice_line_id])}
                                    className="block text-[10px] text-blue-300 underline underline-offset-2 hover:text-blue-200"
                                  >
                                    {expandedBarcodeLineIds[item.invoice_line_id]
                                      ? "Hide codes"
                                      : barcodes.length === 1 ? "View barcode" : "View barcode choices"}
                                  </button>
                                  <select
                                    value={draft.prefilledBarcode}
                                    disabled={draft.scans.length > 0}
                                    onChange={(event) => updateReceiptDraft(item.invoice_line_id, (current) => ({
                                      ...current,
                                      prefilledBarcode: event.target.value,
                                      barcodePrefillConfirmed: false,
                                    }))}
                                    aria-label={`Choose barcode to prefill for ${getPsvItemDisplayName(item)}`}
                                    className="w-full rounded-md border border-theme-divider bg-theme-surface-2 px-2 py-1.5 font-mono text-[9px] text-theme-body disabled:opacity-50"
                                  >
                                    {barcodes.map((barcode, index) => (
                                      <option key={`${item.invoice_line_id}-prefill-${index}`} value={barcode}>
                                        {barcode}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    disabled={draft.scans.length > 0}
                                    onClick={() => updateReceiptDraft(item.invoice_line_id, (current) => ({
                                      ...current,
                                      barcodePrefillConfirmed: !current.barcodePrefillConfirmed,
                                    }))}
                                    className={`rounded px-2 py-1 text-[9px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                                      draft.barcodePrefillConfirmed
                                        ? "border border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                                        : "border border-blue-500/30 text-blue-300 hover:bg-blue-500/10"
                                    }`}
                                  >
                                    {draft.barcodePrefillConfirmed ? "Clear prefill" : "Confirm barcode prefill"}
                                  </button>
                                  {draft.barcodePrefillConfirmed && (
                                    <span className="block rounded bg-amber-500/10 px-2 py-1 text-[9px] text-amber-200">
                                      Confirmed, not physically scanned
                                    </span>
                                  )}
                                  {expandedBarcodeLineIds[item.invoice_line_id] && (
                                    <div className="max-h-24 overflow-y-auto rounded border border-theme-divider bg-theme-surface-2 p-2">
                                      <div className="mb-1 text-[9px] text-theme-muted">
                                        Alternative registered codes for this item; select the code shown on the goods.
                                      </div>
                                      {barcodes.map((barcode, index) => {
                                        const normalizedBarcode = barcode.trim().toUpperCase();
                                        const scannedCount = barcodeCounts[normalizedBarcode] ?? 0;
                                        return (
                                          <div
                                            key={`${item.invoice_line_id}-${barcode}-${index}`}
                                            className="flex items-center justify-between gap-2 font-mono text-[10px] text-theme-body"
                                          >
                                            <span>{barcode}</span>
                                            {scannedCount > 0 && (
                                              <span className="shrink-0 text-emerald-300">{scannedCount} scanned</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {draft.scans.length > 0 ? (
                                    <div className="max-w-[360px] space-y-1">
                                      {Object.entries(barcodeCounts).map(([barcode, count], index) => (
                                        <div key={`${item.invoice_line_id}-${index}`} className="flex items-center justify-between gap-2">
                                          <span className="text-[10px] text-theme-body">Barcode scan {index + 1} × {count}</span>
                                          <button
                                            type="button"
                                            onClick={() => undoInvoiceBarcodeScan(item, barcode)}
                                            className="rounded border border-rose-500/30 px-2 py-1 text-[9px] text-rose-300 hover:bg-rose-500/10"
                                            aria-label={`Undo one barcode scan for ${getPsvItemDisplayName(item)}`}
                                          >
                                            Undo one
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : draft.barcodePrefillConfirmed ? (
                                    <span className="block text-[10px] text-amber-200">
                                      {draft.prefilledBarcode} × {acceptedQty + rejectedQty} · prefilled, not scanned
                                    </span>
                                  ) : (
                                    <span className="block text-[10px] text-theme-muted">No units scanned or prefilled</span>
                                  )}
                                  {draft.hasScanCorrection && (
                                    <input
                                      type="text"
                                      value={draft.scanCorrectionReason}
                                      onChange={(event) => updateReceiptDraft(item.invoice_line_id, (current) => ({
                                        ...current,
                                        scanCorrectionReason: event.target.value,
                                      }))}
                                      placeholder="Reason for undoing a scan (required)"
                                      maxLength={250}
                                      className="mt-1 w-full rounded border border-amber-500/30 bg-theme-surface-2 px-2 py-1 text-[10px] text-theme-body"
                                    />
                                  )}
                                </div>
                              ) : (
                                <div className="min-w-36 space-y-1">
                                  <input
                                    type="password"
                                    value={draft.sku_confirmation}
                                    onChange={(event) => updateReceiptDraft(item.invoice_line_id, (current) => ({
                                      ...current,
                                      sku_confirmation: event.target.value,
                                    }))}
                                    placeholder="Scan or enter product code from the label"
                                    aria-label={`Confirm product label code for ${getPsvItemDisplayName(item)}`}
                                    autoComplete="off"
                                    className="w-full rounded-md border border-theme-divider bg-theme-surface-2 px-2 py-2 font-mono text-[10px] text-theme-body"
                                  />
                                </div>
                              )}
                            </td>
                            {receiptColumnVisibility.article && (
                              <td className="px-2 py-3 font-mono text-[10px] text-theme-body">
                                {item.style_code && item.style_code.trim().toUpperCase() !== item.sku.trim().toUpperCase()
                                  ? item.style_code
                                  : getPsvItemDisplayName(item)}
                              </td>
                            )}
                            {receiptColumnVisibility.color && <td className="px-2 py-3 text-[10px] text-theme-body">{item.color || "—"}</td>}
                            {receiptColumnVisibility.size && <td className="px-2 py-3 text-[10px] text-theme-body">{item.size || "—"}</td>}
                            <td className="px-2 py-3 text-right font-mono text-theme-body">{getRemainingQty(item)}</td>
                            {receiptColumnVisibility.scanned && (
                              <td className={`px-2 py-3 text-right font-mono font-semibold ${draft.barcodePrefillConfirmed ? "text-amber-300" : "text-blue-300"}`}>
                                {barcodes.length > 0
                                  ? draft.scans.length > 0 ? draft.scans.length : draft.barcodePrefillConfirmed ? `${acceptedQty + rejectedQty} pref.` : "—"
                                  : "—"}
                              </td>
                            )}
                            <td className="px-2 py-2 text-right">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={draft.received_qty}
                                onChange={(event) => updateReceiptDraft(item.invoice_line_id, (current) => ({
                                  ...current,
                                  received_qty: Math.max(0, Number(event.target.value) || 0),
                                }))}
                                className="w-20 rounded-md border border-emerald-500/30 bg-theme-surface-2 px-2 py-2 text-right font-mono font-semibold text-emerald-300"
                                aria-label={`Accepted quantity for ${getPsvItemDisplayName(item)}`}
                              />
                            </td>
                            {receiptColumnVisibility.rejected && (
                              <td className="px-2 py-2 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={draft.rejected_qty}
                                  onChange={(event) => updateReceiptDraft(item.invoice_line_id, (current) => ({
                                    ...current,
                                    rejected_qty: Math.max(0, Number(event.target.value) || 0),
                                  }))}
                                  className="w-20 rounded-md border border-theme-divider bg-theme-surface-2 px-2 py-2 text-right font-mono text-rose-300"
                                  aria-label={`Rejected quantity for ${getPsvItemDisplayName(item)}`}
                                />
                              </td>
                            )}
                            {receiptColumnVisibility.reason && (
                              <td className="px-2 py-2">
                                {draft.rejected_qty > 0 ? (
                                  <select
                                    value={draft.rejection_reason}
                                    onChange={(event) => updateReceiptDraft(item.invoice_line_id, (current) => ({
                                      ...current,
                                      rejection_reason: event.target.value,
                                    }))}
                                    className="w-36 rounded-md border border-theme-divider bg-theme-surface-2 px-2 py-2 text-[10px] text-theme-body"
                                    required
                                  >
                                    <option value="">Select reason</option>
                                    <option value="Packaging Torn / Crushed">Transit damage</option>
                                    <option value="Fabric Stained / Soiled">Fabric stained / soiled</option>
                                    <option value="Stitching / Button Defect">Manufacturing defect</option>
                                    <option value="Barcode Label Missing / Unreadable">Barcode label issue</option>
                                    <option value="Wrong Size / Color Variant Delivered">Wrong size / color</option>
                                    <option value="Other / Audit Hold">Other / audit hold</option>
                                  </select>
                                ) : <span className="text-theme-muted">—</span>}
                              </td>
                            )}
                            {receiptColumnVisibility.verification && (
                              <td className="px-2 py-3">
                                {barcodes.length > 0 ? (
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${verificationMatches ? "text-emerald-400" : "text-amber-400"}`}>
                                    <span>{verificationMatches ? "✓" : "!"}</span>
                                    <span>
                                      {prefillMatches
                                        ? "Prefilled · not scanned"
                                        : verificationMatches ? "Scanned" : draft.scans.length ? "Check counts" : "Barcode required"}
                                    </span>
                                  </span>
                                ) : (
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${verificationMatches ? "text-emerald-400" : "text-amber-400"}`}>
                                    <span>{verificationMatches ? "✓" : "!"}</span>
                                    <span>{verificationMatches ? "Label verified" : "Label check required"}</span>
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {additionalScanRows.map((rowId) => (
                        <tr key={rowId} className="bg-blue-500/5">
                          <td className="px-2 py-2 text-[10px] text-theme-muted">+</td>
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              inputMode="none"
                              autoComplete="off"
                              value={additionalScanValues[rowId] ?? ""}
                              onChange={(event) => setAdditionalScanValues((values) => ({
                                ...values,
                                [rowId]: event.target.value,
                              }))}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  handleAdditionalBarcodeScan(rowId, additionalScanValues[rowId] ?? "");
                                }
                              }}
                              placeholder="Scan / Enter barcode"
                              aria-label="Add barcode scan row"
                              className="w-full min-w-36 rounded-md border border-theme-divider bg-theme-surface-2 px-2 py-2 font-mono text-[10px] text-theme-body"
                            />
                            {additionalScanErrors[rowId] && (
                              <span role="alert" className="mt-1 block text-[9px] text-rose-300">{additionalScanErrors[rowId]}</span>
                            )}
                          </td>
                          <td colSpan={Math.max(1,
                            (receiptColumnVisibility.article ? 1 : 0) +
                            (receiptColumnVisibility.color ? 1 : 0) +
                            (receiptColumnVisibility.size ? 1 : 0) + 1 +
                            (receiptColumnVisibility.scanned ? 1 : 0) + 1 +
                            (receiptColumnVisibility.rejected ? 1 : 0) +
                            (receiptColumnVisibility.reason ? 1 : 0) +
                            (receiptColumnVisibility.verification ? 1 : 0)
                          )} className="px-2 py-2 text-[10px] text-theme-muted">
                            {additionalScanErrors[rowId] || "Barcode will be matched to its invoice item."}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <aside className="overflow-hidden rounded-xl border border-theme-divider bg-theme-surface-1">
                  <button
                    type="button"
                    onClick={() => setShadowStockExpanded((expanded) => !expanded)}
                    aria-expanded={shadowStockExpanded}
                    className="flex w-full items-center justify-between gap-2 border-b border-theme-divider bg-theme-surface-2 px-3 py-3 text-left"
                  >
                    <span className="text-[10px] font-semibold text-theme-body">◉ PSV Shadow Stock (Visibility Only)</span>
                    <span className="text-theme-muted">{shadowStockExpanded ? "⌃" : "⌄"}</span>
                  </button>
                  {shadowStockExpanded && (
                    <div className="space-y-2 p-3">
                      <p className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-2 text-[9px] leading-relaxed text-blue-200">
                        Partner stock snapshot is for reference only. It does not verify or record this physical receipt.
                      </p>
                      {receiveShadowStockRows.map(({ item, tracking }) => (
                        <div key={item.invoice_line_id} className="rounded-lg border border-theme-divider p-2">
                          <div className="mb-2 truncate text-[10px] font-semibold text-theme-body" title={getPsvItemDisplayName(item)}>
                            {getPsvItemDisplayName(item)}
                          </div>
                          {tracking ? (
                            <div className="grid grid-cols-3 gap-1 text-center">
                              <div>
                                <div className="text-[8px] uppercase text-theme-muted">Invoiced</div>
                                <div className="mt-1 font-mono text-[10px] text-theme-body">{tracking.invoicedQty}</div>
                              </div>
                              <div>
                                <div className="text-[8px] uppercase text-theme-muted">Sold</div>
                                <div className="mt-1 font-mono text-[10px] text-theme-body">{tracking.confirmedSoldQty}</div>
                              </div>
                              <div>
                                <div className="text-[8px] uppercase text-theme-muted">Returned</div>
                                <div className="mt-1 font-mono text-[10px] text-theme-body">{tracking.returnedQty}</div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[9px] text-theme-muted">No partner stock snapshot for this item.</span>
                          )}
                        </div>
                      ))}
                      {!receiveShadowStockRows.length && (
                        <p className="text-[10px] text-theme-muted">No invoice items to compare.</p>
                      )}
                    </div>
                  )}
                </aside>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label>
                    <span className="mb-1 block text-[10px] font-semibold text-theme-body">Receipt / challan reference</span>
                    <input
                      type="text"
                      value={receiveForm.receipt_reference}
                      onChange={(event) => setReceiveForm({ ...receiveForm, receipt_reference: event.target.value })}
                      placeholder="Optional delivery reference"
                      className="w-full rounded-lg border border-theme-divider bg-theme-surface-2 px-3 py-2 text-xs text-theme-body"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-[10px] font-semibold text-theme-body">
                      Receiving remarks {receiveHasDiscrepancy && <span className="text-rose-400">*</span>}
                    </span>
                    <input
                      type="text"
                      value={receiveForm.remarks}
                      onChange={(event) => setReceiveForm({ ...receiveForm, remarks: event.target.value })}
                      placeholder={receiveHasDiscrepancy ? "Required: explain invoice quantity difference" : "Optional receiving notes"}
                      maxLength={1000}
                      required={receiveHasDiscrepancy}
                      className="w-full rounded-lg border border-theme-divider bg-theme-surface-2 px-3 py-2 text-xs text-theme-body"
                    />
                  </label>
                </div>

                {isManagerOrAdmin && (
                  <label className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-200">
                    <input
                      type="checkbox"
                      checked={receiveForm.auto_approve}
                      onChange={(event) => setReceiveForm({ ...receiveForm, auto_approve: event.target.checked })}
                      className="rounded border-theme-divider text-amber-500"
                    />
                    Manager sign-off — approve this receipt immediately
                  </label>
                )}

                {receiveValidationError && (
                  <pre role="alert" className="whitespace-pre-wrap rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-[11px] text-rose-300">
                    {receiveValidationError}
                  </pre>
                )}

                <div className="flex items-center justify-between gap-2 border-t border-theme-divider pt-3">
                  <p className="text-[10px] text-theme-muted">
                    Barcode-tracked items require verified scans; items without a registered barcode require product-label confirmation.
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setReceiveModalOpen(false)}
                      className="rounded-xl px-4 py-2 text-xs font-medium text-theme-muted hover:bg-theme-surface-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isLoadingReceiveInvoice || isSubmittingReceipt || receiveInvoiceItems.length === 0}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {isSubmittingReceipt ? "Recording…" : "Review & Record All Inward"}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 1: OVERVIEW — DISTRIBUTOR STOCK TRACKER (ORIGINAL UX)
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* ── LEFT PANEL: Distributor List ── */}
            <div className="lg:col-span-4 bg-theme-surface-1 rounded-xl border border-theme-divider flex flex-col">
              {/* Search */}
              <div className="p-3 border-b border-theme-divider">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted text-sm">🔍</span>
                  <input
                    type="text"
                    placeholder="Search distributor, store, code, city or state…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg pl-8 pr-3 py-2 text-sm text-theme-body placeholder:text-theme-muted focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* List */}
              <div className="overflow-y-auto flex-1 custom-scrollbar divide-y divide-theme-divider/50 max-h-[640px]">
                {filteredParties.length === 0 ? (
                  <div className="p-6 text-center text-theme-muted text-sm">
                    No results for "{search}"
                  </div>
                ) : (
                  filteredParties.map((p) => {
                    const sig = statusSignal(p.status);
                    const isActive = selectedPartyId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPartyId(p.id)}
                        className={`w-full text-left p-4 transition-all ${
                          isActive
                            ? "bg-blue-600/10 border-l-2 border-l-blue-500"
                            : "hover:bg-theme-surface-2/50 border-l-2 border-l-transparent"
                        }`}
                      >
                        {/* Name + status */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-semibold text-sm text-theme-body truncate">
                            {p.name}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${sig.cls}`}
                          >
                            {sig.emoji} {sig.label}
                          </span>
                        </div>

                        {/* Store identifier and location */}
                        <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-theme-muted">
                          {p.storeCode && (
                            <span className="font-semibold text-blue-400">
                              <span className="font-mono">{p.storeCode}</span>
                            </span>
                          )}
                          {p.storeNameSnapshot && <span>{p.storeNameSnapshot}</span>}
                          <span>📍 {getPartyCityState(p)}</span>
                        </div>

                        {/* Quick stats */}
                        <div className="grid grid-cols-3 gap-1 text-center">
                          <div className="bg-theme-surface-3/60 rounded-lg py-1.5 px-1">
                            <div className="text-[9px] text-theme-muted uppercase tracking-wide">Stock Left</div>
                            <div className="text-xs font-bold font-mono text-theme-body mt-0.5">
                              {Number(p.stockCount ?? (p as any).stock_count ?? 0)} pcs
                            </div>
                          </div>
                          <div className="bg-theme-surface-3/60 rounded-lg py-1.5 px-1">
                            <div className="text-[9px] text-theme-muted uppercase tracking-wide">Sold %</div>
                            <div className={`text-xs font-bold font-mono mt-0.5 ${sellThroughColour(Number(p.sellThrough ?? (p as any).sell_through ?? 0)).split(" ")[1]}`}>
                              {Number(p.sellThrough ?? (p as any).sell_through ?? 0)}%
                            </div>
                          </div>
                          <div className="bg-theme-surface-3/60 rounded-lg py-1.5 px-1">
                            <div className="text-[9px] text-theme-muted uppercase tracking-wide">Weeks Left</div>
                            <div className={`text-xs font-bold font-mono mt-0.5 ${weeksColour(Number(p.weeksOfCover ?? (p as any).weeks_of_cover ?? 0))}`}>
                              {Number(p.weeksOfCover ?? (p as any).weeks_of_cover ?? 0)} wk
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── RIGHT PANEL: Active Distributor Details ── */}
            <div className="lg:col-span-8 bg-theme-surface-1 rounded-xl border border-theme-divider">
              {!activeParty ? (
                <div className="h-full flex flex-col items-center justify-center py-20 text-center gap-3">
                  <span className="text-5xl">👈</span>
                  <p className="text-sm text-theme-muted">
                    Tap a distributor on the left to see their details.
                  </p>
                </div>
              ) : (
                <div className="p-5 space-y-6">

                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-theme-divider">
                    <div>
                      {(() => {
                        const sig = statusSignal(activeParty.status);
                        return (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border mb-2 ${sig.cls}`}>
                            {sig.emoji} {sig.label}
                          </span>
                        );
                      })()}
                      <h3 className="font-display font-bold text-xl text-theme-body">
                        {activeParty.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-theme-muted">
                        {activeParty.storeCode && (
                          <span className="font-semibold text-blue-400">
                            Store Code: <span className="font-mono">{activeParty.storeCode}</span>
                          </span>
                        )}
                        <span>📍 {getPartyCityState(activeParty)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-theme-muted uppercase tracking-wide">
                        💰 Money Tied in Unsold Stock
                      </div>
                      <div className="text-rose-400 font-bold font-mono text-xl mt-0.5">
                        {formatCurrency(Number(activeParty.capitalLocked ?? (activeParty as any).capital_locked ?? 0))}
                      </div>
                      <div className="text-[10px] text-theme-muted mt-0.5">
                        This money will come back once goods sell.
                      </div>
                    </div>
                  </div>

                  {/* 4 Metric Tiles */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MetricTile
                      icon="📦"
                      label="Stock with Distributor"
                      value={`${Number(activeParty.stockCount ?? (activeParty as any).stock_count ?? 0)} pcs`}
                      sub="Total pieces currently at their shop/warehouse"
                      valueClass="text-blue-400"
                    />
                    <MetricTile
                      icon="🛒"
                      label="How Much Has Sold"
                      value={`${Number(activeParty.sellThrough ?? (activeParty as any).sell_through ?? 0)}%`}
                      sub={sellThroughMessage(Number(activeParty.sellThrough ?? (activeParty as any).sell_through ?? 0))}
                      valueClass={Number(activeParty.sellThrough ?? (activeParty as any).sell_through ?? 0) >= 50 ? "text-emerald-400" : "text-rose-400"}
                    />
                    <MetricTile
                      icon="⏳"
                      label="Stock Will Last"
                      value={`${Number(activeParty.weeksOfCover ?? (activeParty as any).weeks_of_cover ?? 0)} weeks`}
                      sub={
                        Number(activeParty.weeksOfCover ?? (activeParty as any).weeks_of_cover ?? 0) >= 4
                          ? "Comfortable — no rush to restock"
                          : Number(activeParty.weeksOfCover ?? (activeParty as any).weeks_of_cover ?? 0) >= 2
                          ? "Getting low — plan a reorder"
                          : "Very low — reorder soon!"
                      }
                      valueClass={weeksColour(Number(activeParty.weeksOfCover ?? (activeParty as any).weeks_of_cover ?? 0))}
                    />
                    <MetricTile
                      icon="💸"
                      label="Locked Capital"
                      value={formatCurrency(Number(activeParty.capitalLocked ?? (activeParty as any).capital_locked ?? 0))}
                      sub="Value of unsold goods at MRP"
                      valueClass="text-rose-400"
                    />
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-theme-body">
                      <span className="text-emerald-400">✦</span> Suggested Actions
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {Number(activeParty.stockCount || 0) > 0 && Number(activeParty.weeksOfCover || 0) < 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            setReconPartyFilter(activeParty.id);
                            setActiveSubTab("reconciliation");
                          }}
                          className="rounded-lg border border-theme-divider bg-theme-surface-1 px-2.5 py-1.5 text-left text-[10px] text-theme-body hover:border-blue-500/40"
                        >
                          ↗ Low stock cover — review replenishment
                        </button>
                      )}
                      {(activeParty.skuTracking ?? []).some(
                        (sku) => getSkuSentQty(sku) > 0 && computeSkuSellThrough(sku) < 20 && computeSkuLyingWithPartner(sku) > 0
                      ) && (
                        <button
                          type="button"
                          onClick={() => setOverviewDataView("articles")}
                          className="rounded-lg border border-theme-divider bg-theme-surface-1 px-2.5 py-1.5 text-left text-[10px] text-theme-body hover:border-amber-500/40"
                        >
                          ◉ Slow-moving stock — review promotion or store follow-up
                        </button>
                      )}
                      {Number(activeParty.sellThrough || 0) >= 50 && Number(activeParty.weeksOfCover || 0) >= 2 && (
                        <span className="rounded-lg border border-theme-divider bg-theme-surface-1 px-2.5 py-1.5 text-[10px] text-theme-muted">
                          Stock and sell-through are healthy; continue regular review.
                        </span>
                      )}
                      {!activeParty.skuTracking?.length && Number(activeParty.stockCount || 0) <= 0 && (
                        <span className="text-[10px] text-theme-muted">No stock movement data yet to suggest an action.</span>
                      )}
                    </div>
                  </div>

                  {/* Explainer */}
                  <div className="bg-blue-950/30 border border-blue-500/20 rounded-xl p-4">
                    <div className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-2">
                      ℹ️ How to read these numbers
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-theme-muted leading-relaxed">
                      <div>
                        <span className="text-theme-body font-medium">Stock with Distributor</span> — This is how many pieces of your goods are currently sitting with this distributor.
                      </div>
                      <div>
                        <span className="text-theme-body font-medium">How Much Has Sold</span> — Out of everything sent, what % has sold to end customers. 70%+ is healthy.
                      </div>
                      <div>
                        <span className="text-theme-body font-medium">Stock Will Last</span> — Weeks until inventory is depleted at current velocity. Less than 2 weeks = reorder soon.
                      </div>
                      <div>
                        <span className="text-theme-body font-medium">Money Tied in Unsold Stock</span> — Capital committed in unsold merchandise at the distributor.
                      </div>
                    </div>
                  </div>

                  {/* 4-Day Chart */}
                  {activeParty.history && activeParty.history.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-theme-body">
                          📈 Last 4 Days — Stock vs Sales
                        </h4>
                        <span className="text-[10px] text-theme-muted">
                          Blue = stock remaining · Green = daily sales
                        </span>
                      </div>
                      <div className="h-52 bg-theme-surface-3/40 p-4 rounded-xl border border-theme-divider">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={activeParty.history}
                            margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a3a5c" />
                            <XAxis dataKey="date" stroke="#8892a4" fontSize={11} />
                            <YAxis stroke="#8892a4" fontSize={11} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#16213e",
                                borderColor: "#2a3a5c",
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                              labelStyle={{ color: "white" }}
                              formatter={(value: number, name: string) => [
                                `${value} pcs`,
                                name === "stock" ? "📦 Stock Remaining" : "🛒 Daily Sales",
                              ]}
                            />
                            <Legend
                              formatter={(value) =>
                                value === "stock" ? "📦 Stock Remaining" : "🛒 Daily Sales"
                              }
                              wrapperStyle={{ fontSize: 11 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="stock"
                              stroke="#2563EB"
                              strokeWidth={2}
                              activeDot={{ r: 5 }}
                              name="stock"
                            />
                            <Line
                              type="monotone"
                              dataKey="sales"
                              stroke="#22c55e"
                              strokeWidth={2}
                              name="sales"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-theme-surface-3/40 border border-theme-divider rounded-xl p-6 text-center text-sm text-theme-muted">
                      <span className="text-2xl block mb-2">📉</span>
                      No sales activity recorded yet for this distributor. Chart will appear once goods start moving.
                    </div>
                  )}

                  <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1 rounded-lg bg-theme-surface-2 p-1">
                        {([
                          ["stores", "Store-wise Stock"],
                          ["articles", "Article-wise Stock"],
                          ["sizes", "Size-wise Stock"],
                          ["colors", "Color-wise Stock"],
                        ] as const).map(([view, label]) => (
                          <button
                            key={view}
                            type="button"
                            onClick={() => setOverviewDataView(view)}
                            className={`rounded-md px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${
                              overviewDataView === view
                                ? "bg-blue-600 text-white shadow-sm"
                                : "text-theme-muted hover:bg-theme-surface-3 hover:text-theme-body"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReconPartyFilter(activeParty.id);
                            setActiveSubTab("reconciliation");
                          }}
                          className="rounded-lg border border-theme-divider bg-theme-surface-2 px-3 py-1.5 text-[10px] font-semibold text-theme-body hover:bg-theme-surface-3"
                        >
                          Invoice Reconciliation · Inward / Receiver
                        </button>
                        <button
                          type="button"
                          onClick={exportPsvReport}
                          className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-[10px] font-semibold text-blue-300 hover:bg-blue-500/20"
                        >
                          Export CSV
                        </button>
                      </div>
                    </div>

                    {(overviewDataView === "sizes" || overviewDataView === "colors") && (
                      <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[10px] text-amber-200">
                        Projected partner stock is grouped using the size/color attributes registered on each tracked SKU. Stock follows the PSV visibility ledger and is not a physical count.
                      </p>
                    )}

                    {overviewDataView === "stores" && (
                      <div className="overflow-x-auto rounded-xl border border-theme-divider bg-theme-surface-3/40">
                        <table className="w-full min-w-[820px] border-collapse text-left">
                          <thead className="bg-theme-surface-2">
                            <tr className="border-b border-theme-divider">
                              {["#", "Store Code", "Store Name", "City / State", "Stock Left", "Sold Units", "Sold %", "Weeks Left", "Locked Capital", "Health"].map((heading) => (
                                <th key={heading} className="whitespace-nowrap px-2.5 py-2 text-[9px] font-bold uppercase tracking-wide text-theme-muted">{heading}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-theme-divider/50">
                            {filteredParties.map((party, index) => {
                              const signal = statusSignal(party.status);
                              const soldUnits = (party.skuTracking ?? []).reduce(
                                (total, sku) => total + Number(getSkuSoldQty(sku) || 0), 0
                              );
                              return (
                                <tr key={party.id} className={`cursor-pointer hover:bg-theme-surface-2/60 ${party.id === activeParty.id ? "bg-blue-500/5" : ""}`} onClick={() => setSelectedPartyId(party.id)}>
                                  <td className="px-2.5 py-2 text-[10px] text-theme-muted">{index + 1}</td>
                                  <td className="px-2.5 py-2 font-mono text-[10px] font-semibold text-blue-400">{party.storeCode || "—"}</td>
                                  <td className="px-2.5 py-2 text-[10px] font-medium text-theme-body">{party.storeNameSnapshot || party.name}</td>
                                  <td className="px-2.5 py-2 text-[10px] text-theme-muted">{getPartyCityState(party)}</td>
                                  <td className="px-2.5 py-2 text-right font-mono text-[10px] text-theme-body">{Number(party.stockCount || 0)}</td>
                                  <td className="px-2.5 py-2 text-right font-mono text-[10px] text-emerald-400">{soldUnits}</td>
                                  <td className="px-2.5 py-2 text-right font-mono text-[10px] text-theme-body">{Number(party.sellThrough || 0).toFixed(0)}%</td>
                                  <td className="px-2.5 py-2 text-right font-mono text-[10px] text-theme-body">{Number(party.weeksOfCover || 0).toFixed(1)} wk</td>
                                  <td className="px-2.5 py-2 text-right font-mono text-[10px] text-rose-300">{formatCurrency(Number(party.capitalLocked || 0))}</td>
                                  <td className="px-2.5 py-2">
                                    <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-semibold ${signal.cls}`}>{signal.emoji} {signal.label}</span>
                                  </td>
                                </tr>
                              );
                            })}
                            {!filteredParties.length && (
                              <tr><td colSpan={10} className="p-6 text-center text-xs text-theme-muted">No stores match this search.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {overviewDataView === "articles" && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-theme-divider bg-theme-surface-2/60 px-3 py-2">
                          <span className="text-[10px] font-semibold text-theme-body">
                            Suggested actions for {activeParty.storeNameSnapshot || activeParty.name}
                          </span>
                          <span className="text-[10px] text-theme-muted">
                            {Number(activeParty.weeksOfCover || 0) < 2 && Number(activeParty.stockCount || 0) > 0
                              ? "Low cover: review replenishment."
                              : Number(activeParty.sellThrough || 0) < 25
                                ? "Slow sell-through: consider a promotion or store follow-up."
                                : "Review slow-moving articles below; replenish only where demand supports it."}
                          </span>
                        </div>
                        <p className="text-[9px] text-theme-muted">
                          Movement signals use cumulative sold ÷ sent quantities as a proxy; recency-based velocity is not available in the current PSV feed.
                        </p>
                        <div className="overflow-x-auto rounded-xl border border-theme-divider bg-theme-surface-3/40">
                          <table className="w-full min-w-[760px] border-collapse text-left">
                            <thead className="bg-theme-surface-2">
                              <tr className="border-b border-theme-divider">
                                {["Article / Product", "Style", "Color", "Size", "SKU", "Stock Left", "Sent", "Sold", "Returned", "Sell Through", "Sell-through Signal"].map((heading) => (
                                  <th key={heading} className="px-3 py-2 text-[9px] font-bold uppercase tracking-wide text-theme-muted">{heading}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-theme-divider/50">
                              {(activeParty.skuTracking ?? []).map((sku) => {
                                const soldPct = computeSkuSellThrough(sku);
                                const movement = getSkuSentQty(sku) <= 0
                                  ? "No sales data"
                                  : soldPct < 20 ? "Low sell-through" : soldPct < 50 ? "Moderate sell-through" : "High sell-through";
                                const movementClass = movement === "Low sell-through"
                                  ? "text-rose-300 bg-rose-500/10 border-rose-500/20"
                                  : movement === "High sell-through"
                                    ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                                    : "text-amber-300 bg-amber-500/10 border-amber-500/20";
                                return (
                                  <tr key={sku.sku} className="hover:bg-theme-surface-2/40">
                                    <td className="px-3 py-2 text-[10px] font-medium text-theme-body">{sku.productName || sku.sku}</td>
                                    <td className="px-3 py-2 font-mono text-[9px] text-theme-muted">{sku.styleCode || "—"}</td>
                                    <td className="px-3 py-2 text-[9px] text-theme-muted">{sku.color || "—"}</td>
                                    <td className="px-3 py-2 text-[9px] text-theme-muted">{sku.size || "—"}</td>
                                    <td className="px-3 py-2 font-mono text-[9px] text-theme-muted">{sku.sku}</td>
                                    <td className="px-3 py-2 text-right font-mono text-[10px] text-blue-300">{computeSkuLyingWithPartner(sku)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-[10px] text-theme-body">{getSkuSentQty(sku)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-[10px] text-emerald-300">{getSkuSoldQty(sku)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-[10px] text-rose-300">{getSkuReturnedQty(sku)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-[10px] text-theme-body">{soldPct.toFixed(0)}%</td>
                                    <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-semibold ${movementClass}`}>{movement}</span></td>
                                  </tr>
                                );
                              })}
                              {!activeParty.skuTracking?.length && (
                                <tr><td colSpan={11} className="p-6 text-center text-xs text-theme-muted">No article-level sales tracking is available for this store.</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {(overviewDataView === "sizes" || overviewDataView === "colors") && (
                      <div className="overflow-x-auto rounded-xl border border-theme-divider bg-theme-surface-3/40">
                        <table className="w-full min-w-[680px] border-collapse text-left">
                          <thead className="bg-theme-surface-2">
                            <tr className="border-b border-theme-divider">
                              {[overviewDataView === "sizes" ? "Size" : "Color", "SKUs", "Projected Stock", "Sent", "Sold", "Returned"].map((heading) => (
                                <th key={heading} className="px-3 py-2 text-[9px] font-bold uppercase tracking-wide text-theme-muted">{heading}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-theme-divider/50">
                            {dimensionRows.map((row) => (
                              <tr key={row.label}>
                                <td className="px-3 py-2 text-[10px] font-semibold text-theme-body">{row.label}</td>
                                <td className="px-3 py-2 text-right text-[10px] text-theme-body">{row.skuCount}</td>
                                <td className="px-3 py-2 text-right font-mono text-[10px] text-blue-300">{row.stockQty}</td>
                                <td className="px-3 py-2 text-right font-mono text-[10px] text-theme-body">{row.sentQty}</td>
                                <td className="px-3 py-2 text-right font-mono text-[10px] text-emerald-300">{row.soldQty}</td>
                                <td className="px-3 py-2 text-right font-mono text-[10px] text-rose-300">{row.returnedQty}</td>
                              </tr>
                            ))}
                            {!dimensionRows.length && (
                              <tr><td colSpan={6} className="p-6 text-center text-xs text-theme-muted">No SKU stock tracking is available for this catalog dimension.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  {/* Tip Card */}
                  {tip && (
                    <div className="bg-theme-surface-3 rounded-xl p-4 border border-theme-divider flex items-start gap-3">
                      <span className="text-2xl shrink-0 mt-0.5">{tip.icon}</span>
                      <div>
                        <div className="font-bold text-sm text-theme-body mb-1">{tip.title}</div>
                        <p className="text-xs text-theme-muted leading-relaxed">{tip.body}</p>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>

          {/* Bottom Legend */}
          <div className="flex flex-wrap gap-4 justify-center pt-2 pb-1">
            {[
              { emoji: "🟢", label: "All Good — selling well, no action needed" },
              { emoji: "🟡", label: "Keep Watch — sales slightly slow" },
              { emoji: "🔴", label: "Needs Action — goods not moving" },
              { emoji: "⚫", label: "Sold Out — nothing left, reorder if needed" },
            ].map((item) => (
              <span key={item.emoji} className="text-[11px] text-theme-muted flex items-center gap-1.5">
                <span>{item.emoji}</span> {item.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          VIEW 2: INVOICE & RECEIVING QUANTITY RECONCILIATION
      ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === "reconciliation" && (
        <div className="space-y-5">

          {/* ── TOP CONTROL & FILTER BAR ── */}
          <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Party Selector */}
              <div className="min-w-[200px]">
                <label className="block text-[10px] uppercase font-bold text-theme-muted mb-1">
                  Distributor / Retail Store
                </label>
                <select
                  value={reconPartyFilter}
                  onChange={(e) => setReconPartyFilter(e.target.value)}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                >
                  <option value="">🏢 All Distributors & Stores</option>
                  {psvParties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.storeCode ? `${p.storeCode} · ` : ""}{p.storeNameSnapshot || p.name} ({getPartyCityState(p)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="min-w-[150px]">
                <label className="block text-[10px] uppercase font-bold text-theme-muted mb-1">
                  Status Filter
                </label>
                <select
                  value={reconStatusFilter}
                  onChange={(e) => setReconStatusFilter(e.target.value)}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="RECONCILED">✅ Fully Reconciled</option>
                  <option value="SHORTAGE">⚠️ Shortage Detected</option>
                  <option value="EXCESS">📦 Excess Received</option>
                  <option value="PENDING_APPROVAL">⏳ Pending Approval</option>
                  <option value="UNRECEIVED">🕒 Not Received</option>
                  <option value="HAS_REJECTIONS">🛑 Has Rejections</option>
                </select>
              </div>

              {/* Discrepancy Toggle Button */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setReconDiscrepancyOnly(!reconDiscrepancyOnly)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                    reconDiscrepancyOnly
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm shadow-rose-500/20"
                      : "bg-theme-surface-2 text-theme-muted border-theme-divider hover:text-theme-body hover:bg-theme-surface-3"
                  }`}
                >
                  <span>⚠️</span> Discrepancies Only
                </button>
              </div>

              {/* Search Bar */}
              <div className="flex-1 min-w-[220px] pt-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted text-xs">🔍</span>
                  <input
                    type="text"
                    placeholder="Search invoice #, barcode, style/article, color, size…"
                    value={reconSearch}
                    onChange={(e) => setReconSearch(e.target.value)}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg pl-8 pr-3 py-1.5 text-xs text-theme-body placeholder:text-theme-muted focus:outline-none focus:border-blue-500"
                  />
                  {reconSearch && (
                    <button
                      onClick={() => setReconSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme-body text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 pt-4 md:pt-0 self-end md:self-center">
              <button
                type="button"
                onClick={() => fetchReconciliation()}
                disabled={loadingRecon}
                className="bg-theme-surface-2 hover:bg-theme-surface-3 border border-theme-divider text-theme-body text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <span className={loadingRecon ? "animate-spin" : ""}>🔄</span> Refresh
              </button>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => filteredReconItems[0] && openReceiveModal(filteredReconItems[0])}
                  disabled={!filteredReconItems.length || isLoadingReceiveInvoice}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm shadow-emerald-600/30 transition-colors flex items-center gap-1.5"
                >
                  <span>📥</span>
                  {filteredReconItems[0] ? `Bulk Receive ${filteredReconItems[0].invoice_no}` : "Bulk Receive Invoice"}
                </button>
              )}
            </div>
          </div>

          {/* ── KPI RECONCILIATION SUMMARY TILES ── */}
          {reconData?.summary ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <MetricTile
                icon="📄"
                label="Document Qty"
                value={`${reconData.summary.total_document_qty.toLocaleString("en-IN")} pcs`}
                sub="Billed on Sales Invoices"
                valueClass="text-blue-400"
              />
              <MetricTile
                icon="🚚"
                label="Received Qty"
                value={`${reconData.summary.total_received_qty.toLocaleString("en-IN")} pcs`}
                sub="Physically arrived"
                valueClass="text-emerald-400"
              />
              <MetricTile
                icon="⏳"
                label="Pending Approval"
                value={`${reconData.summary.total_pending_approval_qty.toLocaleString("en-IN")} pcs`}
                sub="Quarantined from live stock"
                valueClass="text-amber-300"
                badge={reconData.summary.pending_approval_count > 0 ? `${reconData.summary.pending_approval_count} lines` : undefined}
                badgeCls="bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse"
              />
              <MetricTile
                icon="✅"
                label="Approved Stock"
                value={`${reconData.summary.total_approved_qty.toLocaleString("en-IN")} pcs`}
                sub="Live in store balance"
                valueClass="text-emerald-300"
              />
              <MetricTile
                icon="⚠️"
                label="Net Shortage"
                value={`${reconData.summary.total_short_qty.toLocaleString("en-IN")} pcs`}
                sub="Missing vs Tax Invoice"
                valueClass={reconData.summary.total_short_qty > 0 ? "text-rose-400 font-bold" : "text-theme-muted"}
                badge={reconData.summary.total_short_qty > 0 ? "Discrepancy" : undefined}
                badgeCls="bg-rose-500/20 text-rose-300 border-rose-500/40"
              />
              <MetricTile
                icon="➕"
                label="Excess Received"
                value={`${reconData.summary.total_excess_qty.toLocaleString("en-IN")} pcs`}
                sub="Received over invoice"
                valueClass={reconData.summary.total_excess_qty > 0 ? "text-purple-400" : "text-theme-muted"}
              />
              <MetricTile
                icon="🛑"
                label="Quality Rejected"
                value={`${reconData.summary.total_rejected_qty.toLocaleString("en-IN")} pcs`}
                sub="Damaged / failed audit"
                valueClass={reconData.summary.total_rejected_qty > 0 ? "text-rose-300" : "text-theme-muted"}
              />
            </div>
          ) : loadingRecon ? (
            <div className="py-6 text-center text-sm text-theme-muted animate-pulse">
              Loading quantity reconciliation metrics…
            </div>
          ) : null}

          {/* ── GOVERNANCE / DISCREPANCY ALERT BANNER ── */}
          {reconData?.summary && (reconData.summary.total_pending_approval_qty > 0 || reconData.summary.total_short_qty > 0) && (
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="text-xl shrink-0">🛡️</span>
                <div>
                  <div className="font-bold text-amber-300 text-sm">
                    Stock Ledger Safety Active — Pending & Shortage Quarantine
                  </div>
                  <p className="text-theme-muted mt-0.5 leading-relaxed">
                    {reconData.summary.total_pending_approval_qty > 0 && (
                      <span className="text-amber-200">
                        • {reconData.summary.total_pending_approval_qty} pieces are currently awaiting manager sign-off and are isolated from available live stock.
                      </span>
                    )}
                    {reconData.summary.total_short_qty > 0 && (
                      <span className="text-rose-300 ml-1">
                        • {reconData.summary.total_short_qty} pieces have not yet physically arrived at the retail destination.
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {isManagerOrAdmin && reconData.summary.pending_approval_count > 0 && (
                <div className="text-right shrink-0">
                  <span className="text-[11px] text-theme-muted block mb-1">
                    Manager Sign-off Authorized
                  </span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-1 rounded">
                    Review lines below to approve
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── RECONCILIATION ERROR STATE ── */}
          {reconError && (
            <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 rounded-xl p-4 text-xs flex items-center justify-between">
              <span>⚠️ Error: {reconError}</span>
              <button
                type="button"
                onClick={() => fetchReconciliation()}
                className="underline hover:text-white"
              >
                Try Again
              </button>
            </div>
          )}

          {/* ── AUTHORITATIVE RECONCILIATION DATA TABLE ── */}
          <div className="bg-theme-surface-1 rounded-xl border border-theme-divider overflow-hidden shadow-sm">
            <div className="p-4 border-b border-theme-divider flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm text-theme-body flex items-center gap-2">
                  <span>📋</span> Invoice Item Discrepancy & Receiving Ledger
                </h4>
                <span className="text-[11px] text-theme-muted">
                  Showing {filteredReconItems.length} of {reconData?.summary.total_items || 0} invoice lines
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-theme-muted">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Reconciled
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 ml-2"></span> Pending
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-400 ml-2"></span> Shortage
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-theme-surface-2 border-b border-theme-divider">
                    <th className="px-3 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider">Invoice Ref</th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider">Store / Distributor</th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider">Item & Catalog Dimensions</th>
                    <th className="px-2.5 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Document</th>
                    <th className="px-2.5 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Received</th>
                    <th className="px-2.5 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Pending</th>
                    <th className="px-2.5 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Approved</th>
                    <th className="px-2.5 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Short</th>
                    <th className="px-2.5 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Excess</th>
                    <th className="px-2.5 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Rejected</th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-center">Status</th>
                    <th className="px-3 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-divider/50">
                  {loadingRecon && filteredReconItems.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-12 text-center text-theme-muted">
                        <span className="text-2xl block mb-2 animate-spin">⏳</span>
                        Loading invoice items and receiving records…
                      </td>
                    </tr>
                  ) : filteredReconItems.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-12 text-center text-theme-muted">
                        <span className="text-3xl block mb-2">🔍</span>
                        No invoice items matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredReconItems.map((item) => {
                      const badge = reconStatusBadge(item.reconciliation_status);
                      const hasDiscrepancy = item.short_qty > 0 || item.excess_qty > 0 || item.rejected_qty > 0;
                      return (
                        <tr
                          key={item.invoice_line_id}
                          className={`hover:bg-theme-surface-2/40 transition-colors ${
                            hasDiscrepancy ? "bg-rose-950/5" : ""
                          }`}
                        >
                          {/* Invoice Reference & Date */}
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="font-semibold text-theme-body font-mono text-xs">{item.invoice_no}</div>
                            <div className="text-[10px] text-theme-muted mt-0.5">
                              {item.invoice_date ? new Date(item.invoice_date).toLocaleDateString("en-IN") : "—"}
                            </div>
                          </td>

                          {/* Party / Store */}
                          <td className="px-3 py-3">
                            <div className="font-medium text-theme-body text-xs line-clamp-1">{item.party_name}</div>
                            {item.store_code && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                🏬 {item.store_code}
                              </span>
                            )}
                          </td>

                          {/* Product & Dimensions */}
                          <td className="px-3 py-3">
                            <div className="font-medium text-theme-body text-xs line-clamp-1">{getPsvItemDisplayName(item)}</div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {item.style_code && item.style_code.trim().toUpperCase() !== item.sku.trim().toUpperCase() && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-theme-surface-3 text-indigo-300 border border-indigo-500/20">
                                  ART: {item.style_code}
                                </span>
                              )}
                              {item.color && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-theme-surface-3 text-amber-300 border border-amber-500/20">
                                  🎨 {item.color}
                                </span>
                              )}
                              {item.size && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-theme-surface-3 text-emerald-300 border border-emerald-500/20">
                                  📐 {item.size}
                                </span>
                              )}
                              {item.barcodes?.length ? (
                                <span className="text-[10px] text-blue-300">Barcode verification</span>
                              ) : (
                                <span className="text-[10px] text-amber-300">Product label verification</span>
                              )}
                            </div>
                          </td>

                          {/* Document Qty */}
                          <td className="px-2.5 py-3 text-right font-mono font-bold text-blue-400">
                            {item.document_qty}
                          </td>

                          {/* Received Qty */}
                          <td className="px-2.5 py-3 text-right font-mono font-bold text-emerald-400">
                            {item.received_qty}
                          </td>

                          {/* Pending Approval */}
                          <td className="px-2.5 py-3 text-right font-mono">
                            {item.pending_approval_qty > 0 ? (
                              <span className="text-amber-300 font-semibold px-1 py-0.5 rounded bg-amber-500/20 border border-amber-500/30">
                                {item.pending_approval_qty}
                              </span>
                            ) : (
                              <span className="text-theme-muted">0</span>
                            )}
                          </td>

                          {/* Approved Qty */}
                          <td className="px-2.5 py-3 text-right font-mono text-emerald-300">
                            {item.approved_qty}
                          </td>

                          {/* Short Qty */}
                          <td className="px-2.5 py-3 text-right font-mono">
                            {item.short_qty > 0 ? (
                              <span className="text-rose-400 font-bold px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/30">
                                -{item.short_qty}
                              </span>
                            ) : (
                              <span className="text-theme-muted">0</span>
                            )}
                          </td>

                          {/* Excess Qty */}
                          <td className="px-2.5 py-3 text-right font-mono">
                            {item.excess_qty > 0 ? (
                              <span className="text-purple-400 font-bold px-1 py-0.5 rounded bg-purple-500/20">
                                +{item.excess_qty}
                              </span>
                            ) : (
                              <span className="text-theme-muted">0</span>
                            )}
                          </td>

                          {/* Rejected Qty */}
                          <td className="px-2.5 py-3 text-right font-mono">
                            {item.rejected_qty > 0 ? (
                              <span className="text-rose-400 font-bold px-1 py-0.5 rounded bg-rose-500/20">
                                {item.rejected_qty}
                              </span>
                            ) : (
                              <span className="text-theme-muted">0</span>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                              <span>{badge.emoji}</span> {badge.label}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Manager Approve Button for Pending Events */}
                              {item.pending_approval_qty > 0 && isManagerOrAdmin && item.pending_event_ids?.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveEvent(item.pending_event_ids[0], item.product_name)}
                                  disabled={approvingEventId === item.pending_event_ids[0]}
                                  className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 font-semibold text-[10px] transition-colors flex items-center gap-1"
                                  title="Approve this inward delivery into active stock"
                                >
                                  {approvingEventId === item.pending_event_ids[0] ? (
                                    <span className="animate-spin">⏳</span>
                                  ) : (
                                    <span>✅ Approve</span>
                                  )}
                                </button>
                              )}

                              {/* Inward Receive Button */}
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => openReceiveModal(item)}
                                  className="px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-semibold text-[10px] transition-colors flex items-center gap-1"
                                  title="Receive all items from this invoice"
                                >
                                  <span>📥 Bulk Receive</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL: RECORD INWARD PHYSICAL GOODS RECEIPT
      ══════════════════════════════════════════════════════════════════════ */}
      {selectedItemForReceive && receiveModalOpen && false && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col my-8 animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-theme-divider flex items-center justify-between bg-theme-surface-2">
              <div>
                <h4 className="font-bold text-sm text-theme-body flex items-center gap-2">
                  <span>📥</span> Record Inward Goods Receipt
                </h4>
                <p className="text-[11px] text-theme-muted mt-0.5">
                  Tax Invoice: <span className="font-mono text-blue-400 font-semibold">{receiveForm.invoice_no}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceiveModalOpen(false)}
                className="text-theme-muted hover:text-theme-body p-1 rounded-lg hover:bg-theme-surface-3 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleReceiveSubmit} className="p-5 space-y-4">
              {/* Item Info Banner */}
              {selectedItemForReceive && (
                <div className="bg-theme-surface-3/50 border border-theme-divider rounded-xl p-3 text-xs space-y-1.5">
                  <div className="font-semibold text-theme-body text-sm">
                    {selectedItemForReceive ? getPsvItemDisplayName(selectedItemForReceive) : ""}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {selectedItemForReceive?.style_code &&
                      selectedItemForReceive?.style_code?.trim().toUpperCase() !== selectedItemForReceive?.sku?.trim().toUpperCase() && (
                      <span className="text-indigo-300">ART: {selectedItemForReceive?.style_code}</span>
                    )}
                    {selectedItemForReceive?.color && (
                      <span className="text-amber-300">Color: {selectedItemForReceive?.color}</span>
                    )}
                    {selectedItemForReceive?.size && (
                      <span className="text-emerald-300">Size: {selectedItemForReceive?.size}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1 border-t border-theme-divider/50 text-center font-mono text-[11px]">
                    <div>
                      <span className="text-theme-muted block text-[9px] uppercase">Invoice Qty</span>
                      <span className="font-bold text-blue-400">{selectedItemForReceive?.document_qty} pcs</span>
                    </div>
                    <div>
                      <span className="text-theme-muted block text-[9px] uppercase">Received</span>
                      <span className="font-bold text-emerald-400">{selectedItemForReceive?.received_qty} pcs</span>
                    </div>
                    <div>
                      <span className="text-theme-muted block text-[9px] uppercase">Pending Approval</span>
                      <span className="font-bold text-amber-300">{selectedItemForReceive?.pending_approval_qty} pcs</span>
                    </div>
                    <div>
                      <span className="text-theme-muted block text-[9px] uppercase">Approved</span>
                      <span className="font-bold text-emerald-300">{selectedItemForReceive?.approved_qty} pcs</span>
                    </div>
                    <div>
                      <span className="text-theme-muted block text-[9px] uppercase">Remaining Due</span>
                      <span className="font-bold text-rose-300">{remainingInvoiceQty} pcs</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-theme-muted">
                    Pending and approved are previous receipt statuses; they are shown for reference, not added to this receipt.
                  </p>
                </div>
              )}

              {selectedItemForReceive && selectedItemBarcodes.length > 0 ? (
                <section className="rounded-xl border border-blue-500/30 bg-blue-950/15 p-3 space-y-3">
                  <div>
                    <div>
                      <h5 className="text-xs font-semibold text-theme-body">Verify items by barcode</h5>
                      <p className="mt-1 text-[10px] text-theme-muted">
                        Barcode scanning is required for this item. Scan each physical unit, including rejected pieces.
                      </p>
                    </div>
                  </div>
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    autoFocus
                    inputMode="none"
                    autoComplete="off"
                    aria-label="Scan item barcode"
                    placeholder="Scan barcode and press Enter"
                    value={barcodeInput}
                    onChange={(event) => setBarcodeInput(event.target.value)}
                    onKeyDown={handleBarcodeScan}
                    className="w-full rounded-lg border border-theme-divider bg-theme-surface-2 px-3 py-2 text-sm font-mono text-theme-body focus:border-blue-500 focus:outline-none"
                  />
                  {barcodeScanError && <p role="alert" className="text-[11px] text-rose-400">{barcodeScanError}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                    <span className="text-theme-muted">
                      Scanned: <strong className="text-blue-300">{totalScannedBarcodeQty}</strong>
                      {" "}· Accepted: <strong className="text-emerald-300">{receiveForm.received_qty}</strong>
                      {" "}· Rejected: <strong className="text-rose-300">{receiveForm.rejected_qty}</strong>
                    </span>
                    <span className={
                      totalScannedBarcodeQty === remainingInvoiceQty && totalScannedBarcodeQty > 0
                        ? "text-emerald-300"
                        : totalScannedBarcodeQty === 0 && remainingInvoiceQty === 0
                          ? "text-theme-muted"
                          : "text-amber-300"
                    }>
                      {totalScannedBarcodeQty === remainingInvoiceQty && totalScannedBarcodeQty > 0
                        ? "Matches remaining invoice qty"
                        : totalScannedBarcodeQty === 0 && remainingInvoiceQty === 0
                          ? "No invoice balance due"
                          : `Invoice balance: ${remainingInvoiceQty} pcs — note any difference below`}
                    </span>
                  </div>
                  {Object.entries(scannedBarcodeCounts).length > 0 && (
                    <div className="space-y-1 border-t border-theme-divider/50 pt-2">
                      {Object.entries(scannedBarcodeCounts).map(([barcode, count], index) => (
                        <div key={barcode} className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="text-theme-body">Barcode scan {index + 1} × {count}</span>
                          <button
                            type="button"
                            onClick={() => undoBarcodeScan(barcode)}
                            className="rounded border border-rose-500/30 px-2 py-1 text-rose-300 hover:bg-rose-500/10"
                            aria-label={`Undo one barcode scan for ${selectedItemForReceive ? getPsvItemDisplayName(selectedItemForReceive) : "item"}`}
                          >
                            Undo one
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {hasBarcodeScanCorrection && (
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold text-amber-200">
                        Why was a scan undone? <span className="text-rose-300">*</span>
                      </span>
                      <input
                        type="text"
                        value={scanCorrectionReason}
                        onChange={(event) => setScanCorrectionReason(event.target.value)}
                        placeholder="For example: duplicate scan or wrong label scanned"
                        className="w-full rounded-lg border border-amber-500/30 bg-theme-surface-2 px-3 py-2 text-xs text-theme-body focus:border-amber-500 focus:outline-none"
                        required
                      />
                    </label>
                  )}
                </section>
              ) : selectedItemForReceive ? (
                <section className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-3 space-y-2">
                  <p className="text-[11px] text-amber-200">
                    No barcode is registered. Verify the product label by scanning or entering its product code before quantity entry.
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold text-theme-body">
                      Confirm product label code
                    </span>
                    <input
                      type="password"
                      autoComplete="off"
                      aria-label="Confirm product label code"
                      placeholder="Scan or enter product code from the label"
                      value={skuConfirmation}
                      onChange={(event) => setSkuConfirmation(event.target.value)}
                      className="w-full rounded-lg border border-theme-divider bg-theme-surface-2 px-3 py-2 text-sm font-mono text-theme-body focus:border-amber-500 focus:outline-none"
                    />
                  </label>
                  {skuConfirmation && (
                    <p role={manualSkuConfirmed ? "status" : "alert"} className={`text-[10px] ${manualSkuConfirmed ? "text-emerald-300" : "text-rose-300"}`}>
                      {manualSkuConfirmed ? "Product label verified. Enter the manually counted quantities." : "Product label code does not match the invoice item."}
                    </p>
                  )}
                  {manualSkuConfirmed && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReceiveForm((form) => ({ ...form, received_qty: remainingInvoiceQty }))}
                        className="rounded-lg border border-blue-500/30 px-3 py-1.5 text-[10px] font-semibold text-blue-300 hover:bg-blue-500/10"
                      >
                        Prefill remaining due ({remainingInvoiceQty})
                      </button>
                      <span className="text-[10px] text-theme-muted">
                        Prefill is editable. Enter the physical count if it differs.
                      </span>
                    </div>
                  )}
                </section>
              ) : null}

              {/* Quantities Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-theme-body mb-1">
                    Accepted Quantity <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={receiveForm.received_qty}
                    readOnly={useBarcodeScanning}
                    disabled={!useBarcodeScanning && !manualSkuConfirmed}
                    onChange={(e) => setReceiveForm({ ...receiveForm, received_qty: Number(e.target.value) })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-theme-muted block mt-0.5">
                    {useBarcodeScanning ? "Calculated from scans minus rejected units" : "Manually counted, saleable units"}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-theme-body mb-1">
                    Damaged / Rejected Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    max={useBarcodeScanning ? totalScannedBarcodeQty : undefined}
                    value={receiveForm.rejected_qty}
                    disabled={!useBarcodeScanning && !manualSkuConfirmed}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      const scannedQty = totalScannedBarcodeQty;
                      setRejectedQty(useBarcodeScanning ? Math.min(value, scannedQty) : value);
                    }}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm font-mono text-rose-400 font-bold focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-[10px] text-theme-muted block mt-0.5">
                    Defective, stained, or broken pieces
                  </span>
                </div>
              </div>

              {/* Rejection Reason (shown if rejected_qty > 0) */}
              {receiveForm.rejected_qty > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-theme-body mb-1">
                    Inspection Rejection Reason <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={receiveForm.rejection_reason}
                    onChange={(e) => setReceiveForm({ ...receiveForm, rejection_reason: e.target.value })}
                    className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-xs text-theme-body focus:outline-none focus:border-rose-500 mb-1.5"
                    required
                  >
                    <option value="">Select failure cause…</option>
                    <option value="Packaging Torn / Crushed">Transit Damage — Packaging Torn / Crushed</option>
                    <option value="Fabric Stained / Soiled">Quality Defect — Fabric Stained / Soiled</option>
                    <option value="Stitching / Button Defect">Manufacturing Defect — Stitching / Button</option>
                    <option value="Barcode Label Missing / Unreadable">Labeling — Barcode Missing / Unreadable</option>
                    <option value="Wrong Size / Color Variant Delivered">Wrong Product — Variant Discrepancy</option>
                    <option value="Other / Audit Hold">Other — Audit Quarantine</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-theme-body mb-1">Receipt reference</label>
                <input
                  type="text"
                  placeholder="Optional delivery / challan reference"
                  value={receiveForm.receipt_reference}
                  onChange={(e) => setReceiveForm({ ...receiveForm, receipt_reference: e.target.value })}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Receiving Remarks */}
              <div>
                <label className="block text-[11px] font-semibold text-theme-body mb-1">
                  Delivery / Inspection Remarks {hasReceiptQtyDiscrepancy && <span className="text-rose-400">*</span>}
                </label>
                <textarea
                  rows={2}
                  placeholder={
                    hasReceiptQtyDiscrepancy
                      ? "Required: explain the difference from the invoice balance…"
                      : "Notes from delivery gate or carton inspection…"
                  }
                  value={receiveForm.remarks}
                  onChange={(e) => setReceiveForm({ ...receiveForm, remarks: e.target.value })}
                  required={hasReceiptQtyDiscrepancy}
                  className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Immediate Manager Approval Checkbox */}
              {isManagerOrAdmin && (
                <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoApproveToggle"
                      checked={receiveForm.auto_approve}
                      onChange={(e) => setReceiveForm({ ...receiveForm, auto_approve: e.target.checked })}
                      className="rounded border-theme-divider text-amber-500 focus:ring-amber-400"
                    />
                    <label htmlFor="autoApproveToggle" className="text-xs font-semibold text-amber-300 cursor-pointer">
                      Manager Sign-Off — Immediate Live Stock Credit
                    </label>
                  </div>
                  <span className="text-[10px] text-theme-muted">
                    {receiveForm.auto_approve ? "Skips quarantine" : "Will require manual review"}
                  </span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-theme-divider">
                <button
                  type="button"
                  onClick={() => setReceiveModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-theme-muted hover:text-theme-body hover:bg-theme-surface-2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmittingReceipt ||
                    (selectedItemBarcodes.length > 0
                      ? Object.keys(scannedBarcodeCounts).length === 0
                      : !manualSkuConfirmed)
                  }
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5"
                >
                  {isSubmittingReceipt ? (
                    <>
                      <span className="animate-spin">⏳</span> Recording Receipt…
                    </>
                  ) : (
                    <>
                      <span>💾</span> Confirm & Record Inward
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
