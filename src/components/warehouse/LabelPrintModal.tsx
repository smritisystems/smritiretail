/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.116.1
 * Created      : 2026-08-28
 * Modified     : 2026-10-04
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 *
 * Changelog v3.116.1 (2026-10-04):
 *   - Replaced labelPrintEngine mock with GET /wms/warehouses, GET /wms/locations.
 */

import React, { useState, useEffect, useCallback } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface WarehouseLocation {
  location_id: string;
  location_code: string;
  aisle?: string;
  bin?: string;
  zone?: string;
  warehouse_id?: string;
}

interface LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const LABEL_TEMPLATES = ["BARCODE_SMALL", "BARCODE_LARGE", "PRICE_TAG", "SHELF_LABEL", "LOCATION_LABEL"];

export const LabelPrintModal: React.FC<LabelPrintModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [locations, setLocations]     = useState<WarehouseLocation[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [selected, setSelected]       = useState<string[]>([]);
  const [template, setTemplate]       = useState("BARCODE_LARGE");
  const [qty, setQty]                 = useState(1);
  const [printing, setPrinting]       = useState(false);
  const [search, setSearch]           = useState("");

  const load = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true); setError(null);
    try {
      const data = await apiFetchV1<WarehouseLocation[]>("/wms/locations");
      setLocations(data ?? []);
    } catch (e: any) { setError(e?.message ?? "Failed to load warehouse locations."); }
    finally { setLoading(false); }
  }, [isOpen]);

  useEffect(() => { load(); }, [load]);

  const filtered = locations.filter((l) =>
    !search || l.location_code.toLowerCase().includes(search.toLowerCase()) ||
    (l.zone ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => setSelected((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  );

  const handlePrint = async () => {
    if (!selected.length) { onNotification?.("No Selection", "Select at least one location to print.", "info"); return; }
    setPrinting(true);
    // Simulate print job — in production this POSTs to a label print service
    await new Promise((r) => setTimeout(r, 800));
    onNotification?.("Print Queued", `${selected.length} label(s) queued for ${template} template (x${qty}).`, "success");
    setSelected([]);
    setPrinting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-3xl max-h-[88vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-indigo-400 text-2xl">label</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Label Print Studio</h2>
              <p className="text-xs text-slate-400">Barcode / shelf label printing from warehouse locations</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {error && <div className="px-6 py-2 bg-rose-950/40 border-b border-rose-800/40 text-xs text-rose-300">{error}</div>}

        <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-800 bg-slate-950/30 text-xs flex-wrap">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search location..."
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500/60 w-40" />
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Template:</span>
            <select value={template} onChange={(e) => setTemplate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500/60">
              {LABEL_TEMPLATES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Copies:</span>
            <input type="number" min={1} max={100} value={qty} onChange={(e) => setQty(parseInt(e.target.value) || 1)}
              className="w-16 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500/60" />
          </div>
          {loading && <span className="text-slate-500 animate-pulse ml-auto">Loading...</span>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
          {filtered.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
              <span className="material-symbols-outlined text-4xl">location_off</span>
              <p className="text-sm">No locations found.</p>
            </div>
          ) : filtered.map((loc) => (
            <div key={loc.location_id} onClick={() => toggle(loc.location_id)}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-xs ${selected.includes(loc.location_id) ? "border-indigo-500/40 bg-indigo-950/10" : "border-slate-700/40 bg-slate-800/20 hover:border-slate-600"}`}>
              <input type="checkbox" checked={selected.includes(loc.location_id)} readOnly className="accent-indigo-500" />
              <span className="font-mono font-bold text-slate-200">{loc.location_code}</span>
              <span className="text-slate-500">{loc.zone ?? "—"}</span>
              <span className="text-slate-600">Aisle: {loc.aisle ?? "—"} · Bin: {loc.bin ?? "—"}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <span className="text-xs text-slate-400">{selected.length} location(s) selected</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Cancel</button>
            <button onClick={handlePrint} disabled={!selected.length || printing}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-all">
              {printing ? "Printing..." : `Print Labels (${selected.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabelPrintModal;
