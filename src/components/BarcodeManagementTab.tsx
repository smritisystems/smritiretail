import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Barcode, CheckCircle2, Link2, Plus, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";

type BarcodeRecord = {
  id: string;
  barcode: string;
  barcode_type: string;
  status: "UNASSIGNED" | "ASSIGNED" | "QUARANTINED" | "CONFLICT" | "RETIRED";
  source: string;
  item_code?: string | null;
  variant_sku?: string | null;
  item_name?: string | null;
};

type BarcodeMetrics = {
  total: number;
  assigned: number;
  waiting: number;
  needs_review: number;
  blocked: number;
  retired: number;
};

type DetectionHint = {
  detected: boolean;
  confidence: string;
  candidates: string[];
  reason: string;
};

type CsvRow = {
  barcode: string;
  sku: string;
  state: "READY" | "INVALID" | "IMPORTED" | "ERROR";
};

const statusStyles: Record<BarcodeRecord["status"], string> = {
  UNASSIGNED: "text-amber-300 bg-amber-400/10 border-amber-400/20",
  ASSIGNED: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  QUARANTINED: "text-orange-300 bg-orange-400/10 border-orange-400/20",
  CONFLICT: "text-red-300 bg-red-400/10 border-red-400/20",
  RETIRED: "text-slate-300 bg-slate-400/10 border-slate-400/20",
};

const statusLabels: Record<BarcodeRecord["status"], string> = {
  UNASSIGNED: "Waiting for assignment",
  ASSIGNED: "Linked",
  QUARANTINED: "Blocked",
  CONFLICT: "Needs review",
  RETIRED: "Retired",
};

