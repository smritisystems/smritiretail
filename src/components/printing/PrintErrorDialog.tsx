/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 4.1.0 (SEDS Print Error & HREP Recovery Dialog Component)
 * * Created    : 2026-07-26
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React from "react";
import { AlertTriangle, X, RefreshCw, Cpu, HelpCircle } from "lucide-react";

export interface PrintErrorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRetryJob?: () => void;
  errorMessage: string;
  printerName?: string;
  referenceId?: string;
}

export const PrintErrorDialog: React.FC<PrintErrorDialogProps> = ({
  isOpen,
  onClose,
  onRetryJob,
  errorMessage,
  printerName = "Selected Hardware Printer",
  referenceId = `SMRITI-PRN-${Date.now().toString().slice(-6)}`
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-theme-surface-1 border border-red-500/40 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 className="text-base font-bold text-theme-heading font-display">Hardware Print Failure</h3>
              <p className="text-[11px] text-theme-muted font-mono">Ref ID: {referenceId}</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 text-theme-muted hover:text-theme-heading rounded-lg hover:bg-theme-surface-hover">
            <X size={18} />
          </button>
        </div>

        {/* Error Details */}
        <div className="space-y-3">
          <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-red-200 text-xs font-mono whitespace-pre-wrap">
            {errorMessage || "Unable to establish WebSocket hardware connection with QZ Tray software."}
          </div>

          <div className="bg-theme-surface-2 p-3 rounded-xl border border-theme-divider space-y-1 text-xs">
            <div className="font-bold text-theme-heading flex items-center gap-1.5 mb-1">
              <HelpCircle size={14} className="text-amber-400" />
              <span>Recommended Diagnostic Steps:</span>
            </div>
            <ul className="list-disc list-inside text-theme-body space-y-1 text-[11px] text-theme-muted">
              <li>Confirm QZ Tray application is running on your workstation.</li>
              <li>Verify printer USB cable or TCP/IP network connection ({printerName}).</li>
              <li>Check if thermal ribbon or paper roll is loaded properly.</li>
            </ul>
          </div>
        </div>

        {/* Action Footer */}
        <div className="pt-2 flex justify-between items-center border-t border-theme-divider">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-theme-surface-3 hover:bg-theme-surface-hover border border-theme-divider rounded-xl text-xs font-bold text-theme-body transition-all"
          >
            Dismiss
          </button>

          {onRetryJob && (
            <button
              onClick={() => {
                onClose();
                onRetryJob();
              }}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Retry Print Job</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
