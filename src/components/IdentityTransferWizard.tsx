/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : IdentityTransferWizard (Multi-Level Employee Transfer Wizard)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 2.0.0
 */

import React, { useState } from "react";
import { ArrowLeftRight, Check, X } from "lucide-react";

interface IdentityTransferWizardProps {
  isOpen: boolean;
  identityName: string;
  onClose: () => void;
  onComplete: (transferData: any) => void;
}

export const IdentityTransferWizard: React.FC<IdentityTransferWizardProps> = ({
  isOpen,
  identityName,
  onClose,
  onComplete
}) => {
  const [step, setStep] = useState(1);
  const [company, setCompany] = useState("SMRITI Retail Ltd");
  const [region, setRegion] = useState("Maharashtra Region");
  const [location, setLocation] = useState("Mumbai Branch");
  const [department, setDepartment] = useState("Store Operations");
  const [position, setPosition] = useState("Store Manager");
  const [effectiveDate, setEffectiveDate] = useState("2026-08-01");

  if (!isOpen) return null;

  const handleFinish = () => {
    onComplete({ company, region, location, department, position, effectiveDate });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden font-sans text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <ArrowLeftRight size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Transfer Staff — {identityName}</h3>
              <p className="text-[11px] text-slate-400 font-mono">Multi-Level Organizational Relocation</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>

        {/* Wizard Form Content */}
        <div className="p-6 space-y-4 text-xs font-mono">
          <div>
            <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Target Company</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Target Region</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Work Location / Branch</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Department</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Position / Role</label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-400 text-[10px] uppercase font-bold block mb-1">Effective Transfer Date</label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/40 flex justify-end gap-2 text-xs">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300">
            Cancel
          </button>
          <button
            onClick={handleFinish}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Check size={14} />
            <span>Confirm & Execute Transfer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
