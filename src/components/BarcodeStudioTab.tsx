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
 * * Version    : 3.32.0 (Barcode Studio V2.4a Spec)
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-25
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { 
  Barcode, QrCode, Printer, Settings, Search, Plus, 
  CheckCircle2, Database, ShieldCheck, Tag, FileText, 
  Box, History, Layers, AlertTriangle, Sparkles, RefreshCw, X, Eye, FileCode
} from "lucide-react";
import { BarcodeEngine, BarcodeRecord } from "../services/barcodeEngine.ts";
import { BarcodeLabel } from "../print_engine/templates/BarcodeLabel.tsx";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { UniversalLabelPrinterModal } from "./UniversalLabelPrinterModal.tsx";

/**
 * 4-Step Style Token Resolution Chain (ACP_BARCODE_003 / Section 8)
 * 1. variant_of (Parent Template SKU)
 * 2. custom_style_code
 * 3. style_no
 * 4. SKU Hyphen Split fallback (e.g. BBM-0001-6-BLK -> BBM-0001)
 */
export function resolveStyleToken(item: {
  variant_of?: string;
  custom_style_code?: string;
  style_no?: string;
  styleCode?: string;
  code?: string;
  sku?: string;
}): string {
  if (item.variant_of && item.variant_of.trim()) return item.variant_of.trim();
  if (item.custom_style_code && item.custom_style_code.trim()) return item.custom_style_code.trim();
  if (item.style_no && item.style_no.trim()) return item.style_no.trim();
  if (item.styleCode && item.styleCode.trim()) return item.styleCode.trim();
  
  const rawSku = item.code || item.sku || "";
  if (rawSku.includes("-")) {
    const parts = rawSku.split("-");
    if (parts.length >= 2) return `${parts[0]}-${parts[1]}`;
    return parts[0];
  }
  return rawSku || "STYLE-001";
}

export interface BarcodeWorksheetRow {
  selected: boolean;
  styleCode: string;
  variantSku: string;
  name: string;
  barcode: string;
  costPrice: number;
  price: number;
  mrp: number;
  stockQty: number;
  boxRule: "single" | "box6" | "carton12" | "case24" | "masterGS1";
  labelCopies: number;
}

export interface PrintBatchJob {
  id: string;
  timestamp: string;
  source: string;
  template: string;
  totalLabels: number;
  itemsCount: number;
  status: "Completed" | "Pending" | "Failed";
  protocol: "ZPL" | "TSPL" | "PDF";
  items: Array<{ sku: string; barcode: string; copies: number }>;
  zplPayload?: string;
}

interface BarcodeStudioTabProps {
  currentUser?: { role: string; name: string } | null;
}

