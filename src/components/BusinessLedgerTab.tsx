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
 * * Version    : 2.1.2
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Landmark, TrendingUp, Users, ShieldAlert, FileText, Landmark as BankIcon } from "lucide-react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { DrillableLink } from "./drilldown/DrillableLink.tsx";
import { useDrillDown } from "./drilldown/drilldown_store.tsx";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";

interface BusinessLedgerTabProps {
  currentUser?: { role: string; name: string } | null;
}

interface TaxInvoiceLine {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  status: string;
  customer_name?: string | null;
  customer_gstin?: string | null;
  items_count: number;
  total_quantity: number;
  taxable_value: number;
  total_tax: number;
  grand_total: number;
}

const buildInvoiceTrend = (invoices: TaxInvoiceLine[]) => {
  const totals = new Map<string, number>();
  invoices.forEach((invoice) => {
    const date = new Date(invoice.invoice_date);
    const month = Number.isNaN(date.getTime())
      ? "Unknown"
      : date.toLocaleDateString("en-IN", { month: "short" });
    totals.set(month, (totals.get(month) || 0) + Number(invoice.grand_total || 0));
  });
  return Array.from(totals, ([month, Balance]) => ({ month, Balance }));
};

export const BusinessLedgerTab: React.FC<BusinessLedgerTabProps> = ({ currentUser }) => {
  const isReadOnly = currentUser?.role === "Report User" || currentUser?.role === "REPORT_USER";
  const { activePanel } = useDrillDown();
  const [invoices, setInvoices] = useState<TaxInvoiceLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError(null);
    const timeout = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("Tax invoice service timed out.")), 12000);
    });
    Promise.race([apiFetchV1("/reports/tax-invoices-master-register"), timeout])
      .then((data) => {
        if (mounted) setInvoices(Array.isArray(data?.lines) ? data.lines : []);
      })
      .catch((error) => {
        console.error("Failed to load tax invoice ledger:", error);
        if (mounted) setLoadError(error instanceof Error ? error.message : "Unable to load tax invoices.");
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [activePanel, retryToken]);

  useEffect(() => {
    if (activePanel && activePanel.entityType === "invoice") {
      setSelectedInvoiceNumber(activePanel.entityId);
    }
  }, [activePanel]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
  };

  const totalOutstanding = invoices.reduce((sum, invoice) => sum + Number(invoice.grand_total || 0), 0);
  const totalTax = invoices.reduce((sum, invoice) => sum + Number(invoice.total_tax || 0), 0);
  const selectedInvoice = invoices.find((invoice) => invoice.invoice_id === selectedInvoiceNumber) || invoices[0];
  const chartData = buildInvoiceTrend(invoices);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      {isReadOnly && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2.5 flex items-center space-x-2 text-amber-400 text-xs">
          <span className="material-symbols-outlined text-sm">warning</span>
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Write operations are prohibited.</span>
        </div>
      )}
      {/* Header section */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Business Ledger</h1>
          <p className="text-sm text-slate-500 mt-1">Live statutory sales ledger from posted tax invoices</p>
        </div>
        <div className="text-xs font-mono text-slate-500">Authoritative tax invoice register</div>
      </div>

      {/* Receivables KPI Summary Cards */}
      <div className="px-6 pt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice Value</p>
            <h3 className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">{formatCurrency(totalOutstanding)}</h3>
          </div>
          <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded-lg text-rose-500">
            <Landmark size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tax Invoices</p>
            <h3 className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">{invoices.length}</h3>
          </div>
          <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-blue-500">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">GST Collected</p>
            <h3 className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">{formatCurrency(totalTax)}</h3>
          </div>
          <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-500">
            <ShieldAlert size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Invoice Average</p>
            <h3 className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">{formatCurrency(invoices.length ? totalOutstanding / invoices.length : 0)}</h3>
          </div>
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-emerald-500">
            <TrendingUp size={20} />
          </div>
        </div>
      </div>

      <SmritiScrollArea className="flex-1 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Receivables Table List (Col Span 7) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                <h2 className="font-semibold text-slate-950 dark:text-white">Tax Invoice Ledger</h2>
                <span className="text-xs text-slate-500 font-mono">Showing {invoices.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tax Invoice</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">GST</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Grand Total</th>
                      <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {invoices.map(invoice => {
                      const isSelected = selectedInvoiceNumber === invoice.invoice_id;
                      return (
                        <tr 
                          key={invoice.invoice_number} 
                          onClick={() => setSelectedInvoiceNumber(invoice.invoice_id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected 
                              ? "bg-blue-50/40 dark:bg-blue-950/20 border-l-4 border-blue-600" 
                              : "hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                              {invoice.invoice_number}
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{invoice.invoice_date} · {invoice.status}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {invoice.customer_name || "Walk-in Customer"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right text-slate-900 dark:text-white font-mono">
                            {formatCurrency(invoice.total_tax)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-xs" onClick={(e) => e.stopPropagation()}>
                            <DrillableLink context={{ entityType: "invoice", entityId: invoice.invoice_id, title: invoice.invoice_number }}>
                              <span className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium underline">Open</span>
                            </DrillableLink>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {loading && <div className="p-8 text-center text-slate-500">Loading live tax invoices...</div>}
                {!loading && loadError && (
                  <div className="p-8 text-center text-rose-600 dark:text-rose-400">
                    <p className="text-sm font-semibold">Live tax invoice data could not be loaded.</p>
                    <p className="mt-1 text-xs font-mono">{loadError}</p>
                    <button type="button" onClick={() => setRetryToken((value) => value + 1)} className="mt-3 rounded border border-rose-300 px-3 py-1.5 text-xs font-semibold">Retry</button>
                  </div>
                )}
                {!loading && invoices.length === 0 && (
                  <div className="p-8 text-center text-slate-500">
                    No tax invoices found for the active company and branch.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side: Invoice trend and statutory details (Col Span 5) */}
          <div className="lg:col-span-5 space-y-4">
            {selectedInvoice ? (
              <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
                {/* Header info */}
                <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">Invoice Insights</span>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">{selectedInvoice.customer_name || "Walk-in Customer"}</h3>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-mono">
                        <span className="material-symbols-outlined text-xs">receipt_long</span> {selectedInvoice.invoice_number} · {selectedInvoice.invoice_date}
                      </p>
                    </div>
                    <span className="text-xs font-mono bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 px-2 py-1 rounded font-bold">
                      {selectedInvoice.status}
                    </span>
                  </div>
                </div>

                {/* Actual invoice totals grouped by invoice month */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly Invoice Totals</h4>
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 font-mono">Live Register</span>
                  </div>
                  <div className="h-64 bg-slate-50/50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-800" />
                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#0f172a", borderColor: "#1e293b", borderRadius: 8 }}
                          labelStyle={{ color: "#94a3b8", fontWeight: "bold", fontSize: 11 }}
                          itemStyle={{ color: "#ffffff", fontSize: 12 }}
                          formatter={(value) => [`₹${Number(value).toLocaleString("en-IN")}`, "Balance"]}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="Balance" 
                          stroke="#2563eb" 
                          strokeWidth={2.5} 
                          dot={{ r: 4, stroke: "#2563eb", strokeWidth: 1, fill: "#ffffff" }}
                          activeDot={{ r: 6 }} 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Stat Grid */}
                <div className="grid grid-cols-2 gap-4 border-t border-b border-slate-200 dark:border-slate-800 py-4">
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 font-semibold">Peak Monthly Total</span>
                    <span className="block text-base font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                      {formatCurrency(Math.max(...chartData.map(d => d.Balance), 0))}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 font-semibold">Average Monthly Total</span>
                    <span className="block text-base font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                      {formatCurrency(chartData.length ? Math.round(chartData.reduce((sum, d) => sum + d.Balance, 0) / chartData.length) : 0)}
                    </span>
                  </div>
                </div>

                {/* Authoritative invoice fields */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tax Invoice Details</h4>
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800/40">
                      <span className="text-slate-500 block text-[10px] uppercase">Customer GSTIN</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">{selectedInvoice.customer_gstin || "Not supplied"}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800/40">
                      <span className="text-slate-500 block text-[10px] uppercase">Items / Quantity</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">{selectedInvoice.items_count} / {selectedInvoice.total_quantity}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800/40">
                      <span className="text-slate-500 block text-[10px] uppercase">Taxable Value</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">{formatCurrency(selectedInvoice.taxable_value)}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-100 dark:border-slate-800/40">
                      <span className="text-slate-500 block text-[10px] uppercase">Grand Total</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">{formatCurrency(selectedInvoice.grand_total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 text-center text-slate-500">
                Select a tax invoice from the ledger list to view its live financial details.
              </div>
            )}
          </div>
        </div>
      </SmritiScrollArea>
    </div>
  );
};
