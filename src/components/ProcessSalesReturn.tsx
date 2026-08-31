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

import React, { useState } from 'react';
import { X, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { apiFetchV1 } from '../lib/apiFetchV1';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !invoice) return null;

  const items = invoice.items || [];

  const handleQuantityChange = (productId: string, maxQty: number, val: number) => {
    const qty = Math.max(0, Math.min(maxQty, val));
    setReturnQuantities({ ...returnQuantities, [productId]: qty });
  };

  const calculateReturnTotal = () => {
    let baseTotal = 0;
    items.forEach((item: any) => {
      const pid = item.productId || item.product_id || item.id;
      const qty = returnQuantities[pid] !== undefined ? returnQuantities[pid] : 0;
      const price = item.price || item.unit_price || item.selling_price || 0;
      baseTotal += qty * price;
    });
    const taxTotal = baseTotal * 0.05;
    const grandTotal = baseTotal + taxTotal;
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

    const returnNo = `RET-${Date.now().toString().slice(-6)}`;
    const cnNo = `CN-${Date.now().toString().slice(-6)}`;

    const returnItems = items
      .map((item: any) => {
        const pid = item.productId || item.product_id || item.id;
        const qty = returnQuantities[pid] !== undefined ? returnQuantities[pid] : 0;
        const price = item.price || item.unit_price || item.selling_price || 0;
        return {
          product_id: pid,
          code: item.code || pid,
          name: item.name || 'Returned Product Item',
          quantity: qty,
          price: price,
          line_total: qty * price * 1.05,
        };
      })
      .filter((i: any) => i.quantity > 0);

    const payload = {
      id: returnNo,
      return_no: returnNo,
      original_invoice_id: invoice.id || invoice.invoice_number,
      credit_note_number: cnNo,
      reason: returnReason,
      tax_total: taxTotal,
      grand_total: grandTotal,
      items: returnItems,
    };

    try {
      await apiFetchV1('/sales/returns/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
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
              onChange={(e) => setReturnReason(e.target.value)}
              className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-theme-primary focus:outline-none focus:border-purple-500"
            >
              <option value="Customer Return - Size Fit Issue">Customer Return - Size / Fit Issue</option>
              <option value="Wrong Item Billed">Wrong Item / Variant Billed</option>
              <option value="Defective Product">Defective Product / Manufacturing Defect</option>
              <option value="Order Cancelled Post Billing">Order Cancelled Post Billing</option>
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
                  {items.map((item: any) => {
                    const pid = item.productId || item.product_id || item.id;
                    const maxQty = item.quantity || 1;
                    const qty = returnQuantities[pid] !== undefined ? returnQuantities[pid] : 0;
                    const price = item.price || item.unit_price || item.selling_price || 0;
                    const lineVal = qty * price * 1.05;
                    return (
                      <tr key={pid} className="hover:bg-theme-surface-hover">
                        <td className="px-3 py-2 font-medium">{item.name || item.code || 'Article Item'}</td>
                        <td className="px-3 py-2 text-right font-mono text-theme-muted">{maxQty}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max={maxQty}
                            value={qty}
                            onChange={(e) => handleQuantityChange(pid, maxQty, parseInt(e.target.value) || 0)}
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
            <span className="text-theme-muted">Credit Note Refund Total:</span>
            <span className="text-base font-bold text-purple-400">₹{grandTotal.toFixed(2)}</span>
          </div>

          <div className="bg-purple-950/30 border border-purple-500/30 rounded-xl p-3 text-[11px] text-purple-300 space-y-1">
            <div className="font-bold flex items-center gap-1 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              Golden Rule History Protection:
            </div>
            <p>
              Original invoice #{invoice.invoice_number || invoice.invoiceNo || invoice.id} remains intact. Issuing a Credit Note reinstates stock into inventory and creates a formal return audit record.
            </p>
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
              disabled={loading}
              className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Processing...' : 'Issue Credit Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
