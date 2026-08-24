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
import { Truck, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';
import { trainingStore } from '../../services/trainingStore';

export const Day3GRNSimulator: React.FC<{ onCompleteStep: () => void }> = ({ onCompleteStep }) => {
  const [grnNumber, setGrnNumber] = useState('GRN-2026-9001');
  const [poNumber, setPoNumber] = useState('PO-2026-1001');
  const [receivedQty, setReceivedQty] = useState('48');
  const [shortQty, setShortQty] = useState('2');
  const [grnSubmitted, setGrnSubmitted] = useState(false);
  const [updatedStock, setUpdatedStock] = useState<number>(0);

  const handleProcessGRN = (e: React.FormEvent) => {
    e.preventDefault();
    const result = trainingStore.processSimulatedGRN({
      grnNumber,
      poNumber,
      receivedQty: parseInt(receivedQty, 10),
      shortQty: parseInt(shortQty, 10),
      excessQty: 0,
      receivedDate: new Date().toISOString(),
    });
    setGrnSubmitted(true);
    setUpdatedStock(result.newStock);
    onCompleteStep();
  };

  return (
    <div className="space-y-5 bg-slate-900/60 p-4 rounded-xl border border-slate-700/80">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* GRN Form Simulator */}
        <form onSubmit={handleProcessGRN} className="space-y-3 bg-slate-800/80 p-4 rounded-lg border border-slate-700">
          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wide flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Simulated Goods Receipt Note (GRN) Form
          </h4>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">GRN Number</label>
              <input
                type="text"
                value={grnNumber}
                onChange={(e) => setGrnNumber(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                required
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Select PO Reference</label>
              <input
                type="text"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Actual Received Qty</label>
              <input
                type="number"
                value={receivedQty}
                onChange={(e) => setReceivedQty(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-emerald-400 font-bold"
                required
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Short Receipt Qty</label>
              <input
                type="number"
                value={shortQty}
                onChange={(e) => setShortQty(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-amber-400 font-bold"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded transition-colors flex items-center justify-center gap-2 mt-2 shadow"
          >
            <CheckCircle2 className="w-4 h-4" />
            Process GRN & Update Stock Ledger
          </button>
        </form>

        {/* Stock Impact Visualizer */}
        <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700 space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wide flex items-center justify-between">
            <span>Stock Ledger Impact</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">Immediate Stock Update</span>
          </h4>

          {grnSubmitted ? (
            <div className="bg-slate-900 p-4 rounded border border-emerald-500/40 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-emerald-400">{grnNumber}</span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30 font-semibold">
                  GRN Posted
                </span>
              </div>

              <div className="space-y-1.5 text-slate-300 text-[11px] font-mono">
                <div className="flex justify-between"><span>Material Received:</span><span className="text-emerald-400 font-bold">+{receivedQty} Units</span></div>
                <div className="flex justify-between text-amber-400"><span>Shortage Recorded:</span><span>{shortQty} Units</span></div>
              </div>

              <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded text-xs text-indigo-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-sans font-semibold">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  New Available Stock Balance:
                </span>
                <span className="font-bold text-white text-base font-mono">{updatedStock} Units</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic p-6 text-center border border-dashed border-slate-700 rounded">
              Process GRN above to observe automatic stock ledger increment in real time.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
