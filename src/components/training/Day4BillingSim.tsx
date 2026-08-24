/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-14
 * Modified     : 2026-08-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from 'react';
import { ShoppingBag, CheckCircle2, Printer, CreditCard, DollarSign } from 'lucide-react';
import { trainingSandboxStore, SimulatedSale } from '../../services/trainingSandboxStore';

export const Day4BillingSimulator: React.FC<{ onCompleteStep: () => void }> = ({ onCompleteStep }) => {
  const [invoiceNumber, setInvoiceNumber] = useState('INV-2026-7001');
  const [customerName, setCustomerName] = useState('Walk-in Retail Customer');
  const [sku, setSku] = useState('SKU-RICE-101');
  const [quantity, setQuantity] = useState('5');
  const [unitPrice, setUnitPrice] = useState('450');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [completedSale, setCompletedSale] = useState<SimulatedSale | null>(null);
  const [remainingStock, setRemainingStock] = useState<number>(0);

  const handleExecuteCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    const price = parseFloat(unitPrice);
    const totalAmount = qty * price;
    const totalGst = totalAmount * 0.05;

    const result = trainingSandboxStore.processSimulatedSale({
      invoiceNumber,
      customerName,
      sku,
      quantity: qty,
      unitPrice: price,
      totalGst,
      totalAmount,
      paidAmount: totalAmount,
      paymentMode,
    });

    setCompletedSale(result.sale);
    setRemainingStock(result.remainingStock);
    onCompleteStep();
  };

  return (
    <div className="space-y-5 bg-slate-900/60 p-4 rounded-xl border border-slate-700/80">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* POS Cashier Checkout Form */}
        <form onSubmit={handleExecuteCheckout} className="space-y-3 bg-slate-800/80 p-4 rounded-lg border border-slate-700">
          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wide flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            Simulated POS Cashier Terminal
          </h4>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Invoice Number</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                required
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Customer Profile</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Scan/SKU Code</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                required
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white font-bold"
                required
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Unit Price</label>
              <input
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                required
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="text-slate-400 block mb-1">Tender Payment Mode</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-semibold"
            >
              <option value="CASH">Cash Payment</option>
              <option value="CARD">Credit / Debit Card</option>
              <option value="UPI">UPI / QR Payment</option>
              <option value="CREDIT">Customer Credit Ledger</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition-colors flex items-center justify-center gap-2 mt-2 shadow"
          >
            <CheckCircle2 className="w-4 h-4" />
            SAVE & PRINT TAX INVOICE
          </button>
        </form>

        {/* Thermal Invoice Print Preview */}
        <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700 space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center justify-between">
            <span>Thermal Tax Invoice Preview</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">Tax Invoice PDF</span>
          </h4>

          {completedSale ? (
            <div className="bg-white text-slate-900 p-4 rounded font-mono text-[11px] space-y-2 border border-slate-300 shadow-md">
              <div className="text-center border-b border-slate-300 pb-2">
                <div className="font-bold text-sm">SMRITI RETAIL OS STORE</div>
                <div className="text-[10px] text-slate-600">GSTIN: 27AABCS1429B1Z2</div>
                <div className="text-[10px] text-slate-600">TAX INVOICE #{completedSale.invoiceNumber}</div>
              </div>

              <div className="flex justify-between border-b border-slate-300 py-1">
                <span>Item: {completedSale.sku}</span>
                <span>Qty: {completedSale.quantity}</span>
              </div>

              <div className="space-y-0.5 text-right pt-1">
                <div>Subtotal: ₹{completedSale.totalAmount - completedSale.totalGst}</div>
                <div>CGST + SGST (5%): ₹{completedSale.totalGst.toFixed(2)}</div>
                <div className="font-bold text-sm text-black border-t border-slate-400 pt-1">
                  TOTAL: ₹{completedSale.totalAmount}
                </div>
              </div>

              <div className="text-[10px] text-slate-600 text-center border-t border-slate-300 pt-1">
                Payment Tendered via {completedSale.paymentMode} • Thank You!
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic p-6 text-center border border-dashed border-slate-700 rounded">
              Execute POS checkout to render simulated thermal tax invoice receipt.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
