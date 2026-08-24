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
import { Layers, Play, CheckCircle2, Award, ArrowRight, ShieldCheck } from 'lucide-react';
import { trainingSandboxStore } from '../../services/trainingSandboxStore';

export const Day5LifecycleTestEngine: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [stepProgress, setStepProgress] = useState({
    itemCreated: false,
    supplierCreated: false,
    poIssued: false,
    grnReceived: false,
    customerCreated: false,
    posSold: false,
  });

  const handleRunFullCycle = () => {
    // 1. Create Product
    trainingSandboxStore.addSimulatedItem({
      sku: 'SKU-SUGAR-01',
      name: 'Refined Sugar 1kg Pack',
      hsn: '17019990',
      gstRate: 5,
      mrp: 50,
      purchaseRate: 40,
    });

    // 2. Create Supplier
    trainingSandboxStore.addSimulatedSupplier({
      code: 'SUP-RAJ-TRADERS',
      name: 'Raj Wholesale Traders',
      gstin: '27AABCR9981F1Z8',
    });

    // 3. Issue PO (50 units)
    trainingSandboxStore.createSimulatedPO({
      poNumber: 'PO-DAY5-5001',
      supplierCode: 'SUP-RAJ-TRADERS',
      sku: 'SKU-SUGAR-01',
      quantity: 50,
      rate: 40,
      status: 'Approved',
    });

    // 4. Receive GRN (48 units received, 2 short)
    trainingSandboxStore.processSimulatedGRN({
      grnNumber: 'GRN-DAY5-9001',
      poNumber: 'PO-DAY5-5001',
      receivedQty: 48,
      shortQty: 2,
      excessQty: 0,
      receivedDate: new Date().toISOString(),
    });

    // 5. Sell Item via POS (5 units)
    trainingSandboxStore.processSimulatedSale({
      invoiceNumber: 'INV-DAY5-7001',
      customerName: 'Standard Customer',
      sku: 'SKU-SUGAR-01',
      quantity: 5,
      unitPrice: 50,
      totalGst: 12.5,
      totalAmount: 250,
      paidAmount: 250,
      paymentMode: 'CASH',
    });

    setStepProgress({
      itemCreated: true,
      supplierCreated: true,
      poIssued: true,
      grnReceived: true,
      customerCreated: true,
      posSold: true,
    });

    // 6. Deterministic Verification
    const res = trainingSandboxStore.verifyDay5Lifecycle('SKU-SUGAR-01');
    setEvaluationResult(res);
    if (res.passed) {
      onComplete();
    }
  };

  return (
    <div className="space-y-5 bg-slate-900/60 p-4 rounded-xl border border-slate-700/80">
      <div className="bg-slate-800/80 p-5 rounded-xl border border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Signature Competency Test</span>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Day 5 — Connected Business Lifecycle Simulator
            </h3>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
            Deterministic Evaluator
          </span>
        </div>

        <blockquote className="border-l-2 border-indigo-500 pl-3 py-1.5 text-xs text-slate-300 italic bg-indigo-950/20 rounded-r">
          “Scenario: Create item SKU-SUGAR-01, create supplier SUP-RAJ-TRADERS, issue PO for 50 units, receive 48 units in GRN (2 short), then execute POS sale for 5 units.”
        </blockquote>

        {/* Step Flow Pipeline */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-center text-xs">
          <div className={`p-2 rounded border ${stepProgress.itemCreated ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
            <span className="block text-[10px] opacity-75">1. Item</span>
            SKU-SUGAR-01
          </div>
          <div className={`p-2 rounded border ${stepProgress.supplierCreated ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
            <span className="block text-[10px] opacity-75">2. Supplier</span>
            SUP-RAJ
          </div>
          <div className={`p-2 rounded border ${stepProgress.poIssued ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
            <span className="block text-[10px] opacity-75">3. PO</span>
            Qty: 50
          </div>
          <div className={`p-2 rounded border ${stepProgress.grnReceived ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
            <span className="block text-[10px] opacity-75">4. GRN</span>
            Qty: 48 (Short: 2)
          </div>
          <div className={`p-2 rounded border ${stepProgress.posSold ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
            <span className="block text-[10px] opacity-75">5. POS Sale</span>
            Qty: 5
          </div>
          <div className={`p-2 rounded border ${evaluationResult?.passed ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>
            <span className="block text-[10px] opacity-75">6. Final Stock</span>
            Target: 43
          </div>
        </div>

        <button
          onClick={handleRunFullCycle}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
        >
          <Play className="w-4 h-4 fill-current" />
          Run Day 5 End-to-End Transaction Evaluation
        </button>

        {evaluationResult && (
          <div className={`p-4 rounded-xl border text-xs space-y-3 ${
            evaluationResult.passed
              ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
              : 'bg-amber-950/60 border-amber-500/60 text-amber-200'
          }`}>
            <div className="flex items-center gap-2.5 font-bold text-sm">
              <Award className="w-6 h-6 text-amber-400" />
              <span>🏆 DAY 5 — BUSINESS LIFECYCLE PASSED</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-800/40 text-[11px] font-mono">
              <div>PO Issued: <span className="font-bold text-white">{evaluationResult.poQty}</span></div>
              <div>GRN Received: <span className="font-bold text-white">{evaluationResult.grnQty}</span></div>
              <div>Short Receipt: <span className="font-bold text-amber-300">{evaluationResult.shortQty}</span></div>
              <div>POS Checkout: <span className="font-bold text-white">{evaluationResult.salesQty}</span></div>
              <div>Expected Stock: <span className="font-bold text-emerald-300">{evaluationResult.expectedStock}</span></div>
              <div>Actual Stock: <span className="font-bold text-emerald-300">{evaluationResult.actualStock}</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
