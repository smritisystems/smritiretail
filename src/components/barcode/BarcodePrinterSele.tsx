/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.8.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-23
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from "react";
import { Printer, X, Check, Wifi, Usb, Cable, Activity, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { PrinterTargetConfig, PortType } from "./types.ts";
import {
  isQzTrayEnabled,
  connectQzTray,
  listQzPrinters,
  testQzConnection,
  testQzLabelPrint
} from "../../utils/qzTrayClient.ts";

interface BarcodePrinterSelectModalProps {
  isOpen: boolean;
  currentPort: PortType;
  scriptFileName: string;
  initialPrinterName?: string;
  onClose: () => void;
  onConfirm: (config: { printerName: string; portType: PortType; dpi: number }) => void;
}

const DEFAULT_FALLBACK_PRINTERS: PrinterTargetConfig[] = [
  { name: "IMPACT by Honeywell IH-2 (300 dpi) - DPL", connectionType: "USB", isOnline: true, resolutionDpi: 300 },
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
  initialPrinterName,
  onClose,
  onConfirm
}) => {
  const [selectedPrinter, setSelectedPrinter] = useState<string>(
    initialPrinterName || DEFAULT_FALLBACK_PRINTERS[0].name
  );
  const [selectedPort, setSelectedPort] = useState<PortType>(currentPort);
  const [selectedDpi, setSelectedDpi] = useState<number>(300);

  // QZ Live State
  const [qzStatus, setQzStatus] = useState<{
    connected: boolean;
    version?: string;
    loading: boolean;
    error?: string;
  }>({
    connected: false,
    loading: false
  });
  const [discoveredQzPrinters, setDiscoveredQzPrinters] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<{
    status: "idle" | "running" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  useEffect(() => {
    if (isOpen) {
      checkQzAndLoadPrinters();
    }
  }, [isOpen]);

  const checkQzAndLoadPrinters = async () => {
    if (!isQzTrayEnabled()) {
      setQzStatus({ connected: false, loading: false, error: "QZ Tray disabled" });
      return;
    }

    setQzStatus(prev => ({ ...prev, loading: true, error: undefined }));
    try {
      const res = await testQzConnection();
      if (res.connected) {
        setQzStatus({
          connected: true,
          version: res.version,
          loading: false,
          error: undefined
        });
        setDiscoveredQzPrinters(res.printers);
        if (res.printers.length > 0 && (!selectedPrinter || !res.printers.includes(selectedPrinter))) {
          // If Honeywell or Zebra found, prioritize it, else first
          const honeywell = res.printers.find(p => /honeywell|ih-2|dpl|tsc|zebra/i.test(p));
          if (honeywell) {
            setSelectedPrinter(honeywell);
          } else {
            setSelectedPrinter(res.printers[0]);
          }
        }
      } else {
        setQzStatus({
          connected: false,
          loading: false,
          error: res.error || "QZ Tray not responding on localhost:8182"
        });
      }
    } catch (err: any) {
      setQzStatus({
        connected: false,
        loading: false,
        error: err?.message || "Failed to connect to QZ Tray"
      });
    }
  };

  const handleTestQzConnection = async () => {
    setTestResult({ status: "running", message: "Connecting to QZ Tray..." });
    const res = await testQzConnection();
    if (res.connected) {
      setQzStatus({ connected: true, version: res.version, loading: false });
      setDiscoveredQzPrinters(res.printers);
      setTestResult({
        status: "success",
        message: `QZ Tray v${res.version} connected successfully. Discovered ${res.printers.length} Windows printer(s).`
      });
    } else {
      setQzStatus({ connected: false, loading: false, error: res.error });
      setTestResult({
        status: "error",
        message: res.error || "Connection failed. Please ensure QZ Tray is running on this PC."
      });
    }
  };

  const handleTestLabelPrint = async () => {
    if (!selectedPrinter) {
      setTestResult({ status: "error", message: "Please select a target printer first." });
      return;
    }
    setTestResult({ status: "running", message: `Sending test label to "${selectedPrinter}"...` });
    const format = scriptFileName.toLowerCase().includes("dpl")
      ? "DPL"
      : scriptFileName.toLowerCase().includes("tspl")
      ? "TSPL"
      : "ZPL";
    const res = await testQzLabelPrint(selectedPrinter, format);
    if (res.success) {
      setTestResult({ status: "success", message: res.message });
    } else {
      setTestResult({ status: "error", message: res.error || res.message });
    }
  };

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
      <div className="bg-surface text-on-surface rounded-xl border border-outline-variant w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-outline-variant flex justify-between items-center bg-surface-variant">
          <div className="flex items-center gap-2">
            <Printer size={18} className="text-primary" />
            <div>
              <h2 className="font-title-sm font-bold text-sm text-on-surface">Select Thermal Barcode Printer</h2>
              <p className="text-[11px] text-on-surface-variant">Target printer provisioning for script: {scriptFileName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-error p-1 rounded">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs bg-surface">
          {/* QZ Tray Live Status Banner */}
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-outline-variant bg-surface-container-low">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  qzStatus.connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                }`}
              />
              <div>
                <div className="font-bold text-xs flex items-center gap-1.5">
                  <span>QZ Tray Integration:</span>
                  <span
                    className={`font-semibold ${
                      qzStatus.connected ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {qzStatus.connected ? `Connected (v${qzStatus.version || "2.2.6"})` : "Disconnected / Offline"}
                  </span>
                </div>
                <div className="text-[10px] text-on-surface-variant">
                  {qzStatus.connected
                    ? `${discoveredQzPrinters.length} Windows print queues detected on localhost:8182`
                    : "QZ Tray service not found. Start QZ Tray on this workstation for direct thermal printing."}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestQzConnection}
              disabled={qzStatus.loading}
              className="px-2.5 py-1 bg-surface border border-outline-variant hover:bg-surface-variant text-on-surface rounded font-semibold text-[11px] flex items-center gap-1 transition"
              title="Refresh and verify local QZ Tray connection"
            >
              <RefreshCw size={12} className={qzStatus.loading ? "animate-spin" : ""} />
              <span>Test QZ</span>
            </button>
          </div>

          {/* Test Feedback Notice */}
          {testResult.status !== "idle" && (
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-start gap-2 ${
                testResult.status === "running"
                  ? "bg-blue-50 border-blue-200 text-blue-800"
                  : testResult.status === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border-rose-200 text-rose-800"
              }`}
            >
              {testResult.status === "running" ? (
                <RefreshCw size={14} className="animate-spin shrink-0 mt-0.5" />
              ) : testResult.status === "success" ? (
                <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertTriangle size={14} className="shrink-0 mt-0.5 text-rose-600" />
              )}
              <div className="flex-1 font-medium">{testResult.message}</div>
            </div>
          )}

          {/* Printer List */}
          <div className="space-y-2">
            <label className="font-bold text-on-surface uppercase tracking-wider text-[10px] block">
              {qzStatus.connected ? "Windows Print Queues (via QZ Tray)" : "Available Hardware & System Printers"}
            </label>
            <div className="space-y-1.5 border border-outline-variant rounded-lg p-2 max-h-48 overflow-y-auto bg-surface-container-lowest">
              {qzStatus.connected && discoveredQzPrinters.length > 0 ? (
                discoveredQzPrinters.map(pName => {
                  const isSelected = selectedPrinter === pName;
                  return (
                    <div
                      key={pName}
                      onClick={() => {
                        setSelectedPrinter(pName);
                        setSelectedPort("QZ Tray Thermal");
                      }}
                      className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between transition ${
                        isSelected
                          ? "bg-primary-container border-primary text-on-primary-container"
                          : "bg-surface border-outline-variant hover:bg-surface-variant text-on-surface"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Usb size={16} className="text-primary" />
                        <div>
                          <div className="font-bold text-xs">{pName}</div>
                          <div className="text-[10px] text-on-surface-variant font-mono">
                            Windows Queue via QZ Tray • USB / Spooler
                          </div>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2 py-0.5 rounded">
                          Online (QZ)
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                DEFAULT_FALLBACK_PRINTERS.map(p => {
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
                          ? "bg-primary-container border-primary text-on-primary-container"
                          : "bg-surface border-outline-variant hover:bg-surface-variant text-on-surface"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {p.connectionType === "NETWORK" ? (
                          <Wifi size={16} className="text-secondary" />
                        ) : p.connectionType === "USB" ? (
                          <Usb size={16} className="text-primary" />
                        ) : (
                          <Cable size={16} className="text-outline" />
                        )}
                        <div>
                          <div className="font-bold text-xs">{p.name}</div>
                          <div className="text-[10px] text-on-surface-variant font-mono">
                            {p.address || p.connectionType} • {p.resolutionDpi} DPI
                          </div>
                        </div>
                      </div>
                      <div>
                        {p.isOnline ? (
                          <span className="text-[10px] text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2 py-0.5 rounded">
                            Configured
                          </span>
                        ) : (
                          <span className="text-[10px] text-outline bg-surface-variant px-2 py-0.5 rounded">
                            Offline
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Port Settings & Resolution */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-bold text-on-surface uppercase tracking-wider text-[10px] block mb-1">
                Port / Dispatch Mode
              </label>
              <select
                value={selectedPort}
                onChange={e => setSelectedPort(e.target.value as any)}
                className="w-full border border-outline-variant rounded p-1.5 bg-surface text-on-surface font-semibold text-xs focus:ring-1 focus:ring-primary outline-hidden"
              >
                <option value="QZ Tray Thermal">QZ Tray Thermal (Windows Spooler)</option>
                <option value="USB">USB Direct</option>
                <option value="COM 1">COM 1 (Serial)</option>
                <option value="COM 2">COM 2 (Serial)</option>
                <option value="Network TCP/IP">Network TCP/IP (Raw 9100)</option>
                <option value="PRN File Download">PRN File Download</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-on-surface uppercase tracking-wider text-[10px] block mb-1">
                Resolution (DPI)
              </label>
              <select
                value={selectedDpi}
                onChange={e => setSelectedDpi(parseInt(e.target.value))}
                className="w-full border border-outline-variant rounded p-1.5 bg-surface text-on-surface font-semibold text-xs focus:ring-1 focus:ring-primary outline-hidden"
              >
                <option value={300}>300 DPI (Honeywell / High Density)</option>
                <option value={203}>203 DPI (Standard Retail)</option>
                <option value={600}>600 DPI (Ultra Precision)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-outline-variant bg-surface-variant flex items-center justify-between gap-2">
          <div>
            {qzStatus.connected && selectedPrinter && (
              <button
                type="button"
                onClick={handleTestLabelPrint}
                disabled={testResult.status === "running"}
                className="px-3 py-1.5 bg-surface border border-secondary text-secondary hover:bg-secondary-container rounded font-bold transition flex items-center gap-1.5 text-xs shadow-xs"
                title="Send a harmless test calibration sticker to the printer"
              >
                <Activity size={14} />
                <span>Test Label Print</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-outline rounded text-on-surface font-semibold hover:bg-surface-variant"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-6 py-1.5 bg-primary text-on-primary rounded font-bold hover:bg-primary-hover transition shadow-sm flex items-center gap-1"
            >
              <Check size={14} />
              Confirm Target Printer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
