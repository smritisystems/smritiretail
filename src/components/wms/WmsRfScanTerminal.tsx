/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.129.0
 * Created      : 2026-10-28
 * Modified     : 2026-10-28
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { apiFetchV1 } from "../../lib/apiFetch.ts";
import {
  ScanLine,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  MapPin,
  RefreshCw,
  Volume2,
  VolumeX,
  Vibrate,
  Zap,
  ChevronRight,
  ShieldAlert,
  Layers,
  ArrowDownCircle,
  ArrowUpRight,
  CornerDownLeft,
  X,
  Check
} from "lucide-react";

interface Godown {
  id: string;
  code: string;
  name: string;
  is_central_godown: boolean;
  is_active: boolean;
}

interface ReplenishmentTask {
  task_id: string;
  item_id: string;
  item_code: string;
  product_name: string;
  sku?: string;
  picking_bin: string;
  current_picking_stock: number;
  min_reorder_level: number;
  max_capacity: number;
  reorder_quantity: number;
  source_bin?: string;
  available_bulk_stock: number;
  suggested_quantity: number;
  priority: "CRITICAL" | "HIGH" | "NORMAL" | "BULK_STOCKOUT";
  status: "READY" | "BLOCKED" | "EXECUTED";
  message?: string;
}

interface BinSummary {
  warehouse_id: string;
  warehouse_code: string;
  location_id: string;
  bin_code: string;
  barcode?: string;
  zone: string;
  max_capacity_units: number;
  total_units_occupied: number;
  headroom_units: number;
  is_locked: boolean;
  items: Array<{
    item_id: string;
    item_code: string;
    item_name: string;
    sku?: string;
    batch_no?: string;
    quantity: number;
  }>;
}

