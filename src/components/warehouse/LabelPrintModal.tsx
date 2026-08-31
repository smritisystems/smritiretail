/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.116.0
 * Created      : 2026-08-28
 * Modified     : 2026-08-28
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useMemo } from "react";
import LabelPrintEngine, {
  PrintJob, PrintJobStatus, LabelTemplate,
  DEFAULT_TEMPLATE, BarcodeFormat,
} from "../../utils/labelPrintEngine";

interface LabelPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotification?: (title: string, msg: string, type: "success" | "error" | "info") => void;
}

const STATUS_STYLE: Record<PrintJobStatus, string> = {
  QUEUED:    "text-amber-300 bg-amber-500/15 border-amber-500/25",
  PRINTING:  "text-sky-300 bg-sky-500/15 border-sky-500/25",
  PRINTED:   "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
  FAILED:    "text-rose-300 bg-rose-500/15 border-rose-500/25",
  CANCELLED: "text-slate-400 bg-slate-700/15 border-slate-600/25",
};

const FORMAT_STYLE: Record<BarcodeFormat, string> = {
  CODE128: "text-violet-300",
  QR_CODE: "text-teal-300",
  EAN13:   "text-sky-300",
  CODE39:  "text-amber-300",
};

const SAMPLE_ITEMS = [
  { sku: "FAB-DENIM-BLU",  productName: "Denim Blue 1m",   mrp: 250, barcode: "8901234567890", hsnCode: "5209", qty: 5, copies: 2 },
  { sku: "FAB-COTTON-WHT", productName: "Cotton White 1m",  mrp: 120, barcode: "8901234567891", hsnCode: "5208", qty: 3, copies: 1 },
  { sku: "ACC-BELT-BRN",   productName: "Leather Belt",     mrp: 350, barcode: "8901234567892", hsnCode: "4205", qty: 2, copies: 2 },
  { sku: "ACC-SCARF-BLUE", productName: "Blue Scarf",       mrp: 180, barcode: "8901234567893", hsnCode: "6214", qty: 4, copies: 1 },
];

function buildSampleJobs(): PrintJob[] {
  const j1 = LabelPrintEngine.createJob({ template: DEFAULT_TEMPLATE, branchCode: "BR-MUM-01", createdBy: "MGR-001", items: SAMPLE_ITEMS });
  const j1s = LabelPrintEngine.startPrint(j1, "OP-001");
  const j1p = LabelPrintEngine.completePrint(j1s, "OP-001");
  const j2 = LabelPrintEngine.createJob({ template: DEFAULT_TEMPLATE, branchCode: "BR-MUM-01", createdBy: "MGR-001", items: SAMPLE_ITEMS.slice(0, 2) });
  return [j1p, j2];
}

