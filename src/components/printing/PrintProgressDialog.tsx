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
 * * Version    : 4.1.0 (SEDS Print Progress Dialog Component)
 * * Created    : 2026-07-26
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React from "react";
import { Printer, XCircle, RefreshCw } from "lucide-react";

export interface PrintProgressDialogProps {
  isOpen: boolean;
  currentCount: number;
  totalCount: number;
  printerName: string;
  onCancelJob: () => void;
}

export const PrintProgressDialog: React.FC<PrintProgressDialogProps> = ({
  isOpen,
  currentCount,
  totalCount,
  printerName,
  onCancelJob
}) => {
  if (!isOpen) return null;

  const percentage = Math.min(100, Math.round((currentCount / Math.max(1, totalCount)) * 100));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-sans select-none">
      <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Printer size={20} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-theme-heading font-display">Printing Barcode Labels...</h3>
            <p className="text-[11px] text-theme-muted font-mono truncate max-w-[240px]">Target: {printerName}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold font-mono">
            <span className="text-theme-body">{currentCount} of {totalCount} Labels Printed</span>
            <span className="text-amber-400">{percentage}%</span>
          </div>

          <div className="w-full bg-theme-surface-3 rounded-full h-3 overflow-hidden p-0.5 border border-theme-divider">
            <div
              className="bg-gradient-to-r from-amber-500 to-amber-300 h-full rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Action button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onCancelJob}
            className="px-4 py-2 bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <XCircle size={14} />
            <span>Cancel Job Run</span>
          </button>
        </div>
      </div>
    </div>
  );
};
