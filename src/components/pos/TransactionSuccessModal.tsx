/**
 * Project      : SMRITI Retail OS
 * Architecture : IPS-002 — Retail Transaction Success Confirmation & Stepped Posting Dialog
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.2.0
 */

import React from "react";
import { CheckCircle2, Printer, PlusCircle, ExternalLink, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { TransactionStepProgress, TransactionResult } from "../../kernel/transaction/TransactionEngine";

interface TransactionSuccessModalProps {
  isOpen: boolean;
  isPosting: boolean;
  progress?: TransactionStepProgress | null;
  result?: TransactionResult | null;
  onClose: () => void;
  onNewBill: () => void;
  onPrint: () => void;
  onViewInvoiceList?: (invoiceNo: string) => void;
}

export const TransactionSuccessModal: React.FC<TransactionSuccessModalProps> = ({
  isOpen,
  isPosting,
  progress,
  result,
  onClose,
  onNewBill,
  onPrint,
  onViewInvoiceList,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-sans select-none animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Posting Stepped Progress View */}
        {isPosting && (
          <div className="p-6 space-y-5">
            <div className="flex items-center space-x-3 text-indigo-400 border-b border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-100 uppercase tracking-wide">Posting Sales Invoice...</h3>
                <p className="text-xs text-slate-400 mt-0.5">Banking-Grade Transaction Lock Active • Zero Data Loss Guard</p>
              </div>
            </div>

            {/* Stepped Checklist */}
            <div className="space-y-2.5 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 font-mono text-xs">
              {[
                "Validating Session & Security Token",
                "Committing Sales Invoice & Taxes",
                "Updating Stock Movements & Ledger",
                "Registering Journal Vouchers",
                "Generating Thermal Invoice Document"
              ].map((stepName, idx) => {
                const currentIdx = progress?.stepIndex || 1;
                const isDone = idx + 1 < currentIdx || !isPosting;
                const isCurrent = idx + 1 === currentIdx && isPosting;

                return (
                  <div key={stepName} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      {isDone ? (
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 size={16} className="text-amber-400 animate-spin shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                      )}
                      <span className={isDone ? "text-emerald-300 font-bold" : isCurrent ? "text-amber-300 font-bold animate-pulse" : "text-slate-500"}>
                        {stepName}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {isDone ? "✓ DONE" : isCurrent ? "RUNNING..." : "WAITING"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Post-Checkout Success Card View */}
        {!isPosting && result && (
          <div className="p-6 space-y-6">
            {result.success ? (
              <>
                <div className="flex items-center space-x-4 border-b border-slate-800 pb-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
                    <CheckCircle2 size={28} />
                  </div>
                  <div>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-950 text-emerald-300 border border-emerald-800 uppercase tracking-widest">
                      STATUS: POSTED & COMMITTED
                    </span>
                    <h2 className="text-lg font-extrabold text-slate-100 mt-1">Invoice Posted Successfully</h2>
                    <p className="text-xs text-slate-400">Stock movements and accounting ledgers updated.</p>
                  </div>
                </div>

                {/* Invoice Summary Details Card */}
                <div className="grid grid-cols-2 gap-3 bg-slate-950/70 p-4 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 block uppercase">INVOICE NUMBER</span>
                    <span className="font-mono font-bold text-sm text-indigo-300 select-all">{result.invoiceNo}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 block uppercase">CUSTOMER NAME</span>
                    <span className="font-bold text-slate-200">{result.customerName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 block uppercase">NET PAYABLE AMOUNT</span>
                    <span className="font-mono font-extrabold text-emerald-400 text-sm">₹{result.totalAmount.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 block uppercase">PAYMENT MODE</span>
                    <span className="font-bold text-slate-200 uppercase">{result.paymentMode}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onPrint}
                    className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center space-x-1.5 shadow-lg cursor-pointer"
                  >
                    <Printer size={15} />
                    <span>Print (Ctrl+P)</span>
                  </button>

                  <button
                    type="button"
                    onClick={onNewBill}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center justify-center space-x-1.5 shadow-lg cursor-pointer"
                  >
                    <PlusCircle size={15} />
                    <span>New Bill (F4)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onViewInvoiceList) onViewInvoiceList(result.invoiceNo);
                      onClose();
                    }}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition flex items-center justify-center space-x-1.5 border border-slate-700 cursor-pointer"
                  >
                    <ExternalLink size={15} />
                    <span>View Invoice</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-3 text-rose-400">
                  <AlertTriangle size={24} />
                  <h3 className="font-extrabold text-base text-slate-100">Transaction Recovery Guard Saved</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed bg-rose-950/40 p-3 rounded-lg border border-rose-800/40">
                  {result.error}
                </p>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700"
                  >
                    Close &amp; Resume
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
