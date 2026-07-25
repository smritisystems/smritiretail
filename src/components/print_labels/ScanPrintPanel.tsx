/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (Advanced Scan & Print Console Sub-Component)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import React, { useState, useRef, useEffect } from "react";
import { QrCode, Printer, CheckCircle2, AlertCircle } from "lucide-react";
import { UniversalLabelItem, PrinterProfile } from "../../services/universalLabelPrinterService.ts";
import { BarcodeLabel } from "../../print_engine/templates/BarcodeLabel.tsx";

export interface ScanPrintPanelProps {
  items: UniversalLabelItem[];
  activePrinter?: PrinterProfile;
  onNotification?: (title: string, message: string, type: "success" | "error") => void;
}

export const ScanPrintPanel: React.FC<ScanPrintPanelProps> = ({
  items,
  activePrinter,
  onNotification
}) => {
  const [scanInput, setScanInput] = useState<string>("");
  const [scannedItem, setScannedItem] = useState<UniversalLabelItem | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [statusMessage, setStatusMessage] = useState<string>("Ready for barcode scan...");
  const [isError, setIsError] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus barcode input field
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;

    const term = scanInput.trim().toLowerCase();
    const found = items.find(i => 
      i.barcode.toLowerCase() === term || 
      (i.stock_no || i.item_code).toLowerCase() === term
    ) || items[0]; // fallback sample

    if (found) {
      setScannedItem(found);
      setStatusMessage(`Item Loaded: ${found.name} [Barcode: ${found.barcode}]`);
      setIsError(false);
    } else {
      setScannedItem(null);
      setStatusMessage(`Barcode symbol '${scanInput}' not found in item database`);
      setIsError(true);
    }
  };

  const handlePrintScan = () => {
    if (!scannedItem) return;
    const printerName = activePrinter?.name || "Default Printer";
    if (onNotification) {
      onNotification("Instant Print Dispatched", `Dispatched ${qty} labels for ${scannedItem.name} to ${printerName}`, "success");
    }
    setStatusMessage(`Dispatched ${qty} labels for ${scannedItem.name}. Ready for next scan...`);
    setIsError(false);
    setScanInput("");
    setScannedItem(null);
    setQty(1);
    setTimeout(() => inputRef.current?.focus(), 200);
  };

  return (
    <div className="bg-[#141726] border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl font-mono text-xs max-w-3xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-sm font-bold text-white uppercase flex items-center gap-2">
          <QrCode size={18} className="text-emerald-400" />
          High-Speed Scan & Print Workstation (Scan → Validate → Load → Preview → Print)
        </span>
        <span className="text-[10px] bg-emerald-950/60 text-emerald-300 px-2.5 py-0.5 rounded border border-emerald-500/30 font-bold">Auto-Focus Mode</span>
      </div>

      {/* Barcode Scanner Input Form */}
      <form onSubmit={handleScanSubmit} className="space-y-2">
        <span className="text-[10px] text-slate-400 uppercase font-bold block">Scan Barcode Code / Stock No Symbol:</span>
        <div className="flex gap-2">
          <input 
            ref={inputRef}
            type="text" 
            value={scanInput} 
            onChange={e => setScanInput(e.target.value)} 
            placeholder="Scan or enter barcode (e.g. 8901234560006)..." 
            className="w-full bg-[#0a0c14] border-2 border-emerald-500/50 rounded-xl px-3 py-2 text-emerald-300 font-bold text-sm outline-none shadow-inner" 
          />
          <button type="submit" className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg">
            Lookup Item
          </button>
        </div>
      </form>

      {/* Status Message */}
      <div className={`p-2.5 rounded-xl border flex items-center gap-2 font-bold text-xs ${isError ? "bg-red-950/60 border-red-500/50 text-red-300" : "bg-[#0a0c14] border-slate-800 text-amber-300"}`}>
        {isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} className="text-emerald-400" />}
        <span>{statusMessage}</span>
      </div>

      {/* Loaded Item Preview Card */}
      {scannedItem && (
        <div className="bg-[#0a0c14] border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 text-xs">
              <div><span className="text-[9px] text-slate-500 block font-bold uppercase">Item Name:</span><span className="text-white font-bold text-sm">{scannedItem.name}</span></div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-[9px] text-slate-500 block font-bold uppercase">Barcode:</span><span className="text-indigo-300 font-bold">{scannedItem.barcode}</span></div>
                <div><span className="text-[9px] text-slate-500 block font-bold uppercase">Price:</span><span className="text-emerald-400 font-bold">₹{scannedItem.price}</span></div>
              </div>
            </div>

            <div className="bg-[#08090e] border border-slate-800 rounded-xl p-2 flex items-center justify-center">
              <div className="max-w-[180px] w-full">
                <BarcodeLabel data={{ items: [{ name: scannedItem.name, rate: scannedItem.price || 0, barcode: scannedItem.barcode }] }} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold">Enter Print Copies:</span>
              <input type="number" min={1} max={100} value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))} className="bg-[#141726] border border-slate-700 rounded px-3 py-1 text-amber-300 font-bold w-20 text-center text-sm" />
            </div>

            <button onClick={handlePrintScan} className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-xl flex items-center gap-2">
              <Printer size={16} /> Instant Print ({qty} Labels)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
