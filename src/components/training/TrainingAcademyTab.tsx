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

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  Award, 
  Play, 
  RotateCcw, 
  ShieldCheck, 
  ArrowRight, 
  Layers,
  FileCheck,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { trainingSandboxStore, TrainingSession } from '../../services/trainingSandboxStore';
import { Day1MasterSimulator } from './Day1MasterSimulator';
import { Day2POSimulator } from './Day2POSimulator';
import { Day3GRNSimulator } from './Day3GRNSimulator';
import { Day4BillingSimulator } from './Day4BillingSimulator';
import { Day5LifecycleTestEngine } from './Day5LifecycleTestEngine';
import { CertificateGeneratorModal } from './CertificateGeneratorModal';

interface TrainingDayModule {
  day: number;
  title: string;
  subtitle: string;
  outcome: string;
  status: 'Completed' | 'In Progress' | 'Locked';
}

export const TrainingAcademyTab: React.FC = () => {
  const [session, setSession] = useState<TrainingSession>(trainingSandboxStore.getCurrentSession());
  const [activeDay, setActiveDay] = useState<number>(1);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [day5Result, setDay5Result] = useState<any>(null);
  const [showCertificate, setShowCertificate] = useState<boolean>(false);

  const modules: TrainingDayModule[] = [
    { day: 1, title: 'Master Creation', subtitle: 'Item, Supplier, Customer, Warehouse, Tax', outcome: 'Create & maintain required masters independently', status: 'Completed' },
    { day: 2, title: 'Purchase Order', subtitle: 'PO Creation, Review, Approval, Tracking', outcome: 'Create and track vendor purchase orders', status: 'Completed' },
    { day: 3, title: 'Purchase Receipt / GRN', subtitle: 'Receive Material, Verify Qty, Short/Excess', outcome: 'Process GRN and verify stock ledger increments', status: 'In Progress' },
    { day: 4, title: 'Sales / Billing', subtitle: 'Customer, Item Scan, GST, Tax Invoice, Print', outcome: 'Execute POS checkout & generate tax invoice', status: 'Locked' },
    { day: 5, title: 'Complete Business Cycle', subtitle: 'Master → PO → GRN → Stock → Sales → Reports', outcome: 'Signature end-to-end competency evaluation', status: 'Locked' },
    { day: 6, title: 'Returns & Corrections', subtitle: 'Debit Note, Credit Note, Stock Adjustments', outcome: 'Process returns and invoice corrections', status: 'Locked' },
    { day: 7, title: 'Reports & Certification', subtitle: 'Sales, Purchase, Stock, GST, Exam', outcome: 'Final practical exam & server-authoritative PDF', status: 'Locked' },
  ];

  const methodologySteps = [
    { step: 1, name: 'Explain', desc: 'Understand business concepts and field definitions' },
    { step: 2, name: 'Demonstrate', desc: 'Watch guided animated walkthrough of screen' },
    { step: 3, name: 'Practice', desc: 'Perform guided interactive form inputs' },
    { step: 4, name: 'Scenario', desc: 'Solve real-world store challenge prompt' },
    { step: 5, name: 'Verify', desc: 'Automatic system check comparing state' },
    { step: 6, name: 'Correct', desc: 'Review pits & remediation guidance' },
    { step: 7, name: 'Independent Drill', desc: 'Execute unassisted timed evaluation' },
  ];

  const handleResetSession = () => {
    const newSession = trainingSandboxStore.initSession(session.traineeName);
    setSession({ ...newSession });
    setDay5Result(null);
  };

  const handleRunDay5Test = () => {
    // Seed test sandbox data for Day 5 evaluation
    trainingSandboxStore.addSimulatedItem({
      sku: 'SKU-SUGAR-01',
      name: 'Refined Sugar 1kg Pack',
      hsn: '17019990',
      gstRate: 5,
      mrp: 50,
      purchaseRate: 40,
    });
    trainingSandboxStore.createSimulatedPO({
      poNumber: 'PO-TEST-5001',
      supplierCode: 'SUP-RAJ-TRADERS',
      sku: 'SKU-SUGAR-01',
      quantity: 50,
      rate: 40,
      status: 'Draft',
    });
    trainingSandboxStore.processSimulatedGRN({
      grnNumber: 'GRN-TEST-9001',
      poNumber: 'PO-TEST-5001',
      receivedQty: 48,
      shortQty: 2,
      excessQty: 0,
      receivedDate: new Date().toISOString(),
    });
    trainingSandboxStore.processSimulatedSale({
      invoiceNumber: 'INV-TEST-7001',
      customerName: 'Walk-in Retail Customer',
      sku: 'SKU-SUGAR-01',
      quantity: 5,
      unitPrice: 50,
      totalGst: 12.5,
      totalAmount: 250,
      paidAmount: 250,
      paymentMode: 'CASH',
    });

    const result = trainingSandboxStore.verifyDay5Lifecycle('SKU-SUGAR-01');
    setDay5Result(result);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 p-6 overflow-y-auto space-y-6">
      {/* Header Toolbar & Session Status */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                SMRITI Training Academy
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Sandbox Active
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Learn → Practice → Verify → Certify • Session: <span className="font-mono text-indigo-300 font-semibold">{session.sessionId}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Overall Progress</span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full w-3/4"></div>
              </div>
              <span className="text-sm font-bold text-indigo-400">72%</span>
            </div>
          </div>

          <button 
            onClick={handleResetSession}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-600"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Session
          </button>
        </div>
      </div>

      {/* Production Isolation Guarantee Banner */}
      <div className="bg-emerald-950/40 border border-emerald-600/30 rounded-lg p-3.5 flex items-center justify-between text-xs text-emerald-300">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>
            <strong>Golden Isolation Guarantee:</strong> All training transactions execute inside an isolated sandbox session. 0 production rows are created or modified in <code className="bg-emerald-900/60 px-1.5 py-0.5 rounded text-emerald-200 font-mono">Smritibus_&lt;CompanyCode&gt;</code>.
          </span>
        </div>
      </div>

      {/* 7-Day Curriculum Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {modules.map((m) => (
          <button
            key={m.day}
            onClick={() => setActiveDay(m.day)}
            className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
              activeDay === m.day
                ? 'bg-indigo-600/20 border-indigo-500 shadow-md shadow-indigo-500/10'
                : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Day {m.day}</span>
                {m.status === 'Completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {m.status === 'In Progress' && <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />}
              </div>
              <h3 className="text-xs font-bold text-white leading-tight mb-1">{m.title}</h3>
              <p className="text-[11px] text-slate-400 line-clamp-2">{m.subtitle}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Main Learning Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Step Runner & Business State */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Module Focus Header */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Day {activeDay} Training Focus</span>
                <h2 className="text-lg font-bold text-white">{modules[activeDay - 1].title}</h2>
              </div>
              <span className="text-xs px-3 py-1 bg-slate-700 rounded-full text-slate-300 border border-slate-600">
                {modules[activeDay - 1].outcome}
              </span>
            </div>

            {/* 7-Step Methodology Pills */}
            <div className="grid grid-cols-7 gap-2 pt-2 border-t border-slate-700/60">
              {methodologySteps.map((s) => (
                <button
                  key={s.step}
                  onClick={() => setActiveStep(s.step)}
                  className={`p-2 rounded-lg text-center text-xs font-medium transition-colors ${
                    activeStep === s.step
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span className="block text-[9px] opacity-75">{s.step}</span>
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Active Step Content Box */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-xs">
                  {activeStep}
                </span>
                Step {activeStep}: {methodologySteps[activeStep - 1].name}
              </h3>
              <span className="text-xs text-slate-400">{methodologySteps[activeStep - 1].desc}</span>
            </div>

            <div className="bg-slate-900/60 border border-slate-700/80 rounded-lg p-4 text-xs text-slate-300 leading-relaxed">
              {activeDay === 1 && <Day1MasterSimulator onCompleteStep={() => setActiveStep(prev => Math.min(7, prev + 1))} />}
              {activeDay === 2 && <Day2POSimulator onCompleteStep={() => setActiveStep(prev => Math.min(7, prev + 1))} />}
              {activeDay === 3 && <Day3GRNSimulator onCompleteStep={() => setActiveStep(prev => Math.min(7, prev + 1))} />}
              {activeDay === 4 && <Day4BillingSimulator onCompleteStep={() => setActiveStep(prev => Math.min(7, prev + 1))} />}
              {activeDay === 5 && <Day5LifecycleTestEngine onComplete={() => setActiveStep(7)} />}
              {activeDay >= 6 && (
                <p>
                  Training lesson guidance for Day {activeDay} ({modules[activeDay - 1].title}). Follow the interactive sandbox steps to complete module evaluation.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Live Training State View (Business Effect Widget) */}
        <div className="space-y-6">
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-400" />
              Live Training State View (Business Effect)
            </h3>
            <p className="text-xs text-slate-400">
              Tracks real-time simulated ledger movement without exposing raw backend SQL details.
            </p>

            <div className="space-y-3 pt-2 text-xs font-mono">
              <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700/80 flex items-center justify-between">
                <span className="text-slate-400">PO Created:</span>
                <span className="text-white font-bold">50 Units</span>
              </div>
              <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700/80 flex items-center justify-between">
                <span className="text-slate-400">GRN Received:</span>
                <span className="text-emerald-400 font-bold">48 Units</span>
              </div>
              <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700/80 flex items-center justify-between">
                <span className="text-slate-400">GRN Shortage:</span>
                <span className="text-amber-400 font-bold">2 Units</span>
              </div>
              <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700/80 flex items-center justify-between">
                <span className="text-slate-400">Available Stock Added:</span>
                <span className="text-emerald-400 font-bold">+48 Units</span>
              </div>
              <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-700/80 flex items-center justify-between">
                <span className="text-slate-400">POS Checkout Sale:</span>
                <span className="text-rose-400 font-bold">-5 Units</span>
              </div>
              <div className="p-3 bg-indigo-950/40 border border-indigo-500/40 rounded-lg flex items-center justify-between text-indigo-300">
                <span className="font-sans font-semibold">Current Available Stock:</span>
                <span className="text-sm font-bold text-white">43 Units</span>
              </div>
            </div>
          </div>

          {/* Certificate Action Box */}
          <div className="bg-gradient-to-br from-slate-800 to-indigo-950/40 border border-slate-700 rounded-xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              SMRITI Certification
            </h4>
            <p className="text-xs text-slate-300">
              Pass Day 1–7 competency evaluations to receive server-signed PDF certification.
            </p>
            <button
              onClick={() => setShowCertificate(true)}
              className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs rounded-lg transition-colors border border-slate-600"
            >
              View Verification Status
            </button>
          </div>
        </div>
      </div>

      {/* Certificate Modal */}
      <CertificateGeneratorModal
        isOpen={showCertificate}
        onClose={() => setShowCertificate(false)}
        sessionId={session.sessionId}
        traineeName={session.traineeName}
      />
    </div>
  );
};
