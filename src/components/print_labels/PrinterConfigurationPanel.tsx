/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (Printer Configuration Panel Sub-Component)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import React from "react";
import { Printer, Settings, Usb, Wifi, RefreshCw } from "lucide-react";
import { PrinterProfile } from "../../services/universalLabelPrinterService.ts";

export type OutputPortSelection = "com1" | "com2" | "com3" | "parallel" | "usb" | "tcpip";

export interface PrinterConfigurationPanelProps {
  selectedPort: OutputPortSelection;
  onPortChange: (port: OutputPortSelection) => void;
  outputToPort: boolean;
  onOutputToPortChange: (val: boolean) => void;
  outputToFile: boolean;
  onOutputToFileChange: (val: boolean) => void;
  fileOutputPath: string;
  onFilePathChange: (path: string) => void;
  activePrinter?: PrinterProfile;
  printerProfiles: PrinterProfile[];
  onOpenConfigModal: () => void;
  onRefreshPrinters?: () => void;
  onSelectPrinter?: (profile: PrinterProfile) => void;
}

export const PrinterConfigurationPanel: React.FC<PrinterConfigurationPanelProps> = ({
  selectedPort,
  onPortChange,
  outputToPort,
  onOutputToPortChange,
  outputToFile,
  onOutputToFileChange,
  fileOutputPath,
  onFilePathChange,
  activePrinter,
  printerProfiles,
  onOpenConfigModal,
  onRefreshPrinters
}) => {
  return (
    <div className="bg-[#141726] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5 font-mono">
          <Printer size={15} className="text-amber-400" />
          Output Destination & Hardware Ports
        </span>

        <div className="flex items-center gap-1.5">
          {onRefreshPrinters && (
            <button 
              onClick={onRefreshPrinters} 
              className="text-[10px] text-slate-300 hover:text-white bg-slate-800 p-1 rounded border border-slate-700"
              title="Auto-Detect & Refresh Printers"
            >
              <RefreshCw size={12} />
            </button>
          )}
          <button 
            onClick={onOpenConfigModal} 
            className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40 font-mono"
          >
            <Settings size={11} />
            <span>Config Hardware</span>
          </button>
        </div>
      </div>

      {/* Installed Active Printer Dropdown & Badge */}
      <div className="bg-[#0a0c14] border border-slate-800 rounded-xl p-2.5 space-y-1.5 font-mono text-xs">
        <div className="flex justify-between items-center">
          <span className="text-[9px] text-slate-500 font-bold uppercase">Select Barcode Printer (USB / TCP IP)</span>
          <span className="text-[10px] bg-indigo-950/60 text-indigo-300 px-2 py-0.5 rounded border border-indigo-800/40 font-bold">
            {activePrinter?.dpi || 203} DPI • {activePrinter?.protocol || "ZPL"}
          </span>
        </div>

        <select 
          value={activePrinter?.id || ""} 
          onChange={(e) => {
            const chosen = printerProfiles.find(p => p.id === e.target.value);
            if (chosen && onSelectPrinter) onSelectPrinter(chosen);
          }}
          className="w-full bg-[#141726] border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-amber-300 font-bold outline-none"
        >
          {printerProfiles.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} [{p.connectionType === "TCP/IP" ? `IP: ${p.ipAddress || "192.168.1.45"}:${p.port || 9100}` : `USB: ${p.usbPort || "USB001"}`}]
            </option>
          ))}
        </select>
      </div>

      {/* Checkboxes: Port vs File */}
      <div className="flex items-center gap-6 font-mono text-xs">
        <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-bold">
          <input type="checkbox" checked={outputToPort} onChange={e => onOutputToPortChange(e.target.checked)} className="accent-amber-500" />
          <span>Port Output</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-slate-200 font-bold">
          <input type="checkbox" checked={outputToFile} onChange={e => onOutputToFileChange(e.target.checked)} className="accent-amber-500" />
          <span>File Export (.prn/.txt)</span>
        </label>
      </div>

      {outputToFile && (
        <div className="flex items-center gap-2 pt-1 font-mono text-xs">
          <input 
            type="text" 
            value={fileOutputPath} 
            onChange={e => onFilePathChange(e.target.value)} 
            className="w-full bg-[#0a0c14] border border-slate-800 rounded-lg px-2 py-1 text-emerald-300 text-[11px]" 
          />
        </div>
      )}

      {/* Hardware Port Selection Grid */}
      <div className="bg-[#0a0c14] border border-slate-800 rounded-xl p-3 space-y-2 font-mono">
        <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Hardware Interface Mode</span>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <label className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 ${selectedPort === "usb" ? "bg-emerald-950/50 border-emerald-500/60 text-emerald-300 font-bold" : "bg-[#141726] border-slate-800 text-slate-400"}`}>
            <input type="radio" name="port_setting" checked={selectedPort === "usb"} onChange={() => onPortChange("usb")} className="accent-emerald-500" />
            <span className="flex items-center gap-1"><Usb size={12} /> Direct USB</span>
          </label>

          <label className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 ${selectedPort === "tcpip" ? "bg-indigo-950/50 border-indigo-500/60 text-indigo-300 font-bold" : "bg-[#141726] border-slate-800 text-slate-400"}`}>
            <input type="radio" name="port_setting" checked={selectedPort === "tcpip"} onChange={() => onPortChange("tcpip")} className="accent-indigo-500" />
            <span className="flex items-center gap-1"><Wifi size={12} /> TCP/IP Net</span>
          </label>

          <label className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 ${selectedPort === "parallel" ? "bg-amber-950/50 border-amber-500/60 text-amber-300 font-bold" : "bg-[#141726] border-slate-800 text-slate-400"}`}>
            <input type="radio" name="port_setting" checked={selectedPort === "parallel"} onChange={() => onPortChange("parallel")} className="accent-amber-500" />
            <span>Parallel LPT1</span>
          </label>

          <label className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 ${selectedPort === "com1" ? "bg-purple-950/50 border-purple-500/60 text-purple-300 font-bold" : "bg-[#141726] border-slate-800 text-slate-400"}`}>
            <input type="radio" name="port_setting" checked={selectedPort === "com1"} onChange={() => onPortChange("com1")} className="accent-purple-500" />
            <span>COM 1 Port</span>
          </label>

          <label className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 ${selectedPort === "com2" ? "bg-purple-950/50 border-purple-500/60 text-purple-300 font-bold" : "bg-[#141726] border-slate-800 text-slate-400"}`}>
            <input type="radio" name="port_setting" checked={selectedPort === "com2"} onChange={() => onPortChange("com2")} className="accent-purple-500" />
            <span>COM 2 Port</span>
          </label>

          <label className={`p-2 rounded-lg border cursor-pointer flex items-center gap-2 ${selectedPort === "com3" ? "bg-purple-950/50 border-purple-500/60 text-purple-300 font-bold" : "bg-[#141726] border-slate-800 text-slate-400"}`}>
            <input type="radio" name="port_setting" checked={selectedPort === "com3"} onChange={() => onPortChange("com3")} className="accent-purple-500" />
            <span>COM 3 Port</span>
          </label>
        </div>
      </div>
    </div>
  );
};
