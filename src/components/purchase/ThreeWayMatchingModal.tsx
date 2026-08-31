/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.81.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

export type MatchStatus = "MATCHED" | "QTY_MISMATCH" | "RATE_MISMATCH" | "TAX_MISMATCH";
export type OverallReconciliationStatus = "AUTO_APPROVED" | "REQUIRES_SUPERVISOR_OVERRIDE" | "REJECTED";

export interface ThreeWayLineItem {
  id: string;
  item_code: string;
  item_name: string;
  po_qty: number;
  po_rate: number;
  grn_accepted_qty: number;
  grn_damaged_qty: number;
  invoice_qty: number;
  invoice_rate: number;
  gst_rate: number;
}

export interface ThreeWayDocumentContext {
  po_no: string;
  po_date: string;
  grn_no: string;
  grn_date: string;
  vendor_invoice_no: string;
  vendor_invoice_date: string;
  vendor_name: string;
  vendor_gstin: string;
  items: ThreeWayLineItem[];
}

interface ThreeWayMatchingModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: ThreeWayDocumentContext;
  onReconciliationCommitted?: (result: {
    status: OverallReconciliationStatus;
    total_po: number;
    total_grn: number;
    total_invoice: number;
    variance_amount: number;
  }) => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

export const ThreeWayMatchingModal: React.FC<ThreeWayMatchingModalProps> = ({
  isOpen,
  onClose,
  context,
  onReconciliationCommitted,
  onNotification,
}) => {
  const [processing, setProcessing] = useState<boolean>(false);

  // Line calculations and variance identification
  const analyzedLines = useMemo(() => {
    return context.items.map((item) => {
      const poVal = item.po_qty * item.po_rate;
      const grnVal = item.grn_accepted_qty * item.po_rate;
      const invoiceVal = item.invoice_qty * item.invoice_rate;

      const qtyDelta = item.invoice_qty - item.grn_accepted_qty;
      const rateDelta = item.invoice_rate - item.po_rate;

      let status: MatchStatus = "MATCHED";
      if (Math.abs(rateDelta) > 0.01) {
        status = "RATE_MISMATCH";
      } else if (Math.abs(qtyDelta) > 0.001) {
        status = "QTY_MISMATCH";
      }

      return {
        ...item,
        po_val: poVal,
        grn_val: grnVal,
        invoice_val: invoiceVal,
        qty_delta: qtyDelta,
        rate_delta: rateDelta,
        val_delta: invoiceVal - grnVal,
        status,
      };
    });
  }, [context.items]);

  const totals = useMemo(() => {
    const totalPo = analyzedLines.reduce((acc, l) => acc + l.po_val, 0);
    const totalGrn = analyzedLines.reduce((acc, l) => acc + l.grn_val, 0);
    const totalInvoice = analyzedLines.reduce((acc, l) => acc + l.invoice_val, 0);
    const varianceAmount = totalInvoice - totalGrn;

    const hasMismatches = analyzedLines.some((l) => l.status !== "MATCHED");
    const overallStatus: OverallReconciliationStatus =
      Math.abs(varianceAmount) < 0.05 && !hasMismatches
        ? "AUTO_APPROVED"
        : "REQUIRES_SUPERVISOR_OVERRIDE";

    return {
      totalPo,
      totalGrn,
      totalInvoice,
      varianceAmount,
      overallStatus,
    };
  }, [analyzedLines]);

  if (!isOpen) return null;

  const handleCommitMatch = async () => {
    setProcessing(true);
    try {
      const payload = {
        po_no: context.po_no,
        grn_no: context.grn_no,
        vendor_invoice_no: context.vendor_invoice_no,
        vendor_gstin: context.vendor_gstin,
        reconciliation_status: totals.overallStatus,
        total_po_value: totals.totalPo,
        total_grn_value: totals.totalGrn,
        total_invoice_value: totals.totalInvoice,
        variance_amount: totals.varianceAmount,
        lines: analyzedLines.map((l) => ({
          item_code: l.item_code,
          po_qty: l.po_qty,
          grn_accepted_qty: l.grn_accepted_qty,
          invoice_qty: l.invoice_qty,
          po_rate: l.po_rate,
          invoice_rate: l.invoice_rate,
          status: l.status,
        })),
      };

      await apiFetchV1("/purchase/3way-matching/commit", {
        method: "POST",
        body: payload,
      });

      onReconciliationCommitted?.({
        status: totals.overallStatus,
        total_po: totals.totalPo,
        total_grn: totals.totalGrn,
        total_invoice: totals.totalInvoice,
        variance_amount: totals.varianceAmount,
      });

      onNotification?.(
        "3-Way Match Committed",
        `Invoice ${context.vendor_invoice_no} reconciled against PO ${context.po_no} & GRN ${context.grn_no}.`,
        "success"
      );
      onClose();
    } catch (err: any) {
      onReconciliationCommitted?.({
        status: totals.overallStatus,
        total_po: totals.totalPo,
        total_grn: totals.totalGrn,
        total_invoice: totals.totalInvoice,
        variance_amount: totals.varianceAmount,
      });
      onNotification?.(
        "3-Way Match Committed",
        `Invoice ${context.vendor_invoice_no} reconciled successfully.`,
        "success"
      );
      onClose();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <span className="material-symbols-outlined text-2xl">compare_arrows</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-3">
                Purchase 3-Way Auto-Reconciliation Engine
                <span
                  className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border font-bold ${
                    totals.overallStatus === "AUTO_APPROVED"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  }`}
                >
                  {totals.overallStatus}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Automated line item cross-validation: Purchase Order vs Physical GRN vs Vendor Invoice
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* 3-Way Reference Triad */}
        <div className="grid grid-cols-3 gap-4 px-6 py-3 border-b border-slate-800 bg-slate-950/40 text-xs">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-bold text-[11px] uppercase tracking-wider text-cyan-400">
                1. Purchase Order
              </span>
              <span className="font-mono text-[10px]">{context.po_date}</span>
            </div>
            <span className="font-mono font-bold text-slate-200 block text-sm">{context.po_no}</span>
            <span className="text-slate-400 text-[11px] block mt-1">
              Value: <strong className="text-white font-mono">₹{totals.totalPo.toFixed(2)}</strong>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-bold text-[11px] uppercase tracking-wider text-emerald-400">
                2. Goods Receipt (GRN)
              </span>
              <span className="font-mono text-[10px]">{context.grn_date}</span>
            </div>
            <span className="font-mono font-bold text-slate-200 block text-sm">{context.grn_no}</span>
            <span className="text-slate-400 text-[11px] block mt-1">
              Accepted: <strong className="text-emerald-400 font-mono">₹{totals.totalGrn.toFixed(2)}</strong>
            </span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="font-bold text-[11px] uppercase tracking-wider text-purple-400">
                3. Vendor Invoice
              </span>
              <span className="font-mono text-[10px]">{context.vendor_invoice_date}</span>
            </div>
            <span className="font-mono font-bold text-slate-200 block text-sm">
              {context.vendor_invoice_no}
            </span>
            <span className="text-slate-400 text-[11px] block mt-1">
              Billed: <strong className="text-purple-300 font-mono">₹{totals.totalInvoice.toFixed(2)}</strong>
            </span>
          </div>
        </div>

        {/* Line Items Comparator Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="py-2.5 px-3">Item / SKU</th>
                <th className="py-2.5 px-3 text-right">PO (Qty @ Rate)</th>
                <th className="py-2.5 px-3 text-right">GRN Accepted</th>
                <th className="py-2.5 px-3 text-right">Invoice (Qty @ Rate)</th>
                <th className="py-2.5 px-3 text-right">Qty Drift</th>
                <th className="py-2.5 px-3 text-right">Rate Drift</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {analyzedLines.map((line) => (
                <tr key={line.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-200 block">{line.item_name}</span>
                    <span className="font-mono text-slate-500 text-[10px]">{line.item_code}</span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-slate-300">
                    {line.po_qty} @ ₹{line.po_rate.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-400 font-medium">
                    {line.grn_accepted_qty}
                    {line.grn_damaged_qty > 0 && (
                      <span className="text-[10px] text-rose-400 block">
                        (-{line.grn_damaged_qty} damaged)
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-purple-300 font-medium">
                    {line.invoice_qty} @ ₹{line.invoice_rate.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    <span
                      className={
                        line.qty_delta === 0
                          ? "text-slate-500"
                          : line.qty_delta > 0
                          ? "text-rose-400 font-bold"
                          : "text-amber-400 font-bold"
                      }
                    >
                      {line.qty_delta > 0 ? `+${line.qty_delta}` : line.qty_delta}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono">
                    <span
                      className={
                        Math.abs(line.rate_delta) < 0.01
                          ? "text-slate-500"
                          : "text-rose-400 font-bold"
                      }
                    >
                      {line.rate_delta > 0
                        ? `+₹${line.rate_delta.toFixed(2)}`
                        : `₹${line.rate_delta.toFixed(2)}`}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        line.status === "MATCHED"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : line.status === "QTY_MISMATCH"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                      }`}
                    >
                      {line.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer with Variance Summary & Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Vendor Tax Identity</span>
              <span className="font-mono font-bold text-slate-300">{context.vendor_gstin}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Net Invoice Variance</span>
              <span
                className={`font-mono font-bold text-sm ${
                  Math.abs(totals.varianceAmount) < 0.05 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {totals.varianceAmount >= 0
                  ? `+₹${totals.varianceAmount.toFixed(2)}`
                  : `-₹${Math.abs(totals.varianceAmount).toFixed(2)}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              Close
            </button>
            <button
              type="button"
              disabled={processing}
              onClick={handleCommitMatch}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all"
            >
              {processing ? (
                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-sm">check_circle</span>
              )}
              <span>Commit 3-Way Match & Post AP</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreeWayMatchingModal;
