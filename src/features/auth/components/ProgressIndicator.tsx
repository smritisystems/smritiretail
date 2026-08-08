/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — Progressive Authentication Status Stepper
 * Feature      : src/features/auth/components/ProgressIndicator.tsx
 */

import React from "react";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { AuthProgressStep } from "../types/auth.types";

interface ProgressIndicatorProps {
  steps: AuthProgressStep[];
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ steps }) => {
  return (
    <div className="w-full py-4 px-2 space-y-2.5 font-mono text-xs">
      {steps.map((step) => {
        let icon = <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0" />;
        let textColor = "text-slate-500";

        if (step.status === "active") {
          icon = <Loader2 size={14} className="text-indigo-400 animate-spin shrink-0" />;
          textColor = "text-indigo-300 font-semibold";
        } else if (step.status === "completed") {
          icon = <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />;
          textColor = "text-emerald-300";
        } else if (step.status === "error") {
          icon = <AlertCircle size={14} className="text-rose-400 shrink-0" />;
          textColor = "text-rose-400 font-semibold";
        }

        return (
          <div key={step.id} className={`flex items-center space-x-2.5 transition-colors ${textColor}`}>
            {icon}
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
};