export interface WmsRfScanTerminalProps {
  warehouses: Godown[];
  currentUser?: any;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const WmsRfScanTerminal: React.FC<WmsRfScanTerminalProps> = ({
  warehouses,
  currentUser,
  onNotification,
}) => {
  // Active warehouse selection
  const [selectedWhId, setSelectedWhId] = useState<string>(() => {
    return warehouses.length > 0 ? warehouses[0].id : "";
  });

  // Terminal mode
  const [mode, setMode] = useState<"REPLENISH" | "AUDIT" | "RELOCATE">("REPLENISH");

  // Audio & Haptic state
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Universal Scanner Input
  const [scanBuffer, setScanBuffer] = useState("");
  const [inputFeedback, setInputFeedback] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Web Audio Synthesizer (Zero External Assets)
  // ---------------------------------------------------------------------------
  const playAudioTone = (type: "success" | "error") => {
    if (!audioEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      if (type === "success") {
        // High-pitched dual ascending chime (880Hz -> 1175Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(880, ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(1175, ctx.currentTime + 0.12);
        gain1.gain.setValueAtTime(0.3, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.18);
      } else {
        // Low double buzzer (220Hz -> 180Hz)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(160, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // AudioContext unavailable or restricted by browser policy
    }
  };

  const triggerVibrate = (pattern: number[] = [100, 50, 100]) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Vibrate not allowed
      }
    }
  };

  // ---------------------------------------------------------------------------
  // Mode 1: Directed Replenishment State
  // ---------------------------------------------------------------------------
  const [replenishTasks, setReplenishTasks] = useState<ReplenishmentTask[]>([]);
  const [activeTask, setActiveTask] = useState<ReplenishmentTask | null>(null);
  const [repStep, setRepStep] = useState<1 | 2 | 3 | 4>(1); // 1: Scan Src Bin, 2: Scan Item, 3: Confirm Qty, 4: Scan Dst Bin
  const [scannedSrcBin, setScannedSrcBin] = useState("");
  const [scannedItemCode, setScannedItemCode] = useState("");
  const [transferQty, setTransferQty] = useState(1);
  const [scannedDstBin, setScannedDstBin] = useState("");
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [executingRep, setExecutingRep] = useState(false);

  // Fetch replenishment tasks for active warehouse
  const fetchReplenishTasks = async () => {
    if (!selectedWhId) return;
    setLoadingTasks(true);
    try {
      const data = await apiFetchV1<any>(`/wms/warehouses/${selectedWhId}/replenishment-tasks`);
      const readyTasks = (data?.tasks || []).filter((t: ReplenishmentTask) => t.status === "READY");
      setReplenishTasks(readyTasks);
      if (readyTasks.length > 0 && (!activeTask || !readyTasks.some((t: ReplenishmentTask) => t.task_id === activeTask.task_id))) {
        pickTask(readyTasks[0]);
      } else if (readyTasks.length === 0) {
        setActiveTask(null);
      }
    } catch (err: any) {
      onNotification?.("Replenishment Sync Error", err.message || "Failed loading tasks", "error");
    } finally {
      setLoadingTasks(false);
    }
  };

  const pickTask = (t: ReplenishmentTask) => {
    setActiveTask(t);
    setRepStep(1);
    setScannedSrcBin("");
    setScannedItemCode("");
    setTransferQty(Math.max(1, Math.round(t.suggested_quantity)));
    setScannedDstBin("");
    setInputFeedback(null);
    setTimeout(() => scanInputRef.current?.focus(), 100);
  };

  useEffect(() => {
    if (selectedWhId && mode === "REPLENISH") {
      fetchReplenishTasks();
    }
  }, [selectedWhId, mode]);

  // ---------------------------------------------------------------------------
  // Mode 2: Bin Audit State
  // ---------------------------------------------------------------------------
  const [auditQuery, setAuditQuery] = useState("");
  const [auditResult, setAuditResult] = useState<BinSummary | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchBinAudit = async (code: string) => {
    if (!selectedWhId || !code.trim()) return;
    setAuditLoading(true);
    try {
      const data = await apiFetchV1<BinSummary>(
        `/wms/warehouses/${selectedWhId}/rf/bin-summary?bin_code=${encodeURIComponent(code.trim())}`
      );
      setAuditResult(data);
      playAudioTone("success");
      triggerVibrate([80]);
      setInputFeedback({ text: `Bin '${data.bin_code}' loaded.`, type: "ok" });
    } catch (err: any) {
      setAuditResult(null);
      playAudioTone("error");
      triggerVibrate([200, 100, 200]);
      setInputFeedback({ text: err.message || "Bin not found", type: "err" });
    } finally {
      setAuditLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Mode 3: Quick Relocate State
  // ---------------------------------------------------------------------------
  const [relFromBin, setRelFromBin] = useState("");
  const [relItemId, setRelItemId] = useState("");
  const [relItemCode, setRelItemCode] = useState("");
  const [relItemName, setRelItemName] = useState("");
  const [relQty, setRelQty] = useState(1);
  const [relToBin, setRelToBin] = useState("");
  const [relocateLoading, setRelocateLoading] = useState(false);

  const handleQuickRelocateSubmit = async () => {
    if (!selectedWhId || !relFromBin || !relToBin || !relItemId || relQty <= 0) {
      onNotification?.("Validation Error", "Please fill source bin, destination bin, item and quantity.", "error");
      playAudioTone("error");
      return;
    }
    setRelocateLoading(true);
    try {
      const res = await apiFetchV1<any>(`/wms/warehouses/${selectedWhId}/rf/quick-transfer`, {
        method: "POST",
        body: JSON.stringify({
          from_bin: relFromBin,
          to_bin: relToBin,
          item_id: relItemId,
          quantity: relQty,
          notes: "RF Handheld Quick Move",
        }),
      });
      playAudioTone("success");
      triggerVibrate([100, 50, 150]);
      onNotification?.("Relocation Complete", res.message || "Stock moved successfully.", "success");
      // Reset form
      setRelFromBin("");
      setRelItemId("");
      setRelItemCode("");
      setRelItemName("");
      setRelQty(1);
      setRelToBin("");
      setInputFeedback({ text: "Relocation complete!", type: "ok" });
    } catch (err: any) {
      playAudioTone("error");
      triggerVibrate([250, 100, 250]);
      onNotification?.("Relocation Error", err.message || "Failed moving stock.", "error");
      setInputFeedback({ text: err.message || "Relocation failed.", type: "err" });
    } finally {
      setRelocateLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Universal Barcode Scan Handler
  // ---------------------------------------------------------------------------
  const handleUniversalScan = async (scannedValue: string) => {
    const code = scannedValue.trim();
    if (!code || !selectedWhId) return;

    setScanBuffer("");

    // Verify barcode against backend
    let verifyData: any = null;
    try {
      verifyData = await apiFetchV1<any>(`/wms/warehouses/${selectedWhId}/rf/verify-barcode`, {
        method: "POST",
        body: JSON.stringify({ barcode: code }),
      });
    } catch {
      // Backend verify failed, treat code literally
    }

    // ----------------- REPLENISH MODE -----------------
    if (mode === "REPLENISH") {
      if (!activeTask) {
        onNotification?.("No Active Task", "Select a replenishment task first.", "warning");
        playAudioTone("error");
        return;
      }

      if (repStep === 1) {
        // Step 1: Scan Source Bin
        const matchedBin = (verifyData?.location?.code || code).toUpperCase();
        const expectedBin = (activeTask.source_bin || "").toUpperCase();

        if (matchedBin === expectedBin || !expectedBin) {
          setScannedSrcBin(matchedBin);
          setRepStep(2);
          playAudioTone("success");
          triggerVibrate([100]);
          setInputFeedback({ text: `Source bin '${matchedBin}' verified. Now scan item barcode.`, type: "ok" });
        } else {
          playAudioTone("error");
          triggerVibrate([200, 80, 200]);
          setInputFeedback({
            text: `Wrong source bin scanned ('${matchedBin}'). Expected '${expectedBin}'.`,
            type: "err",
          });
        }
      } else if (repStep === 2) {
        // Step 2: Scan Item Barcode
        const scannedItem = (verifyData?.item?.item_code || code).toUpperCase();
        const expectedItem = (activeTask.item_code || "").toUpperCase();

        if (scannedItem === expectedItem || scannedItem === (activeTask.sku || "").toUpperCase()) {
          setScannedItemCode(scannedItem);
          setRepStep(3);
          playAudioTone("success");
          triggerVibrate([100]);
          setInputFeedback({ text: `Item '${scannedItem}' verified. Confirm pick quantity.`, type: "ok" });
        } else {
          playAudioTone("error");
          triggerVibrate([200, 80, 200]);
          setInputFeedback({
            text: `Wrong item scanned ('${scannedItem}'). Expected '${expectedItem}'.`,
            type: "err",
          });
        }
      } else if (repStep === 4) {
        // Step 4: Scan Destination Picking Bin
        const matchedDst = (verifyData?.location?.code || code).toUpperCase();
        const expectedDst = (activeTask.picking_bin || "").toUpperCase();

        if (matchedDst === expectedDst) {
          setScannedDstBin(matchedDst);
          executeDirectedReplenish(matchedDst);
        } else {
          playAudioTone("error");
          triggerVibrate([200, 80, 200]);
          setInputFeedback({
            text: `Wrong destination bin scanned ('${matchedDst}'). Expected picking bin '${expectedDst}'.`,
            type: "err",
          });
        }
      }
    }

    // ----------------- AUDIT MODE -----------------
    else if (mode === "AUDIT") {
      setAuditQuery(code);
      fetchBinAudit(code);
    }

    // ----------------- RELOCATE MODE -----------------
    else if (mode === "RELOCATE") {
      if (!relFromBin) {
        // First scan is source bin
        const binCode = (verifyData?.location?.code || code).toUpperCase();
        setRelFromBin(binCode);
        playAudioTone("success");
        triggerVibrate([80]);
        setInputFeedback({ text: `Source bin '${binCode}' set. Now scan item.`, type: "ok" });
      } else if (!relItemId) {
        // Second scan is item
        if (verifyData?.item) {
          setRelItemId(verifyData.item.id);
          setRelItemCode(verifyData.item.item_code);
          setRelItemName(verifyData.item.item_name);
          playAudioTone("success");
          triggerVibrate([80]);
          setInputFeedback({ text: `Item '${verifyData.item.item_code}' set. Now scan destination bin.`, type: "ok" });
        } else {
          // Assume code is item_code
          setRelItemId(code);
          setRelItemCode(code);
          setRelItemName(code);
          playAudioTone("success");
          setInputFeedback({ text: `Item set. Now scan destination bin.`, type: "ok" });
        }
      } else if (!relToBin) {
        // Third scan is target bin
        const binCode = (verifyData?.location?.code || code).toUpperCase();
        setRelToBin(binCode);
        playAudioTone("success");
        triggerVibrate([80]);
        setInputFeedback({ text: `Destination bin '${binCode}' set. Review quantity and confirm move.`, type: "ok" });
      }
    }
  };

  // Execute Directed Replenish Confirmation
  const executeDirectedReplenish = async (dstBin: string) => {
    if (!activeTask || !selectedWhId) return;
    setExecutingRep(true);
    try {
      const res = await apiFetchV1<any>(`/wms/warehouses/${selectedWhId}/rf/replenish-confirm`, {
        method: "POST",
        body: JSON.stringify({
          task_id: activeTask.task_id,
          scanned_source_bin: scannedSrcBin || activeTask.source_bin,
          scanned_item_barcode: scannedItemCode || activeTask.item_code,
          scanned_destination_bin: dstBin,
          quantity: transferQty,
          notes: "Directed RF replenishment walk confirmed",
        }),
      });

      playAudioTone("success");
      triggerVibrate([100, 100, 200, 100]);
      onNotification?.("Replenishment Verified", res.message || "Bin transfer successfully posted to ledger.", "success");
      setInputFeedback({ text: `Completed! Transferred ${transferQty} units into ${dstBin}.`, type: "ok" });

      // Refresh task list
      await fetchReplenishTasks();
    } catch (err: any) {
      playAudioTone("error");
      triggerVibrate([300, 100, 300]);
      onNotification?.("Replenishment Error", err.message || "Transfer failed.", "error");
      setInputFeedback({ text: err.message || "Replenishment confirmation failed.", type: "err" });
    } finally {
      setExecutingRep(false);
    }
  };

  return (
    <div className="w-full flex flex-col space-y-4">
      {/* ---------------------------------------------------------------------
          Top Industrial Terminal Header
      --------------------------------------------------------------------- */}
      <div className="p-4 bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
            <ScanLine className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-theme-text-primary tracking-wide">
                RF Gun Terminal & Mobile Replenishment
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                ONLINE RF LINK
              </span>
            </div>
            <p className="text-xs text-theme-muted mt-0.5">
              Optimized for handheld laser scanners, Zebra/Honeywell wedge terminals, and tactile warehouse floor operations
            </p>
          </div>
        </div>

        {/* Warehouse Selector & Sound / Vibrate Toggles */}
        <div className="flex items-center space-x-2">
          <select
            value={selectedWhId}
            onChange={(e) => setSelectedWhId(e.target.value)}
            className="px-3 py-1.5 bg-theme-surface-2 border border-theme-divider rounded-xl text-xs font-semibold text-theme-text-primary focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.code} - {wh.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center transition-all cursor-pointer ${
              audioEnabled
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                : "bg-theme-surface-2 text-theme-muted border-theme-divider"
            }`}
            title={audioEnabled ? "Audio Chime Enabled" : "Audio Muted"}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------
          Mode Selector Bar (Large Touch Targets for Mobile Scanners)
      --------------------------------------------------------------------- */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("REPLENISH");
            setInputFeedback(null);
          }}
          className={`py-3 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mode === "REPLENISH"
              ? "bg-indigo-600 text-white border-indigo-500 shadow-md scale-[1.01]"
              : "bg-theme-surface-1 text-theme-muted border-theme-divider hover:text-theme-text-primary"
          }`}
        >
          <Zap className="w-4 h-4" />
          Directed Replenish
          {replenishTasks.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              mode === "REPLENISH" ? "bg-white text-indigo-700 font-black" : "bg-indigo-500/20 text-indigo-400"
            }`}>
              {replenishTasks.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("AUDIT");
            setInputFeedback(null);
          }}
          className={`py-3 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mode === "AUDIT"
              ? "bg-indigo-600 text-white border-indigo-500 shadow-md scale-[1.01]"
              : "bg-theme-surface-1 text-theme-muted border-theme-divider hover:text-theme-text-primary"
          }`}
        >
          <Search className="w-4 h-4" />
          Bin Barcode Audit
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("RELOCATE");
            setInputFeedback(null);
          }}
          className={`py-3 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            mode === "RELOCATE"
              ? "bg-indigo-600 text-white border-indigo-500 shadow-md scale-[1.01]"
              : "bg-theme-surface-1 text-theme-muted border-theme-divider hover:text-theme-text-primary"
          }`}
        >
          <ArrowRightLeft className="w-4 h-4" />
          Quick Relocate
        </button>
      </div>

      {/* ---------------------------------------------------------------------
          Universal Hardware Scanner Barcode Input Box
      --------------------------------------------------------------------- */}
      <div className="p-4 bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleUniversalScan(scanBuffer);
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <ScanLine className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400 animate-pulse" />
            <input
              ref={scanInputRef}
              type="text"
              autoFocus
              value={scanBuffer}
              onChange={(e) => setScanBuffer(e.target.value)}
              placeholder={
                mode === "REPLENISH"
                  ? repStep === 1
                    ? "Step 1: Point laser at SOURCE BIN barcode..."
                    : repStep === 2
                    ? "Step 2: Point laser at ITEM SKU barcode..."
                    : repStep === 3
                    ? "Step 3: Press 'Next' or hit Enter to confirm quantity..."
                    : "Step 4: Point laser at DESTINATION PICKING BIN barcode..."
                  : mode === "AUDIT"
                  ? "Scan or enter any Location Bin / Item barcode to inspect live stock..."
                  : !relFromBin
                  ? "Scan SOURCE BIN barcode to relocate from..."
                  : !relItemId
                  ? "Scan ITEM barcode to move..."
                  : "Scan DESTINATION BIN barcode to deposit into..."
              }
              className="w-full pl-11 pr-24 py-3 bg-theme-surface-2 border border-theme-divider rounded-xl text-sm font-mono text-theme-text-primary placeholder:text-theme-muted/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
            {scanBuffer && (
              <button
                type="button"
                onClick={() => setScanBuffer("")}
                className="absolute right-20 top-1/2 -translate-y-1/2 p-1 text-theme-muted hover:text-theme-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
              Scan
            </button>
          </div>
        </form>

        {/* Tactile Feedback Banner */}
        {inputFeedback && (
          <div
            className={`mt-2.5 px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              inputFeedback.type === "ok"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            }`}
          >
            {inputFeedback.type === "ok" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{inputFeedback.text}</span>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------------
          MODE 1: DIRECTED REPLENISHMENT WALK VIEW
      --------------------------------------------------------------------- */}
      {mode === "REPLENISH" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Active Task 4-Step Execution Wizard */}
          <div className="lg:col-span-2 space-y-4">
            {activeTask ? (
              <div className="p-5 bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-sm space-y-4">
                {/* Header info */}
                <div className="flex items-center justify-between border-b border-theme-divider pb-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      TASK ID: {activeTask.task_id}
                    </span>
                    <h3 className="text-sm font-bold text-theme-text-primary mt-1">
                      {activeTask.product_name}
                    </h3>
                    <p className="text-xs text-theme-muted font-mono">
                      SKU: {activeTask.item_code}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        activeTask.priority === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse"
                          : activeTask.priority === "HIGH"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                      }`}
                    >
                      {activeTask.priority}
                    </span>
                    <p className="text-[11px] text-theme-muted mt-1">
                      Suggested: <span className="font-bold text-theme-text-primary">{activeTask.suggested_quantity} units</span>
                    </p>
                  </div>
                </div>

                {/* 4-Step Progressive Walk Sequence */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  {/* Step 1 */}
                  <div
                    className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                      repStep === 1
                        ? "bg-indigo-600/10 border-indigo-500 ring-2 ring-indigo-500/30 text-indigo-300"
                        : scannedSrcBin
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-theme-surface-2 border-theme-divider text-theme-muted"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase mb-1">
                        <span>1. Source Bin</span>
                        {scannedSrcBin && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <p className="text-xs font-mono font-bold truncate">
                        {activeTask.source_bin || "ANY BULK"}
                      </p>
                    </div>
                    <span className="text-[10px] text-theme-muted mt-2">
                      {scannedSrcBin ? `Scanned: ${scannedSrcBin}` : "Scan bulk rack"}
                    </span>
                  </div>

                  {/* Step 2 */}
                  <div
                    className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                      repStep === 2
                        ? "bg-indigo-600/10 border-indigo-500 ring-2 ring-indigo-500/30 text-indigo-300"
                        : scannedItemCode
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-theme-surface-2 border-theme-divider text-theme-muted"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase mb-1">
                        <span>2. Item SKU</span>
                        {scannedItemCode && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <p className="text-xs font-mono font-bold truncate">
                        {activeTask.item_code}
                      </p>
                    </div>
                    <span className="text-[10px] text-theme-muted mt-2">
                      {scannedItemCode ? `Verified SKU` : "Scan product tag"}
                    </span>
                  </div>

                  {/* Step 3 */}
                  <div
                    className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                      repStep === 3
                        ? "bg-indigo-600/10 border-indigo-500 ring-2 ring-indigo-500/30 text-indigo-300"
                        : repStep > 3
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-theme-surface-2 border-theme-divider text-theme-muted"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase mb-1">
                        <span>3. Pick Qty</span>
                        {repStep > 3 && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <button
                          type="button"
                          onClick={() => setTransferQty(Math.max(1, transferQty - 1))}
                          className="w-5 h-5 rounded bg-theme-surface-3 flex items-center justify-center text-xs font-bold text-theme-text-primary"
                        >
                          -
                        </button>
                        <span className="text-xs font-mono font-bold text-theme-text-primary px-1">
                          {transferQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTransferQty(transferQty + 1)}
                          className="w-5 h-5 rounded bg-theme-surface-3 flex items-center justify-center text-xs font-bold text-theme-text-primary"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    {repStep === 3 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setRepStep(4);
                          playAudioTone("success");
                          setInputFeedback({ text: `Quantity ${transferQty} confirmed. Scan target bin.`, type: "ok" });
                        }}
                        className="mt-2 py-0.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold"
                      >
                        Confirm Qty →
                      </button>
                    ) : (
                      <span className="text-[10px] text-theme-muted mt-2">{transferQty} units</span>
                    )}
                  </div>

                  {/* Step 4 */}
                  <div
                    className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                      repStep === 4
                        ? "bg-indigo-600/10 border-indigo-500 ring-2 ring-indigo-500/30 text-indigo-300"
                        : scannedDstBin
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                        : "bg-theme-surface-2 border-theme-divider text-theme-muted"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase mb-1">
                        <span>4. Picking Bin</span>
                        {scannedDstBin && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                      </div>
                      <p className="text-xs font-mono font-bold truncate">
                        {activeTask.picking_bin}
                      </p>
                    </div>
                    <span className="text-[10px] text-theme-muted mt-2">
                      {scannedDstBin ? `Deposited` : "Scan picking face"}
                    </span>
                  </div>
                </div>

                {/* Instruction banner for current step */}
                <div className="p-3 bg-theme-surface-2 rounded-xl border border-theme-divider flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                    <span className="text-xs font-semibold text-theme-text-primary">
                      {repStep === 1
                        ? `Navigate to aisle/shelf and scan Source Bin '${activeTask.source_bin}'`
                        : repStep === 2
                        ? `Scan barcode on '${activeTask.product_name}' to verify product`
                        : repStep === 3
                        ? `Confirm ${transferQty} units picked from reserve`
                        : `Navigate to picking face and scan Destination Bin '${activeTask.picking_bin}'`}
                    </span>
                  </div>
                  {repStep === 4 && (
                    <button
                      type="button"
                      disabled={executingRep}
                      onClick={() => executeDirectedReplenish(activeTask.picking_bin)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {executingRep ? "Posting..." : "Confirm Move"}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-8 bg-theme-surface-1 border border-theme-divider rounded-2xl text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h3 className="text-sm font-bold text-theme-text-primary">
                  All Picking Bins Fully Replenished!
                </h3>
                <p className="text-xs text-theme-muted max-w-sm mx-auto">
                  No critical or high replenishment tasks currently pending in this warehouse godown.
                </p>
                <button
                  type="button"
                  onClick={fetchReplenishTasks}
                  className="mt-2 px-3 py-1.5 rounded-xl bg-theme-surface-2 border border-theme-divider text-xs font-semibold text-theme-text-primary inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Check Again
                </button>
              </div>
            )}
          </div>

          {/* Task Queue Sidebar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-theme-text-primary tracking-wide flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-indigo-400" />
                Pending Replenish Queue ({replenishTasks.length})
              </h4>
              <button
                type="button"
                onClick={fetchReplenishTasks}
                className="p-1 rounded text-theme-muted hover:text-theme-text-primary"
                title="Refresh Task Queue"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTasks ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {replenishTasks.map((t) => {
                const isSelected = activeTask?.task_id === t.task_id;
                return (
                  <div
                    key={t.task_id}
                    onClick={() => pickTask(t)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? "bg-indigo-600/15 border-indigo-500 shadow-sm"
                        : "bg-theme-surface-1 border-theme-divider hover:border-indigo-500/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                          t.priority === "CRITICAL"
                            ? "bg-rose-500/20 text-rose-400 font-black"
                            : t.priority === "HIGH"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-sky-500/20 text-sky-400"
                        }`}
                      >
                        {t.priority}
                      </span>
                      <span className="text-[10px] font-mono text-theme-muted font-bold">
                        +{t.suggested_quantity} pcs
                      </span>
                    </div>
                    <p className="text-xs font-bold text-theme-text-primary truncate">
                      {t.product_name}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-theme-muted mt-1 font-mono">
                      <span>{t.source_bin || "BULK"}</span>
                      <ArrowRightLeft className="w-3 h-3 text-indigo-400" />
                      <span className="text-emerald-400 font-bold">{t.picking_bin}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------
          MODE 2: BIN AUDIT & LIVE STOCK INQUIRY
      --------------------------------------------------------------------- */}
      {mode === "AUDIT" && (
        <div className="space-y-4">
          {auditResult ? (
            <div className="p-5 bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-theme-divider pb-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-theme-text-primary">
                      Bin: {auditResult.bin_code}
                    </h3>
                    <p className="text-xs text-theme-muted">
                      Zone: <span className="font-semibold text-theme-text-primary">{auditResult.zone}</span> | Barcode: {auditResult.barcode || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {auditResult.is_locked ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      LOCKED
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ACTIVE
                    </span>
                  )}
                </div>
              </div>

              {/* Physical Headroom Meter */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-theme-text-primary">
                    Occupancy: {auditResult.total_units_occupied} / {auditResult.max_capacity_units} units
                  </span>
                  <span className="font-bold text-emerald-400">
                    Headroom: {auditResult.headroom_units} units available
                  </span>
                </div>
                <div className="w-full h-3 bg-theme-surface-2 rounded-full overflow-hidden border border-theme-divider">
                  <div
                    className={`h-full transition-all rounded-full ${
                      auditResult.total_units_occupied >= auditResult.max_capacity_units
                        ? "bg-rose-500"
                        : auditResult.total_units_occupied > auditResult.max_capacity_units * 0.8
                        ? "bg-amber-500"
                        : "bg-indigo-500"
                    }`}
                    style={{
                      width: `${Math.min(100, (auditResult.total_units_occupied / Math.max(1, auditResult.max_capacity_units)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Occupied Items Table */}
              <div>
                <h4 className="text-xs font-bold text-theme-text-primary mb-2 flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-indigo-400" />
                  Current Stored SKUs ({auditResult.items.length})
                </h4>

                {auditResult.items.length > 0 ? (
                  <div className="border border-theme-divider rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-theme-surface-2 text-theme-muted font-bold border-b border-theme-divider">
                        <tr>
                          <th className="px-3 py-2">Item Code / SKU</th>
                          <th className="px-3 py-2">Product Name</th>
                          <th className="px-3 py-2">Batch</th>
                          <th className="px-3 py-2 text-right">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-theme-divider">
                        {auditResult.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-theme-surface-2/50">
                            <td className="px-3 py-2 font-mono font-bold text-theme-text-primary">
                              {it.item_code}
                            </td>
                            <td className="px-3 py-2 text-theme-body">{it.item_name}</td>
                            <td className="px-3 py-2 font-mono text-theme-muted">
                              {it.batch_no || "-"}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-400">
                              {it.quantity}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-theme-muted italic">This bin is currently empty.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 bg-theme-surface-1 border border-theme-divider rounded-2xl text-center space-y-2">
              <Search className="w-10 h-10 text-theme-muted mx-auto" />
              <h3 className="text-sm font-bold text-theme-text-primary">
                Scan or Enter Any Bin Barcode
              </h3>
              <p className="text-xs text-theme-muted max-w-sm mx-auto">
                Trigger laser scan on rack label to view real-time occupancy headroom and stored SKU ledger rows.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------
          MODE 3: QUICK RELOCATE VIEW
      --------------------------------------------------------------------- */}
      {mode === "RELOCATE" && (
        <div className="p-5 bg-theme-surface-1 border border-theme-divider rounded-2xl shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-theme-text-primary flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
              Ad-Hoc Stock Relocation (Floor Move)
            </h3>
            <p className="text-xs text-theme-muted">
              Rapidly transfer goods between physical racks or bins in under 4 seconds without creating formal STO documents.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* From Bin */}
            <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
              <label className="text-[10px] font-bold uppercase text-theme-muted block mb-1">
                Source Bin
              </label>
              <input
                type="text"
                value={relFromBin}
                onChange={(e) => setRelFromBin(e.target.value.toUpperCase())}
                placeholder="e.g. A-01-R01"
                className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-theme-text-primary"
              />
            </div>

            {/* Item */}
            <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
              <label className="text-[10px] font-bold uppercase text-theme-muted block mb-1">
                Item Code / SKU
              </label>
              <input
                type="text"
                value={relItemCode}
                onChange={(e) => {
                  setRelItemCode(e.target.value);
                  setRelItemId(e.target.value);
                }}
                placeholder="Scan / enter SKU"
                className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-theme-text-primary"
              />
            </div>

            {/* Qty */}
            <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
              <label className="text-[10px] font-bold uppercase text-theme-muted block mb-1">
                Quantity
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRelQty(Math.max(1, relQty - 1))}
                  className="w-7 h-7 rounded-lg bg-theme-surface-3 flex items-center justify-center font-bold text-xs"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={relQty}
                  onChange={(e) => setRelQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-center bg-theme-surface-1 border border-theme-divider rounded-lg py-1.5 text-xs font-mono font-bold text-theme-text-primary"
                />
                <button
                  type="button"
                  onClick={() => setRelQty(relQty + 1)}
                  className="w-7 h-7 rounded-lg bg-theme-surface-3 flex items-center justify-center font-bold text-xs"
                >
                  +
                </button>
              </div>
            </div>

            {/* To Bin */}
            <div className="p-3 bg-theme-surface-2 border border-theme-divider rounded-xl">
              <label className="text-[10px] font-bold uppercase text-theme-muted block mb-1">
                Destination Bin
              </label>
              <input
                type="text"
                value={relToBin}
                onChange={(e) => setRelToBin(e.target.value.toUpperCase())}
                placeholder="e.g. B-02-R01"
                className="w-full bg-theme-surface-1 border border-theme-divider rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-theme-text-primary"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={relocateLoading || !relFromBin || !relToBin || !relItemCode}
              onClick={handleQuickRelocateSubmit}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Zap className="w-4 h-4" />
              {relocateLoading ? "Executing Dual Move..." : "⚡ Post Relocation Move"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
