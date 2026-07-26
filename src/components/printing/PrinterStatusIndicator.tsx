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
 * * Version    : 4.1.0 (SEDS Printer Status Indicator Pill Component)
 * * Created    : 2026-07-26
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React from "react";
import { Printer, CheckCircle2, AlertTriangle, Cpu } from "lucide-react";
import { usePrinter, usePrinterStatus } from "../../hooks/usePrinter";

export interface PrinterStatusIndicatorProps {
  onClick?: () => void;
  className?: string;
}

export const PrinterStatusIndicator: React.FC<PrinterStatusIndicatorProps> = ({
  onClick,
  className = ""
}) => {
  const { isQZConnected, preferences } = usePrinter();
  const { status } = usePrinterStatus(preferences.preferredPrinterName);

  const isOnline = isQZConnected || status.online;

  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full border text-[11px] font-bold font-mono flex items-center gap-1.5 transition-all select-none cursor-pointer ${
        isOnline
          ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60"
          : "bg-amber-950/40 text-amber-300 border-amber-500/40 hover:bg-amber-900/60"
      } ${className}`}
      title={`Active Printer: ${preferences.preferredPrinterName || "System Default"} | Status: ${status.message}`}
    >
      <Printer size={13} className={isOnline ? "text-emerald-400" : "text-amber-400"} />
      <span className="truncate max-w-[130px]">
        {preferences.preferredPrinterName || "System Printer"}
      </span>

      <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />

      {isQZConnected && (
        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-bold">QZ</span>
      )}
    </button>
  );
};
