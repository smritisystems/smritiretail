/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.7.0
 * Created      : 2026-08-21
 * Modified     : 2026-10-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Barcode Script Compiler & Direct Printer Dispatch Studio
 * Capability   : @SmritiCapability("BARCODE", "SCRIPT_COMPILER_PRINT")
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Code,
  Save,
  Upload,
  Maximize2,
  Minimize2,
  ArrowLeft,
  FileCode,
  LogOut,
  Sparkles,
  Sliders,
  Printer,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  Network,
  Usb,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  Send,
  Terminal,
  Info,
  FolderOpen,
  FileText,
  Search,
  Database,
  Package,
  Eye,
  Tag,
  X,
} from "lucide-react";
import { ScriptFieldIdentification } from "./types.ts";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import {
  isQzTrayEnabled,
  connectQzTray,
  testQzConnection,
  dispatchToQzTray,
} from "../../utils/qzTrayClient.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

type DispatchMode = "qz_tray" | "server_tcp" | "prn_download";

/** Minimal shape from GET /api/v1/inventory/search */
interface DbItem {
  id: number;
  name: string;
  barcode: string;
  style_code: string | null;
  color: string | null;
  size: string | null;
  mrp: number | string;
  brand: string | null;
  created_at: string | null;
}

/** Resolved placeholder map for script substitution */
type PlaceholderMap = Record<string, string>;

interface PrinterTarget {
  name: string;
  source: "qz_live" | "manual" | "fallback";
}

interface PrintDispatchState {
  status: "idle" | "connecting" | "printing" | "success" | "error";
  message: string;
  lastPrinter?: string;
}

const FALLBACK_PRINTERS: PrinterTarget[] = [
  { name: "IMPACT by Honeywell IH-2 (300 dpi) - DPL", source: "fallback" },
  { name: "TSC TE244 Thermal Barcode Printer", source: "fallback" },
  { name: "Zebra ZD421 Direct Thermal (USB)", source: "fallback" },
  { name: "Zebra ZD220 Direct Thermal Label", source: "fallback" },
  { name: "Citizen CL-S621 Network Printer", source: "fallback" },
  { name: "Generic Text / PRN Direct Spooler", source: "fallback" },
];

const LS_PRINTER_KEY = "smriti_script_compiler_printer";
const LS_MODE_KEY = "smriti_script_compiler_dispatch_mode";
const LS_TCP_IP_KEY = "smriti_script_compiler_tcp_ip";
const LS_TCP_PORT_KEY = "smriti_script_compiler_tcp_port";

// ─── PRN Script Library (served from /assets/prn/ via Vite public/) ──────────

interface PrnLibraryEntry {
  name: string;          // display label
  file: string;          // filename in /assets/prn/
  lang: "ZPL" | "DPL" | "BLF" | "PRN";
  description: string;
}

const PRN_LIBRARY: PrnLibraryEntry[] = [
  { name: "Tattly Threads — Footwear 3-Stub",        file: "TattlyThreads.prn",                             lang: "ZPL", description: "Full 3-stub footwear label: barcode, size, colour, MRP, brand" },
  { name: "Tattly Threads — Black 37",                file: "TATTLY_BLACK_37.prn",                           lang: "ZPL", description: "Pre-filled: BLACK, Size 37" },
  { name: "Tattly Threads — Black 40",                file: "TATTLY_BLACK_40.prn",                           lang: "ZPL", description: "Pre-filled: BLACK, Size 40" },
  { name: "Tattly Threads — Toupe 37",                file: "TATTLY_TOUPE_37.prn",                           lang: "ZPL", description: "Pre-filled: TOUPE, Size 37" },
  { name: "Tattly Threads — Toupe 42",                file: "TATTLY_TOUPE_42.prn",                           lang: "ZPL", description: "Pre-filled: TOUPE, Size 42" },
  { name: "Tattly CH-30-K Black 37 (Corrected)",      file: "TATTLY_CH-30-K_BLACK_37_CORRECTED.prn",         lang: "ZPL", description: "Corrected version — CH-30-K, BLACK, 37" },
  { name: "Tattly SND-18-V Black 37 (Corrected)",     file: "TATTLY_SND-18-V_BLACK_37_CORRECTED.prn",        lang: "ZPL", description: "Corrected version — SND-18-V, BLACK, 37" },
  { name: "Footwear 100×50 3-Stub Layout",            file: "smriti_labels_lay-footwear-100x50-3stub_1791617855968.prn", lang: "ZPL", description: "Generic footwear 100×50mm 3-stub" },
  { name: "Raw PRN Script (General)",                  file: "RawPRNScript.prn",                             lang: "PRN", description: "General-purpose raw PRN template" },
  { name: "Honeywell IH-2 Label (A)",                 file: "Honeywell_IH2_Labels_1791612531188.prn",        lang: "DPL", description: "Honeywell IH-2 DPL label variant A" },
  { name: "Honeywell IH-2 Label (B)",                 file: "Honeywell_IH2_Labels_1791617952352.prn",        lang: "DPL", description: "Honeywell IH-2 DPL label variant B" },
  { name: "Modern Label Design TE244",                file: "ModernLabelDesign_TE244.blf",                   lang: "BLF", description: "TSC TE244 BLF script with macro tokens" },
];

const TATTLY_DEFAULT_URL = "/assets/prn/TattlyThreads.prn";

// ─── Default Sample Script (fallback if fetch fails) ─────────────────────────

const DEFAULT_SAMPLE_SCRIPT = `@@@01;02;02;03;04@@@^XA
^PRB
^LH0,0^FS
^LL200
^MD8
^MNY
^LH0,0^FS
^CWI,T0NPJYZV.FNT^FS
^FO107,81^AJN,27,0^CI0^FR^FD@@@02;02;02;01;16@@@^FS
^CWJ,P0NPJYZV.FNT^FS
^FO102,111^AJN,24,0^CI0^FR^FD@@@04;02;02;01;16@@@^FS
^CWJ,P0NPJYZV.FNT^FS
^FO102,136^AJN,24,0^CI0^FR^FD@@@06;02;02;01;16@@@^FS
^CWJ,P0NPJYZV.FNT^FS
^FO102,160^AJN,24,0^CI0^FR^FD@@@08;02;02;01;16@@@^FS
^CWJ,P0NPJYZV.FNT^FS
^FO142,187^AJN,24,0^CI0^FR^FD@@@01;01;02;10;02@@@^FS
^CWJ,P0NPJYZV.FNT^FS
^FO101,187^AJN,24,0^CI0^FR^FD@@@01;02;02;01;16@@@^FS
^FO11,21^FR^XGXTXJFPOS,1,1^FS
^CWK,T0NPJYZV.FNT^FS
^XZ`;

