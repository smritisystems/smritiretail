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
import { ShoppingCart, CheckCircle2, FileText, ArrowRight, ShieldCheck } from 'lucide-react';
import { trainingSandboxStore, SimulatedPO } from '../../services/trainingSandboxStore';

export const Day2POSimulator: React.FC<{ onCompleteStep: () => void }> = ({ onCompleteStep }) => {
  const suppliers = trainingSandboxStore.getSimulatedSuppliers();
  const items = trainingSandboxStore.getSimulatedItems();

  const [poNumber, setPoNumber] = useState('PO-2026-1001');
  const [selectedSupplier, setSelectedSupplier] = useState(suppliers[0]?.code || 'SUP-AMAR-TRADERS');
  const [selectedSku, setSelectedSku] = useState(items[0]?.sku || 'SKU-RICE-101');
  const [quantity, setQuantity] = useState('50');
  const [rate, setRate] = useState('380');
  const [createdPo, setCreatedPo] = useState<SimulatedPO | null>(null);

  const handleCreatePO = (e: React.FormEvent) => {
    e.preventDefault();
    const newPo = trainingSandboxStore.createSimulatedPO({
      poNumber,
      supplierCode: selectedSupplier,
      sku: selectedSku,
      quantity: parseInt(quantity, 10),
      rate: parseFloat(rate),
      status: 'Approved',
    });
    setCreatedPo(newPo);
    onCompleteStep();
  };

  return (
    <div className="space-y-5 bg-slate-900/60 p-4 rounded-xl border border-slate-700/80">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* PO Form Simulator */}
        <form onSubmit={handleCreatePO} className="space-y-3 bg-slate-800/80 p-4 rounded-lg border border-slate-700">
          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wide flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Simulated Purchase Order (PO) Form
          </h4>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">PO Reference No.</label>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                required
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Select Supplier</label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
              >
                {suppliers.length > 0 ? (
                  suppliers.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)
                ) : (
                  <option value="SUP-AMAR-TRADERS">Amar Wholesale Traders (SUP-AMAR-TRADERS)</option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Select Item / SKU</label>
              <select
                value={selectedSku}
                onChange={(e) => setSelectedSku(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white font-mono"
              >
                {items.length > 0 ? (
                  items.map((i) => <option key={i.sku} value={i.sku}>{i.sku} - {i.name}</option>)
                ) : (
                  <option value="SKU-RICE-101">SKU-RICE-101 - Basmati Rice</option>
                )}
              </select>
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
              <label className="text-slate-400 block mb-1">Purchase Rate</label>
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition-colors flex items-center justify-center gap-2 mt-2 shadow"
          >
            <CheckCircle2 className="w-4 h-4" />
            Issue & Approve Simulated PO
          </button>
        </form>

        {/* PO Status Display Card */}
        <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700 space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center justify-between">
            <span>PO Status Tracker</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">Sandbox Session</span>
          </h4>

          {createdPo ? (
            <div className="bg-slate-900 p-4 rounded border border-emerald-500/40 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-indigo-400">{createdPo.poNumber}</span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30 font-semibold">
                  {createdPo.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-300 border-t border-slate-800 pt-2 text-[11px]">
                <div>Supplier: <span className="font-semibold text-white">{createdPo.supplierCode}</span></div>
                <div>SKU: <span className="font-mono text-white">{createdPo.sku}</span></div>
                <div>Order Quantity: <span className="font-bold text-emerald-400">{createdPo.quantity} Units</span></div>
                <div>Unit Rate: <span className="font-semibold text-white">₹{createdPo.rate}</span></div>
              </div>

              <div className="p-2 bg-indigo-950/40 border border-indigo-500/30 rounded text-[11px] text-indigo-300 flex items-center justify-between">
                <span>Total PO Value:</span>
                <span className="font-bold text-white text-sm">₹{(createdPo.quantity * createdPo.rate).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic p-6 text-center border border-dashed border-slate-700 rounded">
              No active Purchase Order created yet. Fill the PO form to generate a simulated PO.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