export const BarcodeManagementTab: React.FC = () => {
  const [records, setRecords] = useState<BarcodeRecord[]>([]);
  const [metrics, setMetrics] = useState<BarcodeMetrics>({ total: 0, assigned: 0, waiting: 0, needs_review: 0, blocked: 0, retired: 0 });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [barcodeSource, setBarcodeSource] = useState("GS1 / Supplier-issued");
  const [barcodeType, setBarcodeType] = useState("EAN13");
  const [barcodePurpose, setBarcodePurpose] = useState("RETAIL");
  const [encodingStandard, setEncodingStandard] = useState("NONE");
  const [variantSku, setVariantSku] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [detectionHint, setDetectionHint] = useState<DetectionHint | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  const loadRecords = async () => {
    const params = new URLSearchParams({ limit: "500" });
    if (query.trim()) params.set("q", query.trim());
    if (status) params.set("status", status);
    const [data, metricData] = await Promise.all([
      apiFetchV1(`/barcode-registry?${params.toString()}`),
      apiFetchV1("/barcode-registry/metrics"),
    ]);
    setRecords(Array.isArray(data) ? data : []);
    if (metricData && typeof metricData === "object") setMetrics(metricData as BarcodeMetrics);
  };

  useEffect(() => {
    void loadRecords().catch((error: Error) => setNotice({ kind: "error", text: error.message }));
  }, [query, status]);

  const intake = async () => {
    if (!barcode.trim()) return;
    setBusy(true);
    try {
      const detection = await apiFetchV1(`/barcode-registry/detect?q=${encodeURIComponent(barcode.trim())}`);
      if (detection && typeof detection === "object") setDetectionHint(detection as DetectionHint);
      await apiFetchV1("/barcode-registry/intake", {
        method: "POST",
        body: JSON.stringify({ barcode: barcode.trim(), barcode_type: barcodeType, barcode_purpose: barcodePurpose, encoding_standard: encodingStandard, source: barcodeSource === "GS1 / Supplier-issued" ? "GS1_IMPORT" : barcodeSource === "My business / Internal" ? "INTERNAL" : "OTHER" }),
      });
      setBarcode("");
      setNotice({ kind: "success", text: "Barcode added to the unassigned queue." });
      await loadRecords();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Barcode intake failed" });
    } finally {
      setBusy(false);
    }
  };

  const scanNext = () => {
    setBarcode("");
    setDetectionHint(null);
    setNotice(null);
    window.requestAnimationFrame(() => barcodeInputRef.current?.focus());
  };

  const handleCsvFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const header = lines.shift()?.toLowerCase().split(",").map((value) => value.trim()) || [];
    const barcodeIndex = header.indexOf("barcode");
    const skuIndex = header.indexOf("sku");
    if (barcodeIndex < 0) {
      setCsvRows([{ barcode: "", sku: "", state: "INVALID" }]);
      setNotice({ kind: "error", text: "CSV must contain a barcode column. The sku column is optional." });
      return;
    }
    setCsvRows(lines.map((line) => {
      const values = line.split(",").map((value) => value.trim());
      const nextBarcode = values[barcodeIndex] || "";
      const nextSku = values[skuIndex] || "";
      return { barcode: nextBarcode, sku: nextSku, state: nextBarcode ? "READY" : "INVALID" };
    }));
  };

  const importCsv = async () => {
    const readyRows = csvRows.filter((row) => row.state === "READY");
    if (!readyRows.length) return;
    setBusy(true);
    let imported = 0;
    for (const row of readyRows) {
      try {
        await apiFetchV1("/barcode-registry/intake", {
          method: "POST",
          body: JSON.stringify({ barcode: row.barcode, barcode_type: "EAN13", barcode_purpose: "RETAIL", encoding_standard: "NONE", source: "GS1_IMPORT", source_reference: "CSV_IMPORT" }),
        });
        row.state = "IMPORTED";
        imported += 1;
      } catch {
        row.state = "ERROR";
      }
    }
    setCsvRows([...csvRows]);
    setNotice({ kind: imported ? "success" : "error", text: `${imported} barcode${imported === 1 ? "" : "s"} added; review any rejected rows.` });
    await loadRecords();
    setBusy(false);
  };

  const handleBarcodeKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void intake();
    }
  };

  const assign = async () => {
    if (!selectedId || (!variantSku.trim() && !itemCode.trim()) || (variantSku.trim() && itemCode.trim())) return;
    setBusy(true);
    try {
      await apiFetchV1(`/barcode-registry/${selectedId}/assign`, {
        method: "POST",
        body: JSON.stringify({
          variant_sku: variantSku.trim() || undefined,
          item_code: itemCode.trim() || undefined,
          reason: "GS1 barcode linked from Barcode Management",
        }),
      });
      setSelectedId("");
      setVariantSku("");
      setItemCode("");
      setNotice({ kind: "success", text: "Barcode assigned permanently to the selected stock identity." });
      await loadRecords();
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Barcode assignment failed" });
    } finally {
      setBusy(false);
    }
  };

  const selected = records.find((record) => record.id === selectedId);
  const metricValues: Record<BarcodeRecord["status"], number> = {
    UNASSIGNED: metrics.waiting,
    ASSIGNED: metrics.assigned,
    CONFLICT: metrics.needs_review,
    QUARANTINED: metrics.blocked,
    RETIRED: metrics.retired,
  };

  return (
    <div className="h-full overflow-auto bg-theme-base text-theme-body p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-theme-body">
            <Barcode size={22} className="text-emerald-400" />
            <h1 className="text-xl font-bold">Barcode Management</h1>
          </div>
          <p className="text-xs text-theme-muted mt-1">Register GS1 barcodes and link them to canonical stock identities.</p>
        </div>
        <button type="button" onClick={() => void loadRecords()} className="p-2 rounded-lg border border-theme-divider hover:bg-theme-surface-2" title="Refresh registry">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(["UNASSIGNED", "ASSIGNED", "CONFLICT", "QUARANTINED", "RETIRED"] as const).map((key) => (
          <button key={key} type="button" onClick={() => setStatus(status === key ? "" : key)} className={`text-left border rounded-lg p-3 ${status === key ? "border-emerald-400/50" : "border-theme-divider"} bg-theme-surface-1`}>
            <div className="text-[10px] text-theme-muted uppercase">{key}</div>
            <div className="text-2xl font-bold mt-1">{metricValues[key]}</div>
          </button>
        ))}
      </div>

      {notice && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${notice.kind === "success" ? "text-emerald-300 border-emerald-400/20 bg-emerald-400/10" : "text-red-300 border-red-400/20 bg-red-400/10"}`}>
          {notice.kind === "success" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {notice.text}
          <button type="button" className="ml-auto" onClick={() => setNotice(null)}><XCircle size={15} /></button>
        </div>
      )}

      {detectionHint && (
        <div className="border border-sky-400/20 bg-sky-400/10 rounded-lg px-3 py-2 text-xs text-sky-200">
          <span className="font-semibold">Barcode check:</span> {detectionHint.candidates.join(" / ")} ({detectionHint.confidence.toLowerCase()} confidence). {detectionHint.reason}
        </div>
      )}

      <div className="grid xl:grid-cols-[1fr_360px] gap-5">
        <section className="border border-theme-divider rounded-xl bg-theme-surface-1 overflow-hidden">
          <div className="p-3 border-b border-theme-divider flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
              <input data-field-key="barcode_registry_search" aria-label="Search barcode registry" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search GS1 barcode..." className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg pl-9 pr-3 py-2 text-sm" />
            </div>
            <select data-field-key="barcode_registry_status" aria-label="Barcode status" value={status} onChange={(event) => setStatus(event.target.value)} className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm">
              <option value="">All statuses</option>
              <option value="UNASSIGNED">Unassigned</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="CONFLICT">Conflict</option>
              <option value="QUARANTINED">Quarantined</option>
              <option value="RETIRED">Retired</option>
            </select>
          </div>
          <div className="overflow-auto max-h-[560px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-theme-surface-2 text-theme-muted uppercase"><tr><th className="p-3">Barcode</th><th className="p-3">Stock identity</th><th className="p-3">Source</th><th className="p-3">Status</th></tr></thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} onClick={() => record.status === "UNASSIGNED" && setSelectedId(record.id)} className={`border-t border-theme-divider ${record.status === "UNASSIGNED" ? "cursor-pointer hover:bg-theme-surface-2" : ""} ${selectedId === record.id ? "bg-emerald-400/10" : ""}`}>
                    <td className="p-3 font-mono">{record.barcode}</td>
                    <td className="p-3"><div>{record.variant_sku || record.item_code || "Unassigned"}</div><div className="text-[10px] text-theme-muted">{record.item_name || "Awaiting assignment"}</div></td>
                    <td className="p-3 text-theme-muted">{record.source}</td>
                    <td className="p-3"><span className={`inline-flex px-2 py-1 rounded border text-[10px] ${statusStyles[record.status]}`}>{statusLabels[record.status]}</span></td>
                  </tr>
                ))}
                {!records.length && <tr><td colSpan={4} className="p-10 text-center text-theme-muted">No barcode records found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="border border-theme-divider rounded-xl bg-theme-surface-1 p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold"><Plus size={16} className="text-emerald-400" /> GS1 intake</div>
            <label className="block text-xs text-theme-muted">Where did this barcode come from?</label>
            <select data-field-key="barcode_registry_source" aria-label="Barcode source" value={barcodeSource} onChange={(event) => setBarcodeSource(event.target.value)} className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm">
              <option>GS1 / Supplier-issued</option>
              <option>My business / Internal</option>
              <option>Other</option>
            </select>
            <details className="border border-theme-divider rounded-lg px-3 py-2">
              <summary className="cursor-pointer text-xs text-theme-muted">Advanced barcode classification</summary>
              <div className="pt-3 space-y-3">
            <select data-field-key="barcode_registry_type" aria-label="Barcode symbology" value={barcodeType} onChange={(event) => setBarcodeType(event.target.value)} className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm">
              {[
                ["EAN13", "EAN-13 - Retail unit"], ["EAN8", "EAN-8 - Small retail pack"], ["UPCA", "UPC-A - North American retail"], ["UPCE", "UPC-E - Compact retail"], ["ITF14", "ITF-14 - Carton or case"],
                ["GS1_128", "GS1-128 - Logistics traceability"], ["GS1_DATAMATRIX", "GS1 DataMatrix - Serialized or regulated"], ["CODE128", "Code 128 - Internal stock"], ["CODE39", "Code 39 - Legacy warehouse"], ["CODE93", "Code 93 - Internal asset"], ["QR", "QR - Consumer information"], ["DATAMATRIX", "DataMatrix - Compact asset"], ["PDF417", "PDF417 - High-density document"],
              ].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select data-field-key="barcode_registry_purpose" aria-label="Barcode business purpose" value={barcodePurpose} onChange={(event) => setBarcodePurpose(event.target.value)} className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm">
              {[['RETAIL', 'Retail'], ['INTERNAL', 'Internal'], ['LOGISTICS', 'Logistics'], ['SERIALIZED', 'Serialized'], ['LOT', 'Lot'], ['CASE', 'Case'], ['ASSET', 'Asset'], ['DOCUMENT', 'Document']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select data-field-key="barcode_registry_standard" aria-label="Encoding standard" value={encodingStandard} onChange={(event) => setEncodingStandard(event.target.value)} className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm">
              <option value="NONE">No structured standard</option>
              <option value="GS1">GS1 structured data</option>
              <option value="CUSTOM">Custom / internal encoding</option>
            </select>
              </div>
            </details>
            <input ref={barcodeInputRef} data-field-key="barcode_registry_value" data-f2-entity="item_barcode" aria-label="Barcode value" value={barcode} onChange={(event) => setBarcode(event.target.value)} onKeyDown={handleBarcodeKeyDown} placeholder="Scan or paste barcode value" className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm font-mono" />
            <button type="button" disabled={busy || !barcode.trim()} onClick={() => void intake()} className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-semibold"><Plus size={15} /> Add to unassigned queue</button>
            <button type="button" onClick={scanNext} className="w-full border border-theme-divider hover:bg-theme-surface-2 rounded-lg py-2 text-sm">Scan next</button>
          </section>
          <section className="border border-theme-divider rounded-xl bg-theme-surface-1 p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold"><Barcode size={16} className="text-amber-300" /> Bulk barcode import</div>
            <p className="text-[11px] text-theme-muted">Use <span className="font-mono">barcode</span> alone to assign later, or add an optional <span className="font-mono">sku</span> reference for review.</p>
            <input type="file" accept=".csv,text/csv" onChange={(event) => void handleCsvFile(event)} className="w-full text-xs text-theme-muted file:mr-2 file:rounded file:border-0 file:bg-theme-surface-2 file:px-2 file:py-1.5 file:text-theme-body" />
            {csvRows.length > 0 && <div className="border border-theme-divider rounded-lg max-h-32 overflow-auto text-[11px]">
              {csvRows.slice(0, 50).map((row, index) => <div key={`${row.barcode}-${index}`} className="flex justify-between gap-2 px-2 py-1 border-b border-theme-divider"><span className="font-mono">{row.barcode || "Missing barcode"}</span><span>{row.sku || "Assign later"}</span><span className={row.state === "READY" ? "text-emerald-300" : row.state === "IMPORTED" ? "text-sky-300" : "text-red-300"}>{row.state === "READY" && !row.sku ? "UNASSIGNED" : row.state}</span></div>)}
            </div>}
            <button type="button" disabled={busy || !csvRows.some((row) => row.state === "READY")} onClick={() => void importCsv()} className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-semibold">Import ready rows</button>
          </section>
          <section className="border border-theme-divider rounded-xl bg-theme-surface-1 p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold"><Link2 size={16} className="text-sky-400" /> Assign to stock identity</div>
            <div className="text-[11px] text-theme-muted">{selected ? `Selected barcode: ${selected.barcode}` : "Select an unassigned barcode"}</div>
            <input data-field-key="barcode_registry_variant_sku" data-f2-entity="variant" aria-label="Variant SKU or stock number" value={variantSku} onChange={(event) => { setVariantSku(event.target.value); setItemCode(""); }} placeholder="Variant SKU / stock no" className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm font-mono" />
            <div className="text-center text-[10px] text-theme-muted">or</div>
            <input data-field-key="barcode_registry_item_code" data-f2-entity="item" aria-label="Parent item code" value={itemCode} onChange={(event) => { setItemCode(event.target.value); setVariantSku(""); }} placeholder="Parent item code" className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-2 text-sm font-mono" />
            <button type="button" disabled={busy || !selectedId || (!variantSku.trim() && !itemCode.trim())} onClick={() => void assign()} className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-semibold"><ShieldCheck size={15} /> Confirm permanent link</button>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default BarcodeManagementTab;