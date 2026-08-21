/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.2.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState } from "react";
import { Printer, X, Check, Wifi, Usb, Cable, Layers } from "lucide-react";
import { PrinterTargetConfig, PortType } from "./types.ts";

interface BarcodePrinterSelectModalProps {
  isOpen: boolean;
  currentPort: PortType;
  scriptFileName: string;
  onClose: () => void;
  onConfirm: (config: { printerName: string; portType: PortType; dpi: number }) => void;
}

const AVAILABLE_PRINTERS: PrinterTargetConfig[] = [
  { name: "TSC TE244 Thermal Barcode Printer", connectionType: "USB", isOnline: true, resolutionDpi: 203 },
  { name: "Zebra ZD220 Direct Thermal Label", connectionType: "USB", isOnline: true, resolutionDpi: 203 },
  { name: "Citizen CL-S621 Network Printer", connectionType: "NETWORK", address: "192.168.1.180:9100", isOnline: true, resolutionDpi: 300 },
  { name: "Honeywell PC42t Desktop Printer", connectionType: "SERIAL", address: "COM1", isOnline: false, resolutionDpi: 203 },
  { name: "Generic Text / PRN Direct Spooler", connectionType: "SYSTEM_DEFAULT", isOnline: true, resolutionDpi: 203 }
];

export const BarcodePrinterSelectModal: React.FC<BarcodePrinterSelectModalProps> = ({
  isOpen,
  currentPort,
  scriptFileName,
  onClose,
  onConfirm
}) => {
  const [selectedPrinter, setSelectedPrinter] = useState<string>(AVAILABLE_PRINTERS[0].name);
  const [selectedPort, setSelectedPort] = useState<PortType>(currentPort);
  const [selectedDpi, setSelectedDpi] = useState<number>(203);

  if (!isOpen) return null;

  const handleApply = () => {
    onConfirm({
      printerName: selectedPrinter,
      portType: selectedPort,
      dpi: selectedDpi
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150 font-sans">
      <div className="bg-[#fbf8fb] text-[#1b1b1e] rounded-lg border border-[#c5c6ce] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-[#c5c6ce] flex justify-between items-center bg-[#efedf0]">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-[#041632]" />
            <div>
              <h2 className="font-semibold text-sm text-[#041632]">Select Thermal Barcode Printer</h2>
              <p className="text-[11px] text-[#44474d]">Target printer provisioning for script: {scriptFileName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-[#44474d] hover:text-[#ba1a1a] p-1 rounded">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs bg-white">
          
          {/* Printer list */}
          <div className="space-y-2">
            <label className="font-bold text-[#041632] uppercase tracking-wider text-[10px] block">
              Available Printers
            </label>
            <div className="space-y-1.5 border border-[#c5c6ce] rounded-lg p-2 max-h-48 overflow-y-auto bg-[#fbf8fb]">
              {AVAILABLE_PRINTERS.map((p) => {
                const isSelected = selectedPrinter === p.name;
                return (
                  <div
                    key={p.name}
                    onClick={() => {
                      setSelectedPrinter(p.name);
                      setSelectedDpi(p.resolutionDpi);
                      if (p.connectionType === "NETWORK") setSelectedPort("Network TCP/IP");
                      else if (p.connectionType === "USB") setSelectedPort("USB");
                      else if (p.connectionType === "SERIAL") setSelectedPort("COM 1");
                    }}
                    className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between transition ${
                      isSelected
                        ? "bg-[#d7e2ff] border-[#3e5f90] text-[#041632]"
                        : "bg-white border-[#c5c6ce] hover:bg-[#eae7ea] text-[#1b1b1e]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {p.connectionType === "NETWORK" ? (
                        <Wifi size={16} className="text-[#3e5f90]" />
                      ) : p.connectionType === "USB" ? (
                        <Usb size={16} className="text-[#041632]" />
                      ) : (
                        <Cable size={16} className="text-[#75777e]" />
                      )}
                      <div>
                        <div className="font-bold text-xs">{p.name}</div>
                        <div className="text-[10px] text-[#44474d] font-mono">
                          {p.address || p.connectionType} • {p.resolutionDpi} DPI
                        </div>
                      </div>
                    </div>
                    <div>
                      {p.isOnline ? (
                        <span className="text-[10px] text-emerald-700 bg-emerald-100 font-bold px-2 py-0.5 rounded">
                          Online
                        </span>
                      ) : (
                        <span className="text-[10px] text-[#75777e] bg-[#efedf0] px-2 py-0.5 rounded">
                          Offline
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Port Settings & Resolution */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-[#041632] uppercase tracking-wider text-[10px] block mb-1">
                Port Setting
              </label>
              <select
                value={selectedPort}
                onChange={e => setSelectedPort(e.target.value as any)}
                className="w-full border border-[#c5c6ce] rounded p-1.5 bg-[#fbf8fb] font-semibold text-xs"
              >
                <option value="USB">USB Direct</option>
                <option value="COM 1">COM 1 (Serial)</option>
                <option value="COM 2">COM 2 (Serial)</option>
                <option value="Network TCP/IP">Network TCP/IP (Raw 9100)</option>
                <option value="QZ Tray Thermal">QZ Tray Direct Spooler</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-[#041632] uppercase tracking-wider text-[10px] block mb-1">
                Resolution (DPI)
              </label>
              <select
                value={selectedDpi}
                onChange={e => setSelectedDpi(parseInt(e.target.value))}
                className="w-full border border-[#c5c6ce] rounded p-1.5 bg-[#fbf8fb] font-semibold text-xs"
              >
                <option value={203}>203 DPI (Standard Retail)</option>
                <option value={300}>300 DPI (High Density)</option>
                <option value={600}>600 DPI (Ultra Precision)</option>
              </select>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#c5c6ce] bg-[#efedf0] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-[#75777e] rounded text-[#041632] font-semibold hover:bg-[#eae7ea]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-6 py-1.5 bg-[#041632] text-white rounded font-bold hover:bg-[#1b2b48] transition shadow-sm flex items-center gap-1"
          >
            <Check size={14} />
            Confirm Target Printer
          </button>
        </div>

      </div>
    </div>
  );
};
