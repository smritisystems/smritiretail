/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-15
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useEffect, useRef, useState } from 'react';
import { X, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { SalesReturnContext, SalesReturnContextLine, SalesReturnCreatePayload, SalesReturnService } from '../services/salesReturnService';
import { TransactionAttachmentPanel } from './common/TransactionAttachmentPanel';
import type { TransactionAttachment } from '../domain/attachment';

interface ProcessSalesReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReturnProcessed: () => void;
  invoice: any | null;
}

export const ProcessSalesReturnModal: React.FC<ProcessSalesReturnModalProps> = ({
  isOpen,
  onClose,
  onReturnProcessed,
  invoice,
}) => {
  const [returnReason, setReturnReason] = useState('Customer Return - Size Fit Issue');
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnContext, setReturnContext] = useState<SalesReturnContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [refundMode, setRefundMode] = useState<SalesReturnCreatePayload['refund_mode']>('CREDIT_NOTE');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAttachmentPanel, setShowAttachmentPanel] = useState(false);
  const requestKeyRef = useRef<string | null>(null);
  const documentNoRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen || !invoice) return;
    const invoiceId = String(invoice.id || '').trim();
    if (!invoiceId) {
      setError('This invoice has no saved document ID, so its return context cannot be loaded.');
      setReturnContext(null);
      return;
    }
    let active = true;
    setContextLoading(true);
    setError(null);
    setReturnContext(null);
    setReturnQuantities({});
    setReturnReason('');
    requestKeyRef.current = null;
    documentNoRef.current = null;
    SalesReturnService.getReturnContext(invoiceId)
      .then((context) => {
        if (!active) return;
        setReturnContext(context);
        setReturnReason(context.effective_policy?.allowed_return_reasons?.[0] || '');
        setRefundMode(
          (context.effective_policy?.allowed_refund_modes?.includes('CREDIT_NOTE')
            ? 'CREDIT_NOTE'
            : context.effective_policy?.allowed_refund_modes?.[0]) as SalesReturnCreatePayload['refund_mode']
        );
      })
      .catch((err: any) => {
        if (active) setError(err?.message || 'Could not load the invoice return policy and remaining quantities.');
      })
      .finally(() => { if (active) setContextLoading(false); });
    return () => { active = false; };
  }, [isOpen, invoice?.id]);

  if (!isOpen || !invoice) return null;

  const items = returnContext?.lines || [];

  const invalidatePendingRequest = () => {
    requestKeyRef.current = null;
    documentNoRef.current = null;
  };

  const handleQuantityChange = (productId: string, maxQty: number, val: number) => {
    invalidatePendingRequest();
    const qty = Math.max(0, Math.min(maxQty, val));
    setReturnQuantities({ ...returnQuantities, [productId]: qty });
  };

  const calculateReturnTotal = () => {
    const baseTotal = items.reduce((sum, item) => sum + (returnQuantities[item.product_id] || 0) * Number(item.unit_price || 0), 0);
    const taxTotal = items.reduce((sum, item) => {
      const qty = returnQuantities[item.product_id] || 0;
      const perUnitTax = Number(item.original_quantity) > 0 ? Number(item.tax_amount || 0) / Number(item.original_quantity) : 0;
      return sum + qty * perUnitTax;
    }, 0);
    const grandTotal = items.reduce((sum, item) => {
      const qty = returnQuantities[item.product_id] || 0;
      const perUnitTotal = Number(item.original_quantity) > 0 ? Number(item.total_amount || 0) / Number(item.original_quantity) : Number(item.unit_price || 0);
      return sum + qty * perUnitTotal;
    }, 0);
    return { baseTotal, taxTotal, grandTotal };
  };

  const { baseTotal, taxTotal, grandTotal } = calculateReturnTotal();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (grandTotal <= 0) {
      setError('Select at least 1 item quantity to return');
      return;
    }

    setLoading(true);
    setError(null);

    if (!returnContext || !returnReason || !refundMode || !returnContext.effective_policy.allowed_refund_modes.includes(refundMode)) {
      setLoading(false);
      setError('The return policy must provide an allowed reason and refund mode before continuing.');
      return;
    }

    const returnNo = documentNoRef.current || `RET-${Date.now().toString().slice(-6)}`;
    documentNoRef.current = returnNo;
    if (!requestKeyRef.current) {
      requestKeyRef.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `sales-return-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    const returnItems = items
      .map((item: SalesReturnContextLine) => {
        const pid = item.product_id;
        const qty = returnQuantities[pid] || 0;
        const price = Number(item.unit_price || 0);
        const taxAmount = Number(item.original_quantity) > 0 ? qty * Number(item.tax_amount || 0) / Number(item.original_quantity) : 0;
        return {
          product_id: pid,
          code: item.code,
          name: item.name,
          quantity: qty,
          price: price,
          gst_rate: Number(item.gst_rate || 0),
          tax_amount: taxAmount,
          total_amount: qty * price + taxAmount,
        };
      })
      .filter((i: any) => i.quantity > 0);

    const payload: SalesReturnCreatePayload = {
      id: returnNo,
      return_no: returnNo,
      original_invoice_id: returnContext.invoice_id,
      reason: returnReason,
      refund_mode: refundMode,
      tax_total: taxTotal,
      grand_total: grandTotal,
      items: returnItems,
    };

    try {
      await SalesReturnService.createSalesReturn(payload, requestKeyRef.current || undefined);
      onReturnProcessed();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Unable to process the sales return. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-theme-surface-2 border border-theme-divider rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative text-theme-primary font-sans">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-theme-muted hover:text-theme-primary p-1 rounded-lg hover:bg-theme-surface-hover transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-theme-divider pb-4">
          <div className="w-10 h-10 bg-purple-500/20 text-purple-400 rounded-xl flex items-center justify-center border border-purple-500/30">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-theme-primary font-display">Process Sales Return & Credit Note</h3>
            <p className="text-xs text-theme-muted">
              Invoice #{invoice.invoice_number || invoice.invoiceNo || invoice.id} — Issue Credit Note & Restrain History.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 text-rose-300 rounded-lg text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-theme-muted font-mono font-bold mb-1">Return Reason *</label>
            <select
              value={returnReason}
              onChange={(e) => { invalidatePendingRequest(); setReturnReason(e.target.value); }}
              className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-theme-primary focus:outline-none focus:border-purple-500"
              disabled={contextLoading || loading || !returnContext?.effective_policy?.allowed_return_reasons?.length}
            >
              {(returnContext?.effective_policy?.allowed_return_reasons || []).map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-theme-muted font-mono font-bold mb-1">Refund Method *</label>
            <select
              value={refundMode || ''}
              onChange={(e) => {
                invalidatePendingRequest();
                setRefundMode(e.target.value as SalesReturnCreatePayload['refund_mode']);
              }}
              className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-theme-primary focus:outline-none focus:border-purple-500"
              disabled={contextLoading || loading || !returnContext?.effective_policy?.allowed_refund_modes?.length}
            >
              {(returnContext?.effective_policy?.allowed_refund_modes || []).map((mode) => (
                <option key={mode} value={mode}>{mode.replaceAll('_', ' ')}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-theme-muted font-mono font-bold">Select Return Quantities *</label>
            <div className="bg-theme-surface-3 border border-theme-divider rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-theme-surface-4 border-b border-theme-divider text-[10px] uppercase font-mono text-theme-muted">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 text-right">Billed Qty</th>
                    <th className="px-3 py-2 text-center">Return Qty</th>
                    <th className="px-3 py-2 text-right">Refund</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-divider">
                  {contextLoading ? (
                    <tr><td colSpan={4} className="px-3 py-5 text-center text-theme-muted">Loading invoice return context…</td></tr>
                  ) : items.map((item: SalesReturnContextLine) => {
                    const pid = item.product_id;
                    const maxQty = Number(item.remaining_quantity || 0);
                    const qty = returnQuantities[pid] || 0;
                    const perUnitTotal = Number(item.original_quantity) > 0
                      ? Number(item.total_amount || 0) / Number(item.original_quantity)
                      : Number(item.unit_price || 0);
                    const lineVal = qty * perUnitTotal;
                    return (
                      <tr key={pid} className="hover:bg-theme-surface-hover">
                        <td className="px-3 py-2 font-medium">{item.name || item.code}</td>
                        <td className="px-3 py-2 text-right font-mono text-theme-muted">{item.remaining_quantity} <span className="text-[10px]">of {item.original_quantity}</span></td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max={maxQty}
                            value={qty}
                            onChange={(e) => handleQuantityChange(pid, maxQty, Number(e.target.value) || 0)}
                            disabled={contextLoading || loading || maxQty <= 0}
                            className="w-16 bg-theme-surface-2 border border-theme-divider rounded px-2 py-1 text-center font-mono text-theme-primary focus:outline-none focus:border-purple-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-purple-400">
                          ₹{lineVal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-theme-surface-3 border border-theme-divider rounded-xl p-3 flex items-center justify-between text-xs font-mono">
            <span className="text-theme-muted">Return Amount:</span>
            <span className="text-base font-bold text-purple-400">₹{grandTotal.toFixed(2)}</span>
          </div>

          <div className="bg-purple-950/30 border border-purple-500/30 rounded-xl p-3 text-[11px] text-purple-300 space-y-1">
            <div className="font-bold flex items-center gap-1 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              Golden Rule History Protection:
            </div>
            <p>
              The original invoice remains unchanged. The server revalidates the return window, remaining quantities, tax, refund policy, stock movement, and accounting record when you submit.
            </p>
          </div>

          {/* Attachments Section */}
          <div className="border-t border-theme-divider pt-3">
            <button
              type="button"
              onClick={() => setShowAttachmentPanel(!showAttachmentPanel)}
              className={`text-xs font-bold px-3 py-2 rounded-lg transition-colors ${
                showAttachmentPanel
                  ? 'bg-purple-600 text-white'
                  : 'bg-theme-surface-3 text-theme-muted hover:bg-theme-surface-hover'
              }`}
            >
              {showAttachmentPanel ? '✕ Hide Attachments' : '+ Add Attachments'}
            </button>
            {showAttachmentPanel && (
              <div className="mt-3 bg-theme-surface-3 border border-theme-divider rounded-lg p-3">
                <TransactionAttachmentPanel
                  documentType="sales_return"
                  documentId={`RET-${Date.now().toString().slice(-6)}`}
                  onAttachmentAdded={(att: TransactionAttachment) => {
                    console.log('Return attachment added:', att.fileName);
                  }}
                  readOnly={false}
                  maxFiles={3}
                  allowedExtensions="PDF, Word, Excel, CSV, Images"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-theme-divider">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-muted font-bold rounded-lg transition-colors border border-theme-divider"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || contextLoading || !returnContext || !items.some((item) => (returnQuantities[item.product_id] || 0) > 0)}
              className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow"
            >
              <Save className="w-4 h-4" />
              {contextLoading ? 'Loading policy…' : loading ? 'Processing...' : `Process Return · ${(refundMode || 'credit note').replaceAll('_', ' ')}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
