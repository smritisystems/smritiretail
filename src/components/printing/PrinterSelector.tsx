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
 * * Version    : 4.1.0 (SEDS Printer Selector Component)
 * * Created    : 2026-07-26
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React from "react";
import { Printer, RefreshCw, CheckCircle2, ShieldAlert, Wifi, Usb, Cpu, Sliders } from "lucide-react";
import { usePrinter, usePrinterList } from "../../hooks/usePrinter";

export interface PrinterSelectorProps {
  className?: string;
  showDetails?: boolean;
}

export const PrinterSelector: React.FC<PrinterSelectorProps> = ({
  className = "",
  showDetails = true
}) => {
  const { isQZConnected, activeProviderName, preferences, setPreferredPrinter, setSilentMode, connectQZ } = usePrinter();
  const { printers, loading, refreshPrinters } = usePrinterList();

  return (
    <div className={`bg-theme-surface-2 border border-theme-divider rounded-xl p-4 space-y-3 font-sans ${className}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Printer className="text-amber-400" size={16} />
          <span className="text-xs font-bold text-theme-heading uppercase tracking-wide">Workstation Hardware Printer</span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
            isQZConnected 
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isQZConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            {isQZConnected ? "QZ Tray Active" : "Browser Spooler Fallback"}
          </span>

          <button
            onClick={() => refreshPrinters()}
            disabled={loading}
            className="p-1 text-theme-muted hover:text-theme-heading rounded hover:bg-theme-surface-hover transition-all"
            title="Refresh Installed Printers"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Select Dropdown */}
      <div>
        <label className="block text-[11px] font-semibold text-theme-muted mb-1">
          Active Output Device:
        </label>
        <select
          value={preferences.preferredPrinterName}
          onChange={(e) => setPreferredPrinter(e.target.value)}
          className="w-full bg-theme-surface-3 border border-theme-divider rounded-lg px-3 py-2 text-xs font-bold text-theme-heading focus:outline-none focus:border-amber-500 transition-all"
        >
          <option value="">-- Use System Default Printer --</option>
          {printers.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name} {p.isDefault ? "(Default)" : ""} [{p.connectionType}]
            </option>
          ))}
        </select>
      </div>

      {showDetails && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-theme-divider text-[11px]">
          {/* Silent Mode Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={preferences.silentMode}
              onChange={(e) => setSilentMode(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span className="text-theme-body font-semibold">Silent Direct Printing</span>
          </label>

          {/* QZ Status Action */}
          <div className="flex justify-end">
            {!isQZConnected ? (
              <button
                onClick={() => connectQZ()}
                className="text-[10px] font-bold text-amber-400 hover:underline flex items-center gap-1"
              >
                <Cpu size={12} />
                <span>Connect QZ Tray</span>
              </button>
            ) : (
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle2 size={12} />
                <span>Bridge Online</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
