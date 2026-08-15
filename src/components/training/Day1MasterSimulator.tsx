/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-14
 * Modified     : 2026-08-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from 'react';
import { Package, Truck, Users, Building2, CheckCircle2, ArrowRight, Plus } from 'lucide-react';
import { trainingSandboxStore } from '../../services/trainingSandboxStore';

export const Day1MasterSimulator: React.FC<{ onCompleteStep: () => void }> = ({ onCompleteStep }) => {
  const [activeSubTab, setActiveSubTab] = useState<'item' | 'supplier' | 'customer'>('item');
  const [sku, setSku] = useState('SKU-RICE-101');
  const [itemName, setItemName] = useState('Basmati Premium Rice 5kg');
  const [hsn, setHsn] = useState('10063020');
  const [gstRate, setGstRate] = useState('5');
  const [mrp, setMrp] = useState('450');
  const [purchaseRate, setPurchaseRate] = useState('380');
  const [createdItems, setCreatedItems] = useState(trainingSandboxStore.getSimulatedItems());

  const [supplierCode, setSupplierCode] = useState('SUP-AMAR-TRADERS');
  const [supplierName, setSupplierName] = useState('Amar Wholesale Traders');
  const [supplierGstin, setSupplierGstin] = useState('27ABCDE1234F1Z5');
  const [createdSuppliers, setCreatedSuppliers] = useState(trainingSandboxStore.getSimulatedSuppliers());

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    trainingSandboxStore.addSimulatedItem({
      sku,
      name: itemName,
      hsn,
      gstRate: parseFloat(gstRate),
      mrp: parseFloat(mrp),
      purchaseRate: parseFloat(purchaseRate),
    });
    setCreatedItems(trainingSandboxStore.getSimulatedItems());
    onCompleteStep();
  };

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    trainingSandboxStore.addSimulatedSupplier({
      code: supplierCode,
      name: supplierName,
      gstin: supplierGstin,
    });
    setCreatedSuppliers(trainingSandboxStore.getSimulatedSuppliers());
    onCompleteStep();
  };

  return (
    <div className="space-y-5 bg-slate-900/60 p-4 rounded-xl border border-slate-700/80">
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-700 pb-3">
        <button
          onClick={() => setActiveSubTab('item')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeSubTab === 'item' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          1. Item Master
        </button>
        <button
          onClick={() => setActiveSubTab('supplier')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeSubTab === 'supplier' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          2. Supplier Master
        </button>
      </div>

      {/* Item Master Form Simulator */}
      {activeSubTab === 'item' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <form onSubmit={handleCreateItem} className="space-y-3 bg-slate-800/80 p-4 rounded-lg border border-slate-700">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wide flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Simulated Item Master Form
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">SKU / Item Code</label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">HSN / SAC Code</label>
                <input
                  type="text"
                  value={hsn}
                  onChange={(e) => setHsn(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                  required
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="text-slate-400 block mb-1">Item Description / Name</label>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">GST Rate (%)</label>
                <select
                  value={gstRate}
                  onChange={(e) => setGstRate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                >
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 block mb-1">MRP (₹)</label>
                <input
                  type="number"
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                  required
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Landing Rate (₹)</label>
                <input
                  type="number"
                  value={purchaseRate}
                  onChange={(e) => setPurchaseRate(e.target.value)}
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
              Save Item To Sandbox Master
            </button>
          </form>

          {/* Sandbox Master List Preview */}
          <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center justify-between">
              <span>Sandbox Item Registry ({createdItems.length})</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">Session Sandbox</span>
            </h4>

            {createdItems.length === 0 ? (
              <div className="text-xs text-slate-500 italic p-4 text-center border border-dashed border-slate-700 rounded">
                No items created in this session sandbox yet. Fill the form to create your first item master.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {createdItems.map((item) => (
                  <div key={item.sku} className="bg-slate-900 p-2.5 rounded border border-slate-700 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{item.name}</span>
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded">{item.sku}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        HSN: <span className="font-mono text-slate-300">{item.hsn}</span> • GST: {item.gstRate}%
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-emerald-400">₹{item.mrp}</div>
                      <div className="text-[10px] text-slate-400">Cost: ₹{item.purchaseRate}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Supplier Master Form Simulator */}
      {activeSubTab === 'supplier' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <form onSubmit={handleCreateSupplier} className="space-y-3 bg-slate-800/80 p-4 rounded-lg border border-slate-700">
            <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wide flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Simulated Supplier Master Form
            </h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Supplier Code</label>
                <input
                  type="text"
                  value={supplierCode}
                  onChange={(e) => setSupplierCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                  required
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">GSTIN</label>
                <input
                  type="text"
                  value={supplierGstin}
                  onChange={(e) => setSupplierGstin(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono uppercase"
                  required
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="text-slate-400 block mb-1">Supplier / Trade Name</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition-colors flex items-center justify-center gap-2 mt-2 shadow"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save Supplier To Sandbox Master
            </button>
          </form>

          {/* Sandbox Supplier List Preview */}
          <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center justify-between">
              <span>Sandbox Supplier Registry ({createdSuppliers.length})</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">Session Sandbox</span>
            </h4>

            {createdSuppliers.length === 0 ? (
              <div className="text-xs text-slate-500 italic p-4 text-center border border-dashed border-slate-700 rounded">
                No suppliers registered in this session sandbox yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {createdSuppliers.map((sup) => (
                  <div key={sup.code} className="bg-slate-900 p-2.5 rounded border border-slate-700 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{sup.name}</span>
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded">{sup.code}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        GSTIN: {sup.gstin}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
