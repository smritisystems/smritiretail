import React, { useMemo, useState } from "react";
import { CalendarRange, Check, Download, FileJson, Filter, LoaderCircle, RefreshCw, Send, Truck, X } from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

type FilterMode = "selected" | "all" | "date_range" | "bill_range";
type BatchResult = "GENERATED" | "PREVIEWED" | "SKIPPED" | "FAILED";

interface EWayBillRow {
  invoice_id: string;
  invoice_no: string;
  invoice_date: string;
  status: string;
  customer_name?: string;
  customer_gstin?: string;
  grand_total: number;
  item_count: number;
  eway_bill_no?: string | null;
  eligible: boolean;
  reason?: string | null;
  payload?: Record<string, unknown>;
  result?: BatchResult;
  valid_upto?: string;
}

interface EWayBillManagementTabProps {
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
}

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);

export const EWayBillManagementTab: React.FC<EWayBillManagementTabProps> = ({ onNotification }) => {
  const [mode, setMode] = useState<FilterMode>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [billFrom, setBillFrom] = useState("");
  const [billTo, setBillTo] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [transMode, setTransMode] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");
  const [transporterId, setTransporterId] = useState("");
  const [transporterName, setTransporterName] = useState("");
  const [transportDocNo, setTransportDocNo] = useState("");
  const [rows, setRows] = useState<EWayBillRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<"preview" | "generate" | null>(null);
  const [lastRun, setLastRun] = useState<{ generated: number; skipped: number; failed: number } | null>(null);

  const eligibleRows = useMemo(() => rows.filter((row) => row.eligible && !row.eway_bill_no), [rows]);
  const allEligibleSelected = eligibleRows.length > 0 && eligibleRows.every((row) => selectedIds.includes(row.invoice_id));

  const buildFilter = (requestedMode: FilterMode = mode) => ({
    mode: requestedMode,
    invoice_ids: requestedMode === "selected" ? selectedIds : [],
    date_from: requestedMode === "date_range" ? dateFrom || null : null,
    date_to: requestedMode === "date_range" ? dateTo || null : null,
    bill_from: requestedMode === "bill_range" ? billFrom || null : null,
    bill_to: requestedMode === "bill_range" ? billTo || null : null,
    include_existing: false,
    distance_km: distanceKm ? Number(distanceKm) : null,
    trans_mode: transMode || null,
    vehicle_no: vehicleNo.trim() || null,
    transporter_id: transporterId.trim() || null,
    transporter_name: transporterName.trim() || null,
    trans_doc_no: transportDocNo.trim() || null,
  });

  const transportReady = Boolean(distanceKm && transMode && (transMode === "1" ? vehicleNo.trim() : transportDocNo.trim()));

  const preview = async (requestedMode: FilterMode = mode) => {
    setBusy("preview");
    try {
      const data = await apiFetchV1("/compliance/ewaybill-management/preview", { method: "POST", body: buildFilter(requestedMode) });
      const nextRows = Array.isArray(data?.invoices) ? data.invoices : [];
      setRows(nextRows);
      setSelectedIds(nextRows.filter((row: EWayBillRow) => row.eligible && !row.eway_bill_no).map((row: EWayBillRow) => row.invoice_id));
      onNotification?.("E-Way Bill Set Ready", `${data.eligible} eligible invoice(s) found from ${data.total} invoice(s).`, "info");
    } catch (error: any) {
      onNotification?.("Preview Failed", error?.message || "Unable to load the invoice set.", "error");
    } finally {
      setBusy(null);
    }
  };

  const generate = async (requestedMode: FilterMode) => {
    if (!transportReady) {
      onNotification?.("Transport details required", "Enter distance, transport mode, and vehicle or transport document details before generation.", "error");
      return;
    }
    if (requestedMode === "selected" && selectedIds.length === 0) {
      onNotification?.("No Invoices Selected", "Select at least one eligible invoice.", "error");
      return;
    }
    setBusy("generate");
    try {
      const data = await apiFetchV1("/compliance/ewaybill-management/generate", {
        method: "POST",
        body: { ...buildFilter(requestedMode), dry_run: false },
      });
      setLastRun({ generated: data.generated || 0, skipped: data.skipped || 0, failed: data.failed || 0 });
      const resultRows = Array.isArray(data?.results) ? data.results : [];
      setRows(resultRows);
      setSelectedIds([]);
      onNotification?.("E-Way Bill Batch Complete", `${data.generated || 0} generated, ${data.skipped || 0} skipped, ${data.failed || 0} failed.`, data.failed ? "warning" : "success");
    } catch (error: any) {
      onNotification?.("Generation Failed", error?.message || "The batch could not be submitted.", "error");
    } finally {
      setBusy(null);
    }
  };

  const downloadJson = () => {
    const selected = rows.filter((row) => selectedIds.includes(row.invoice_id));
    const blob = new Blob([JSON.stringify(selected.length ? selected : rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `eway-bill-${mode}-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const toggleAll = () => setSelectedIds(allEligibleSelected ? [] : eligibleRows.map((row) => row.invoice_id));
  const toggleRow = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  return (
    <div className="h-full overflow-auto bg-[#f5f7fb] text-[#132238] p-5 md:p-7">
      <div className="max-w-[1500px] mx-auto space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 flex items-center justify-center rounded-xl bg-[#0c6572] text-white shadow-sm"><Truck size={21} /></div>
              <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0c6572]">GST Compliance Operations</p><h1 className="text-2xl font-semibold tracking-tight">E-Way Bill Management</h1></div>
            </div>
            <p className="mt-3 max-w-3xl text-sm text-slate-500">Prepare, review, export, and generate NIC v1.03 E-Way Bills from canonical sales invoices.</p>
          </div>
          <button onClick={() => preview()} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={busy === "preview" ? "animate-spin" : ""} /> Refresh set</button>
        </header>

        <section className="border-y border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 mr-2"><Filter size={16} className="text-[#0c6572]" /><span className="text-sm font-semibold">Target invoices</span></div>
            {(["selected", "all", "date_range", "bill_range"] as FilterMode[]).map((value) => (
              <button key={value} onClick={() => setMode(value)} className={`rounded-md px-3 py-2 text-xs font-bold capitalize ${mode === value ? "bg-[#0c6572] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{value.replace("_", " ")}</button>
            ))}
            <button onClick={() => preview()} disabled={busy !== null || !transportReady} className="ml-auto inline-flex items-center gap-2 rounded-md bg-[#d46b32] px-4 py-2 text-xs font-bold text-white hover:bg-[#bb5724] disabled:opacity-50"><CalendarRange size={15} /> Preview target</button>
          </div>
          {mode === "date_range" && <div className="mt-4 flex flex-wrap gap-3"><label className="text-xs font-semibold text-slate-600">From<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="ml-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal" /></label><label className="text-xs font-semibold text-slate-600">To<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="ml-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal" /></label></div>}
          {mode === "bill_range" && <div className="mt-4 flex flex-wrap gap-3"><label className="text-xs font-semibold text-slate-600">Bill from<input value={billFrom} onChange={(event) => setBillFrom(event.target.value)} className="ml-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal" /></label><label className="text-xs font-semibold text-slate-600">Bill to<input value={billTo} onChange={(event) => setBillTo(event.target.value)} className="ml-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal" /></label></div>}
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-3 lg:grid-cols-6">
            <label className="text-xs font-semibold text-slate-600">Distance (km)<input required type="number" min="0" max="4000" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal" /></label>
            <label className="text-xs font-semibold text-slate-600">Transport mode<select required value={transMode} onChange={(event) => setTransMode(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal"><option value="">Select</option><option value="1">Road</option><option value="2">Rail</option><option value="3">Air</option><option value="4">Ship</option></select></label>
            <label className="text-xs font-semibold text-slate-600">Vehicle number<input value={vehicleNo} onChange={(event) => setVehicleNo(event.target.value.toUpperCase())} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal" /></label>
            <label className="text-xs font-semibold text-slate-600">Transport document<input value={transportDocNo} onChange={(event) => setTransportDocNo(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal" /></label>
            <label className="text-xs font-semibold text-slate-600">Transporter GSTIN<input value={transporterId} onChange={(event) => setTransporterId(event.target.value.toUpperCase())} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal" /></label>
            <label className="text-xs font-semibold text-slate-600">Transporter name<input value={transporterName} onChange={(event) => setTransporterName(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-normal" /></label>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[{ label: "Invoices", value: rows.length }, { label: "Eligible", value: eligibleRows.length }, { label: "Selected", value: selectedIds.length }, { label: "Existing EWB", value: rows.filter((row) => Boolean(row.eway_bill_no)).length }, { label: "Last failed", value: lastRun?.failed ?? "-" }].map((metric) => <div key={metric.label} className="border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{metric.label}</p><p className="mt-1 text-xl font-semibold text-slate-800">{metric.value}</p></div>)}
        </section>

        <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div><h2 className="text-sm font-bold">Invoice generation queue</h2><p className="text-xs text-slate-500">Each selected invoice creates one NIC request. Existing bills are protected from duplicate generation.</p></div>
            <div className="flex flex-wrap gap-2">
              <button onClick={downloadJson} disabled={!rows.length} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white disabled:opacity-40"><Download size={14} /> Download JSON</button>
              <button onClick={() => generate("selected")} disabled={busy !== null || !selectedIds.length || !transportReady} className="inline-flex items-center gap-1.5 rounded-md bg-[#0c6572] px-3 py-2 text-xs font-bold text-white hover:bg-[#084d57] disabled:opacity-40"><Send size={14} /> Generate selected</button>
              <button onClick={() => generate(mode === "all" ? "all" : mode)} disabled={busy !== null || !rows.length || !transportReady} className="inline-flex items-center gap-1.5 rounded-md bg-[#d46b32] px-3 py-2 text-xs font-bold text-white hover:bg-[#bb5724] disabled:opacity-40"><FileJson size={14} /> Generate {mode === "all" ? "all" : mode.replace("_", " ")}</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="w-10 px-4 py-3"><input type="checkbox" checked={allEligibleSelected} onChange={toggleAll} aria-label="Select all eligible invoices" /></th><th className="px-4 py-3">Bill</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3 text-center">Items</th><th className="px-4 py-3">EWB / Result</th><th className="px-4 py-3">Reason</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.invoice_id} className={row.eligible ? "hover:bg-teal-50/30" : "bg-slate-50/60"}><td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(row.invoice_id)} onChange={() => toggleRow(row.invoice_id)} disabled={!row.eligible || Boolean(row.eway_bill_no)} aria-label={`Select ${row.invoice_no}`} /></td><td className="px-4 py-3"><p className="font-mono text-xs font-bold text-slate-800">{row.invoice_no}</p><p className="text-[11px] text-slate-400">{row.status}</p></td><td className="px-4 py-3"><p className="font-medium text-slate-700">{row.customer_name || "Walk-in customer"}</p><p className="font-mono text-[11px] text-slate-400">{row.customer_gstin || "URP"}</p></td><td className="px-4 py-3 text-xs text-slate-600">{row.invoice_date}</td><td className="px-4 py-3 text-right font-mono text-xs text-slate-700">{money(row.grand_total)}</td><td className="px-4 py-3 text-center text-xs text-slate-600">{row.item_count}</td><td className="px-4 py-3">{row.eway_bill_no ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700"><Check size={14} /> {row.eway_bill_no}</span> : row.result === "FAILED" ? <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700"><X size={14} /> Failed</span> : <span className="text-xs font-semibold text-amber-700">Ready</span>}</td><td className="max-w-[260px] px-4 py-3 text-xs text-slate-500">{row.reason || (row.payload ? "JSON prepared" : "")}</td></tr>)}</tbody></table>
            {!rows.length && <div className="py-16 text-center"><Truck className="mx-auto mb-3 text-slate-300" size={28} /><p className="text-sm font-semibold text-slate-500">Preview an invoice set to begin.</p><p className="mt-1 text-xs text-slate-400">Choose all invoices, a date range, a bill range, or selected invoices.</p></div>}
          </div>
        </section>
        {busy && <div className="fixed bottom-5 right-5 flex items-center gap-2 rounded-lg bg-[#132238] px-4 py-3 text-sm font-semibold text-white shadow-xl"><LoaderCircle size={16} className="animate-spin" /> {busy === "preview" ? "Preparing JSON preview..." : "Generating E-Way Bills..."}</div>}
      </div>
    </div>
  );
};

export default EWayBillManagementTab;
