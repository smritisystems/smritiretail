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
 * Shortage Qty, Excess Qty, and Quality Rejections across Catalog Dimensions (Style/Article, Color, Size, SKU).
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
  hasScanCorrection: boolean;
  scanCorrectionReason: string;
}

function emptyReceiptDraft(): PSVReceiptLineDraft {
  return {
    received_qty: 0,
    rejected_qty: 0,
    rejection_reason: "",
    sku_confirmation: "",
    scans: [],
    hasScanCorrection: false,
    scanCorrectionReason: "",
  };
}

type PSVReceiptMode = "prefill" | "csv" | "scan";

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
   SUB-COMPONENT — SKU Row
───────────────────────────────────────────────────────── */
function SkuRow({ sku }: { sku: PSVPartySkuTracking }) {
  const lying = computeSkuLyingWithPartner(sku);
  const sellThrough = computeSkuSellThrough(sku);
  return (
    <tr className="hover:bg-theme-surface-2/40 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-theme-body text-sm">{sku.productName || sku.sku}</div>
        <div className="text-[10px] text-theme-muted font-mono mt-0.5">{sku.sku}</div>
      </td>
      <td className="px-3 py-3 text-right text-theme-body text-sm font-mono">{sku.invoicedQty}</td>
      <td className="px-3 py-3 text-right text-emerald-400 text-sm font-semibold font-mono">{sku.confirmedSoldQty}</td>
      <td className="px-3 py-3 text-right text-rose-400 text-sm font-mono">{sku.returnedQty}</td>
      <td className="px-3 py-3 text-right text-blue-400 text-sm font-bold font-mono">{lying}</td>
      <td className="px-4 py-3 text-right">
        <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${sellThroughColour(sellThrough)}`}>
          {sellThrough.toFixed(0)}%
        </span>
      </td>
    </tr>
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
  const [activeSubTab, setActiveSubTab] = useState<"overview" | "reconciliation">("overview");

  const [selectedPartyId, setSelectedPartyId] = useState<string>(
    psvParties[0]?.id || ""
  );
  const [search, setSearch] = useState("");
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
  const [receiveMode, setReceiveMode] = useState<PSVReceiptMode>("prefill");
  const [scanDisposition, setScanDisposition] = useState<"accepted" | "rejected">("accepted");
  const [csvImportError, setCsvImportError] = useState<string | null>(null);
  const [csvImportSummary, setCsvImportSummary] = useState<string | null>(null);
  const [receiveValidationError, setReceiveValidationError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

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
        invoiceItems.map((line) => [line.invoice_line_id, emptyReceiptDraft()])
      ));
    } catch (error: any) {
      console.error("[PSV] Failed to load invoice lines for bulk receiving:", error);
      setReceiveValidationError(error.message || "Failed to load all invoice items.");
    } finally {
      setIsLoadingReceiveInvoice(false);
    }
  };

  const handleBarcodeScan = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const barcode = barcodeInput.trim().toUpperCase();
    if (!barcode) return;
    const matches = receiveInvoiceItems.filter((item) =>
      (item.barcodes ?? []).some((knownBarcode) => knownBarcode.trim().toUpperCase() === barcode)
    );
    const distinctSkus = new Set(matches.map((item) => item.sku.trim().toUpperCase()));
    if (matches.length === 0 || distinctSkus.size > 1) {
      setBarcodeScanError(
        distinctSkus.size > 1
          ? "This barcode matches multiple invoice lines. Ask a manager to resolve the duplicate barcode."
          : "This barcode does not match an item on this invoice."
      );
      setBarcodeInput("");
      return;
    }
    const matchedItem = matches.find((item) => {
      const currentScans = receiptLineDrafts[item.invoice_line_id]?.scans.length ?? 0;
      return currentScans < getRemainingQty(item);
    }) ?? matches[0];
    updateReceiptDraft(matchedItem.invoice_line_id, (draft) => ({
      ...draft,
      scans: [...draft.scans, { barcode, disposition: scanDisposition }],
    }));
    setBarcodeScanError(null);
    setReceiveValidationError(null);
    setBarcodeInput("");
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
      return [item.invoice_line_id, (item.barcodes ?? []).length > 0
        ? draft
        : { ...draft, received_qty: getRemainingQty(item) }];
    })));
    setReceiveValidationError(null);
  };

  const downloadReceiptCsvTemplate = () => {
    const headers = [
      "invoice_line_id",
      "sku",
      "sku_confirmation",
      "barcode",
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
      const requiredHeaders = [
        "invoice_line_id", "sku", "sku_confirmation", "barcode", "disposition",
        "received_qty", "rejected_qty", "rejection_reason",
      ];
      const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
      if (missingHeaders.length) {
        throw new Error(`Missing CSV columns: ${missingHeaders.join(", ")}.`);
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
          const lineId = valueAt(row, "invoice_line_id");
          const item = byLineId.get(lineId);
          if (!item) throw new Error(`Row ${rowNumber}: unknown invoice line ID.`);
          if (valueAt(row, "sku").toUpperCase() !== item.sku.trim().toUpperCase()) {
            throw new Error(`Row ${rowNumber}: SKU does not match invoice line ${item.sku}.`);
          }
          const barcode = valueAt(row, "barcode").toUpperCase();
          const disposition = valueAt(row, "disposition").toLowerCase();
          const draft = importedDrafts[lineId];
          if ((item.barcodes ?? []).length > 0) {
            if (!barcode) {
              if (valueAt(row, "received_qty") || valueAt(row, "rejected_qty")) {
                throw new Error(`Row ${rowNumber}: barcode-enabled items require one registered barcode per unit, not typed quantities.`);
              }
              return;
            }
            if (!(item.barcodes ?? []).some((known) => known.trim().toUpperCase() === barcode)) {
              throw new Error(`Row ${rowNumber}: barcode does not belong to invoice SKU ${item.sku}.`);
            }
            if (disposition !== "accepted" && disposition !== "rejected") {
              throw new Error(`Row ${rowNumber}: disposition must be "accepted" or "rejected".`);
            }
            draft.scans.push({ barcode, disposition });
          } else {
            if (barcode || disposition) {
              throw new Error(`Row ${rowNumber}: this SKU-only item has no registered barcode; enter its exact SKU confirmation and quantities.`);
            }
            if (seenManualLines.has(lineId)) {
              throw new Error(`Row ${rowNumber}: SKU-only invoice lines must appear once in the CSV.`);
            }
            seenManualLines.add(lineId);
            if (valueAt(row, "sku_confirmation").toUpperCase() !== item.sku.trim().toUpperCase()) {
              throw new Error(`Row ${rowNumber}: enter the exact invoice SKU in sku_confirmation.`);
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
      setReceiptLineDrafts(importedDrafts);
      setCsvImportSummary(`Imported ${acceptedRows} CSV row${acceptedRows === 1 ? "" : "s"}. Review quantities and scanned barcodes before saving.`);
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
    const payloadItems: Record<string, any>[] = [];
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
        if (!draft.scans.length) {
          validationErrors.push(`${item.sku}: scan each received/rejected unit using its registered barcode.`);
          return;
        }
        const invalidBarcode = draft.scans.find((scan) =>
          !registeredBarcodes.some((known) => known.trim().toUpperCase() === scan.barcode)
        );
        if (invalidBarcode) {
          validationErrors.push(`${item.sku}: a scanned barcode is not registered to this invoice item.`);
          return;
        }
        if (draft.scans.length !== totalQty) {
          validationErrors.push(`${item.sku}: scan total must equal accepted plus rejected quantity.`);
          return;
        }
      } else if (draft.sku_confirmation.trim().toUpperCase() !== item.sku.trim().toUpperCase()) {
        validationErrors.push(`${item.sku}: confirm the exact invoice SKU before recording quantities.`);
        return;
      }
      if (draft.hasScanCorrection && !draft.scanCorrectionReason.trim()) {
        validationErrors.push(`${item.sku}: explain why a barcode scan was undone.`);
        return;
      }
      if (rejectedQty > 0 && !draft.rejection_reason.trim()) {
        validationErrors.push(`${item.sku}: select a rejection reason.`);
        return;
      }
      if (totalQty !== getRemainingQty(item)) hasQuantityDiscrepancy = true;
      const barcodeCounts = getScannedCounts(draft);
      if (draft.scanCorrectionReason.trim()) {
        correctionNotes.push(`${item.sku}: ${draft.scanCorrectionReason.trim()}`);
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
        p.location.toLowerCase().includes(q)
    );
  }, [psvParties, search]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);

  const tip = activeParty ? tipForParty(activeParty) : null;

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-5">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl w-full max-w-7xl max-h-[94vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b border-theme-divider flex items-center justify-between bg-theme-surface-2">
              <div>
                <h4 className="font-bold text-base text-theme-body flex items-center gap-2">
                  <span>📥</span> Bulk Invoice Item Receiving
                </h4>
                <p className="text-[11px] text-theme-muted mt-0.5">
                  Invoice <span className="font-mono text-blue-400 font-semibold">{receiveForm.invoice_no}</span>
                  {" · "}{receiveInvoiceItems.length} items
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceiveModalOpen(false)}
                className="text-theme-muted hover:text-theme-body p-1 rounded-lg hover:bg-theme-surface-3 text-sm"
                aria-label="Close bulk receiving"
              >
                ✕
              </button>
            </div>

            {isLoadingReceiveInvoice ? (
              <div className="p-12 text-center text-sm text-theme-muted animate-pulse">Loading all invoice items…</div>
            ) : (
              <form onSubmit={handleReceiveSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
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
                    <span className="block text-[9px] uppercase text-theme-muted">SKU Confirmation</span>
                    <strong className="text-sm text-amber-300">
                      {receiveInvoiceItems.filter((item) => (item.barcodes ?? []).length === 0).length}
                    </strong>
                  </div>
                  <div className="rounded-lg border border-theme-divider bg-theme-surface-2 p-2">
                    <span className="block text-[9px] uppercase text-theme-muted">Lines Entered</span>
                    <strong className="text-sm text-emerald-300">
                      {receiveInvoiceItems.filter((item) => {
                        const draft = getReceiptDraft(item);
                        return getLineQuantity(draft, "accepted") + getLineQuantity(draft, "rejected") > 0;
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
                  <section className="rounded-xl border border-blue-500/30 bg-blue-950/10 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-semibold text-theme-body">Prefill remaining invoice quantities</h5>
                        <p className="text-[10px] text-theme-muted mt-1">
                          Prefill works for SKU-only items. Barcode items must be scanned; their quantities stay scan-derived.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={prefillRemainingQuantities}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white hover:bg-blue-500"
                      >
                        Prefill all SKU-only lines
                      </button>
                    </div>
                  </section>
                )}

                {receiveMode === "csv" && (
                  <section className="rounded-xl border border-violet-500/30 bg-violet-950/10 p-3 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h5 className="text-xs font-semibold text-theme-body">Import receiving CSV</h5>
                        <p className="text-[10px] text-theme-muted mt-1">
                          SKU-only lines need exact SKU confirmation and quantities. Barcode lines need one row per scanned unit with its barcode and accepted/rejected disposition.
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
                      CSV import replaces the current draft. The template includes all invoice lines; leave barcode quantities blank and repeat a line once per physical barcode scanned.
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

                <div className="overflow-x-auto rounded-xl border border-theme-divider">
                  <table className="w-full min-w-[980px] text-left text-xs">
                    <thead className="bg-theme-surface-2">
                      <tr>
                        <th className="px-3 py-2 text-[10px] uppercase text-theme-muted">Invoice Item</th>
                        <th className="px-3 py-2 text-right text-[10px] uppercase text-theme-muted">Due</th>
                        <th className="px-3 py-2 text-[10px] uppercase text-theme-muted">Verification</th>
                        <th className="px-3 py-2 text-right text-[10px] uppercase text-theme-muted">Accepted</th>
                        <th className="px-3 py-2 text-right text-[10px] uppercase text-theme-muted">Rejected</th>
                        <th className="px-3 py-2 text-[10px] uppercase text-theme-muted">Rejection reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-divider/50">
                      {receiveInvoiceItems.map((item) => {
                        const draft = getReceiptDraft(item);
                        const barcodes = item.barcodes ?? [];
                        const acceptedQty = getLineQuantity(draft, "accepted");
                        const rejectedQty = getLineQuantity(draft, "rejected");
                        const barcodeCounts = getScannedCounts(draft);
                        return (
                          <tr key={item.invoice_line_id} className="align-top">
                            <td className="px-3 py-3">
                              <div className="font-semibold text-theme-body">{item.product_name}</div>
                              <div className="mt-1 text-[10px] text-theme-muted">
                                SKU <span className="font-mono">{item.sku}</span>
                                {item.color ? ` · ${item.color}` : ""}
                                {item.size ? ` · ${item.size}` : ""}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right font-mono">
                              <div className="text-theme-body">{getRemainingQty(item)}</div>
                              <div className="text-[9px] text-theme-muted">of {item.document_qty}</div>
                            </td>
                            <td className="px-3 py-3">
                              {barcodes.length > 0 ? (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-semibold text-blue-300">Barcode required</span>
                                  {draft.scans.length > 0 ? (
                                    <div className="max-w-[360px] space-y-1">
                                      {Object.entries(barcodeCounts).map(([barcode, count]) => (
                                        <div key={barcode} className="flex items-center justify-between gap-2">
                                          <span className="font-mono text-[10px] text-theme-body">{barcode} × {count}</span>
                                          <button
                                            type="button"
                                            onClick={() => undoInvoiceBarcodeScan(item, barcode)}
                                            className="rounded border border-rose-500/30 px-2 py-1 text-[9px] text-rose-300 hover:bg-rose-500/10"
                                          >
                                            Undo one
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="block text-[10px] text-theme-muted">No units scanned yet</span>
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
                                <div className="space-y-1">
                                  <span className="text-[10px] font-semibold text-amber-300">No barcode registered · SKU check</span>
                                  <input
                                    type="text"
                                    value={draft.sku_confirmation}
                                    onChange={(event) => updateReceiptDraft(item.invoice_line_id, (current) => ({
                                      ...current,
                                      sku_confirmation: event.target.value,
                                    }))}
                                    placeholder={`Confirm ${item.sku}`}
                                    aria-label={`Confirm invoice SKU ${item.sku}`}
                                    className="w-full rounded border border-theme-divider bg-theme-surface-2 px-2 py-1.5 font-mono text-[10px] text-theme-body"
                                  />
                                  {draft.sku_confirmation && (
                                    <span className={`text-[9px] ${
                                      draft.sku_confirmation.trim().toUpperCase() === item.sku.trim().toUpperCase()
                                        ? "text-emerald-300" : "text-rose-300"
                                    }`}>
                                      {draft.sku_confirmation.trim().toUpperCase() === item.sku.trim().toUpperCase()
                                        ? "SKU confirmed" : "SKU does not match"}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3 text-right">
                              {barcodes.length > 0 ? (
                                <span className="font-mono font-semibold text-emerald-300">{acceptedQty}</span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={draft.received_qty}
                                  onChange={(event) => updateReceiptDraft(item.invoice_line_id, (current) => ({
                                    ...current,
                                    received_qty: Math.max(0, Number(event.target.value) || 0),
                                  }))}
                                  className="w-24 rounded border border-theme-divider bg-theme-surface-2 px-2 py-1.5 text-right font-mono text-emerald-300"
                                  aria-label={`Accepted quantity for ${item.sku}`}
                                />
                              )}
                            </td>
                            <td className="px-3 py-3 text-right">
                              {barcodes.length > 0 ? (
                                <span className="font-mono font-semibold text-rose-300">{rejectedQty}</span>
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={draft.rejected_qty}
                                  onChange={(event) => updateReceiptDraft(item.invoice_line_id, (current) => ({
                                    ...current,
                                    rejected_qty: Math.max(0, Number(event.target.value) || 0),
                                  }))}
                                  className="w-24 rounded border border-theme-divider bg-theme-surface-2 px-2 py-1.5 text-right font-mono text-rose-300"
                                  aria-label={`Rejected quantity for ${item.sku}`}
                                />
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {rejectedQty > 0 ? (
                                <select
                                  value={draft.rejection_reason}
                                  onChange={(event) => updateReceiptDraft(item.invoice_line_id, (current) => ({
                                    ...current,
                                    rejection_reason: event.target.value,
                                  }))}
                                  className="w-52 rounded border border-theme-divider bg-theme-surface-2 px-2 py-1.5 text-[10px] text-theme-body"
                                  required
                                >
                                  <option value="">Select reason…</option>
                                  <option value="Packaging Torn / Crushed">Transit damage</option>
                                  <option value="Fabric Stained / Soiled">Fabric stained / soiled</option>
                                  <option value="Stitching / Button Defect">Manufacturing defect</option>
                                  <option value="Barcode Label Missing / Unreadable">Barcode label issue</option>
                                  <option value="Wrong Size / Color Variant Delivered">Wrong size / color</option>
                                  <option value="Other / Audit Hold">Other / audit hold</option>
                                </select>
                              ) : <span className="text-theme-muted">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                    Barcode lines cannot be submitted as typed quantities. SKU-only lines require exact SKU confirmation.
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
                    placeholder="Search distributor or city…"
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

                        {/* Location */}
                        <div className="text-xs text-theme-muted mb-2.5">
                          📍 {p.location}
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
                      <p className="text-xs text-theme-muted mt-0.5">📍 {activeParty.location}</p>
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

                  {/* Per-Product Breakdown */}
                  {activeParty.skuTracking && activeParty.skuTracking.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-theme-body">
                          📋 Product-by-Product Breakdown
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            setReconPartyFilter(activeParty.id);
                            setActiveSubTab("reconciliation");
                          }}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium underline flex items-center gap-1"
                        >
                          View Invoice Reconciliation for {activeParty.name} →
                        </button>
                      </div>
                      <div className="overflow-x-auto border border-theme-divider rounded-xl bg-theme-surface-3/40">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-theme-surface-2 border-b border-theme-divider">
                              <th className="px-4 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider">Product</th>
                              <th className="px-3 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Sent 📤</th>
                              <th className="px-3 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Sold ✅</th>
                              <th className="px-3 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Returned 🔄</th>
                              <th className="px-3 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Still There 📦</th>
                              <th className="px-4 py-3 text-[10px] font-bold uppercase text-theme-muted tracking-wider text-right">Sold %</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-theme-divider/50">
                            {activeParty.skuTracking.map((sku) => (
                              <SkuRow key={sku.sku} sku={sku} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

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
                      {p.name} ({p.location})
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
                    placeholder="Search invoice #, style/article, color, size, SKU…"
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
                  onClick={() => {
                    if (reconData?.items && reconData.items.length > 0) {
                      openReceiveModal(reconData.items[0]);
                    } else {
                      alert("Please select or search an invoice first.");
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg shadow-sm shadow-emerald-600/30 transition-colors flex items-center gap-1.5"
                >
                  <span>📥</span> Bulk Receive Invoice
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

                          {/* Product & Dimensions (Style, Color, Size, SKU) */}
                          <td className="px-3 py-3">
                            <div className="font-medium text-theme-body text-xs line-clamp-1">{item.product_name}</div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {item.style_code && (
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
                              <span className="text-[10px] text-theme-muted font-mono">
                                SKU: {item.sku}
                              </span>
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
                    {selectedItemForReceive?.product_name}
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {selectedItemForReceive?.style_code && (
                      <span className="text-indigo-300">ART: {selectedItemForReceive?.style_code}</span>
                    )}
                    {selectedItemForReceive?.color && (
                      <span className="text-amber-300">Color: {selectedItemForReceive?.color}</span>
                    )}
                    {selectedItemForReceive?.size && (
                      <span className="text-emerald-300">Size: {selectedItemForReceive?.size}</span>
                    )}
                    <span className="text-theme-muted font-mono">SKU: {selectedItemForReceive?.sku}</span>
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
                      {Object.entries(scannedBarcodeCounts).map(([barcode, count]) => (
                        <div key={barcode} className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="font-mono text-theme-body">{barcode} × {count}</span>
                          <button
                            type="button"
                            onClick={() => undoBarcodeScan(barcode)}
                            className="rounded border border-rose-500/30 px-2 py-1 text-rose-300 hover:bg-rose-500/10"
                            aria-label={`Undo one scan for barcode ${barcode}`}
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
                    No barcode is registered. Verify the product label by entering the exact invoice SKU before quantity entry.
                  </p>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold text-theme-body">
                      Confirm SKU: <span className="font-mono text-blue-300">{selectedItemForReceive?.sku}</span>
                    </span>
                    <input
                      type="text"
                      autoComplete="off"
                      aria-label="Confirm invoice SKU"
                      placeholder="Scan or enter the SKU from the product label"
                      value={skuConfirmation}
                      onChange={(event) => setSkuConfirmation(event.target.value)}
                      className="w-full rounded-lg border border-theme-divider bg-theme-surface-2 px-3 py-2 text-sm font-mono text-theme-body focus:border-amber-500 focus:outline-none"
                    />
                  </label>
                  {skuConfirmation && (
                    <p role={manualSkuConfirmed ? "status" : "alert"} className={`text-[10px] ${manualSkuConfirmed ? "text-emerald-300" : "text-rose-300"}`}>
                      {manualSkuConfirmed ? "SKU verified. Enter the manually counted quantities." : "SKU does not match the invoice item."}
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
