import React, { useEffect, useMemo, useState } from "react";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import { calculateSourceDiscountAmount } from "../../../utils/sourceBillingDiscount.ts";
import {
  initialSourceBillingQuantities,
} from "../../../utils/sourceBillingQuantities.ts";

type SourceType = "SALES_ORDER" | "PACKING_SLIP";

interface SourceDocumentOption {
  id: string;
  number: string;
  status?: string;
  customer_id?: string;
}

export interface PreparedLine {
  source_line_id: string;
  source_document_id?: string | null;
  source_document_number?: string | null;
  product_id: string;
  code: string;
  name: string;
  barcodes?: string[];
  article_no?: string | null;
  color?: string | null;
  size?: string | null;
  ordered_quantity?: number | string;
  remaining_quantity: number | string;
  po_quantity?: number | string;
  document_quantity?: number | string | null;
  previously_billed_quantity?: number | string;
  stock_on_hand?: number | string | null;
  unit_price: number | string;
  discount_percent?: number | string;
  discount_amount?: number | string;
  discount_quantity_basis?: number | string;
  previously_billed_order_quantity?: number | string;
  gst_rate?: number | string | null;
  hsn_code?: string | null;
  eligible: boolean;
  reason?: string | null;
}

export interface PreparedSource {
  source_type: SourceType;
  source_document_id?: string | null;
  source_document_number?: string | null;
  source_documents?: SourceDocumentOption[];
  customer_id: string;
  customer_name: string;
  sales_order_number?: string | null;
  po_reference?: string | null;
  lines: PreparedLine[];
}

export interface SelectedSourceBilling {
  sourceType: SourceType;
  documentId: string;
  documentIds: string[];
  documentNumber: string;
  lines: Array<{ sourceLineId: string; sourceDocumentId: string; quantity: number }>;
  prepared: PreparedSource;
  commitEnabled: boolean;
}

interface Props {
  sourceType: SourceType;
  customerId: string;
  customerName: string;
  onClose: () => void;
  onUseSource: (source: SelectedSourceBilling) => void;
}

const asList = (value: any): any[] => Array.isArray(value) ? value : value?.items || value?.data || [];
const SALES_ORDER_PAGE_SIZE = 100;

