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
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { 
  Barcode, QrCode, Printer, Settings, Search, Plus, 
  CheckCircle2, Database, ShieldCheck, Tag, FileText, 
  Box, History, Copy, Layers, FileDown, AlertTriangle
} from "lucide-react";
import { BarcodeEngine, BarcodeRecord } from "../services/barcodeEngine.ts";
import { recordAuditAction } from "../lib/apiFetch.ts";

interface BarcodeStudioTabProps {
  currentUser?: { role: string; name: string } | null;
}

export const BarcodeStudioTab: React.FC<BarcodeStudioTabProps> = ({ currentUser }) => {
  const isReadOnly = currentUser?.role === "Report User";
  const [activeView, setActiveView] = useState<
    "master" | "generator" | "history" | "settings" | "printing" | "scanner"
  >("master");

  useEffect(() => {
    recordAuditAction("VIEW", "barcodes", activeView, `Switched barcode studio view to: ${activeView}`);
  }, [activeView]);

  const [masterData, setMasterData] = useState<BarcodeRecord[]>([
    { id: "BC-1001", value: "8901234560012", type: "Internal EAN-13", mode: "Auto", entity: "Premium Headphones", status: "Active", date: "2026-07-01" },
    { id: "BC-1002", value: "012345678905", type: "UPC-A", mode: "Imported", entity: "Wireless Mouse", status: "Active", date: "2026-07-02" },
    { id: "BC-1003", value: "(01)08901234560012(10)B123", type: "GS1-128", mode: "GS1 Professional", entity: "Pharma Carton", status: "Active", date: "2026-07-05" },
    { id: "BC-1004", value: "INT-SKU-902", type: "Code128", mode: "Auto", entity: "Internal Bin 4", status: "Active", date: "2026-07-09" }
  ]);

  const [notification, setNotification] = useState<{title: string, message: string, type: "success"|"error"} | null>(null);

  const showNotification = (title: string, message: string, type: "success"|"error") => {
    setNotification({ title, message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddBarcode = (record: BarcodeRecord) => {
    if (masterData.some(b => b.value === record.value)) {
      showNotification("Duplicate Error", "This barcode value already exists in the master registry.", "error");
      return false;
    }
    setMasterData([record, ...masterData]);
    showNotification("Success", `Barcode ${record.value} added to master registry.`, "success");
    return true;
  };

  return (
    <div className="flex h-full gap-4 relative">
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 50, x: "-50%" }}
            className={`absolute bottom-6 left-1/2 z-50 px-6 py-3 rounded-lg shadow-xl border flex items-center gap-3 ${
              notification.type === "success" 
                ? "bg-emerald-50 text-emerald-900 border-emerald-200" 
                : "bg-rose-50 text-rose-900 border-rose-200"
            }`}
          >
            {notification.type === "success" ? <CheckCircle2 className="text-emerald-500" /> : <AlertTriangle className="text-rose-500" />}
            <div>
              <div className="font-bold text-sm">{notification.title}</div>
              <div className="text-xs opacity-80">{notification.message}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <div className="w-56 shrink-0 bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-xl p-4 flex flex-col h-[calc(100vh-140px)]">
        <div className="flex items-center gap-2 text-theme-body font-display font-bold text-lg mb-6 px-2">
          <Barcode className="text-indigo-500" />
          Barcode Studio
        </div>
        
        <nav className="space-y-1">
          <NavItem icon={<Database />} label="Barcode Master" active={activeView === "master"} onClick={() => setActiveView("master")} />
          <NavItem icon={<Plus />} label="Generate Barcode" active={activeView === "generator"} onClick={() => setActiveView("generator")} />
          <NavItem icon={<Printer />} label="Label Printing" active={activeView === "printing"} onClick={() => setActiveView("printing")} />
          <NavItem icon={<Search />} label="Scanner Console" active={activeView === "scanner"} onClick={() => setActiveView("scanner")} />
          <NavItem icon={<History />} label="Barcode History" active={activeView === "history"} onClick={() => setActiveView("history")} />
        </nav>
        
        <div className="mt-auto space-y-1 pt-4 border-t border-theme-divider">
          <NavItem icon={<Settings />} label="Engine Settings" active={activeView === "settings"} onClick={() => setActiveView("settings")} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-xl overflow-hidden flex flex-col h-[calc(100vh-140px)]">
        {isReadOnly && (
          <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2.5 flex items-center space-x-2 text-amber-400 text-xs">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
            <span>Operating under a Read-Only Report User role. Modifying barcodes or templates is prohibited.</span>
          </div>
        )}
        <SmritiScrollArea className="flex-1 p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeView === "master" && <BarcodeMaster masterData={masterData} />}
              {activeView === "generator" && <BarcodeGenerator onAddBarcode={handleAddBarcode} />}
              {activeView === "printing" && <LabelPrinting />}
              {activeView === "scanner" && <ScannerConsole masterData={masterData} />}
              {activeView === "history" && <BarcodeHistory masterData={masterData} />}
              {activeView === "settings" && <EngineSettings />}
            </motion.div>
          </AnimatePresence>
        </SmritiScrollArea>
      </div>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors font-semibold ${
      active 
        ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" 
        : "text-theme-muted hover:text-theme-body hover:bg-theme-surface-2 border border-transparent"
    }`}
  >
    <div className={active ? "text-indigo-400" : "text-theme-muted"}>
      {React.cloneElement(icon, { size: 18 })}
    </div>
    {label}
  </button>
);

const BarcodeMaster = ({ masterData }: { masterData: BarcodeRecord[] }) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-theme-divider pb-4">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-body flex items-center gap-2">
            <Database className="text-indigo-400" />
            Barcode Master
          </h2>
          <p className="text-xs text-theme-muted mt-1">Unified registry of all barcodes generated or imported in the system.</p>
        </div>
        <div className="flex gap-2">
           <button className="px-3 py-1.5 bg-theme-surface-3 border border-theme-divider rounded-lg text-xs font-semibold hover:bg-theme-surface-hover flex items-center gap-2 text-theme-body">
            <FileDown size={14} /> Export Registry
          </button>
        </div>
      </div>

      <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 flex gap-4 items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
          <input 
            type="text" 
            placeholder="Search Barcode Value, Entity, or ID..." 
            className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <select className="bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option>All Generation Modes</option>
          <option>Internal Barcode</option>
          <option>Imported Existing</option>
          <option>GS1 Professional</option>
        </select>
        <select className="bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option>All Types</option>
          <option>EAN-13</option>
                    <option>EAN-8</option>
          <option>GS1-128</option>
          <option>Code128</option>
          <option>QR Code</option>
        </select>
      </div>

      <div className="border border-theme-divider rounded-xl overflow-hidden bg-theme-surface-1 shadow-md">
        <table className="w-full text-left text-xs">
          <thead className="bg-theme-surface-2 border-b border-theme-divider">
            <tr className="uppercase tracking-wider font-mono text-[10px] text-theme-muted">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Barcode Value</th>
              <th className="px-4 py-3">Generation Mode</th>
              <th className="px-4 py-3">Barcode Type</th>
              <th className="px-4 py-3">Assigned Entity</th>
              <th className="px-4 py-3">Created Date</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-divider">
            {masterData.map((b) => (
              <tr key={b.id} className="hover:bg-theme-surface-2 transition-colors cursor-pointer text-theme-body">
                <td className="px-4 py-3 font-mono text-indigo-400 font-bold">{b.id}</td>
                <td className="px-4 py-3 font-mono font-bold">{b.value}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    b.mode === 'Auto' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 
                    b.mode === 'Imported' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                    'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                  }`}>
                    {b.mode}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">{b.type}</td>
                <td className="px-4 py-3 font-medium">{b.entity}</td>
                <td className="px-4 py-3 text-theme-muted font-mono">{b.date}</td>
                <td className="px-4 py-3 text-center">
                  <ShieldCheck size={14} className="text-emerald-500 mx-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const BarcodeGenerator = ({ onAddBarcode }: { onAddBarcode: (record: BarcodeRecord) => boolean }) => {
  const [engineMode, setEngineMode] = useState<"internal" | "imported" | "gs1" | "qrcode">("internal");

  // Internal State
  const [internalEntity, setInternalEntity] = useState("Premium Headphones (SKU-1001)");
  const [internalPreview, setInternalPreview] = useState("");

  const handleGenerateInternal = () => {
    const nextId = Math.floor(Math.random() * 999999999);
    const barcode = BarcodeEngine.generateInternalEAN13("200", nextId);
    if(onAddBarcode({
      id: "BC-" + Math.floor(Math.random() * 10000),
      value: barcode,
      type: "Internal EAN-13",
      mode: "Auto",
      entity: internalEntity,
      status: "Active",
      date: new Date().toISOString().split("T")[0]
    })) {
      setInternalPreview(barcode);
    }
  };

  // Imported State
  const [importedEntity, setImportedEntity] = useState("Imported Soap (SKU-2001)");
  const [importedType, setImportedType] = useState("EAN-13");
  const [importedValue, setImportedValue] = useState("");
  const [importStatus, setImportStatus] = useState<"idle" | "validating" | "success" | "error">("idle");
  const [importError, setImportError] = useState("");

  const handleImport = () => {
    setImportStatus("validating");
    setTimeout(() => {
      let isValid = true;
      if (importedType === "EAN-13") isValid = BarcodeEngine.validateEAN13(importedValue);
      else if (importedType === "EAN-8") isValid = BarcodeEngine.validateEAN8(importedValue);
      else if (importedType === "UPC-A") isValid = BarcodeEngine.validateUPCA(importedValue);
      else if (importedType === "Code128") isValid = BarcodeEngine.validateCode128(importedValue);
      
      if (!isValid) {
        setImportStatus("error");
        setImportError("Invalid check digit or format for " + importedType);
        return;
      }

      if(onAddBarcode({
        id: "BC-" + Math.floor(Math.random() * 10000),
        value: importedValue,
        type: importedType,
        mode: "Imported",
        entity: importedEntity,
        status: "Active",
        date: new Date().toISOString().split("T")[0]
      })) {
        setImportStatus("success");
      } else {
        setImportStatus("error");
        setImportError("Barcode already exists in the master registry.");
      }
    }, 500);
  };

  // QR Code State
  const [qrEntity, setQrEntity] = useState("Retail Product Pack");
  const [qrDomain, setQrDomain] = useState("id.retail.com");
  const [qrBatch, setQrBatch] = useState("");
  const [qrExpiry, setQrExpiry] = useState("");
  const [qrItemRef, setQrItemRef] = useState("012345");
  const [qrPreview, setQrPreview] = useState("");

  const handleQRCode = () => {
    const link = BarcodeEngine.generateGS1_DigitalLink(qrDomain, "8901234", qrItemRef, qrBatch, qrExpiry);
    if(onAddBarcode({
      id: "BC-" + Math.floor(Math.random() * 10000),
      value: link,
      type: "GS1 Digital Link (QR)",
      mode: "GS1 Professional",
      entity: qrEntity,
      status: "Active",
      date: new Date().toISOString().split("T")[0]
    })) {
      setQrPreview(link);
    }
  };

  // GS1 State
  const [gs1Entity, setGs1Entity] = useState("Pharma Batch XYZ");
  const [gs1Batch, setGs1Batch] = useState("B123");
  const [gs1Expiry, setGs1Expiry] = useState("261231");
  const [gs1ItemRef, setGs1ItemRef] = useState("012345");
  const [gs1Preview, setGs1Preview] = useState("");

  const handleGS1 = () => {
    const barcode = BarcodeEngine.generateGS1_128("8901234", gs1ItemRef, gs1Batch, gs1Expiry);
    if(onAddBarcode({
      id: "BC-" + Math.floor(Math.random() * 10000),
      value: barcode,
      type: "GS1-128",
      mode: "GS1 Professional",
      entity: gs1Entity,
      status: "Active",
      date: new Date().toISOString().split("T")[0]
    })) {
      setGs1Preview(barcode);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-theme-divider pb-4">
        <h2 className="text-xl font-bold font-display text-theme-body flex items-center gap-2">
          <Plus className="text-indigo-400" />
          Universal Barcode Engine
        </h2>
        <p className="text-xs text-theme-muted mt-1">Select an engine mode to generate or import barcodes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ModeCard 
          title="Mode 1: Internal Barcode" 
          desc="Auto-generate EAN-13 compatible barcodes. No GS1 registration required." 
          icon={<Barcode />} 
          active={engineMode === "internal"} 
          onClick={() => setEngineMode("internal")}
        />
        <ModeCard 
          title="Mode 2: Imported Barcode" 
          desc="Use existing EAN, UPC, Code39, Code128, or QR codes." 
          icon={<FileText />} 
          active={engineMode === "imported"} 
          onClick={() => setEngineMode("imported")}
        />
        <ModeCard 
          title="Mode 3: GS1 Professional" 
          desc="Configure GS1 Company Prefix, GTIN, GS1-128, SSCC, and GLN." 
          icon={<Box />} 
          active={engineMode === "gs1"} 
          onClick={() => setEngineMode("gs1")}
        />
        <ModeCard 
          title="Mode 4: GS1 QR Code" 
          desc="Encode GS1 Digital Link URIs into scannable QR codes for mobile." 
          icon={<QrCode />} 
          active={engineMode === "qrcode"} 
          onClick={() => setEngineMode("qrcode")}
        />
      </div>

      <div className="mt-8 bg-theme-surface-2 border border-theme-divider rounded-2xl p-6 shadow-sm">
        {engineMode === "internal" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-theme-body">Generate Internal Barcode</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-theme-muted uppercase">Linked Entity (Item / Variant)</label>
                  <select 
                    value={internalEntity}
                    onChange={e => setInternalEntity(e.target.value)}
                    className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option>Select Item...</option>
                    <option>Premium Headphones (SKU-1001)</option>
                    <option>Wireless Mouse (SKU-1002)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-theme-muted uppercase">Internal Code Prefix</label>
                  <input type="text" defaultValue="200" className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" readOnly />
                </div>
                <button onClick={handleGenerateInternal} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-sm shadow-lg flex justify-center items-center gap-2 cursor-pointer transition-colors">
                  <Plus size={16} /> Auto Generate EAN-13
                </button>
              </div>
              <div className="border border-theme-divider bg-theme-surface-1 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                 <Barcode size={80} strokeWidth={1} className={`${internalPreview ? 'text-indigo-400' : 'text-theme-body opacity-20'}`} />
                 {internalPreview ? (
                   <div className="mt-4 font-mono font-bold text-lg text-theme-body tracking-widest">{internalPreview}</div>
                 ) : (
                   <p className="text-xs text-theme-muted mt-4">Preview will appear here after generation.<br/>Check digits are calculated automatically.</p>
                 )}
              </div>
            </div>
          </div>
        )}

        {engineMode === "imported" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-theme-body">Import Existing Barcode</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-theme-muted uppercase">Linked Entity (Item / Variant)</label>
                  <select 
                    value={importedEntity}
                    onChange={e => setImportedEntity(e.target.value)}
                    className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option>Select Item...</option>
                    <option>Imported Soap (SKU-2001)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-theme-muted uppercase">Barcode Type</label>
                  <select 
                    value={importedType}
                    onChange={e => setImportedType(e.target.value)}
                    className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option>EAN-13</option>
                    <option>EAN-8</option>
                    <option>UPC-A</option>
                    <option>Code128</option>
                    <option>QR Code</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-theme-muted uppercase">Barcode Value</label>
                  <input 
                    type="text" 
                    value={importedValue}
                    onChange={e => {setImportedValue(e.target.value); setImportStatus("idle");}}
                    placeholder="Scan or enter barcode value..." 
                    className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" 
                  />
                </div>
                {importStatus === "error" && (
                  <div className="text-rose-500 text-xs font-semibold flex items-center gap-1"><AlertTriangle size={12}/> {importError}</div>
                )}
                <button 
                  onClick={handleImport}
                  disabled={!importedValue || importStatus === "validating"}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-bold text-sm shadow-lg flex justify-center items-center gap-2 cursor-pointer transition-colors"
                >
                  <CheckCircle2 size={16} /> Validate & Import
                </button>
              </div>
              <div className="border border-theme-divider bg-theme-surface-1 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                 {importStatus === "success" ? (
                   <>
                     <ShieldCheck size={48} className="text-emerald-500 mb-4" />
                     <div className="text-emerald-500 font-bold">Successfully Imported</div>
                     <div className="font-mono mt-2 text-theme-body tracking-wider">{importedValue}</div>
                   </>
                 ) : (
                   <>
                     <ShieldCheck size={48} className="text-theme-muted opacity-50 mb-4" />
                     <p className="text-xs text-theme-muted">The engine will validate length, check digit, and check for duplicates in the registry before importing.</p>
                   </>
                 )}
              </div>
            </div>
          </div>
        )}

        {engineMode === "gs1" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-purple-500">GS1 Professional Allocation</h3>
              <span className="px-2 py-1 bg-purple-500/10 text-purple-500 border border-purple-500/20 rounded text-[10px] font-bold uppercase tracking-wider">Premium Feature</span>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-theme-muted uppercase">Target Entity</label>
                  <select 
                    value={gs1Entity}
                    onChange={e => setGs1Entity(e.target.value)}
                    className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option>Pharma Batch XYZ</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-theme-muted uppercase">Item Reference (6 digits)</label>
                  <input 
                    type="text" 
                    value={gs1ItemRef}
                    onChange={e => setGs1ItemRef(e.target.value)}
                    maxLength={6}
                    className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-theme-muted uppercase">(10) Batch/Lot</label>
                    <input 
                      type="text" 
                      value={gs1Batch}
                      onChange={e => setGs1Batch(e.target.value)}
                      className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-theme-muted uppercase">(17) Expiry (YYMMDD)</label>
                    <input 
                      type="text" 
                      value={gs1Expiry}
                      onChange={e => setGs1Expiry(e.target.value)}
                      maxLength={6}
                      className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" 
                    />
                  </div>
                </div>
                
                <button onClick={handleGS1} className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-sm shadow-lg flex justify-center items-center gap-2 mt-4 cursor-pointer transition-colors">
                  <Box size={16} /> Allocate GS1-128
                </button>
              </div>
              <div className="border border-theme-divider bg-theme-surface-1 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                 <Barcode size={80} strokeWidth={1} className={`${gs1Preview ? 'text-purple-400' : 'text-purple-500 opacity-20'}`} />
                 {gs1Preview ? (
                   <div className="mt-4 font-mono font-bold text-sm text-theme-body">{gs1Preview}</div>
                 ) : (
                   <p className="text-xs text-theme-muted mt-4">GS1 Engine automatically formats composite barcodes and verifies AI strict rules.</p>
                 )}
              </div>
            </div>
          </div>
        )}

        {engineMode === "qrcode" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-sky-500">GS1 Digital Link QR Generator</h3>
              <span className="px-2 py-1 bg-sky-500/10 text-sky-500 border border-sky-500/20 rounded text-[10px] font-bold uppercase tracking-wider">Mobile Standard</span>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-theme-muted uppercase">Target Entity</label>
                  <select 
                    value={qrEntity}
                    onChange={e => setQrEntity(e.target.value)}
                    className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none"
                  >
                    <option>Retail Product Pack</option>
                    <option>Marketing Brochure</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-theme-muted uppercase">Resolver Domain</label>
                  <input 
                    type="text" 
                    value={qrDomain}
                    onChange={e => setQrDomain(e.target.value)}
                    className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-theme-muted uppercase">Item Reference (6 digits)</label>
                  <input 
                    type="text" 
                    value={qrItemRef}
                    onChange={e => setQrItemRef(e.target.value)}
                    maxLength={6}
                    className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-theme-muted uppercase">(10) Batch (Opt)</label>
                    <input 
                      type="text" 
                      value={qrBatch}
                      onChange={e => setQrBatch(e.target.value)}
                      className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-theme-muted uppercase">(17) Expiry (Opt)</label>
                    <input 
                      type="text" 
                      value={qrExpiry}
                      onChange={e => setQrExpiry(e.target.value)}
                      maxLength={6}
                      className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-sky-500" 
                    />
                  </div>
                </div>
                
                <button onClick={handleQRCode} className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-sm shadow-lg flex justify-center items-center gap-2 mt-4 cursor-pointer transition-colors">
                  <QrCode size={16} /> Encode Digital Link QR
                </button>
              </div>
              <div className="border border-theme-divider bg-theme-surface-1 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                 <QrCode size={120} strokeWidth={1} className={`${qrPreview ? 'text-sky-500' : 'text-sky-500 opacity-20'}`} />
                 {qrPreview ? (
                   <div className="mt-6">
                     <div className="font-bold text-sm text-theme-body">QR Generated Successfully</div>
                     <div className="font-mono mt-1 text-[10px] text-theme-muted break-all max-w-[250px]">{qrPreview}</div>
                   </div>
                 ) : (
                   <p className="text-xs text-theme-muted mt-4">Generates standard GS1 Digital Link format (e.g., https://domain/01/gtin?10=batch).</p>
                 )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ModeCard = ({ title, desc, icon, active, onClick }: any) => (
  <div 
    onClick={onClick}
    className={`p-4 rounded-xl border cursor-pointer transition-all ${
      active 
        ? "bg-theme-surface-3 border-indigo-500 shadow-md shadow-indigo-500/10" 
        : "bg-theme-surface-2 border-theme-divider hover:border-theme-muted"
    }`}
  >
    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${
      active ? "bg-indigo-500 text-white" : "bg-theme-surface-3 text-theme-muted"
    }`}>
      {React.cloneElement(icon, { size: 20 })}
    </div>
    <h4 className={`font-bold text-sm mb-1 ${active ? "text-theme-body" : "text-theme-muted"}`}>{title}</h4>
    <p className="text-xs text-theme-muted leading-relaxed">{desc}</p>
  </div>
);

const EngineSettings = () => {

  return (
    <div className="max-w-4xl space-y-8">
      <div className="border-b border-theme-divider pb-4">
        <h2 className="text-xl font-bold font-display text-theme-body flex items-center gap-2">
          <Settings className="text-indigo-400" />
          Engine Settings
        </h2>
        <p className="text-xs text-theme-muted mt-1">Configure global rules for the Universal Barcode Engine.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-sm text-theme-body border-b border-theme-divider pb-2">Internal Barcode Rules</h3>
            <div className="space-y-4">
               <label className="flex items-start gap-3">
                 <input type="checkbox" defaultChecked className="mt-1 rounded bg-theme-surface-3 border-theme-divider" />
                 <div>
                   <div className="text-sm font-semibold text-theme-body">Auto-Generate on Item Creation</div>
                   <div className="text-[10px] text-theme-muted">Automatically create an internal barcode if item has no existing barcode.</div>
                 </div>
               </label>
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-theme-muted uppercase">Default Internal Prefix</label>
                  <input type="text" defaultValue="200" className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-sm focus:outline-none" />
               </div>
            </div>
          </div>
          
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 space-y-4">
            <h3 className="font-bold text-sm text-theme-body border-b border-theme-divider pb-2">Imported Validation Rules</h3>
            <div className="space-y-4">
               <label className="flex items-start gap-3">
                 <input type="checkbox" defaultChecked className="mt-1 rounded bg-theme-surface-3 border-theme-divider" />
                 <div>
                   <div className="text-sm font-semibold text-theme-body">Enforce Check Digit Verification</div>
                   <div className="text-[10px] text-theme-muted">Reject imported EAN/UPC barcodes if the final check digit is invalid.</div>
                 </div>
               </label>
               <label className="flex items-start gap-3">
                 <input type="checkbox" defaultChecked className="mt-1 rounded bg-theme-surface-3 border-theme-divider" />
                 <div>
                   <div className="text-sm font-semibold text-theme-body">Strict Uniqueness</div>
                   <div className="text-[10px] text-theme-muted">Prevent the same barcode from being linked to multiple items.</div>
                 </div>
               </label>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-theme-surface-2 border-purple-500/30 rounded-xl p-5 space-y-4 shadow-lg shadow-purple-500/5">
            <h3 className="font-bold text-sm text-purple-400 border-b border-theme-divider pb-2 flex items-center justify-between">
              GS1 Professional Configuration
              <ShieldCheck size={16} />
            </h3>
            <div className="space-y-4">
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-theme-muted uppercase">GS1 Company Prefix</label>
                  <input type="text" defaultValue="8901234" className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-sm font-mono focus:outline-none" />
               </div>
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-theme-muted uppercase">Prefix Length</label>
                  <select className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option>7 Digits</option>
                    <option>8 Digits</option>
                    <option>9 Digits</option>
                  </select>
               </div>
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-theme-muted uppercase">GTIN Length Mode</label>
                  <select className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-sm focus:outline-none">
                    <option>GTIN-13</option>
                    <option>GTIN-14 (Packaging Levels)</option>
                  </select>
               </div>
               <label className="flex items-start gap-3 pt-2">
                 <input type="checkbox" defaultChecked className="mt-1 rounded bg-theme-surface-3 border-theme-divider" />
                 <div>
                   <div className="text-sm font-semibold text-theme-body">Enable Application Identifiers (AI) validation</div>
                   <div className="text-[10px] text-theme-muted">Validate data formats (Dates, Alphanumeric limits) for GS1-128.</div>
                 </div>
               </label>
            </div>
            <button className="w-full mt-4 py-2 bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-body rounded-lg text-sm font-bold transition-colors">
              Test GS1 Allocation Integrity
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const LabelPrinting = () => {
  return (
    <div className="space-y-6">
      <div className="border-b border-theme-divider pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-body flex items-center gap-2">
            <Printer className="text-indigo-400" />
            Label Printing
          </h2>
          <p className="text-xs text-theme-muted mt-1">Multi-format template support for standard A4 and Thermal printers.</p>
        </div>
        <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-lg flex items-center gap-2">
          <Printer size={16} /> Batch Print Run
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
           <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 flex gap-4">
             <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold text-theme-muted uppercase">Print Source</label>
                <select className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option>Purchase Order (PO-26-045)</option>
                  <option>Goods Receipt Note (GRN)</option>
                  <option>Manual Item Selection</option>
                </select>
             </div>
             <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold text-theme-muted uppercase">Template</label>
                <select className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option>Standard Product Label (50x25mm)</option>
                  <option>Shelf Price Tag (75x50mm)</option>
                  <option>Carton GS1 Label (100x150mm)</option>
                  <option>A4 Avery Standard (3x7 grid)</option>
                </select>
             </div>
           </div>

           <div className="border border-theme-divider rounded-xl overflow-hidden bg-theme-surface-1 shadow-md">
             <table className="w-full text-left text-xs">
               <thead className="bg-theme-surface-2 border-b border-theme-divider">
                 <tr className="uppercase tracking-wider font-mono text-[10px] text-theme-muted">
                   <th className="px-4 py-3"><input type="checkbox" defaultChecked className="rounded bg-theme-surface-3" /></th>
                   <th className="px-4 py-3">Item Name</th>
                   <th className="px-4 py-3">Barcode Value</th>
                   <th className="px-4 py-3 w-24 text-right">Copies</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-theme-divider">
                 {[1,2,3,4].map((i) => (
                   <tr key={i} className="hover:bg-theme-surface-2 transition-colors">
                     <td className="px-4 py-3"><input type="checkbox" defaultChecked className="rounded bg-theme-surface-3" /></td>
                     <td className="px-4 py-3 font-bold text-theme-body">Product Variant {i}</td>
                     <td className="px-4 py-3 font-mono text-indigo-400">89012345600{i}5</td>
                     <td className="px-4 py-3">
                       <input type="number" defaultValue={i * 5} className="w-full text-right bg-theme-surface-3 border border-theme-divider rounded px-2 py-1 text-sm focus:outline-none focus:border-indigo-500" />
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>

        <div className="space-y-4">
           <h3 className="font-bold text-sm text-theme-body">Printer Profiles</h3>
           <div className="space-y-3">
             <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                <div className="flex justify-between items-start mb-2">
                   <div className="flex gap-2 items-center">
                     <Printer size={16} className="text-emerald-400" />
                     <span className="font-bold text-sm text-theme-body">Zebra ZD421</span>
                   </div>
                   <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded uppercase">Ready</span>
                </div>
                <div className="text-xs text-theme-muted font-mono">192.168.1.45:9100</div>
                <div className="text-xs text-theme-muted mt-1">ZPL Protocol</div>
             </div>
             
             <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
                <div className="flex justify-between items-start mb-2">
                   <div className="flex gap-2 items-center">
                     <Printer size={16} className="text-amber-400" />
                     <span className="font-bold text-sm text-theme-body">TSC TE244</span>
                   </div>
                   <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-bold rounded uppercase">Standby</span>
                </div>
                <div className="text-xs text-theme-muted font-mono">USB / COM4</div>
                <div className="text-xs text-theme-muted mt-1">TSPL Protocol</div>
             </div>
             
             <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl opacity-60">
                <div className="flex justify-between items-start mb-2">
                   <div className="flex gap-2 items-center">
                     <FileText size={16} className="text-theme-muted" />
                     <span className="font-bold text-sm text-theme-body">PDF Export</span>
                   </div>
                </div>
                <div className="text-xs text-theme-muted">Virtual A4 Renderer</div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const ScannerConsole = ({ masterData }: { masterData: BarcodeRecord[] }) => {
  const [scanInput, setScanInput] = useState("");
  const [lastScanned, setLastScanned] = useState<{ value: string, type: string } | null>(null);
  const [log, setLog] = useState<{ time: string, message: string, status: "success"|"error" }[]>([
    { time: "14:32:01", message: "SUCCESS: EAN-13 [8901234560012] - Validated against master. Entity: Premium Headphones.", status: "success" }
  ]);

  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && scanInput.trim()) {
      const val = scanInput.trim();
      const match = masterData.find(b => b.value === val);
      
      const timeStr = new Date().toLocaleTimeString([], { hour12: false });
      
      if (match) {
        setLastScanned({ value: match.value, type: match.type });
        setLog([{ time: timeStr, message: `SUCCESS: ${match.type} [${match.value}] - Validated. Entity: ${match.entity}.`, status: "success" }, ...log]);
      } else {
        setLastScanned({ value: val, type: "Unknown" });
        setLog([{ time: timeStr, message: `ERROR: Unknown Format [${val}] - Not found in master registry.`, status: "error" }, ...log]);
      }
      setScanInput("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-theme-divider pb-4">
        <h2 className="text-xl font-bold font-display text-theme-body flex items-center gap-2">
          <Search className="text-indigo-400" />
          Scanner Validation Console
        </h2>
        <p className="text-xs text-theme-muted mt-1">Test hardware scanners and validate barcode integrity against the master database.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-6 shadow-inner">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={40} />
            </div>
            <div>
              <div className="font-bold text-lg text-theme-body">Ready to Scan</div>
              <div className="text-xs text-theme-muted mt-1">Listening for hardware wedge or USB input...</div>
            </div>
            <input 
               autoFocus 
               value={scanInput}
               onChange={e => setScanInput(e.target.value)}
               onKeyDown={handleScan}
               placeholder="Scan Barcode Here..." 
               className="w-full bg-theme-surface-1 border-2 border-indigo-500 text-theme-body rounded-xl px-4 py-4 text-center font-mono font-bold text-lg focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-md"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl">
               <div className="text-[10px] font-bold text-theme-muted uppercase mb-1">Last Scanned Value</div>
               <div className="font-mono font-bold text-indigo-400 text-lg">{lastScanned ? lastScanned.value : "--"}</div>
             </div>
             <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl">
               <div className="text-[10px] font-bold text-theme-muted uppercase mb-1">Detected Type</div>
               <div className="font-bold text-theme-body">{lastScanned ? lastScanned.type : "--"}</div>
             </div>
          </div>
        </div>

        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 flex flex-col h-96">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-theme-muted">Scan Event Log</h3>
            <button onClick={() => setLog([])} className="text-[10px] text-theme-muted hover:text-theme-body font-bold">Clear Log</button>
          </div>
          <div className="flex-1 bg-theme-surface-1 border border-theme-divider rounded-lg p-4 font-mono text-[10px] space-y-3 overflow-y-auto">
            {log.map((entry, idx) => (
              <div key={idx} className={`flex items-start gap-2 ${entry.status === 'success' ? (entry.message.includes('Code128') ? 'text-blue-400' : 'text-emerald-400') : 'text-rose-400 font-bold'}`}>
                <span className="shrink-0">[{entry.time}]</span>
                <span>{entry.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};


const BarcodeHistory = ({ masterData }: { masterData: BarcodeRecord[] }) => {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filter for generated internal barcodes
  const historyData = masterData.filter(b => b.mode === "Auto");
  
  const filteredData = historyData.filter(b => 
    b.value.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end border-b border-theme-divider pb-4">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-body flex items-center gap-2">
            <History className="text-indigo-400" />
            Barcode History
          </h2>
          <p className="text-xs text-theme-muted mt-1">Previously generated barcodes from the internal registry.</p>
        </div>
      </div>

      <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 flex gap-4 items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
          <input 
            type="text" 
            placeholder="Search by Barcode Value, Entity, or ID..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredData.length > 0 ? filteredData.map((b) => (
          <div key={b.id} className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded text-[10px] font-bold">
                {b.type}
              </span>
              <span className="text-xs text-theme-muted font-mono">{b.date}</span>
            </div>
            
            <div className="text-center py-4 bg-theme-surface-1 border border-theme-divider rounded-lg">
               <Barcode size={48} strokeWidth={1} className="text-theme-body mx-auto" />
               <div className="mt-2 font-mono font-bold text-lg text-theme-body tracking-widest">{b.value}</div>
            </div>
            
            <div>
              <div className="text-[10px] font-bold text-theme-muted uppercase mb-0.5">Assigned Entity</div>
              <div className="font-semibold text-sm text-theme-body truncate">{b.entity}</div>
            </div>
            
            <button className="w-full mt-2 py-2 bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-body rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 border border-theme-divider">
              <Printer size={14} /> Reprint Label
            </button>
          </div>
        )) : (
          <div className="col-span-full py-12 text-center text-theme-muted">
             <History size={48} className="mx-auto mb-4 opacity-20" />
             <p className="text-sm font-semibold">No history found</p>
             <p className="text-xs mt-1">Try generating an internal barcode first or adjust your search.</p>
          </div>
        )}
      </div>
    </div>
  );
};