// ─── Component ────────────────────────────────────────────────────────────────

interface BarcodeScriptGenerationViewProps {
  onBackToPrinting: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info") => void;
}

export const BarcodeScriptGenerationView: React.FC<BarcodeScriptGenerationViewProps> = ({
  onBackToPrinting,
  onNotification,
}) => {
  // ── Editor State ─────────────────────────────────────────────────────────
  const [scriptContent, setScriptContent] = useState<string>(DEFAULT_SAMPLE_SCRIPT);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [loadedFileName, setLoadedFileName] = useState<string>("ModernLabelDesign_TE244.blf");
  const [identConfig, setIdentConfig] = useState<ScriptFieldIdentification>({
    field: "Stock Number",
    direction: "From Left",
    startPosition: 3,
    numDigits: 4,
    textValue1: "",
    textValue2: "",
  });
  const [compilerStatus, setCompilerStatus] = useState<string>("Compiler Ready");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Printer Dispatch State ────────────────────────────────────────────────
  const [dispatchMode, setDispatchMode] = useState<DispatchMode>(
    () => (localStorage.getItem(LS_MODE_KEY) as DispatchMode) || "qz_tray"
  );
  const [selectedPrinter, setSelectedPrinter] = useState<string>(
    () => localStorage.getItem(LS_PRINTER_KEY) || FALLBACK_PRINTERS[0].name
  );
  const [tcpIp, setTcpIp] = useState<string>(
    () => localStorage.getItem(LS_TCP_IP_KEY) || "192.168.1.200"
  );
  const [tcpPort, setTcpPort] = useState<string>(
    () => localStorage.getItem(LS_TCP_PORT_KEY) || "9100"
  );
  const [printers, setPrinters] = useState<PrinterTarget[]>(FALLBACK_PRINTERS);
  const [qzConnected, setQzConnected] = useState<boolean>(false);
  const [qzVersion, setQzVersion] = useState<string>("");
  const [qzLoading, setQzLoading] = useState<boolean>(false);
  const [printDispatch, setPrintDispatch] = useState<PrintDispatchState>({
    status: "idle",
    message: "Ready to send script to printer",
  });
  const [copies, setCopies] = useState<number>(1);
  const [printerDropdownOpen, setPrinterDropdownOpen] = useState<boolean>(false);
  const [libraryOpen, setLibraryOpen] = useState<boolean>(false);
  const [libraryLoading, setLibraryLoading] = useState<string | null>(null);

  // ── DB Item Resolver state ───────────────────────────────────────────
  const [dbOpen, setDbOpen] = useState<boolean>(false);
  const [dbQuery, setDbQuery] = useState<string>("");
  const [dbResults, setDbResults] = useState<DbItem[]>([]);
  const [dbSearching, setDbSearching] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<DbItem | null>(null);
  const [resolvedScript, setResolvedScript] = useState<string>("");
  const [resolvedPreviewOpen, setResolvedPreviewOpen] = useState<boolean>(false);

  const lines = scriptContent.split("\n");

  // ── Detect script language from content ──────────────────────────────────
  const detectedLang = (() => {
    const upper = scriptContent.trimStart().toUpperCase();
    if (upper.startsWith("^XA") || upper.includes("^XA\n") || upper.includes("@@@")) return "ZPL";
    if (upper.startsWith("\x02L") || upper.startsWith("\\x02L")) return "DPL";
    if (upper.startsWith("SIZE") || upper.startsWith("GAP")) return "TSPL";
    if (upper.startsWith("\x1B") || upper.startsWith("\\ESC")) return "ESC/POS";
    return "RAW";
  })();

  // ── QZ Tray Discovery ─────────────────────────────────────────────────────
  const discoverQzPrinters = useCallback(async () => {
    if (!isQzTrayEnabled()) {
      setQzConnected(false);
      return;
    }
    setQzLoading(true);
    try {
      const result = await testQzConnection();
      if (result.connected) {
        setQzConnected(true);
        setQzVersion(result.version || "2.x");
        const livePrinters: PrinterTarget[] = (result.printers || []).map((n) => ({
          name: n,
          source: "qz_live" as const,
        }));
        if (livePrinters.length > 0) {
          setPrinters([...livePrinters, ...FALLBACK_PRINTERS]);
          // Auto-select preferred printer if not already a live one
          const saved = localStorage.getItem(LS_PRINTER_KEY);
          if (saved && result.printers.includes(saved)) {
            setSelectedPrinter(saved);
          } else {
            const preferred = result.printers.find((p) =>
              /honeywell|ih-2|zebra|tsc|citizen/i.test(p)
            );
            setSelectedPrinter(preferred || result.printers[0]);
          }
        } else {
          setPrinters(FALLBACK_PRINTERS);
        }
      } else {
        setQzConnected(false);
        setPrinters(FALLBACK_PRINTERS);
      }
    } catch {
      setQzConnected(false);
    } finally {
      setQzLoading(false);
    }
  }, []);

  useEffect(() => {
    void discoverQzPrinters();
  }, [discoverQzPrinters]);

  // ── Auto-load TattlyThreads.prn on first mount ────────────────────────────
  useEffect(() => {
    const loadDefault = async () => {
      try {
        const res = await fetch(TATTLY_DEFAULT_URL);
        if (!res.ok) return; // fallback to DEFAULT_SAMPLE_SCRIPT stays in place
        const text = await res.text();
        setScriptContent(text);
        setLoadedFileName("TattlyThreads.prn");
        setCompilerStatus("Loaded: TattlyThreads.prn");
        setPrintDispatch({ status: "idle", message: "TattlyThreads.prn loaded — ready to send to printer." });
      } catch {
        // silently fall back to the embedded DEFAULT_SAMPLE_SCRIPT
      }
    };
    void loadDefault();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load a PRN file from the library by URL ───────────────────────────────
  const loadScriptFromUrl = useCallback(async (entry: PrnLibraryEntry) => {
    setLibraryLoading(entry.file);
    try {
      const res = await fetch(`/assets/prn/${encodeURIComponent(entry.file)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setScriptContent(text);
      setLoadedFileName(entry.file);
      setCompilerStatus(`Loaded: ${entry.name}`);
      setPrintDispatch({ status: "idle", message: `${entry.name} loaded — ready to send to printer.` });
      setLibraryOpen(false);
      onNotification?.("Script Loaded", `${entry.name} loaded into editor.`, "success");
    } catch (err: any) {
      onNotification?.("Load Failed", `Could not load ${entry.file}: ${err?.message}`, "error");
    } finally {
      setLibraryLoading(null);
    }
  }, [onNotification]);

  // ── Search DB items ───────────────────────────────────────────────────────
  const searchDbItems = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setDbResults([]); return; }
    setDbSearching(true);
    try {
      const data = await apiFetchV1<DbItem[]>(`/inventory/search?q=${encodeURIComponent(q.trim())}&limit=12`);
      setDbResults(data || []);
    } catch {
      setDbResults([]);
    } finally {
      setDbSearching(false);
    }
  }, []);

  // Debounce the search
  useEffect(() => {
    if (!dbQuery) { setDbResults([]); return; }
    const t = setTimeout(() => void searchDbItems(dbQuery), 350);
    return () => clearTimeout(t);
  }, [dbQuery, searchDbItems]);

  // ── Resolve script placeholders from a DB item ─────────────────────────────
  const resolveScript = useCallback((item: DbItem): string => {
    const today = new Date();
    const pkd = today.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const map: PlaceholderMap = {
      "{barcode}":    item.barcode || "",
      "{size}":       item.size || "",
      "{colour}":     item.color || "",
      "{color}":      item.color || "",
      "{style_code}": item.style_code || "",
      "{mrp}":        String(item.mrp ?? ""),
      "{pkd_date}":   pkd,
      "{brand}":      item.brand || "",
      "{name}":       item.name || "",
    };
    let out = scriptContent;
    for (const [ph, val] of Object.entries(map)) {
      out = out.split(ph).join(val);
    }
    return out;
  }, [scriptContent]);

  // When item selected, resolve immediately
  const handleSelectItem = useCallback((item: DbItem) => {
    setSelectedItem(item);
    setDbResults([]);
    setDbQuery(item.name);
    const resolved = resolveScript(item);
    setResolvedScript(resolved);
    setResolvedPreviewOpen(true);
    setCompilerStatus(`Resolved: ${item.name} (${item.barcode})`);
    onNotification?.(
      "Item Resolved",
      `Script placeholders filled with: ${item.name} — ${item.barcode}`,
      "success"
    );
  }, [resolveScript, onNotification]);

  // Apply resolved script to editor
  const handleApplyResolvedToEditor = useCallback(() => {
    if (!resolvedScript) return;
    setScriptContent(resolvedScript);
    setResolvedPreviewOpen(false);
    setCompilerStatus(`Applied: ${selectedItem?.name || "Item"} — ready to print`);
    setPrintDispatch({ status: "idle", message: `Script resolved with real item data — ready to send to printer.` });
    onNotification?.("Applied to Editor", "Resolved script loaded into editor. Hit Send to Printer.", "success");
  }, [resolvedScript, selectedItem, onNotification]);

  // Persist selections
  useEffect(() => {
    localStorage.setItem(LS_PRINTER_KEY, selectedPrinter);
  }, [selectedPrinter]);
  useEffect(() => {
    localStorage.setItem(LS_MODE_KEY, dispatchMode);
  }, [dispatchMode]);
  useEffect(() => {
    localStorage.setItem(LS_TCP_IP_KEY, tcpIp);
  }, [tcpIp]);
  useEffect(() => {
    localStorage.setItem(LS_TCP_PORT_KEY, tcpPort);
  }, [tcpPort]);

  // ── Repeat payload for copies ─────────────────────────────────────────────
  const buildPayload = (): string => {
    const safeScript = scriptContent.trim();
    if (copies <= 1) return safeScript;
    return Array(copies).fill(safeScript).join("\n");
  };

  // ── Main Dispatch Handler ─────────────────────────────────────────────────
  const handleDispatchPrint = async () => {
    if (!scriptContent.trim()) {
      onNotification?.("Empty Script", "Load or write a PRN/ZPL script before printing.", "error");
      return;
    }

    setPrintDispatch({ status: "printing", message: "Sending script to printer…" });
    setCompilerStatus("Dispatching…");

    try {
      // ── MODE 1: PRN File Download ──────────────────────────────────────
      if (dispatchMode === "prn_download") {
        const payload = buildPayload();
        const ext = detectedLang === "TSPL" ? "tspl" : detectedLang === "DPL" ? "dpl" : "prn";
        const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `smriti_script_${Date.now()}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        setPrintDispatch({
          status: "success",
          message: `Downloaded ${ext.toUpperCase()} script (${copies} cop${copies === 1 ? "y" : "ies"}) — copy to USB/SD and print on printer.`,
          lastPrinter: "File Download",
        });
        setCompilerStatus("PRN Downloaded");
        onNotification?.("Script Downloaded", `Saved as .${ext} — copy to your barcode printer drive or USB dongle.`, "success");
        return;
      }

      // ── MODE 2: QZ Tray ───────────────────────────────────────────────
      if (dispatchMode === "qz_tray") {
        if (!isQzTrayEnabled()) {
          throw new Error("QZ Tray is disabled. Set VITE_ENABLE_QZ_TRAY=true in environment.");
        }
        setPrintDispatch({ status: "connecting", message: "Connecting to QZ Tray…" });
        const conn = await connectQzTray();
        if (!conn.connected) {
          throw new Error(
            conn.error ||
              "QZ Tray is not running on this workstation. Install & start QZ Tray, then retry."
          );
        }
        const jobId = `script-job-${Date.now()}`;
        const result = await dispatchToQzTray(
          {
            job_id: jobId,
            payload: buildPayload(),
            language: detectedLang.toLowerCase(),
            encoding: "UTF-8",
            suggested_printer: selectedPrinter || null,
          },
          selectedPrinter || undefined
        );
        if (!result.success) throw new Error(result.error || result.message);
        setPrintDispatch({
          status: "success",
          message: `Sent to "${result.printerName || selectedPrinter}" via QZ Tray (${copies} cop${copies === 1 ? "y" : "ies"}).`,
          lastPrinter: result.printerName || selectedPrinter,
        });
        setCompilerStatus(`Printed → ${result.printerName || selectedPrinter}`);
        onNotification?.(
          "Script Printed",
          `${detectedLang} script dispatched to ${result.printerName || selectedPrinter}.`,
          "success"
        );
        return;
      }

      // ── MODE 3: Server TCP (via FastAPI /barcode/print) ───────────────
      if (dispatchMode === "server_tcp") {
        const payload = buildPayload();
        const body = {
          layoutId: "raw-script",
          targetPrinter: selectedPrinter,
          printer_language: detectedLang,
          language: detectedLang.toLowerCase(),
          dispatch_mode: "server_tcp",
          templateContent: payload,
          items: [
            {
              code: "SCRIPT-DIRECT",
              name: "Direct Script Print",
              barcode: "000000000000",
              mrp: 0,
              qty: copies,
            },
          ],
        };

        const res = await apiFetchV1<any>("/barcode/print", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res?.success === false) throw new Error(res?.message || "Server dispatch failed.");

        setPrintDispatch({
          status: "success",
          message: `Sent via TCP to ${res?.printer || `${tcpIp}:${tcpPort}`} (${copies} cop${copies === 1 ? "y" : "ies"}).`,
          lastPrinter: res?.printer || `${tcpIp}:${tcpPort}`,
        });
        setCompilerStatus(`TCP → ${res?.printer || `${tcpIp}:${tcpPort}`}`);
        onNotification?.(
          "Script Sent",
          `${detectedLang} script dispatched via server TCP to barcode printer.`,
          "success"
        );
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      setPrintDispatch({ status: "error", message: msg });
      setCompilerStatus("Dispatch Failed");
      onNotification?.("Print Failed", msg, "error");
    }
  };

  // ── Editor Handlers ───────────────────────────────────────────────────────
  const handleApplyToken = () => {
    const fieldCode =
      identConfig.field === "Stock Number" ? "01" :
      identConfig.field === "Retail Price" ? "02" :
      identConfig.field === "Lot Code" ? "03" :
      identConfig.field === "Barcode" ? "04" :
      identConfig.field === "Product Name" ? "05" :
      identConfig.field === "Brand" ? "06" :
      identConfig.field === "Style" ? "07" :
      identConfig.field === "Size" ? "08" : "09";
    const dirCode = identConfig.direction === "From Left" ? "01" : "02";
    const startStr = String(identConfig.startPosition).padStart(2, "0");
    const numStr = String(identConfig.numDigits).padStart(2, "0");
    const token = `@@@${fieldCode};${dirCode};02;${startStr};${numStr}@@@`;
    const lineToInsert = `^FO100,100^AJN,24,0^CI0^FR^FD${token}^FS`;
    setScriptContent((prev) => prev.trim() + "\n" + lineToInsert + "\n");
    setCompilerStatus("Token Injected: " + token);
    onNotification?.("Token Applied", `Generated macro placeholder ${token}`, "success");
  };

  const handleClearValues = () => {
    setIdentConfig({ ...identConfig, textValue1: "", textValue2: "", startPosition: 1, numDigits: 6 });
  };

  const handleSaveScript = () => {
    const blob = new Blob([scriptContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = loadedFileName;
    a.click();
    URL.revokeObjectURL(url);
    onNotification?.("Script Saved", `Exported script as ${loadedFileName}`, "success");
  };

  const handleLoadScriptFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setScriptContent(content);
        setLoadedFileName(file.name);
        setCompilerStatus("Loaded: " + file.name);
        setPrintDispatch({ status: "idle", message: `Script loaded: ${file.name}` });
        onNotification?.("Script Loaded", `Loaded ${file.name} — ready to send to printer.`, "success");
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be reloaded
    e.target.value = "";
  };

  // ── Status colour ─────────────────────────────────────────────────────────
  const statusColor: Record<PrintDispatchState["status"], string> = {
    idle: "bg-blue-500",
    connecting: "bg-amber-400",
    printing: "bg-amber-400",
    success: "bg-green-500",
    error: "bg-red-500",
  };

  const statusPulse = printDispatch.status === "connecting" || printDispatch.status === "printing";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={`h-full flex flex-col bg-surface text-on-surface font-sans select-none overflow-hidden ${
        isFullscreen ? "fixed inset-0 z-50 bg-slate-900" : ""
      }`}
    >
      {/* ── Top App Bar ──────────────────────────────────────────────────── */}
      <header className="h-14 border-b border-outline-variant bg-surface-container flex justify-between items-center px-4 shrink-0 shadow-xs z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToPrinting}
            className="p-1.5 hover:bg-surface-variant rounded text-primary flex items-center gap-1.5 text-xs font-bold transition"
            title="Back to Tag Printing Terminal"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <div className="h-4 w-px bg-outline-variant" />
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <Code size={18} className="text-secondary" />
            <span>PRN / ZPL Script Compiler & Printer</span>
          </div>
          {/* Language badge */}
          <span className="text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
            {detectedLang}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* QZ Status pill */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
              qzConnected
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            }`}
          >
            {qzLoading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : qzConnected ? (
              <Wifi size={12} />
            ) : (
              <WifiOff size={12} />
            )}
            <span>{qzConnected ? `QZ Tray v${qzVersion}` : "QZ Offline"}</span>
          </div>
          <button
            type="button"
            onClick={discoverQzPrinters}
            className="p-1.5 hover:bg-surface-variant rounded text-on-surface-variant transition"
            title="Refresh printer list"
          >
            <RefreshCw size={14} className={qzLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* ── Main Layout: Editor left | Config + Printer right ───────────── */}
      <main className="flex-1 flex flex-col lg:flex-row p-3 gap-3 overflow-hidden bg-surface-container-lowest">

        {/* ────────────── LEFT: Code Editor ──────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-surface border border-outline-variant rounded-lg overflow-hidden shadow-xs min-w-0">

          {/* Editor header */}
          <div className="bg-surface-container px-4 py-2.5 border-b border-outline-variant flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2 text-primary font-bold text-xs">
              <FileCode size={16} className="text-secondary" />
              <span className="truncate max-w-[220px]">{loadedFileName}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-on-surface-variant">
              <span>{lines.length} lines</span>
              <span>•</span>
              <span>UTF-8</span>
              <button
                type="button"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1 hover:bg-surface-variant rounded text-on-surface ml-2"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>

          {/* VS Code style dark editor */}
          <div className="flex-1 relative bg-[#1E1E1E] text-[#D4D4D4] font-mono text-xs overflow-hidden flex">
            {/* Line numbers */}
            <div className="w-10 bg-[#1E1E1E] border-r border-white/10 text-right pr-2 pt-4 select-none text-white/25 text-[11px] leading-[1.6] overflow-hidden shrink-0">
              {lines.map((_, idx) => (
                <div key={idx}>{idx + 1}</div>
              ))}
            </div>
            {/* Textarea */}
            <div className="flex-1 relative overflow-auto p-4 leading-[1.6]">
              <textarea
                value={scriptContent}
                onChange={(e) => {
                  setScriptContent(e.target.value);
                  setCompilerStatus("Editing…");
                  if (printDispatch.status === "success" || printDispatch.status === "error") {
                    setPrintDispatch({ status: "idle", message: "Script modified — ready to send." });
                  }
                }}
                spellCheck={false}
                className="w-full h-full bg-transparent text-[#D4D4D4] font-mono text-xs leading-[1.6] outline-none resize-none border-none selection:bg-blue-500/30"
              />
            </div>
          </div>

          {/* Editor footer */}
          <div className="bg-surface-container px-4 py-3 border-t border-outline-variant flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="bg-surface-container-highest hover:bg-surface-variant text-on-surface border border-outline-variant px-4 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-xs"
            >
              <Upload size={13} />
              <span>Load Script</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".t,.blf,.prn,.zpl,.tspl,.dpl,.txt"
              className="hidden"
              onChange={handleLoadScriptFile}
            />
            <button
              type="button"
              onClick={handleSaveScript}
              className="bg-primary hover:opacity-90 text-on-primary px-4 py-1.5 rounded-lg text-xs font-bold transition shadow flex items-center gap-1.5"
            >
              <Save size={13} />
              <span>Save</span>
            </button>

            {/* Browse Library button */}
            <button
              type="button"
              onClick={() => setLibraryOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold border transition shadow-xs ${
                libraryOpen
                  ? "bg-secondary text-on-secondary border-secondary"
                  : "bg-surface-container-highest hover:bg-surface-variant text-on-surface border-outline-variant"
              }`}
            >
              <FolderOpen size={13} />
              <span>PRN Library</span>
            </button>

            <div className="flex-1" />

            {/* Copies input */}
            <label className="flex items-center gap-1.5 text-xs text-on-surface-variant font-semibold">
              <span>Copies</span>
              <input
                type="number"
                min="1"
                max="999"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 text-center border border-outline-variant rounded bg-surface text-on-surface text-xs py-1 font-bold focus:border-secondary focus:ring-1 focus:ring-secondary"
              />
            </label>

            <button
              type="button"
              onClick={onBackToPrinting}
              className="text-error border border-error hover:bg-error-container hover:text-on-error-container px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1"
            >
              <LogOut size={13} />
              <span>Exit</span>
            </button>
          </div>
        </div>

        {/* ────────────── RIGHT: Printer Panel + Config ───────────────────── */}
        <div className="lg:w-80 shrink-0 flex flex-col gap-3 overflow-y-auto">

          {/* ── Card: PRN Script Library ────────────────────────────────── */}
          <div className="bg-surface border border-outline-variant rounded-lg shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setLibraryOpen((o) => !o)}
              className="w-full px-4 py-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/5 border-b border-outline-variant flex items-center justify-between hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/15">
                  <FolderOpen size={15} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-on-surface">PRN Script Library</p>
                  <p className="text-[10px] text-on-surface-variant">{PRN_LIBRARY.length} scripts — click to browse &amp; load</p>
                </div>
              </div>
              <ChevronDown size={14} className={`text-on-surface-variant transition-transform ${libraryOpen ? "rotate-180" : ""}`} />
            </button>

            {libraryOpen && (
              <div className="max-h-72 overflow-y-auto">
                {PRN_LIBRARY.map((entry) => {
                  const isActive = loadedFileName === entry.file;
                  const isLoading = libraryLoading === entry.file;
                  const langColor: Record<string, string> = {
                    ZPL: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
                    DPL: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
                    TSPL: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
                    BLF: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
                    PRN: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
                  };
                  return (
                    <button
                      key={entry.file}
                      type="button"
                      onClick={() => void loadScriptFromUrl(entry)}
                      disabled={isLoading}
                      className={`w-full text-left px-4 py-2.5 border-b border-outline-variant/50 flex items-start gap-3 transition ${
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-900/20"
                          : "hover:bg-surface-variant"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isLoading ? (
                          <Loader2 size={14} className="animate-spin text-indigo-500" />
                        ) : isActive ? (
                          <CheckCircle2 size={14} className="text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <FileText size={14} className="text-on-surface-variant" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold ${isActive ? "text-indigo-700 dark:text-indigo-300 font-bold" : "text-on-surface"}`}>
                            {entry.name}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${langColor[entry.lang] ?? langColor.PRN}`}>
                            {entry.lang}
                          </span>
                          {isActive && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500 text-white">
                              LOADED
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-on-surface-variant mt-0.5 truncate">{entry.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Card: Send to Printer ──────────────────────────────────────── */}
          <div className="bg-surface border border-outline-variant rounded-lg shadow-xs overflow-hidden">
            {/* Card header */}
            <div className="px-4 py-3 bg-gradient-to-r from-primary/10 to-secondary/5 border-b border-outline-variant flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/15">
                <Printer size={15} className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-on-surface">Send to Printer</p>
                <p className="text-[10px] text-on-surface-variant">Direct barcode printer dispatch</p>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {/* Dispatch Mode Selector */}
              <div>
                <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Dispatch Mode
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-surface-container rounded-lg">
                  {(
                    [
                      { id: "qz_tray", label: "QZ Tray", icon: <Wifi size={11} /> },
                      { id: "server_tcp", label: "TCP Socket", icon: <Network size={11} /> },
                      { id: "prn_download", label: "Download", icon: <Download size={11} /> },
                    ] as { id: DispatchMode; label: string; icon: React.ReactNode }[]
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setDispatchMode(m.id)}
                      className={`flex flex-col items-center gap-0.5 py-1.5 rounded text-[10px] font-bold transition ${
                        dispatchMode === m.id
                          ? "bg-primary text-on-primary shadow"
                          : "text-on-surface-variant hover:bg-surface-variant"
                      }`}
                    >
                      {m.icon}
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Printer Selector (QZ Tray / TCP modes) */}
              {dispatchMode !== "prn_download" && (
                <div>
                  <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Target Printer
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setPrinterDropdownOpen((p) => !p)}
                      className="w-full flex items-center justify-between px-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface text-xs font-semibold hover:border-secondary transition"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {printers.find((p) => p.name === selectedPrinter)?.source === "qz_live" ? (
                          <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                        ) : (
                          <Usb size={11} className="text-on-surface-variant shrink-0" />
                        )}
                        <span className="truncate">{selectedPrinter || "Select printer…"}</span>
                      </div>
                      <ChevronDown size={13} className="shrink-0 text-on-surface-variant" />
                    </button>

                    {printerDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-outline-variant rounded-lg shadow-lg max-h-52 overflow-y-auto">
                        {/* Section: QZ Live */}
                        {printers.some((p) => p.source === "qz_live") && (
                          <div className="px-3 py-1.5 text-[9px] font-bold uppercase text-on-surface-variant bg-surface-container border-b border-outline-variant tracking-wider">
                            <Wifi size={9} className="inline mr-1" />
                            QZ Tray — Live Printers
                          </div>
                        )}
                        {printers
                          .filter((p) => p.source === "qz_live")
                          .map((p) => (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() => { setSelectedPrinter(p.name); setPrinterDropdownOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-surface-variant transition ${
                                selectedPrinter === p.name ? "bg-primary/10 font-bold text-primary" : "text-on-surface"
                              }`}
                            >
                              <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                              {p.name}
                              {selectedPrinter === p.name && <CheckCircle2 size={11} className="ml-auto text-primary" />}
                            </button>
                          ))}

                        {/* Section: Known Models */}
                        <div className="px-3 py-1.5 text-[9px] font-bold uppercase text-on-surface-variant bg-surface-container border-b border-outline-variant tracking-wider">
                          <Usb size={9} className="inline mr-1" />
                          Known Barcode Printers
                        </div>
                        {printers
                          .filter((p) => p.source !== "qz_live")
                          .map((p) => (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() => { setSelectedPrinter(p.name); setPrinterDropdownOpen(false); }}
                              className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-surface-variant transition ${
                                selectedPrinter === p.name ? "bg-primary/10 font-bold text-primary" : "text-on-surface"
                              }`}
                            >
                              <Usb size={11} className="text-on-surface-variant shrink-0" />
                              <span className="truncate">{p.name}</span>
                              {selectedPrinter === p.name && <CheckCircle2 size={11} className="ml-auto text-primary" />}
                            </button>
                          ))}

                        {/* Manual entry row */}
                        <div className="px-3 py-2 border-t border-outline-variant">
                          <input
                            type="text"
                            placeholder="Type custom printer name…"
                            className="w-full text-xs border border-outline-variant rounded px-2 py-1.5 bg-surface text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = (e.target as HTMLInputElement).value.trim();
                                if (val) {
                                  setSelectedPrinter(val);
                                  setPrinterDropdownOpen(false);
                                }
                              }
                            }}
                          />
                          <p className="text-[9px] text-on-surface-variant mt-1">Press Enter to use custom name</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TCP Settings (server_tcp mode) */}
              {dispatchMode === "server_tcp" && (
                <div className="bg-surface-container-low border border-outline-variant rounded-lg p-3 flex flex-col gap-2">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                    <Network size={10} className="inline mr-1" />TCP/IP Settings
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tcpIp}
                      onChange={(e) => setTcpIp(e.target.value)}
                      placeholder="192.168.1.200"
                      className="flex-1 text-xs border border-outline-variant rounded px-2 py-1.5 bg-surface text-on-surface font-mono focus:border-secondary focus:ring-1 focus:ring-secondary"
                    />
                    <input
                      type="text"
                      value={tcpPort}
                      onChange={(e) => setTcpPort(e.target.value)}
                      placeholder="9100"
                      className="w-16 text-xs border border-outline-variant rounded px-2 py-1.5 bg-surface text-on-surface font-mono text-center focus:border-secondary focus:ring-1 focus:ring-secondary"
                    />
                  </div>
                  <p className="text-[9px] text-on-surface-variant">Raw TCP socket port 9100 — network barcode printers</p>
                </div>
              )}

              {/* QZ Tray info when offline */}
              {dispatchMode === "qz_tray" && !qzConnected && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 flex gap-2">
                  <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300">QZ Tray Not Running</p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                      Download and start QZ Tray on this workstation, then click{" "}
                      <button
                        type="button"
                        onClick={discoverQzPrinters}
                        className="underline font-bold"
                      >
                        Refresh
                      </button>
                      .
                    </p>
                  </div>
                </div>
              )}

              {/* PRN download info */}
              {dispatchMode === "prn_download" && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 flex gap-2">
                  <Info size={14} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-relaxed">
                    Downloads the raw script as a <strong>.prn</strong> / <strong>.zpl</strong> file. Copy to USB or SD card and print directly on the barcode printer.
                  </p>
                </div>
              )}

              {/* ── PRINT BUTTON ── */}
              <button
                type="button"
                onClick={handleDispatchPrint}
                disabled={printDispatch.status === "printing" || printDispatch.status === "connecting"}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition shadow-md ${
                  printDispatch.status === "printing" || printDispatch.status === "connecting"
                    ? "bg-amber-500 text-white cursor-wait"
                    : printDispatch.status === "success"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : printDispatch.status === "error"
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-primary hover:opacity-90 text-on-primary"
                }`}
              >
                {printDispatch.status === "printing" || printDispatch.status === "connecting" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : printDispatch.status === "success" ? (
                  <CheckCircle2 size={16} />
                ) : printDispatch.status === "error" ? (
                  <AlertTriangle size={16} />
                ) : dispatchMode === "prn_download" ? (
                  <Download size={16} />
                ) : (
                  <Send size={16} />
                )}
                <span>
                  {printDispatch.status === "connecting"
                    ? "Connecting…"
                    : printDispatch.status === "printing"
                    ? "Sending…"
                    : printDispatch.status === "success"
                    ? "Sent Successfully"
                    : printDispatch.status === "error"
                    ? "Retry Print"
                    : dispatchMode === "prn_download"
                    ? `Download Script (${copies} cop${copies === 1 ? "y" : "ies"})`
                    : `Send to Printer (${copies} cop${copies === 1 ? "y" : "ies"})`}
                </span>
              </button>

              {/* Dispatch result message */}
              {printDispatch.status !== "idle" && (
                <div
                  className={`rounded-lg px-3 py-2 text-[11px] font-medium flex items-start gap-2 ${
                    printDispatch.status === "success"
                      ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700"
                      : printDispatch.status === "error"
                      ? "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700"
                      : "bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700"
                  }`}
                >
                  {printDispatch.status === "success" ? (
                    <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
                  ) : printDispatch.status === "error" ? (
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  ) : (
                    <Loader2 size={12} className="mt-0.5 shrink-0 animate-spin" />
                  )}
                  <span className="leading-relaxed">{printDispatch.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Card: Identification Settings ─────────────────────────────── */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-xs">
            <h2 className="text-xs font-bold text-primary mb-3.5 flex items-center gap-2 border-b border-outline-variant pb-2 uppercase tracking-wider">
              <Sliders size={14} className="text-secondary" />
              <span>Token Identification</span>
            </h2>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1">Field Selection</label>
                <select
                  value={identConfig.field}
                  onChange={(e) => setIdentConfig({ ...identConfig, field: e.target.value as any })}
                  className="w-full bg-surface border border-outline-variant text-on-surface rounded focus:border-secondary focus:ring-1 focus:ring-secondary transition text-xs py-1.5 px-2.5 font-medium"
                >
                  <option value="Stock Number">Stock Number</option>
                  <option value="Retail Price">Retail Price</option>
                  <option value="Lot Code">Lot Code</option>
                  <option value="Barcode">Barcode</option>
                  <option value="Product Name">Product Name</option>
                  <option value="Brand">Brand</option>
                  <option value="Style">Style</option>
                  <option value="Size">Size</option>
                  <option value="Shade">Shade</option>
                </select>
              </div>

              <div className="border border-outline-variant rounded p-2.5 bg-surface-container-low">
                <label className="block text-[10px] text-on-surface-variant mb-1.5 uppercase tracking-wider font-bold">
                  String Direction
                </label>
                <div className="flex gap-4">
                  {(["From Right", "From Left"] as const).map((dir) => (
                    <label key={dir} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="direction"
                        checked={identConfig.direction === dir}
                        onChange={() => setIdentConfig({ ...identConfig, direction: dir })}
                        className="text-secondary focus:ring-secondary h-3.5 w-3.5"
                      />
                      <span className="text-xs text-on-surface">{dir}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">Start Position</label>
                  <input
                    type="number"
                    min="1"
                    value={identConfig.startPosition}
                    onChange={(e) => setIdentConfig({ ...identConfig, startPosition: parseInt(e.target.value) || 1 })}
                    className="w-full bg-surface border border-outline-variant text-on-surface rounded focus:border-secondary text-xs py-1.5 px-2.5 text-right font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-on-surface-variant mb-1">No. of Digits</label>
                  <input
                    type="number"
                    min="1"
                    value={identConfig.numDigits}
                    onChange={(e) => setIdentConfig({ ...identConfig, numDigits: parseInt(e.target.value) || 1 })}
                    className="w-full bg-surface border border-outline-variant text-on-surface rounded focus:border-secondary text-xs py-1.5 px-2.5 text-right font-bold font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Card: Values ─────────────────────────────────────────────── */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 shadow-xs">
            <h2 className="text-xs font-bold text-primary mb-3 flex items-center gap-2 border-b border-outline-variant pb-2 uppercase tracking-wider">
              <Sparkles size={14} className="text-secondary" />
              <span>Values</span>
            </h2>

            <div className="flex flex-col gap-2.5">
              {(["textValue1", "textValue2"] as const).map((field, idx) => (
                <div key={field}>
                  <label className="block text-xs text-on-surface-variant mb-1">
                    Text Value {idx + 1}
                  </label>
                  <input
                    type="text"
                    value={identConfig[field]}
                    onChange={(e) => setIdentConfig({ ...identConfig, [field]: e.target.value })}
                    placeholder={idx === 0 ? "e.g. SMRITI RETAIL" : "e.g. MRP INCL OF TAXES"}
                    className="w-full bg-surface border border-outline-variant text-on-surface rounded focus:border-secondary text-xs py-1.5 px-2.5"
                  />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-outline-variant">
              <button
                type="button"
                onClick={handleClearValues}
                className="bg-surface-container-highest hover:bg-surface-variant text-on-surface border border-outline-variant px-3.5 py-1.5 rounded text-xs font-semibold transition"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleApplyToken}
                className="bg-secondary hover:opacity-90 text-on-secondary px-5 py-1.5 rounded text-xs font-bold transition shadow-xs"
              >
                Apply Token
              </button>
            </div>
          </div>

          {/* ── Card: Resolve with DB Items ────────────────────────────── */}
          <div className="bg-surface border border-outline-variant rounded-lg shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setDbOpen((o) => !o)}
              className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500/10 to-teal-500/5 border-b border-outline-variant flex items-center justify-between hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition"
            >
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/15">
                  <Database size={15} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-on-surface">Resolve with DB Items</p>
                  <p className="text-[10px] text-on-surface-variant">
                    {selectedItem
                      ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">&#10003; {selectedItem.name}</span>
                      : "Search & fill script placeholders from live DB"
                    }
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedItem && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedItem(null); setResolvedScript(""); setDbQuery(""); setResolvedPreviewOpen(false); setCompilerStatus("Compiler Ready"); }}
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500"
                    title="Clear"
                  >
                    <X size={12} />
                  </button>
                )}
                <ChevronDown size={14} className={`text-on-surface-variant transition-transform ${dbOpen ? "rotate-180" : ""}`} />
              </div>
            </button>

            {dbOpen && (
              <div className="p-3 flex flex-col gap-2.5">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                  <input
                    type="text"
                    value={dbQuery}
                    onChange={(e) => setDbQuery(e.target.value)}
                    placeholder="Search name, barcode, SKU..."
                    className="w-full pl-8 pr-7 py-2 text-xs border border-outline-variant rounded-lg bg-surface text-on-surface focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition"
                  />
                  {dbSearching && <Loader2 size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-emerald-500" />}
                </div>

                {dbResults.length > 0 && (
                  <div className="border border-outline-variant rounded-lg overflow-hidden max-h-52 overflow-y-auto shadow bg-surface">
                    {dbResults.map((item) => (
                      <button key={item.id} type="button" onClick={() => handleSelectItem(item)}
                        className="w-full text-left px-3 py-2.5 border-b border-outline-variant/40 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition">
                        <div className="flex items-start gap-2">
                          <Package size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-on-surface truncate">{item.name}</p>
                            <div className="flex gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[9px] font-mono text-on-surface-variant">{item.barcode}</span>
                              {item.style_code && <span className="text-[9px] bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-1 rounded font-mono">{item.style_code}</span>}
                              {item.size && <span className="text-[9px] bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-1 rounded">{item.size}</span>}
                              {item.color && <span className="text-[9px] bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-1 rounded">{item.color}</span>}
                              <span className="text-[9px] font-bold text-green-700 dark:text-green-400">&#8377;{item.mrp}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedItem && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg p-2.5">
                    <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Tag size={10} /> Resolved Values
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {([
                        ["{barcode}",    selectedItem.barcode],
                        ["{style_code}", selectedItem.style_code || "—"],
                        ["{size}",       selectedItem.size || "—"],
                        ["{colour}",     selectedItem.color || "—"],
                        ["{mrp}",        "Rs." + selectedItem.mrp],
                        ["{pkd_date}",   new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })],
                      ] as [string, string][]).map(([k, v]) => (
                        <div key={k}>
                          <span className="text-[9px] font-mono text-on-surface-variant">{k}</span>
                          <p className="text-[10px] font-semibold text-on-surface truncate">{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {resolvedScript && resolvedPreviewOpen && (
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Eye size={10} /> Resolved Script Preview
                    </p>
                    <pre className="bg-[#1E1E1E] text-[#D4D4D4] text-[10px] font-mono rounded-lg p-2 max-h-28 overflow-auto leading-relaxed whitespace-pre-wrap break-all">
                      {resolvedScript.slice(0, 500)}
                      {resolvedScript.length > 500 && <span className="text-white/40">{"\n\u2026"}{resolvedScript.length - 500} more chars</span>}
                    </pre>
                  </div>
                )}

                {selectedItem && resolvedScript && (
                  <div className="flex gap-2">
                    <button type="button" onClick={handleApplyResolvedToEditor}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow">
                      <FileCode size={13} />
                      Apply to Editor
                    </button>
                    <button type="button" onClick={() => setResolvedPreviewOpen((p) => !p)}
                      className="px-3 py-2 border border-outline-variant rounded-lg text-xs text-on-surface-variant hover:bg-surface-variant transition" title="Toggle preview">
                      <Eye size={13} />
                    </button>
                  </div>
                )}

                {dbQuery.trim().length >= 2 && !dbSearching && dbResults.length === 0 && !selectedItem && (
                  <p className="text-[11px] text-on-surface-variant text-center py-2">No products found for &ldquo;{dbQuery}&rdquo;</p>
                )}
              </div>
            )}
          </div>

          {/* ── Status Bar ───────────────────────────────────────────────── */}
          <div className="bg-surface-container-low border border-outline-variant rounded-lg p-3 flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              {statusPulse && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusColor[printDispatch.status]} opacity-75`} />
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${statusColor[printDispatch.status]}`} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-bold flex items-center gap-1">
                <Terminal size={9} />
                Status
              </p>
              <p className="text-xs font-semibold text-on-surface truncate">{compilerStatus}</p>
            </div>
          </div>

        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="bg-surface-container-low border-t border-outline-variant h-9 flex justify-between items-center px-4 z-30 text-[10px] shrink-0 font-mono">
        <div className="text-secondary font-bold">© 2026 SMRITI Retail OS • Script Compiler v6.7</div>
        <div className="flex gap-4 items-center text-on-surface-variant">
          <span>
            Script: <strong className="text-on-surface">{loadedFileName}</strong>
          </span>
          <span>•</span>
          <span>
            Lang: <strong className="text-on-surface">{detectedLang}</strong>
          </span>
          <span>•</span>
          <span>
            Mode:{" "}
            <strong className="text-on-surface">
              {dispatchMode === "qz_tray" ? "QZ Tray" : dispatchMode === "server_tcp" ? "TCP Socket" : "PRN Download"}
            </strong>
          </span>
        </div>
      </footer>
    </div>
  );
};

export default BarcodeScriptGenerationView;