export function SourceBillingSelectionModal({
  sourceType,
  customerId,
  customerName,
  onClose,
  onUseSource,
}: Props) {
  const [documents, setDocuments] = useState<SourceDocumentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreDocuments, setHasMoreDocuments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capabilityError, setCapabilityError] = useState<string | null>(null);
  const [capabilityLoading, setCapabilityLoading] = useState(true);
  const [commitEnabled, setCommitEnabled] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [prepared, setPrepared] = useState<PreparedSource | null>(null);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    setDocuments([]);
    setSelectedDocumentIds([]);
    setPrepared(null);
    setError(null);
    setCapabilityError(null);
    setCapabilityLoading(true);
    setCommitEnabled(false);
    const load = async () => {
      try {
        const path = sourceType === "SALES_ORDER"
          ? `/sales/orders?customer_id=${encodeURIComponent(customerId)}&skip=0&limit=${SALES_ORDER_PAGE_SIZE}`
          : `/fulfillment/packing-slips?customer_id=${encodeURIComponent(customerId)}&status=PACKED&limit=200`;
        const result = await apiFetchV1<any>(path);
        if (!active) return;
        const records = asList(result);
        const options = records.map((record: any) => ({
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
        setHasMoreDocuments(sourceType === "SALES_ORDER" && records.length === SALES_ORDER_PAGE_SIZE);
        setError(null);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Source documents could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    void apiFetchV1<{ commit_enabled: boolean }>("/billing/sources/capabilities")
      .then(result => {
        if (active) setCommitEnabled(Boolean(result.commit_enabled));
      })
      .catch(reason => {
        if (active) setCapabilityError(reason instanceof Error ? reason.message : "Billing capabilities could not be checked.");
      })
      .finally(() => {
        if (active) setCapabilityLoading(false);
      });
    return () => { active = false; };
  }, [customerId, sourceType]);

  const eligibleLines = useMemo(
    () => (prepared?.lines || []).filter(line => line.eligible && Number(line.remaining_quantity) > 0),
    [prepared],
  );
  const displayLines = useMemo(
    () => sourceType === "SALES_ORDER" ? prepared?.lines || [] : eligibleLines,
    [eligibleLines, prepared, sourceType],
  );
  const stockWarnings = useMemo(() => {
    if (!prepared) return [];
    const byProduct = new Map<string, { code: string; required: number; onHand: number }>();
    for (const line of eligibleLines) {
      const quantity = Number(quantities[line.source_line_id] || 0);
      if (quantity <= 0 || line.stock_on_hand == null) continue;
      const current = byProduct.get(line.product_id) || {
        code: line.code,
        required: 0,
        onHand: Number(line.stock_on_hand),
      };
      current.required += quantity;
      byProduct.set(line.product_id, current);
    }
    return [...byProduct.values()]
      .filter(stock => stock.required > stock.onHand)
      .map(stock => `${stock.code}: selected ${stock.required}, current stock ${stock.onHand}.`);
  }, [eligibleLines, prepared, quantities]);

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
      setSelectedDocumentIds([document.id]);
      setQuantities(initialSourceBillingQuantities(sourceType, result.lines));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Source document could not be prepared.");
    } finally {
      setPreparingId(null);
    }
  };

  const toggleOrderSelection = (documentId: string) => {
    if (!selectedDocumentIds.includes(documentId) && selectedDocumentIds.length >= 20) {
      setError("Select no more than 20 Sales Orders per consolidated invoice.");
      return;
    }
    setSelectedDocumentIds(previous => previous.includes(documentId)
      ? previous.filter(id => id !== documentId)
      : [...previous, documentId]);
    setPrepared(null);
    setQuantities({});
    setError(null);
  };

  const loadMoreOrders = async () => {
    setLoadingMore(true);
    try {
      const result = await apiFetchV1<any>(
        `/sales/orders?customer_id=${encodeURIComponent(customerId)}&skip=${documents.length}&limit=${SALES_ORDER_PAGE_SIZE}`,
      );
      const records = asList(result);
      const options = records.map((record: any) => ({
        id: String(record.id || ""),
        number: String(record.order_no || record.order_number || record.id),
        status: record.status,
        customer_id: record.customer_id ? String(record.customer_id) : undefined,
      })).filter((record: SourceDocumentOption) => record.id && record.customer_id === customerId);
      setDocuments(previous => {
        const known = new Set(previous.map(document => document.id));
        return [...previous, ...options.filter((document: SourceDocumentOption) => !known.has(document.id))];
      });
      setHasMoreDocuments(records.length === SALES_ORDER_PAGE_SIZE);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "More Sales Orders could not be loaded.");
    } finally {
      setLoadingMore(false);
    }
  };

  const prepareSelectedOrders = async () => {
    if (selectedDocumentIds.length < 2) {
      const selected = documents.find(document => document.id === selectedDocumentIds[0]);
      if (selected) await prepareDocument(selected);
      return;
    }
    setPreparingId("selected-orders");
    setPrepared(null);
    setQuantities({});
    setError(null);
    try {
      const result = await apiFetchV1<PreparedSource>("/billing/sources/prepare", {
        method: "POST",
        body: JSON.stringify({ source_type: "SALES_ORDER", source_document_ids: selectedDocumentIds }),
      });
      if (result.customer_id !== customerId) throw new Error("The selected Sales Orders do not belong to this customer.");
      setPrepared(result);
      setQuantities(initialSourceBillingQuantities("SALES_ORDER", result.lines));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Selected Sales Orders could not be prepared.");
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
    const preparedDocuments = prepared.source_documents?.length
      ? prepared.source_documents
      : [{
        id: prepared.source_document_id || "",
        number: prepared.source_document_number || "",
      }];
    const documentIds = preparedDocuments.map(document => document.id).filter(Boolean);
    const lines = eligibleLines.flatMap(line => {
      const quantity = Number(quantities[line.source_line_id] || 0);
      return Number.isFinite(quantity) && quantity > 0 && quantity <= Number(line.remaining_quantity)
        ? [{
          sourceLineId: line.source_line_id,
          sourceDocumentId: line.source_document_id || documentIds[0] || "",
          quantity,
        }]
        : [];
    });
    if (!lines.length && sourceType !== "SALES_ORDER") {
      setError("Enter a positive quantity for at least one eligible line, within its remaining quantity.");
      return;
    }
    if (lines.length > 0 && documentIds.length > 1) {
      const allocatedOrderIds = new Set(lines.map(line => line.sourceDocumentId));
      const unallocatedOrder = preparedDocuments.find(document => !allocatedOrderIds.has(document.id));
      if (unallocatedOrder) {
        setError(`Enter a positive bill quantity for at least one line from ${unallocatedOrder.number}, or unselect that Sales Order.`);
        return;
      }
    }
    onUseSource({
      sourceType,
      documentId: documentIds[0] || prepared.source_document_id || "",
      documentIds,
      documentNumber: documentIds.length > 1
        ? `${documentIds.length} Sales Orders`
        : prepared.source_document_number || preparedDocuments[0]?.number || "",
      lines,
      prepared,
      commitEnabled,
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
              {sourceType === "SALES_ORDER" ? "Select Sales Orders" : "Select Packing Slip"}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Customer: {customerName}. {sourceType === "SALES_ORDER"
                ? "Select one or more orders for this customer; enter the actual quantities to bill."
                : "Bill quantities start at the remaining packed quantity and can be reduced."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Close</button>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 md:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.4fr)]">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Available records</h3>
            {loading ? <p className="text-sm text-slate-500">Loading records…</p> : null}
            {!loading && documents.length === 0 ? <p className="text-sm text-slate-500">No matching records found.</p> : null}
            {sourceType === "SALES_ORDER" && (
              <div className="mb-2">
                <p className="mb-2 text-xs text-slate-500">{selectedDocumentIds.length} order(s) selected</p>
                <button
                  type="button"
                  onClick={() => void prepareSelectedOrders()}
                  disabled={selectedDocumentIds.length === 0 || preparingId !== null}
                  className="w-full rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Prepare selected orders
                </button>
              </div>
            )}
            <ul className="space-y-2">
              {documents.map(document => (
                <li key={document.id}>
                  <button
                    type="button"
                    disabled={preparingId !== null}
                    onClick={() => sourceType === "SALES_ORDER"
                      ? toggleOrderSelection(document.id)
                      : void prepareDocument(document)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm disabled:opacity-50 ${
                      selectedDocumentIds.includes(document.id)
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
            {sourceType === "SALES_ORDER" && hasMoreDocuments && (
              <button
                type="button"
                onClick={() => void loadMoreOrders()}
                disabled={loadingMore}
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-slate-600"
              >
                {loadingMore ? "Loading…" : "Load more Sales Orders"}
              </button>
            )}
          </div>

          <div className="min-w-0">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Review source quantities</h3>
            {preparingId ? <p className="text-sm text-slate-500">Preparing source…</p> : null}
            {!prepared && !preparingId ? <p className="text-sm text-slate-500">Select orders, then prepare them to review eligibility and billable quantities.</p> : null}
            {prepared && eligibleLines.length === 0 ? <p className="text-sm text-slate-500">No eligible quantity remains on this source.</p> : null}
            {prepared && eligibleLines.length > 0 && prepared.source_documents?.length !== 1 && prepared.source_type === "SALES_ORDER" && (
              <p className="mb-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
                Order lines remain separate so each invoice line keeps its source Sales Order and order-line allocation.
              </p>
            )}
            {prepared && eligibleLines.length > 0 && prepared.source_documents?.length !== 1 && prepared.source_type === "SALES_ORDER" && !commitEnabled && (
              <p role="status" className="mb-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                Consolidated posting is currently disabled by the server rollout setting. You can review this selection, but cannot finalize it yet.
              </p>
            )}
            {capabilityError && (
              <p role="status" className="mb-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                Posting capability could not be verified: {capabilityError}
              </p>
            )}
            {capabilityLoading && sourceType === "SALES_ORDER" && selectedDocumentIds.length > 1 && (
              <p role="status" className="mb-2 text-xs text-slate-500">Checking consolidated posting capability…</p>
            )}
            {stockWarnings.length > 0 && (
              <div role="status" className="mb-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                <strong>Stock warning — this does not change order eligibility:</strong>
                <ul className="mt-1 list-disc pl-4">
                  {stockWarnings.map(warning => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
            )}
            {displayLines.length > 0 && (
              <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="p-2">Item</th>
                      {prepared?.source_documents && prepared.source_documents.length > 1 && <th className="p-2">Sales Order</th>}
                      <th className="p-2 text-right">Rate</th>
                      <th className="p-2 text-right">SO Disc.</th>
                      <th className="p-2 text-right">{sourceType === "SALES_ORDER" ? "SO Qty" : "PO Qty"}</th>
                      {sourceType === "PACKING_SLIP" && <th className="p-2 text-right">Doc Qty</th>}
                      {sourceType === "SALES_ORDER" ? (
                        <>
                          <th className="p-2 text-right">SO Fulfilled Qty</th>
                          <th className="p-2 text-right">SO Pending Qty</th>
                        </>
                      ) : (
                        <>
                          <th className="p-2 text-right">Previously Billed</th>
                          <th className="p-2 text-right">Remaining</th>
                        </>
                      )}
                      <th className="p-2 text-right">Stock</th>
                      <th className="p-2 text-right">Bill Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayLines.map(line => (
                      <tr key={line.source_line_id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="p-2"><span className="font-medium">{line.name}</span><span className="block text-slate-500">{line.code}</span></td>
                        {prepared?.source_documents && prepared.source_documents.length > 1 && (
                          <td className="p-2">{line.source_document_number || line.source_document_id}</td>
                        )}
                        <td className="p-2 text-right">{Number(line.unit_price).toFixed(2)}</td>
                        <td className="p-2 text-right">
                          {Number(line.discount_percent || 0) > 0
                            ? `${Number(line.discount_percent).toFixed(2)}%`
                            : `₹${calculateSourceDiscountAmount({
                              unitPrice: Number(line.unit_price || 0),
                              quantity: Number(quantities[line.source_line_id] || 0),
                              discountAmount: Number(line.discount_amount || 0),
                              discountQuantityBasis: Number(line.discount_quantity_basis || 0),
                              previouslyBilledQuantity: Number(line.previously_billed_order_quantity || 0),
                            }).toFixed(2)}`}
                        </td>
                        <td className="p-2 text-right">{Number(line.po_quantity ?? line.ordered_quantity ?? 0)}</td>
                        {sourceType === "PACKING_SLIP" && (
                          <td className="p-2 text-right">{Number(line.document_quantity ?? line.ordered_quantity)}</td>
                        )}
                        <td className="p-2 text-right">{Number(line.previously_billed_quantity || 0)}</td>
                        <td className="p-2 text-right">{Number(line.remaining_quantity)}</td>
                        <td className="p-2 text-right">{line.stock_on_hand == null ? "—" : Number(line.stock_on_hand)}</td>
                        <td className="p-2 text-right">
                          <input
                            aria-label={`Bill quantity for ${line.code}`}
                            type="number"
                            min="0"
                            max={Number(line.remaining_quantity)}
                            step="0.0001"
                            value={quantities[line.source_line_id] ?? ""}
                            disabled={!line.eligible || Number(line.remaining_quantity) <= 0}
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
            {error || (preparingId === "selected-orders" ? "Preparing selected Sales Orders…" : `Preparing ${preparingId}…`)}
          </p>
        )}
        <footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Cancel</button>
          <button
            type="button"
            onClick={usePreparedSource}
            disabled={!prepared || (sourceType !== "SALES_ORDER" && eligibleLines.length === 0) || (prepared.source_documents?.length || 0) > 1 && capabilityLoading}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Use selected lines
          </button>
        </footer>
      </section>
    </div>
  );
}