export const BarcodeStudioTab: React.FC<BarcodeStudioTabProps> = ({ currentUser }) => {
  const isReadOnly = currentUser?.role === "Report User";
  const [activeView, setActiveView] = useState<
    "master" | "generator" | "history" | "settings" | "printing" | "scanner" | "demo"
  >("master");

  useEffect(() => {
    recordAuditAction("VIEW", "barcodes", activeView, `Switched barcode studio view to: ${activeView}`);
  }, [activeView]);

  const [masterData, setMasterData] = useState<BarcodeRecord[]>([
    { id: "BC-1001", value: "8901234560012", type: "Internal EAN-13", mode: "Auto", entity: "BBM-0001 (Mens Casual Shoes)", status: "Active", date: "2026-07-01" },
    { id: "BC-1002", value: "012345678905", type: "UPC-A", mode: "Imported", entity: "STL-101 (Wireless Headset)", status: "Active", date: "2026-07-02" },
    { id: "BC-1003", value: "(01)08901234560012(10)B123", type: "GS1-128", mode: "GS1 Professional", entity: "PHARM-B500 (Pharma Batch)", status: "Active", date: "2026-07-05" },
    { id: "BC-1004", value: "INT-SKU-902", type: "Code128", mode: "Auto", entity: "BIN-004 (Internal Bin)", status: "Active", date: "2026-07-09" }
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
    <div className="flex h-full gap-4 relative font-mono text-xs">
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 50, x: "-50%" }}
            className={`absolute bottom-6 left-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl border flex items-center gap-3 ${
              notification.type === "success" 
                ? "bg-emerald-950 text-emerald-200 border-emerald-500/40" 
                : "bg-rose-950 text-rose-200 border-rose-500/40"
            }`}
          >
            {notification.type === "success" ? <CheckCircle2 className="text-emerald-400" /> : <AlertTriangle className="text-rose-400" />}
            <div>
              <div className="font-bold text-sm">{notification.title}</div>
              <div className="text-xs opacity-80">{notification.message}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <div className="w-60 shrink-0 bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-xl p-4 flex flex-col h-[calc(100vh-140px)]">
        <div className="flex items-center gap-2 text-theme-body font-display font-bold text-lg mb-4 px-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Barcode size={18} />
          </div>
          <div>
            <span>Barcode Studio</span>
            <span className="text-[10px] font-mono text-indigo-300 block -mt-1">V2.4a Spec</span>
          </div>
        </div>

        <nav className="space-y-1">
          <NavItem icon={<Database />} label="Barcode Master" active={activeView === "master"} onClick={() => setActiveView("master")} />
          <NavItem icon={<Plus />} label="Generate Barcode" active={activeView === "generator"} onClick={() => setActiveView("generator")} />
          <NavItem icon={<Printer />} label="Label Printing V2.4a" active={activeView === "printing"} onClick={() => setActiveView("printing")} />
          <NavItem icon={<Tag />} label="Barcode Demo" active={activeView === "demo"} onClick={() => setActiveView("demo")} />
          <NavItem icon={<Search />} label="Scanner Console & SRS" active={activeView === "scanner"} onClick={() => setActiveView("scanner")} />
          <NavItem icon={<History />} label="Reprint Queue History" active={activeView === "history"} onClick={() => setActiveView("history")} />
        </nav>
        
        <div className="mt-auto space-y-1 pt-4 border-t border-theme-divider">
          <NavItem icon={<Settings />} label="Engine Settings" active={activeView === "settings"} onClick={() => setActiveView("settings")} />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-xl overflow-hidden flex flex-col h-[calc(100vh-140px)]">
        {isReadOnly && (
          <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2.5 flex items-center space-x-2 text-amber-400 text-xs">
            <AlertTriangle size={14} />
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
              {activeView === "printing" && <LabelPrintingV24a onNotification={showNotification} />}
              {activeView === "demo" && <BarcodeDemo />}
              {activeView === "scanner" && <ScannerConsole masterData={masterData} />}
              {activeView === "history" && <ReprintQueueHistory />}
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
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all font-semibold ${
      active 
        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-bold shadow-md" 
        : "text-theme-muted hover:text-theme-body hover:bg-theme-surface-2 border border-transparent"
    }`}
  >
    <div className={active ? "text-indigo-400" : "text-theme-muted"}>
      {React.cloneElement(icon, { size: 16 })}
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
            Barcode Master Registry
          </h2>
          <p className="text-xs text-theme-muted mt-1">Authoritative system-of-record ledger of all catalog barcodes and GS1 tokens.</p>
        </div>
        <button className="px-3 py-1.5 bg-theme-surface-3 border border-theme-divider rounded-lg text-xs font-semibold hover:bg-theme-surface-hover flex items-center gap-2 text-theme-body">
          <FileText size={14} /> Export Registry (CSV)
        </button>
      </div>

      <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 flex gap-4 items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
          <input 
            type="text" 
            placeholder="Search Barcode Value, Entity, or ID..." 
            className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg pl-9 pr-4 py-2 text-xs font-mono outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <select className="bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-xs font-mono outline-none">
          <option>All Generation Modes</option>
          <option>Internal Barcode</option>
          <option>Imported Existing</option>
          <option>GS1 Professional</option>
        </select>
      </div>

      <div className="border border-theme-divider rounded-xl overflow-hidden bg-theme-surface-1 shadow-md">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-theme-surface-2 border-b border-theme-divider text-[10px] uppercase text-theme-muted font-bold">
            <tr>
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
              <tr key={b.id} className="hover:bg-theme-surface-2 transition-colors text-theme-body">
                <td className="px-4 py-3 font-bold text-indigo-400">{b.id}</td>
                <td className="px-4 py-3 font-bold text-amber-300">{b.value}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    b.mode === 'Auto' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 
                    b.mode === 'Imported' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  }`}>
                    {b.mode}
                  </span>
                </td>
                <td className="px-4 py-3">{b.type}</td>
                <td className="px-4 py-3 font-semibold text-slate-200">{b.entity}</td>
                <td className="px-4 py-3 text-theme-muted">{b.date}</td>
                <td className="px-4 py-3 text-center">
                  <ShieldCheck size={14} className="text-emerald-400 mx-auto" />
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
  const [internalEntity, setInternalEntity] = useState("BBM-0001 (Mens Casual Shoes)");
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

  return (
    <div className="space-y-6">
      <div className="border-b border-theme-divider pb-4">
        <h2 className="text-xl font-bold font-display text-theme-body flex items-center gap-2">
          <Plus className="text-indigo-400" />
          Universal Barcode Engine
        </h2>
        <p className="text-xs text-theme-muted mt-1">Configure & generate GTIN-13, EAN-8, GS1-128, or GS1 Digital Link QR tokens.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ModeCard 
          title="Internal Barcode" 
          desc="Auto-generate EAN-13 internal barcodes with check digit validation." 
          icon={<Barcode />} 
          active={engineMode === "internal"} 
          onClick={() => setEngineMode("internal")}
        />
        <ModeCard 
          title="Imported Barcode" 
          desc="Validate existing vendor EAN, UPC, Code39, or Code128 values." 
          icon={<FileText />} 
          active={engineMode === "imported"} 
          onClick={() => setEngineMode("imported")}
        />
        <ModeCard 
          title="GS1 Professional" 
          desc="Configure GS1 Company Prefix, GTIN, GS1-128, SSCC, and GLN." 
          icon={<Box />} 
          active={engineMode === "gs1"} 
          onClick={() => setEngineMode("gs1")}
        />
        <ModeCard 
          title="GS1 QR Code" 
          desc="Encode GS1 Digital Link URIs into scannable mobile QR codes." 
          icon={<QrCode />} 
          active={engineMode === "qrcode"} 
          onClick={() => setEngineMode("qrcode")}
        />
      </div>

      <div className="bg-theme-surface-2 border border-theme-divider rounded-2xl p-6 shadow-sm">
        {engineMode === "internal" && (
          <div className="space-y-4 font-mono">
            <h3 className="text-sm font-bold text-theme-body">Generate Internal EAN-13</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Target Entity / SKU</label>
                  <input 
                    type="text"
                    value={internalEntity}
                    onChange={e => setInternalEntity(e.target.value)}
                    className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">Internal Prefix (EAN 200 Series)</label>
                  <input type="text" defaultValue="200" className="w-full bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-xs font-mono outline-none" readOnly />
                </div>
                <button onClick={handleGenerateInternal} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-lg flex justify-center items-center gap-2 cursor-pointer transition-colors">
                  <Plus size={14} /> Auto-Generate EAN-13 Barcode
                </button>
              </div>
              <div className="border border-theme-divider bg-theme-surface-1 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                 <Barcode size={80} strokeWidth={1} className={`${internalPreview ? 'text-indigo-400' : 'text-theme-body opacity-20'}`} />
                 {internalPreview ? (
                   <div className="mt-4 font-mono font-bold text-base text-amber-300 tracking-widest">{internalPreview}</div>
                 ) : (
                   <p className="text-[11px] text-theme-muted mt-4">Preview will appear here after generation.<br/>Check digit computed automatically.</p>
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
    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
      active 
        ? "bg-indigo-600/10 border-indigo-500/40 shadow-lg shadow-indigo-500/10" 
        : "bg-theme-surface-2 border-theme-divider hover:bg-theme-surface-hover"
    }`}
  >
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${active ? 'bg-indigo-600 text-white' : 'bg-theme-surface-3 text-theme-muted'}`}>
      {React.cloneElement(icon, { size: 16 })}
    </div>
    <div className="font-bold text-xs text-theme-body mb-1">{title}</div>
    <div className="text-[10px] text-theme-muted leading-relaxed">{desc}</div>
  </div>
);

/**
 * ── BARCODE STUDIO V2.4a WORKSPACE CENTER (ACP_BARCODE_003) ───────────────────
 * Features:
 * 1. Article Range Loader (e.g. BBM-0001 to BBM-0010)
 * 2. Interactive 9-Column Fashion Variant Worksheet
 * 3. 4-Step Style Token Resolution Chain ({style})
 * 4. Box & Carton Multiplier Mode
 * 5. Persistent LocalStorage Reprint Queue
 */
const LabelPrintingV24a = ({ onNotification }: { onNotification: (t: string, m: string, type: "success"|"error") => void }) => {
  // Range Loader States
  const [rangeStart, setRangeStart] = useState("BBM-0001");
  const [rangeEnd, setRangeEnd] = useState("BBM-0005");
  const [selectedTemplate, setSelectedTemplate] = useState("Standard Product Tag (50x25mm)");
  const [selectedProtocol, setSelectedProtocol] = useState<"ZPL" | "TSPL" | "PDF">("ZPL");
  const [showUniversalPrinter, setShowUniversalPrinter] = useState<boolean>(false);

  // 9-Column Interactive Worksheet Grid State
  const [worksheet, setWorksheet] = useState<BarcodeWorksheetRow[]>([
    { selected: true, styleCode: "BBM-0001", variantSku: "BBM-0001-6-BLK", name: "Mens Casual Footwear (Black / 6)", barcode: "8901234560015", costPrice: 450, price: 899, mrp: 1199, stockQty: 24, boxRule: "carton12", labelCopies: 2 },
    { selected: true, styleCode: "BBM-0001", variantSku: "BBM-0001-7-BLK", name: "Mens Casual Footwear (Black / 7)", barcode: "8901234560022", costPrice: 450, price: 899, mrp: 1199, stockQty: 36, boxRule: "carton12", labelCopies: 3 },
    { selected: true, styleCode: "BBM-0002", variantSku: "BBM-0002-8-BRN", name: "Mens Oxford Leather (Brown / 8)", barcode: "8901234560039", costPrice: 650, price: 1499, mrp: 1899, stockQty: 18, boxRule: "single", labelCopies: 18 },
    { selected: true, styleCode: "STL-101", variantSku: "STL-101-L-BLU", name: "Cotton Denim Shirt (Blue / L)", barcode: "8901234560046", costPrice: 380, price: 799, mrp: 999, stockQty: 12, boxRule: "box6", labelCopies: 2 },
  ]);

  // Article Range Loader Handler
  const handleLoadArticleRange = () => {
    // Generate sequential Article Range rows (e.g., BBM-0001 to BBM-0005)
    const matchStart = rangeStart.match(/^([A-Z]+-)(\d+)$/i);
    const matchEnd = rangeEnd.match(/^([A-Z]+-)(\d+)$/i);

    if (!matchStart || !matchEnd) {
      onNotification("Range Format Error", "Specify range as PREFIX-NUMERIC (e.g. BBM-0001 to BBM-0010)", "error");
      return;
    }

    const prefix = matchStart[1];
    const numStart = parseInt(matchStart[2], 10);
    const numEnd = parseInt(matchEnd[2], 10);

    if (numEnd < numStart || numEnd - numStart > 50) {
      onNotification("Range Boundary Limit", "Maximum range generation boundary is 50 styles per load.", "error");
      return;
    }

    const newRows: BarcodeWorksheetRow[] = [];
    const sizes = ["6", "7", "8", "9"];
    const colors = ["BLK", "BRN"];

    for (let i = numStart; i <= numEnd; i++) {
      const styleNumStr = String(i).padStart(matchStart[2].length, "0");
      const styleId = `${prefix}${styleNumStr}`;

      colors.forEach(c => {
        sizes.forEach(s => {
          const sku = `${styleId}-${s}-${c}`;
          const bcode = BarcodeEngine.generateInternalEAN13("200", Math.floor(Math.random() * 999999999));
          newRows.push({
            selected: true,
            styleCode: styleId,
            variantSku: sku,
            name: `Style ${styleId} (${c} / Size ${s})`,
            barcode: bcode,
            costPrice: 500,
            price: 999,
            mrp: 1299,
            stockQty: 12,
            boxRule: "carton12",
            labelCopies: 1
          });
        });
      });
    }

    setWorksheet(newRows);
    onNotification("Range Loader", `Loaded ${newRows.length} size-color variants across styles ${rangeStart} to ${rangeEnd}.`, "success");
  };

  // Box Rule Change Handler
  const handleBoxRuleChange = (idx: number, rule: "single" | "box6" | "carton12" | "case24" | "masterGS1") => {
    setWorksheet(prev => prev.map((row, i) => {
      if (i !== idx) return row;
      let multiplier = 1;
      if (rule === "box6") multiplier = Math.ceil(row.stockQty / 6);
      else if (rule === "carton12") multiplier = Math.ceil(row.stockQty / 12);
      else if (rule === "case24") multiplier = Math.ceil(row.stockQty / 24);
      else if (rule === "masterGS1") multiplier = 1;
      else multiplier = row.stockQty;

      return { ...row, boxRule: rule, labelCopies: multiplier };
    }));
  };

  // Total Labels Computation
  const selectedRows = worksheet.filter(r => r.selected);
  const totalLabelsToPrint = selectedRows.reduce((sum, r) => sum + r.labelCopies, 0);

  // Execute Batch Print Run
  const handleExecutePrintRun = () => {
    if (selectedRows.length === 0) {
      onNotification("Selection Empty", "Select at least one item row in the worksheet grid.", "error");
      return;
    }

    const batchId = `JOB-${Date.now()}`;
    const zplCode = selectedRows.map(r => `
^XA
^FO50,30^A0N,25,25^FDStyle: ${r.styleCode}^FS
^FO50,60^A0N,20,20^FD${r.name.substring(0, 24)}^FS
^FO50,90^BY2,2.0,50^BCN,50,Y,N,N^FD${r.barcode}^FS
^FO50,165^A0N,25,25^FDSell Rate: RS.${r.price}^FS
^PQ${r.labelCopies}
^XZ
    `).join("\n");

    const newJob: PrintBatchJob = {
      id: batchId,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      source: "Barcode Studio V2.4a Worksheet",
      template: selectedTemplate,
      totalLabels: totalLabelsToPrint,
      itemsCount: selectedRows.length,
      status: "Completed",
      protocol: selectedProtocol,
      items: selectedRows.map(r => ({ sku: r.variantSku, barcode: r.barcode, copies: r.labelCopies })),
      zplPayload: zplCode
    };

    // Save to LocalStorage Reprint Queue
    const existing = localStorage.getItem("smriti_barcode_reprint_queue");
    const queueList: PrintBatchJob[] = existing ? JSON.parse(existing) : [];
    localStorage.setItem("smriti_barcode_reprint_queue", JSON.stringify([newJob, ...queueList.slice(0, 19)]));

    onNotification("Batch Print Dispatched", `Sent ${totalLabelsToPrint} labels across ${selectedRows.length} SKUs to ${selectedProtocol} hardware engine.`, "success");
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="border-b border-theme-divider pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-body flex items-center gap-2">
            <Printer className="text-indigo-400" />
            Barcode Studio V2.4a Operations Workspace
          </h2>
          <p className="text-xs text-theme-muted mt-1">Widescreen 3-panel warehouse printing grid with Article Range Loader & Box Packing Rules.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowUniversalPrinter(true)}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer transition-all"
          >
            <Sparkles size={16} /> Open Universal Label Engine
          </button>
          <button onClick={handleExecutePrintRun} className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 cursor-pointer transition-all">
            <Printer size={16} /> Batch Print Run ({totalLabelsToPrint} Labels)
          </button>
        </div>
      </div>

      {/* Panel 1: Article Range Loader & Output Controls */}
      <div className="bg-theme-surface-2 border border-theme-divider rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <span className="text-[10px] text-indigo-400 font-bold uppercase block">1. Article / Style Range Loader</span>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={rangeStart}
              onChange={e => setRangeStart(e.target.value)}
              placeholder="From: BBM-0001" 
              className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-indigo-500" 
            />
            <input 
              type="text" 
              value={rangeEnd}
              onChange={e => setRangeEnd(e.target.value)}
              placeholder="To: BBM-0005" 
              className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-indigo-500" 
            />
          </div>
          <button onClick={handleLoadArticleRange} className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-md flex items-center justify-center gap-1">
            <Sparkles size={13} /> Generate & Expand Style Boundary
          </button>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">2. Label Layout Template</span>
          <select 
            value={selectedTemplate}
            onChange={e => setSelectedTemplate(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none"
          >
            <option>Standard Product Tag (50x25mm)</option>
            <option>Footwear Box Label (75x50mm)</option>
            <option>Carton Outer GS1-128 (100x150mm)</option>
            <option>A4 Avery Standard (3x7 grid)</option>
          </select>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">3. Hardware Protocol Engine</span>
          <div className="grid grid-cols-3 gap-2">
            {(["ZPL", "TSPL", "PDF"] as const).map((proto) => (
              <button
                key={proto}
                onClick={() => setSelectedProtocol(proto)}
                className={`py-2 rounded-lg text-xs font-bold border ${selectedProtocol === proto ? "bg-indigo-600 border-indigo-400 text-white" : "bg-slate-900 border-slate-800 text-slate-400"}`}
              >
                {proto}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Panel 2: Interactive 9-Column Fashion Variant Worksheet Grid */}
      <div className="border border-theme-divider rounded-2xl overflow-hidden bg-theme-surface-1 shadow-lg space-y-2">
        <div className="px-4 py-3 bg-theme-surface-3 border-b border-theme-divider flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-bold text-xs text-white">Worksheet Grid ({selectedRows.length} / {worksheet.length} Rows Selected)</span>
            <button onClick={() => setWorksheet(prev => prev.map(r => ({ ...r, selected: true })))} className="text-[10px] text-indigo-400 hover:underline font-bold">Select All</button>
            <button onClick={() => setWorksheet(prev => prev.map(r => ({ ...r, selected: false })))} className="text-[10px] text-slate-400 hover:underline">Clear</button>
          </div>
          <span className="text-[11px] font-bold text-emerald-400">Total Labels: {totalLabelsToPrint} Copies</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900 border-b border-slate-800 text-[10px] uppercase text-slate-400 font-bold">
              <tr>
                <th className="px-3 py-2 text-center">Sel</th>
                <th className="px-3 py-2">Style ({'{style}'})</th>
                <th className="px-3 py-2">Variant SKU</th>
                <th className="px-3 py-2">Item Name</th>
                <th className="px-3 py-2">Barcode</th>
                <th className="px-3 py-2 text-right">Cost / Rate / MRP</th>
                <th className="px-3 py-2 text-right">Stock</th>
                <th className="px-3 py-2">Box / Packing Rule</th>
                <th className="px-3 py-2 text-right w-24">Labels</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {worksheet.map((r, idx) => {
                const resolvedStyle = resolveStyleToken({ styleCode: r.styleCode, sku: r.variantSku });
                return (
                  <tr key={idx} className={`hover:bg-slate-900/60 ${r.selected ? "bg-indigo-950/20" : "opacity-60"}`}>
                    <td className="px-3 py-2 text-center">
                      <input 
                        type="checkbox" 
                        checked={r.selected} 
                        onChange={e => setWorksheet(prev => prev.map((row, i) => i === idx ? { ...row, selected: e.target.checked } : row))} 
                        className="rounded bg-slate-900 border-slate-700" 
                      />
                    </td>
                    <td className="px-3 py-2 font-bold text-amber-300">{resolvedStyle}</td>
                    <td className="px-3 py-2 text-indigo-300 font-bold">{r.variantSku}</td>
                    <td className="px-3 py-2 text-white truncate max-w-xs">{r.name}</td>
                    <td className="px-3 py-2 font-bold text-emerald-400">{r.barcode}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-slate-400">₹{r.costPrice}</span> / <strong className="text-emerald-400">₹{r.price}</strong> / <span className="text-white">₹{r.mrp}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-white">{r.stockQty}</td>
                    <td className="px-3 py-2">
                      <select 
                        value={r.boxRule} 
                        onChange={e => handleBoxRuleChange(idx, e.target.value as any)}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-white outline-none"
                      >
                        <option value="single">Single (1:1)</option>
                        <option value="box6">6-Pack Box (1/6)</option>
                        <option value="carton12">12-Pair Carton (1/12)</option>
                        <option value="case24">24-Pair Case (1/24)</option>
                        <option value="masterGS1">Master Outer GS1 (1)</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input 
                        type="number" 
                        min="1" 
                        value={r.labelCopies} 
                        onChange={e => setWorksheet(prev => prev.map((row, i) => i === idx ? { ...row, labelCopies: parseInt(e.target.value) || 1 } : row))}
                        className="w-16 text-right bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-bold outline-none focus:border-indigo-500" 
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      {/* Universal Label Printer Modal */}
      <UniversalLabelPrinterModal
        isOpen={showUniversalPrinter}
        onClose={() => setShowUniversalPrinter(false)}
        moduleSource="Barcode Studio V2.4a"
        onNotification={onNotification}
        items={worksheet.map(r => ({
          id: r.variantSku,
          item_code: r.styleCode,
          barcode: r.barcode,
          sku: r.variantSku,
          name: r.name,
          cost_price: r.costPrice,
          price: r.price,
          mrp: r.mrp,
          stock_qty: r.stockQty,
          received_qty: r.stockQty,
          sold_qty: 0,
          style_code: r.styleCode
        }))}
      />
    </div>
  );
};

const BarcodeDemo = () => {
  const demoData = {
    items: [
      { name: "BBM-0001 Mens Casual Shoes", rate: 899, barcode: "8901234560015" }
    ]
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="border-b border-theme-divider pb-4">
        <h2 className="text-xl font-bold font-display text-theme-body flex items-center gap-2">
          <Tag className="text-indigo-400" />
          Barcode Label Preview Studio
        </h2>
        <p className="text-xs text-theme-muted mt-1">Live visual rendering engine for ZPL / TSPL label layout verification.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-theme-surface-2 border border-theme-divider rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-theme-body">Label Specs & Token Resolution</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-800 pb-1"><span className="text-slate-400">Article Style ({'{style}'}):</span><span className="font-bold text-amber-300">BBM-0001</span></div>
            <div className="flex justify-between border-b border-slate-800 pb-1"><span className="text-slate-400">Variant SKU ({'{sku}'}):</span><span className="font-bold text-indigo-300">BBM-0001-6-BLK</span></div>
            <div className="flex justify-between border-b border-slate-800 pb-1"><span className="text-slate-400">Barcode EAN-13 ({'{barcode}'}):</span><span className="font-bold text-emerald-400">8901234560015</span></div>
            <div className="flex justify-between border-b border-slate-800 pb-1"><span className="text-slate-400">Selling Price ({'{rate}'}):</span><span className="font-bold text-white">₹899.00</span></div>
          </div>
        </div>

        <div className="border border-theme-divider rounded-3xl bg-theme-surface-1 p-6 flex items-center justify-center">
          <div className="max-w-[55mm]">
            <BarcodeLabel data={demoData} />
          </div>
        </div>
      </div>
    </div>
  );
};

const EngineSettings = () => {
  return (
    <div className="max-w-4xl space-y-8 font-mono text-xs">
      <div className="border-b border-theme-divider pb-4">
        <h2 className="text-xl font-bold font-display text-theme-body flex items-center gap-2">
          <Settings className="text-indigo-400" />
          Barcode Engine Rules & Settings
        </h2>
        <p className="text-xs text-theme-muted mt-1">Configure global rules for GS1 prefixes, check digits, and token resolution.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-sm text-theme-body border-b border-theme-divider pb-2">Internal Barcode Rules</h3>
          <label className="flex items-start gap-3">
            <input type="checkbox" defaultChecked className="mt-1 rounded bg-theme-surface-3" />
            <div>
              <div className="font-bold text-theme-body">Auto-Generate on Item Creation</div>
              <div className="text-[10px] text-theme-muted">Creates an internal EAN-13 barcode if no barcode is specified.</div>
            </div>
          </label>
        </div>

        <div className="bg-theme-surface-2 border border-purple-500/30 rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-sm text-purple-400 border-b border-theme-divider pb-2">GS1 Company Prefix Rules</h3>
          <div>
            <label className="text-[10px] font-bold text-theme-muted uppercase block mb-1">GS1 Company Prefix</label>
            <input type="text" defaultValue="8901234" className="w-full bg-theme-surface-1 border border-theme-divider rounded px-3 py-1.5 text-xs font-mono outline-none" />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * ── REPRINT QUEUE HISTORY (ACP_BARCODE_003) ──────────────────────────────────
 * Caches recent print job batches in LocalStorage with 1-click reprint capabilities.
 */
const ReprintQueueHistory = () => {
  const [jobs, setJobs] = useState<PrintBatchJob[]>([]);
  const [viewingJob, setViewingJob] = useState<PrintBatchJob | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("smriti_barcode_reprint_queue");
    if (raw) {
      try {
        setJobs(JSON.parse(raw));
      } catch {
        setJobs([]);
      }
    }
  }, []);

  const handleClearHistory = () => {
    localStorage.removeItem("smriti_barcode_reprint_queue");
    setJobs([]);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex justify-between items-end border-b border-theme-divider pb-4">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-body flex items-center gap-2">
            <History className="text-indigo-400" />
            Reprint Queue & Print Job History
          </h2>
          <p className="text-xs text-theme-muted mt-1">Caches recent warehouse print batches for instant 1-click reprinting.</p>
        </div>
        {jobs.length > 0 && (
          <button onClick={handleClearHistory} className="px-3 py-1.5 bg-rose-950/60 border border-rose-500/40 text-rose-300 rounded-lg text-xs font-bold hover:bg-rose-900 transition">
            Clear History Log
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobs.length > 0 ? jobs.map((job) => (
          <div key={job.id} className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 space-y-3 shadow-md">
            <div className="flex justify-between items-center">
              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[10px] font-bold">
                {job.protocol} Engine
              </span>
              <span className="text-[10px] text-theme-muted font-mono">{job.timestamp}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Job Batch ID</span>
              <span className="font-bold text-amber-300 text-sm">{job.id}</span>
            </div>

            <div className="text-[11px] space-y-1 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
              <div className="flex justify-between"><span className="text-slate-400">Template:</span><span className="text-white font-bold truncate max-w-[140px]">{job.template}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Items:</span><span className="text-indigo-300 font-bold">{job.itemsCount} SKUs</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Total Labels:</span><span className="text-emerald-400 font-bold">{job.totalLabels} Copies</span></div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setViewingJob(job)} 
                className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-xs flex items-center justify-center gap-1 border border-slate-700"
              >
                <FileCode size={13} /> View ZPL
              </button>
              <button 
                onClick={() => alert(`Reprinting Job ${job.id} (${job.totalLabels} labels)...`)} 
                className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow-md"
              >
                <Printer size={13} /> Reprint
              </button>
            </div>
          </div>
        )) : (
          <div className="col-span-full py-12 text-center text-theme-muted">
             <History size={48} className="mx-auto mb-4 opacity-20" />
             <p className="text-sm font-semibold">No print history jobs found</p>
             <p className="text-xs mt-1">Execute a batch print run from the Label Printing V2.4a tab to build reprint history.</p>
          </div>
        )}
      </div>

      {/* ZPL Code Inspector Modal */}
      {viewingJob && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#141720] border border-indigo-500/40 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-[#1a1e2b] border-b border-indigo-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode size={16} className="text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Hardware Output — {viewingJob.id}</h3>
              </div>
              <button onClick={() => setViewingJob(null)} className="p-1 text-slate-400 hover:text-white"><X size={16} /></button>
            </div>

            <div className="p-6 space-y-3 font-mono text-xs">
              <span className="text-[10px] text-slate-400 uppercase block font-bold">Direct Thermal Command Code ({viewingJob.protocol})</span>
              <textarea 
                readOnly 
                value={viewingJob.zplPayload || "^XA\n^FO50,50^A0N,30,30^FDDEMO PRINT^FS\n^XZ"} 
                className="w-full h-48 bg-slate-950 border border-slate-800 rounded-xl p-3 text-emerald-400 font-mono text-[11px] outline-none"
              />
            </div>

            <div className="px-6 py-4 bg-[#1a1e2b] border-t border-indigo-500/20 flex justify-end gap-3">
              <button onClick={() => setViewingJob(null)} className="px-4 py-2 bg-slate-800 text-slate-300 text-xs rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * ── SCANNER CONSOLE & SCAN RELIABILITY SCORE (SRS) DIAGNOSTICS ─────────────────
 * Formula: SRS = ((FirstPassSuccesses + 0.5 * RetrySuccesses) / TotalScans) * 100
 */
const ScannerConsole = ({ masterData }: { masterData: BarcodeRecord[] }) => {
  const [scanInput, setScanInput] = useState("");
  const [lastScanned, setLastScanned] = useState<{ value: string, type: string } | null>(null);
  
  // Telemetry Metrics State
  const [firstPassScans, setFirstPassScans] = useState(14);
  const [retryScans, setRetryScans] = useState(2);
  const [failedScans, setFailedScans] = useState(1);
  const totalScans = firstPassScans + retryScans + failedScans;

  // SRS Math Score: SRS = ((FirstPass + 0.5 * Retry) / Total) * 100
  const srsScore = totalScans > 0 ? Math.round(((firstPassScans + 0.5 * retryScans) / totalScans) * 100) : 100;

  const [log, setLog] = useState<{ time: string, message: string, status: "success"|"error", eventCode: string }[]>([
    { time: "14:32:01", message: "SUCCESS: EAN-13 [8901234560012] - Validated against master ledger. Entity: BBM-0001.", status: "success", eventCode: "SCAN-EVT-001" }
  ]);

  const handleScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && scanInput.trim()) {
      const val = scanInput.trim();
      const match = masterData.find(b => b.value === val);
      const timeStr = new Date().toLocaleTimeString([], { hour12: false });
      
      if (match) {
        setFirstPassScans(prev => prev + 1);
        setLastScanned({ value: match.value, type: match.type });
        setLog([{ time: timeStr, message: `[SCAN-EVT-001] SUCCESS: ${match.type} [${match.value}] - Verified on First Pass. Entity: ${match.entity}.`, status: "success", eventCode: "SCAN-EVT-001" }, ...log]);
      } else {
        setFailedScans(prev => prev + 1);
        setLastScanned({ value: val, type: "Unknown" });
        setLog([{ time: timeStr, message: `[SCAN-EVT-003] ERROR: Unregistered Barcode [${val}] - Not found in ledger.`, status: "error", eventCode: "SCAN-EVT-003" }, ...log]);
      }
      setScanInput("");
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="border-b border-theme-divider pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-body flex items-center gap-2">
            <Search className="text-indigo-400" />
            Hardware Scanner Console & Telemetry Diagnostics
          </h2>
          <p className="text-xs text-theme-muted mt-1">Real-time scan event tracking (SCAN-EVT-001/002/003) and Scan Reliability Score (SRS) computation.</p>
        </div>

        {/* SRS Score Badge Gauge */}
        <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl flex items-center gap-3">
          <div className="text-right">
            <span className="text-[9px] text-slate-500 uppercase block font-bold">Scan Reliability Score ($SRS$)</span>
            <span className={`text-lg font-bold ${srsScore >= 90 ? "text-emerald-400" : srsScore >= 75 ? "text-amber-400" : "text-rose-400"}`}>
              {srsScore}% SRS
            </span>
          </div>
          <div className={`w-3 h-3 rounded-full ${srsScore >= 90 ? "bg-emerald-500 animate-pulse" : srsScore >= 75 ? "bg-amber-500" : "bg-rose-500"}`} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-6 shadow-inner">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <div className="font-bold text-base text-theme-body">Scanner Input Receiver Ready</div>
              <div className="text-[11px] text-theme-muted mt-1">Listening for hardware wedge or USB barcode scan...</div>
            </div>
            <input 
               autoFocus 
               value={scanInput}
               onChange={e => setScanInput(e.target.value)}
               onKeyDown={handleScan}
               placeholder="Scan Barcode Here..." 
               className="w-full bg-theme-surface-1 border-2 border-indigo-500 text-theme-body rounded-xl px-4 py-3.5 text-center font-mono font-bold text-base focus:outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all shadow-md"
            />
          </div>
          
          <div className="grid grid-cols-3 gap-3 text-center">
             <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
               <span className="text-[9px] font-bold text-emerald-400 uppercase block">SCAN-EVT-001 (Pass)</span>
               <span className="font-mono font-bold text-white text-base mt-0.5 block">{firstPassScans}</span>
             </div>
             <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
               <span className="text-[9px] font-bold text-amber-400 uppercase block">SCAN-EVT-002 (Retry)</span>
               <span className="font-mono font-bold text-white text-base mt-0.5 block">{retryScans}</span>
             </div>
             <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
               <span className="text-[9px] font-bold text-rose-400 uppercase block">SCAN-EVT-003 (Fail)</span>
               <span className="font-mono font-bold text-white text-base mt-0.5 block">{failedScans}</span>
             </div>
          </div>
        </div>

        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 flex flex-col h-96">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-theme-muted">Live Telemetry Scan Event Stream</h3>
            <button onClick={() => setLog([])} className="text-[10px] text-theme-muted hover:text-theme-body font-bold">Clear Log</button>
          </div>
          <div className="flex-1 bg-theme-surface-1 border border-theme-divider rounded-lg p-3 font-mono text-[11px] space-y-2 overflow-y-auto">
            {log.map((entry, idx) => (
              <div key={idx} className={`p-2 rounded border flex items-start gap-2 ${entry.status === 'success' ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' : 'bg-rose-950/20 border-rose-500/30 text-rose-300 font-bold'}`}>
                <span className="shrink-0 text-slate-500 text-[10px]">[{entry.time}]</span>
                <span>{entry.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
