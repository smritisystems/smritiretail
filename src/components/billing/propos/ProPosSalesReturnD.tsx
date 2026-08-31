/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.16.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-29
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import { ReturnItem } from "./types.ts";
import {
  X,
  RotateCcw,
  Search,
  AlertCircle,
  CheckCircle,
  FileText,
  Banknote,
  CreditCard,
  Loader2,
  ShieldCheck,
  User,
  Calendar,
} from "lucide-react";
import { SalesReturnService, SalesReturnContext } from "../../../services/salesReturnService.ts";

interface ExtendedReturnItem extends ReturnItem {
  productId?: string;
  remainingQty?: number;
  gstRate?: number;
  taxAmount?: number;
}

interface SmritiProPosSalesReturnModalProps {
  onProcessReturn: (returnDetails: {
    originalBillNo?: string;
    items: ReturnItem[];
    totalRefund: number;
    refundMode: "CASH" | "CREDIT_NOTE" | "ORIGINAL_PAYMENT";
    isBlindReturn: boolean;
    creditNoteNumber?: string;
  }) => void;
  onClose: () => void;
}

export const SmritiProPosSalesReturnModal: React.FC<SmritiProPosSalesReturnModalProps> = ({
  onProcessReturn,
  onClose,
}) => {
  const [returnMode, setReturnMode] = useState<"WITH_REFERENCE" | "BLIND_RETURN">("WITH_REFERENCE");
  const [billNumberInput, setBillNumberInput] = useState<string>("");
  const [refundMode, setRefundMode] = useState<"CASH" | "CREDIT_NOTE" | "ORIGINAL_PAYMENT">("CREDIT_NOTE");
  const [loadingContext, setLoadingContext] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [returnContext, setReturnContext] = useState<SalesReturnContext | null>(null);

  // Return items list initialized empty awaiting backend context
  const [returnItems, setReturnItems] = useState<ExtendedReturnItem[]>([]);

  const totalRefundValue = useMemo(() => {
    return returnItems.reduce((acc, item) => acc + (item.returnQty * (item.unitPrice ?? 0)), 0);
  }, [returnItems]);

  const totalReturnedQty = useMemo(() => {
    return returnItems.reduce((acc, item) => acc + item.returnQty, 0);
  }, [returnItems]);

  const handleLoadBill = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanNo = billNumberInput.trim();
    if (!cleanNo) {
      setError("Please enter or scan an Invoice/Bill number.");
      return;
    }

    setLoadingContext(true);
    setError(null);
    try {
      const ctx = await SalesReturnService.getReturnContext(cleanNo);
      setReturnContext(ctx);

      // Populate items from authoritative backend lines
      const mappedItems: ExtendedReturnItem[] = (ctx.lines || []).map((line) => ({
        sku: line.code,
        name: line.name,
        productId: line.product_id,
        originalQty: line.original_quantity,
        remainingQty: line.remaining_quantity,
        returnQty: 0,
        unitPrice: line.unit_price,
        gstRate: line.gst_rate,
        taxAmount: line.tax_amount,
        refundAmount: 0,
        returnReason: "Size Mismatch / Fit Issue",
        condition: "Good",
      }));

      setReturnItems(mappedItems);
      if (mappedItems.length === 0) {
        setError("This invoice has no line items available for return.");
      }
    } catch (err: any) {
      setError(err?.message || `Unable to load return context for invoice "${cleanNo}".`);
      setReturnContext(null);
      setReturnItems([]);
    } finally {
      setLoadingContext(false);
    }
  };

  const handleQtyChange = (index: number, qty: number) => {
    setReturnItems((prev) => {
      const next = [...prev];
      const maxAllowed = next[index].remainingQty ?? next[index].originalQty ?? 1;
      const validQty = Math.max(0, Math.min(maxAllowed, qty));
      next[index] = {
        ...next[index],
        returnQty: validQty,
        refundAmount: validQty * (next[index].unitPrice ?? 0),
      };
      return next;
    });
  };

  const handleReasonChange = (index: number, reason: string) => {
    setReturnItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], returnReason: reason };
      return next;
    });
  };

  const handleConditionChange = (index: number, condition: "Good" | "Defective" | "Damaged") => {
    setReturnItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], condition };
      return next;
    });
  };

  const handleCompleteReturn = async () => {
    const activeReturnItems = returnItems.filter((i) => i.returnQty > 0);
    if (activeReturnItems.length === 0) {
      setError("Please select at least 1 item quantity to return.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const ts = Date.now().toString().slice(-6);
    const returnNo = `RET-${ts}`;
    const targetInvoiceId = returnContext?.invoice_id || billNumberInput.trim();

    const payload = {
      id: returnNo,
      return_no: returnNo,
      original_invoice_id: targetInvoiceId,
      credit_note_number: `CN-${returnNo}`,
      refund_mode: refundMode,
      is_blind_return: returnMode === "BLIND_RETURN",
      reason: activeReturnItems[0]?.returnReason || "Customer Return",
      items: activeReturnItems.map((item) => ({
        product_id: item.productId || item.sku || "PROD-GEN",
        code: item.sku || "CODE",
        name: item.name || "Item",
        quantity: item.returnQty,
        price: item.unitPrice || 0,
        gst_rate: item.gstRate || 0,
      })),
    };

    try {
      const resp = await SalesReturnService.createSalesReturn(payload);
      // P1 Semantics: On API SUCCESS -> trigger callback, show notification, close modal
      onProcessReturn({
        originalBillNo: targetInvoiceId,
        items: activeReturnItems,
        totalRefund: resp.grand_total || totalRefundValue,
        refundMode,
        isBlindReturn: returnMode === "BLIND_RETURN",
        creditNoteNumber: resp.credit_note_number,
      });
      onClose();
    } catch (err: any) {
      // P1 Semantics: On API FAILURE -> display error in UI, remain open, do NOT call onProcessReturn
      setError(err?.message || "Unable to process the sales return. Please review quantities and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#191c1e] text-[#191c1e] dark:text-[#eff1f3] w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[#c4c5d5] dark:border-[#444653] max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#c4c5d5] dark:border-[#444653] bg-[#f8f9fa] dark:bg-[#131b2e] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#ffdad6] dark:bg-[#93000a] text-[#ba1a1a] dark:text-white rounded-xl">
              <RotateCcw size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#191c1d] dark:text-white">
                Sales Return &amp; Credit Note Processing
              </h2>
              <p className="text-xs text-[#565e74] dark:text-[#bec6e0]">
                Authoritative POS item return with real-time stock replenishment and policy verification.
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-[#e7e8e9] dark:bg-[#2d3133] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setReturnMode("WITH_REFERENCE")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                returnMode === "WITH_REFERENCE"
                  ? "bg-white dark:bg-[#131b2e] text-[#00288e] dark:text-[#a8b8ff] shadow-xs"
                  : "text-[#565e74] dark:text-[#bec6e0]"
              }`}
            >
              With Original Bill
            </button>
            <button
              type="button"
              onClick={() => setReturnMode("BLIND_RETURN")}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                returnMode === "BLIND_RETURN"
                  ? "bg-white dark:bg-[#131b2e] text-[#ba1a1a] dark:text-[#ffdad6] shadow-xs"
                  : "text-[#565e74] dark:text-[#bec6e0]"
              }`}
            >
              Blind Return (Manager)
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#565e74] hover:bg-[#f3f4f5] p-1.5 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error notification banner if any */}
        {error && (
          <div className="px-6 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Search / Bill Reference Area */}
        <div className="p-6 pb-4 grid grid-cols-1 md:grid-cols-12 gap-4 bg-[#f8f9fa] dark:bg-[#131b2e] border-b border-[#c4c5d5] dark:border-[#444653] shrink-0">
          <div className="md:col-span-6 flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
              Original Invoice / Slip Number
            </label>
            <form onSubmit={handleLoadBill} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#757684]" size={15} />
                <input
                  type="text"
                  value={billNumberInput}
                  onChange={(e) => setBillNumberInput(e.target.value)}
                  placeholder="Scan or enter Invoice No (e.g. INV-001)..."
                  className="w-full pl-9 pr-3 py-2 border border-[#c4c5d5] dark:border-[#444653] rounded-xl bg-white dark:bg-[#191c1e] text-xs font-mono font-bold outline-none focus:border-[#00288e]"
                />
              </div>
              <button
                type="submit"
                disabled={loadingContext || !billNumberInput.trim()}
                className="px-4 py-2 bg-[#00288e] text-white rounded-xl text-xs font-bold hover:bg-[#1e40af] transition shrink-0 flex items-center gap-1.5 disabled:opacity-50"
              >
                {loadingContext ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                <span>Load Bill</span>
              </button>
            </form>
          </div>

          <div className="md:col-span-6 flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
              Refund Settlement Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRefundMode("CREDIT_NOTE")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  refundMode === "CREDIT_NOTE"
                    ? "bg-[#00288e] text-white shadow-xs"
                    : "bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653]"
                }`}
              >
                <FileText size={13} />
                Credit Note
              </button>
              <button
                type="button"
                onClick={() => setRefundMode("CASH")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  refundMode === "CASH"
                    ? "bg-[#00288e] text-white shadow-xs"
                    : "bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653]"
                }`}
              >
                <Banknote size={13} />
                Cash Refund
              </button>
              <button
                type="button"
                onClick={() => setRefundMode("ORIGINAL_PAYMENT")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  refundMode === "ORIGINAL_PAYMENT"
                    ? "bg-[#00288e] text-white shadow-xs"
                    : "bg-white dark:bg-[#2d3133] border border-[#c4c5d5] dark:border-[#444653]"
                }`}
              >
                <CreditCard size={13} />
                Original Mode
              </button>
            </div>
          </div>
        </div>

        {/* Invoice Context Header Banner */}
        {returnContext && (
          <div className="px-6 py-2 bg-[#f0f4ff] dark:bg-[#1a233b] border-b border-[#c4c5d5] dark:border-[#444653] flex flex-wrap items-center justify-between text-xs text-[#2e3135] dark:text-[#c4c5d5]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 font-mono font-bold text-[#00288e] dark:text-[#a8b8ff]">
                <FileText size={13} /> #{returnContext.invoice_no || returnContext.invoice_id}
              </span>
              <span className="flex items-center gap-1 text-[#565e74] dark:text-[#bec6e0]">
                <Calendar size={13} /> {returnContext.invoice_date}
              </span>
              {returnContext.customer && (
                <span className="flex items-center gap-1 text-[#565e74] dark:text-[#bec6e0]">
                  <User size={13} /> {returnContext.customer.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                <ShieldCheck size={11} /> Window: {returnContext.effective_policy?.return_window_days ?? 30} Days
              </span>
            </div>
          </div>
        )}

        {/* Return Items Grid */}
        <div className="p-6 flex-1 flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
              Eligible Items from Original Invoice ({returnItems.length})
            </span>
            <span className="text-xs font-bold font-mono text-[#ba1a1a]">
              Items Selected for Return: {totalReturnedQty}
            </span>
          </div>

          <div className="border border-[#c4c5d5] dark:border-[#444653] rounded-xl overflow-hidden flex-1 flex flex-col">
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#edeeef] dark:bg-[#131b2e] sticky top-0 text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0] border-b border-[#c4c5d5] dark:border-[#444653]">
                  <tr>
                    <th className="px-3 py-2.5 w-10 text-center">#</th>
                    <th className="px-3 py-2.5 w-28">SKU</th>
                    <th className="px-3 py-2.5">Item Description</th>
                    <th className="px-3 py-2.5 text-center w-20">Sold Qty</th>
                    <th className="px-3 py-2.5 text-center w-20 text-emerald-600">Available</th>
                    <th className="px-3 py-2.5 text-center w-24 text-[#ba1a1a]">Return Qty</th>
                    <th className="px-3 py-2.5 text-right w-24">Unit Rate</th>
                    <th className="px-3 py-2.5 w-36">Return Reason</th>
                    <th className="px-3 py-2.5 w-28">Condition</th>
                    <th className="px-3 py-2.5 text-right w-28">Refund Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eceef0] dark:divide-[#2d3133]">
                  {returnItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-[#757684]">
                        {loadingContext ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 size={16} className="animate-spin text-[#00288e]" />
                            <span>Loading return context...</span>
                          </div>
                        ) : (
                          <span>Scan or enter Invoice/Bill number above to load returnable items.</span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    returnItems.map((item, idx) => {
                      const isReturning = item.returnQty > 0;
                      const maxAllowed = item.remainingQty ?? item.originalQty ?? 1;
                      return (
                        <tr
                          key={item.sku || idx}
                          className={`transition ${
                            isReturning ? "bg-[#ffdad6]/20 dark:bg-[#93000a]/10 font-medium" : "opacity-75"
                          }`}
                        >
                          <td className="px-3 py-2 text-center font-mono text-[#757684]">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono font-bold text-[#00288e] dark:text-[#a8b8ff]">
                            {item.sku}
                          </td>
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2 text-center font-mono">{item.originalQty}</td>
                          <td className="px-3 py-2 text-center font-mono font-bold text-emerald-600">
                            {item.remainingQty ?? item.originalQty}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="number"
                              min={0}
                              max={maxAllowed}
                              value={item.returnQty}
                              onChange={(e) => handleQtyChange(idx, parseInt(e.target.value, 10) || 0)}
                              className="w-16 h-7 px-2 border border-[#ba1a1a] rounded-lg text-center font-mono font-bold text-xs bg-white dark:bg-[#191c1e] text-[#ba1a1a] outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            ₹{(item.unitPrice ?? 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              disabled={!isReturning}
                              value={item.returnReason}
                              onChange={(e) => handleReasonChange(idx, e.target.value)}
                              className="w-full text-[11px] p-1 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#191c1e] outline-none"
                            >
                              <option value="Size Mismatch / Fit Issue">Size Mismatch / Fit Issue</option>
                              <option value="Customer Changed Mind">Customer Changed Mind</option>
                              <option value="Defective / Quality Issue">Defective / Quality Issue</option>
                              <option value="Wrong Item Sold">Wrong Item Sold</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              disabled={!isReturning}
                              value={item.condition}
                              onChange={(e) => handleConditionChange(idx, e.target.value as any)}
                              className="w-full text-[11px] p-1 border border-[#c4c5d5] dark:border-[#444653] rounded-lg bg-white dark:bg-[#191c1e] outline-none"
                            >
                              <option value="Good">Good (Restock)</option>
                              <option value="Defective">Defective</option>
                              <option value="Damaged">Damaged</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-sm text-[#ba1a1a]">
                            -₹{item.refundAmount.toFixed(2)}
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

        {/* Footer Summary & Actions */}
        <div className="px-6 py-4 bg-[#f8f9fa] dark:bg-[#131b2e] border-t border-[#c4c5d5] dark:border-[#444653] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#565e74] dark:text-[#bec6e0]">
                Total Refund Payable
              </span>
              <span className="text-2xl font-bold font-mono text-[#ba1a1a]">
                -₹{totalRefundValue.toFixed(2)}
              </span>
            </div>
            <div className="h-8 w-px bg-[#c4c5d5] dark:bg-[#444653]"></div>
            <span className="text-xs text-[#565e74] dark:text-[#bec6e0]">
              Mode: <strong>{refundMode}</strong>
            </span>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 border border-[#c4c5d5] dark:border-[#444653] bg-white dark:bg-[#2d3133] rounded-xl text-xs font-bold hover:bg-[#e7e8e9] transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={totalReturnedQty === 0 || submitting}
              onClick={handleCompleteReturn}
              className="px-6 py-2.5 bg-[#ba1a1a] hover:bg-[#93000a] text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm disabled:opacity-40"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              <span>Issue Return &amp; Refund</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SmritiProPosSalesReturnModal;
