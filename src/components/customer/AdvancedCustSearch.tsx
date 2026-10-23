import React, { useEffect, useState } from "react";
import { X, Search, Users, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import type { CustomerDirectoryItem, CustomerDirectoryResponse } from "./types.ts";

interface Props { isOpen: boolean; onClose: () => void; onSelectCustomer: (customer: CustomerDirectoryItem) => void; }
const PAGE_SIZE = 25;

export const SmritiAdvancedCustomerSearchModal: React.FC<Props> = ({ isOpen, onClose, onSelectCustomer }) => {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<CustomerDirectoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const run = async () => {
        setLoading(true); setError("");
        try {
          const params = new URLSearchParams({ skip: String(page * PAGE_SIZE), limit: String(PAGE_SIZE), status });
          if (query.trim()) params.set("q", query.trim());
          const result = await apiFetchV1<CustomerDirectoryResponse>(`/crm/customers/directory?${params.toString()}`);
          if (!cancelled) {
            setItems(result.items || []);
            setTotal(result.total || 0);
            setSelectedId(old => result.items?.some(item => item.id === old) ? old : null);
          }
        } catch (err: any) {
          if (!cancelled) { setItems([]); setTotal(0); setError(err?.message || "Unable to load customers. Try again."); }
        } finally { if (!cancelled) setLoading(false); }
      };
      void run();
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [isOpen, page, query, status]);

  useEffect(() => {
    if (!isOpen) return;
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const selected = items.find(item => item.id === selectedId) || null;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="customer-search-title" className="bg-white dark:bg-[#191c1e] w-full max-w-5xl rounded-2xl shadow-2xl border flex flex-col max-h-[90vh] overflow-hidden">
        <header className="px-5 py-4 bg-[#f2f4f6] dark:bg-[#131b2e] border-b flex items-center justify-between">
          <div><h2 id="customer-search-title" className="text-sm font-bold">Search customers</h2><p className="text-xs mt-1 text-slate-600">Search by name, code, or phone.</p></div>
          <button type="button" onClick={onClose} aria-label="Close customer search" className="p-2 rounded-lg hover:bg-slate-200"><X size={18} /></button>
        </header>
        <div className="p-4 flex flex-col sm:flex-row gap-3 border-b">
          <label className="relative flex-1"><span className="sr-only">Search customers</span><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input autoFocus value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="Name, customer code, or phone" className="w-full pl-9 pr-3 py-2.5 border rounded-lg bg-white dark:bg-[#191c1e]" />
          </label>
          <label className="text-xs font-semibold flex items-center gap-2">Status
            <select value={status} onChange={event => { setStatus(event.target.value); setPage(0); }} className="px-3 py-2.5 border rounded-lg bg-white dark:bg-[#191c1e]">
              <option value="all">All statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Archived">Archived</option><option value="Merged">Merged</option>
            </select>
          </label>
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-[#f7f9fb] dark:bg-[#131b2e] text-xs uppercase"><tr>
              <th scope="col" className="px-4 py-3">Code</th><th scope="col" className="px-4 py-3">Customer</th><th scope="col" className="px-4 py-3">Phone</th><th scope="col" className="px-4 py-3">Group</th><th scope="col" className="px-4 py-3">Status</th><th scope="col" className="px-4 py-3"><span className="sr-only">Action</span></th>
            </tr></thead>
            <tbody className="divide-y">
              {loading ? <tr><td colSpan={6} className="p-10 text-center"><Loader2 size={20} className="animate-spin mx-auto" /><span className="sr-only">Loading customers</span></td></tr>
                : error ? <tr><td colSpan={6} role="alert" className="p-10 text-center text-red-700">{error}</td></tr>
                : items.length === 0 ? <tr><td colSpan={6} className="p-10 text-center text-slate-500"><Users size={28} className="mx-auto mb-2" />No customers match these filters.</td></tr>
                : items.map((item, index) => {
                  const active = item.status?.toLowerCase() === "active" && item.is_active;
                  return <tr
                    key={item.id}
                    tabIndex={0}
                    aria-selected={selectedId === item.id}
                    onFocus={() => setSelectedId(item.id)}
                    onClick={() => setSelectedId(item.id)}
                    onKeyDown={event => {
                      if (event.key === "Enter") { event.preventDefault(); onSelectCustomer(item); }
                      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        const rows = Array.from(event.currentTarget.parentElement?.querySelectorAll<HTMLTableRowElement>("tr[tabindex='0']") || []);
                        rows[Math.min(rows.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus();
                      }
                    }}
                    className={`cursor-pointer focus:outline focus:outline-2 focus:outline-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800 ${selectedId === item.id ? "bg-blue-50 dark:bg-blue-950/40" : ""}`}
                  >
                    <td className="px-4 py-3 font-mono">{item.code || "—"}</td><td className="px-4 py-3 font-semibold">{item.name}</td><td className="px-4 py-3">{item.mobile || "—"}</td><td className="px-4 py-3">{item.customer_group_name || "—"}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"}`}>{item.status || "Unknown"}</span></td>
                    <td className="px-4 py-3 text-right"><button type="button" onClick={event => { event.stopPropagation(); onSelectCustomer(item); }} className="px-3 py-1.5 bg-[#00355f] text-white rounded-lg font-semibold">Open</button></td>
                  </tr>;
                })}
            </tbody>
          </table>
        </div>
        <footer className="px-4 py-3 border-t flex items-center justify-between gap-3 text-sm">
          <span aria-live="polite">{total} customer{total === 1 ? "" : "s"} found{total ? ` · Page ${page + 1} of ${pages}` : ""}</span>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Previous page" disabled={page === 0 || loading} onClick={() => setPage(value => Math.max(0, value - 1))} className="px-3 py-2 border rounded-lg disabled:opacity-40"><ChevronLeft size={16} /></button>
            <button type="button" aria-label="Next page" disabled={page + 1 >= pages || loading} onClick={() => setPage(value => value + 1)} className="px-3 py-2 border rounded-lg disabled:opacity-40"><ChevronRight size={16} /></button>
            <button type="button" disabled={!selected || loading} onClick={() => selected && onSelectCustomer(selected)} className="px-4 py-2 bg-[#00355f] text-white rounded-lg font-semibold disabled:opacity-40">Open selected</button>
          </div>
        </footer>
      </section>
    </div>
  );
};