export const LabelPrintModal: React.FC<LabelPrintModalProps> = ({ isOpen, onClose, onNotification }) => {
  const [jobs, setJobs] = useState<PrintJob[]>(buildSampleJobs);
  const [selectedId, setSelectedId] = useState(jobs[0]?.jobId ?? "");
  const [activeTab, setActiveTab] = useState<"ITEMS" | "TEMPLATE" | "AUDIT">("ITEMS");

  const selected = jobs.find((j) => j.jobId === selectedId);
  const summary  = useMemo(() => LabelPrintEngine.queueSummary(jobs), [jobs]);

  if (!isOpen) return null;

  const update = (updated: PrintJob) => setJobs((prev) => prev.map((j) => j.jobId === updated.jobId ? updated : j));

  const handleStart = () => {
    if (!selected) return;
    try { update(LabelPrintEngine.startPrint(selected, "OP-001")); onNotification?.("Printing", `${selected.jobNo} â€” ${selected.totalLabels} labels`, "info"); }
    catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  const handleComplete = () => {
    if (!selected) return;
    try { update(LabelPrintEngine.completePrint(selected, "OP-001")); onNotification?.("Printed", `${selected.totalLabels} labels complete`, "success"); }
    catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  const handleFail = () => {
    if (!selected) return;
    try { update(LabelPrintEngine.failPrint(selected, "OP-001", "Printer offline")); onNotification?.("Failed", `${selected.jobNo} failed`, "error"); }
    catch (e: any) { onNotification?.("Error", e.message, "error"); }
  };

  const handleReprint = () => {
    if (!selected) return;
    const rp = LabelPrintEngine.reprint(selected, DEFAULT_TEMPLATE, "MGR-001");
    setJobs((prev) => [rp, ...prev]);
    setSelectedId(rp.jobId);
    onNotification?.("Reprint Queued", `${rp.jobNo} â€” ${rp.totalLabels} labels`, "info");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <span className="material-symbols-outlined text-2xl">print</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Barcode & Label Printing Engine</h2>
              <p className="text-xs text-slate-400">Templates Â· Print Queue Â· CODE128 / QR / EAN13 Â· Reprint</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(["ITEMS", "TEMPLATE", "AUDIT"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === tab ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "text-slate-400 hover:text-slate-200"}`}>
                {tab === "TEMPLATE" ? "Template" : tab === "AUDIT" ? "Audit" : "Print Items"}
              </button>
            ))}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-2 transition-colors">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Queue summary strip */}
        <div className="flex items-center gap-5 px-6 py-2.5 border-b border-slate-800 bg-slate-950/40 text-xs overflow-x-auto">
          {[
            { label: "Queued",   value: summary.queued,        style: STATUS_STYLE.QUEUED },
            { label: "Printing", value: summary.printing,      style: STATUS_STYLE.PRINTING },
            { label: "Printed",  value: summary.printed,       style: STATUS_STYLE.PRINTED },
            { label: "Failed",   value: summary.failed,        style: STATUS_STYLE.FAILED },
            { label: "Reprints", value: summary.reprintCount,  style: "text-slate-300" },
            { label: "Total Labels", value: summary.totalLabels, style: "text-teal-400 font-black" },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-slate-600">{m.label}:</span>
              <span className={`font-mono font-bold ${m.style.split(" ")[0]}`}>{m.value}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Job sidebar */}
          <div className="w-56 border-r border-slate-800 overflow-y-auto bg-slate-950/30 p-3 space-y-2">
            {jobs.map((j) => (
              <button key={j.jobId} onClick={() => { setSelectedId(j.jobId); setActiveTab("ITEMS"); }}
                className={`w-full text-left p-3 rounded-xl border transition-all ${selectedId === j.jobId ? "bg-teal-950/20 border-teal-500/40" : "border-transparent hover:bg-slate-800/60"}`}>
                <p className="text-[10px] font-mono font-bold text-slate-200">{j.jobNo}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{j.items.length} SKU(s)</p>
                <p className="text-xs font-bold text-teal-400 mt-0.5">{j.totalLabels} labels</p>
                <div className="flex gap-1 mt-1.5">
                  <span className={`text-[8px] font-bold px-1 py-0.5 rounded-full border ${STATUS_STYLE[j.status]}`}>{j.status}</span>
                  {j.isReprint && <span className="text-[8px] font-bold text-slate-400 bg-slate-700/20 border border-slate-600/20 px-1 py-0.5 rounded-full">REPRINT</span>}
                </div>
              </button>
            ))}
          </div>

          {selected && (
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <p className="text-lg font-bold font-mono text-slate-100">{selected.jobNo}</p>
                  <p className="text-xs text-slate-400">{selected.branchCode} Â· {selected.templateName} Â· {FORMAT_STYLE[DEFAULT_TEMPLATE.barcodeFormat] ? <span className={FORMAT_STYLE[DEFAULT_TEMPLATE.barcodeFormat]}>{DEFAULT_TEMPLATE.barcodeFormat}</span> : DEFAULT_TEMPLATE.barcodeFormat}</p>
                  {selected.isReprint && <p className="text-[10px] text-amber-400">â†© Reprint of {selected.originalJobId}</p>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
                  {selected.status === "QUEUED"   && <button onClick={handleStart}    className="px-3 py-1.5 text-xs font-bold text-white bg-sky-700 hover:bg-sky-600 rounded-xl">Start Print</button>}
                  {selected.status === "PRINTING" && <button onClick={handleComplete} className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl">Mark Printed</button>}
                  {selected.status === "PRINTING" && <button onClick={handleFail}     className="px-3 py-1.5 text-xs font-bold text-rose-300 border border-rose-500/30 rounded-xl">Fail</button>}
                  {selected.status === "PRINTED"  && <button onClick={handleReprint}  className="px-3 py-1.5 text-xs font-bold text-teal-300 border border-teal-500/30 hover:bg-teal-950/30 rounded-xl">â†© Reprint</button>}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "SKUs",         value: selected.items.length,    color: "text-slate-300" },
                  { label: "Total Labels", value: selected.totalLabels,     color: "text-teal-400 font-black" },
                  { label: "Status",       value: selected.status,          color: STATUS_STYLE[selected.status].split(" ")[0] },
                  { label: "Printed At",   value: selected.printedAt ? new Date(selected.printedAt).toLocaleTimeString("en-IN") : "â€”", color: "text-slate-400" },
                ].map((m) => (
                  <div key={m.label} className="bg-slate-800/30 border border-slate-700/60 rounded-xl p-3 text-center">
                    <div className={`font-bold font-mono text-sm ${m.color}`}>{m.value}</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>

              {activeTab === "ITEMS" && (
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="text-slate-500 uppercase text-[10px] border-b border-slate-800 bg-slate-950/60">
                      <th className="py-2 px-3">Product</th>
                      <th className="py-2 px-3">Barcode</th>
                      <th className="py-2 px-3 text-right">MRP</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Copies</th>
                      <th className="py-2 px-3 text-right">Labels</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-800/40 font-mono">
                      {selected.items.map((i) => (
                        <tr key={i.itemId}>
                          <td className="py-2 px-3 font-sans"><p className="text-xs text-slate-200">{i.productName}</p><p className="text-[10px] text-slate-500">{i.sku}{i.hsnCode ? ` Â· HSN ${i.hsnCode}` : ""}</p></td>
                          <td className="py-2 px-3 text-[10px] text-slate-400">{i.barcode}</td>
                          <td className="py-2 px-3 text-right text-slate-300">â‚¹{i.mrp}</td>
                          <td className="py-2 px-3 text-right text-slate-400">{i.qty}</td>
                          <td className="py-2 px-3 text-right text-slate-400">{i.copies}</td>
                          <td className="py-2 px-3 text-right text-teal-400 font-bold">{i.qty * i.copies}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-900/40 font-bold border-t border-slate-700/40">
                        <td colSpan={5} className="py-2 px-3 text-slate-400 text-right font-sans text-xs">Total Labels</td>
                        <td className="py-2 px-3 text-right text-teal-400">{selected.totalLabels}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "TEMPLATE" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { label: "Template Code", value: DEFAULT_TEMPLATE.templateCode },
                      { label: "Format",        value: DEFAULT_TEMPLATE.barcodeFormat },
                      { label: "Dimensions",    value: `${DEFAULT_TEMPLATE.width}mm Ã— ${DEFAULT_TEMPLATE.height}mm` },
                      { label: "Default Copies", value: String(DEFAULT_TEMPLATE.copies) },
                    ].map((m) => (
                      <div key={m.label} className="flex items-center justify-between px-3 py-2 bg-slate-800/30 border border-slate-700/60 rounded-lg">
                        <span className="text-slate-500">{m.label}</span>
                        <span className="font-mono text-slate-300">{m.value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-2">Label Fields</p>
                  <div className="space-y-1.5">
                    {DEFAULT_TEMPLATE.fields.map((f) => (
                      <div key={f.fieldKey} className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs ${f.visible ? "bg-teal-950/10 border-teal-500/20" : "bg-slate-900/20 border-slate-800/30"}`}>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${f.visible ? "text-teal-300 bg-teal-500/10" : "text-slate-600 bg-slate-700/10"}`}>{f.visible ? "ON" : "OFF"}</span>
                        <span className="font-mono text-slate-400 w-20">{f.fieldKey}</span>
                        <span className="text-slate-300">{f.label}</span>
                        <span className="ml-auto text-slate-500">{f.fontSize}pt{f.bold ? " Â· bold" : ""} Â· {f.position}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "AUDIT" && (
                <div className="space-y-1.5">
                  {[...selected.auditTrail].reverse().map((e) => (
                    <div key={e.auditId} className="flex items-center gap-3 px-3 py-2 bg-slate-800/30 border border-slate-800/50 rounded-lg text-xs">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                        e.action === "PRINT_COMPLETED" ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/20"
                        : e.action === "PRINT_FAILED"    ? "text-rose-300 bg-rose-500/10 border-rose-500/20"
                        : e.action === "PRINT_STARTED"   ? "text-sky-300 bg-sky-500/10 border-sky-500/20"
                        : "text-slate-400 bg-slate-700/10 border-slate-600/20"
                      }`}>{e.action.replace(/_/g, " ")}</span>
                      <span className="text-slate-400 flex-1 truncate">{e.note}</span>
                      <span className="text-[10px] text-slate-600 flex-shrink-0">{e.performedBy}</span>
                      <span className="text-[10px] text-slate-600 flex-shrink-0">{new Date(e.timestamp).toLocaleTimeString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-slate-950/80">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

export default LabelPrintModal;

