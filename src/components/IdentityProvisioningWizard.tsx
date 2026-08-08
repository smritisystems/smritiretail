/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : IdentityProvisioningWizard (4-Step Identity Provisioning Lifecycle Wizard)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 2.0.0
 */

import React, { useState } from "react";
import { UserCheck, Check, X, ArrowRight } from "lucide-react";

interface IdentityProvisioningWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: any) => void;
}

export const IdentityProvisioningWizard: React.FC<IdentityProvisioningWizardProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("Cashier");

  if (!isOpen) return null;

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    else {
      onComplete({ fullName, username, role });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-theme-surface-2 border border-theme-divider rounded-2xl shadow-2xl overflow-hidden font-sans text-theme-heading animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-theme-divider bg-theme-surface-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <UserCheck size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Identity Provisioning Wizard</h3>
              <p className="text-[11px] text-theme-muted font-mono">Step {step} of 4: Identity Setup</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-theme-muted hover:text-white hover:bg-theme-surface-hover">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs font-mono">
          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label className="text-theme-muted text-[10px] uppercase font-bold block mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jawahar Mallah"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-theme-surface-3 border border-theme-divider rounded-xl px-3 py-2 text-theme-heading outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-theme-muted text-[10px] uppercase font-bold block mb-1">Username</label>
                <input
                  type="text"
                  placeholder="e.g. jawahar"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-theme-surface-3 border border-theme-divider rounded-xl px-3 py-2 text-theme-heading outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {step > 1 && (
            <div className="p-4 bg-theme-surface-3 rounded-xl border border-theme-divider text-center text-theme-muted">
              Step {step} provisioning parameter configuration active.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-theme-divider bg-theme-surface-3 flex justify-end gap-2 text-xs">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body">
            Cancel
          </button>
          <button
            onClick={handleNext}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <span>{step === 4 ? "Complete Provisioning" : "Next Step"}</span>
            {step === 4 ? <Check size={14} /> : <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
};
