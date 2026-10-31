import React, { useEffect, useMemo, useState } from "react";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";

type SourceType = "SALES_ORDER" | "PACKING_SLIP";

interface SourceDocumentOption {
  id: string;
  number: string;
  status?: string;
  customer_id?: string;
}

interface PreparedLine {
  source_line_id: string;
  product_id: string;
  code: string;
  name: string;
  remaining_quantity: number | string;
  unit_price: number | string;
  gst_rate?: number | string | null;
  hsn_code?: string | null;
  eligible: boolean;
  reason?: string | null;
}

interface PreparedSource {
  source_type: SourceType;
  source_document_id: string;
  source_document_number: string;
  customer_id: string;
  customer_name: string;
  sales_order_number?: string | null;
  lines: PreparedLine[];
}

export interface SelectedSourceBilling {
  sourceType: SourceType;
  documentId: string;
  documentNumber: string;
  lines: Array<{ sourceLineId: string; quantity: number }>;
  prepared: PreparedSource;
}

interface Props {
  sourceType: SourceType;
  customerId: string;
  customerName: string;
  onClose: () => void;
  onUseSource: (source: SelectedSourceBilling) => void;
}

const asList = (value: any): any[] => Array.isArray(value) ? value : value?.items || value?.data || [];

export function SourceBillingSelectionModal({
  sourceType,
  customerId,
  customerName,
  onClose,
  onUseSource,
}: Props) {
  const [documents, setDocuments] = useState<SourceDocumentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<PreparedSource | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    const path = sourceType === "SALES_ORDER"
      ? `/sales/orders?customer_id=${encodeURIComponent(customerId)}&limit=1000`
      : `/fulfillment/packing-slips?customer_id=${encodeURIComponent(customerId)}&status=PACKED&limit=200`;
    void apiFetchV1<any>(path).then(result => {
      if (!active) return;
      const options = asList(result).map((record: any) => ({
        id: String(record.id || ""),
        number: String(
          sourceType === "SALES_ORDER"
            ? record.order_no || record.order_number || record.id
            : record.packing_slip_number || record.id
        ),
        status: record.status,
        customer_id: record.customer_id ? String(record.customer_id) : undefined,
      })).filter((record: SourceDocumentOption) => record.id && record.customer_id === customerId);
      setDocuments(options);
      setError(null);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "Source documents could not be loaded.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [customerId, sourceType]);

  const eligibleLines = useMemo(
    () => (prepared?.lines || []).filter(line => line.eligible && Number(line.remaining_quantity) > 0),
    [prepared],
  );

  const prepareDocument = async (document: SourceDocumentOption) => {
    setPreparingId(document.id);
    setPrepared(null);
    setQuantities({});
    setError(null);
    try {
      const result = await apiFetchV1<PreparedSource>("/billing/sources/prepare", {
        method: "POST",
        body: JSON.stringify({ source_type: sourceType, source_document_id: document.id }),
      });
      if (result.customer_id !== customerId) {
        throw new Error("The selected source belongs to a different customer account.");
      }
      setPrepared(result);
      setQuantities(Object.fromEntries(
        result.lines
          .filter(line => line.eligible && Number(line.remaining_quantity) > 0)
          .map(line => [line.source_line_id, String(line.remaining_quantity)])
      ));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Source document could not be prepared.");
    } finally {
      setPreparingId(null);
    }
  };

  const usePreparedSource = () => {
    if (!prepared) return;
    const invalidLine = eligibleLines.find(line => {
      const raw = quantities[line.source_line_id];
      if (!raw) return false;
      const quantity = Number(raw);
      return !Number.isFinite(quantity)
        || quantity < 0
        || quantity > Number(line.remaining_quantity)
        || Number(quantity.toFixed(4)) !== quantity;
    });
    if (invalidLine) {
      setError(`${invalidLine.code}: quantity must be between zero and the remaining quantity, with at most four decimal places.`);
      return;
    }
    const lines = eligibleLines.flatMap(line => {
      const quantity = Number(quantities[line.source_line_id] || 0);
      return Number.isFinite(quantity) && quantity > 0 && quantity <= Number(line.remaining_quantity)
        ? [{ sourceLineId: line.source_line_id, quantity }]
        : [];
    });
    if (!lines.length) {
      setError("Enter a positive quantity for at least one eligible line, within its remaining quantity.");
      return;
    }
    onUseSource({
      sourceType,
      documentId: prepared.source_document_id,
      documentNumber: prepared.source_document_number,
      lines,
      prepared,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-billing-title"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h2 id="source-billing-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {sourceType === "SALES_ORDER" ? "Select Sales Order" : "Select Packing Slip"}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">Customer: {customerName}. Preparation is read-only.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Close</button>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 md:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.4fr)]">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Available records</h3>
            {loading ? <p className="text-sm text-slate-500">Loading records…</p> : null}
            {!loading && documents.length === 0 ? <p className="text-sm text-slate-500">No matching records found.</p> : null}
            <ul className="space-y-2">
              {documents.map(document => (
                <li key={document.id}>
                  <button
                    type="button"
                    disabled={preparingId !== null}
                    onClick={() => void prepareDocument(document)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm disabled:opacity-50 ${
                      prepared?.source_document_id === document.id
                        ? "border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100"
                        : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="block font-semibold">{document.number}</span>
                    <span className="text-xs text-slate-500">{document.status || "Open"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Eligible lines and remaining quantity</h3>
            {preparingId ? <p className="text-sm text-slate-500">Preparing source…</p> : null}
            {!prepared && !preparingId ? <p className="text-sm text-slate-500">Select a record to review ownership and billable quantities.</p> : null}
            {prepared && eligibleLines.length === 0 ? <p className="text-sm text-slate-500">No eligible quantity remains on this source.</p> : null}
            {eligibleLines.length > 0 && (
              <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr><th className="p-2">Item</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Remaining</th><th className="p-2 text-right">Bill Qty</th></tr>
                  </thead>
                  <tbody>
                    {eligibleLines.map(line => (
                      <tr key={line.source_line_id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="p-2"><span className="font-medium">{line.name}</span><span className="block text-slate-500">{line.code}</span></td>
                        <td className="p-2 text-right">{Number(line.unit_price).toFixed(2)}</td>
                        <td className="p-2 text-right">{Number(line.remaining_quantity)}</td>
                        <td className="p-2 text-right">
                          <input
                            aria-label={`Bill quantity for ${line.code}`}
                            type="number"
                            min="0"
                            max={Number(line.remaining_quantity)}
                            step="0.0001"
                            value={quantities[line.source_line_id] || ""}
                            onChange={event => setQuantities(previous => ({ ...previous, [line.source_line_id]: event.target.value }))}
                            className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-right dark:border-slate-600 dark:bg-slate-950"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {prepared && prepared.lines.some(line => !line.eligible) && (
              <details className="mt-3 text-xs text-amber-800 dark:text-amber-200">
                <summary className="cursor-pointer">Show ineligible lines and reasons</summary>
                <ul className="mt-2 space-y-1">
                  {prepared.lines.filter(line => !line.eligible).map(line => (
                    <li key={line.source_line_id}>{line.code}: {line.reason || "Not eligible for billing."}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </div>

        {(error || preparingId) && (
          <p role="alert" className="px-4 pb-2 text-sm text-rose-700 dark:text-rose-300">
            {error || `Preparing ${preparingId}…`}
          </p>
        )}
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Cancel</button>
          <button type="button" onClick={usePreparedSource} disabled={!prepared || eligibleLines.length === 0} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Use selected lines
          </button>
        </footer>
      </section>
    </div>
  );
}
