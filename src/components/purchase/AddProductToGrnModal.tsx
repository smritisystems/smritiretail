/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.34.0
 * Created      : 2026-09-20
 * Modified     : 2026-11-03 (v3.34.1 — Strict PO Line & SKU/Size Parameter Reconciliation)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "ADD_PRODUCT_TO_GRN")
 * Target UI    : Add Product From Master Catalog & PO Scope to GRN Workspace
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Search, X, Package, Plus, Barcode, ClipboardList, Check, AlertTriangle } from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";

export interface SelectedGrnProduct {
  product_id: string;
  code: string;
  name: string;
  size: string;
  color: string;
  cost_price: number;
  invoice_rate: number;
  gst_rate: number;
  mrp: number;
  quantity_ordered?: number;
  quantity_received?: number;
}

interface AddProductToGrnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (prod: SelectedGrnProduct) => void;
  selectedOrder?: any;
  existingLines?: any[];
}

export const AddProductToGrnModal: React.FC<AddProductToGrnModalProps> = ({
  isOpen,
  onClose,
  onSelectProduct,
  selectedOrder,
  existingLines = [],
}) => {
  const hasPo = Boolean(selectedOrder && selectedOrder.items && selectedOrder.items.length > 0);
  const [activeTab, setActiveTab] = useState<"po" | "catalog">(hasPo ? "po" : "catalog");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  // Selected custom sizes per catalog item id
  const [itemSizeOverrides, setItemSizeOverrides] = useState<Record<string, string>>({});
  const [itemColorOverrides, setItemColorOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setActiveTab(hasPo ? "po" : "catalog");
    }
  }, [isOpen, hasPo]);

  const fetchProducts = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const url = query.trim()
        ? `/inventory/?page=1&page_size=50&q=${encodeURIComponent(query.trim())}`
        : `/inventory/?page=1&page_size=50&sort=name&order=asc`;
      const res = await apiFetchV1(url);
      const items = Array.isArray(res) ? res : res?.items || [];
      setProducts(items);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === "catalog") {
      fetchProducts(searchTerm);
    }
  }, [isOpen, activeTab, fetchProducts, searchTerm]);

  // Filtered PO Lines
  const poLines = useMemo(() => {
    if (!hasPo) return [];
    const rawItems: any[] = selectedOrder.items || [];
    if (!searchTerm.trim()) return rawItems;
    const q = searchTerm.trim().toLowerCase();
    return rawItems.filter((it: any) => {
      const code = String(it.code || it.product_code || it.sku || "").toLowerCase();
      const name = String(it.name || it.item_name || it.description || "").toLowerCase();
      const size = String(it.size || "").toLowerCase();
      const color = String(it.color || "").toLowerCase();
      return code.includes(q) || name.includes(q) || size.includes(q) || color.includes(q);
    });
  }, [hasPo, selectedOrder, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600 text-white">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                {hasPo ? "Select Purchase Order / Master Catalog SKU" : "Add Product from Master Catalog"}
              </h3>
              <p className="text-xs text-slate-500">
                {hasPo
                  ? `Inwarding against PO ${selectedOrder.order_no || selectedOrder.id} with strict SKU/size parameters`
                  : "Search item database to inward without PO or add ad-hoc SKU"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Source Switcher Tabs if PO is linked */}
        {hasPo && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-5 pt-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("po")}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition flex items-center gap-2 ${
                activeTab === "po"
                  ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 -mb-[1px] shadow-xs"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>PO Items ({selectedOrder.items?.length || 0})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("catalog")}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition flex items-center gap-2 ${
                activeTab === "catalog"
                  ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 -mb-[1px] shadow-xs"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Master Catalog Search</span>
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === "po" ? "Filter ordered PO lines by SKU, Name, Size..." : "Search master catalog by SKU, Name, Brand, Barcode..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>
          {hasPo && activeTab === "catalog" && (
            <div className="mt-2.5 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Purchase Order Notice: Inwarding items not in the approved PO requires manager authorization.</span>
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {activeTab === "po" ? (
            poLines.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No items in Purchase Order match "{searchTerm}".
              </div>
            ) : (
              poLines.map((it: any, idx: number) => {
                const sku = it.code || it.product_code || it.sku || `ITEM-${idx + 1}`;
                const name = it.name || it.item_name || it.description || "PO Line Item";
                const size = it.size || "M";
                const color = it.color || "Standard";
                const cost = Number(it.cost_price || it.unit_price || 0);
                const gst = Number(it.gst_rate || 18);
                const mrp = Number(it.mrp || (cost * 1.5));
                const orderedQty = Number(it.quantity || it.qty_ordered || 0);
                const receivedQty = Number(it.received_qty || 0);
                const pendingQty = it.pending_qty !== undefined ? Number(it.pending_qty) : Math.max(0, orderedQty - receivedQty);
                const isFullyBilled = it.is_billed || (pendingQty <= 0 && orderedQty > 0);

                const isAlreadyAdded = existingLines.some(
                  (l) => (l.code === sku || l.product_id === it.product_id) && String(l.size).toLowerCase() === String(size).toLowerCase()
                );

                return (
                  <div
                    key={`${sku}-${size}-${color}-${idx}`}
                    className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 ${
                      isAlreadyAdded
                        ? "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 opacity-90"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-indigo-50/20"
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-indigo-700 dark:text-indigo-400">
                          {sku}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          Size: {size}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          Color: {color}
                        </span>
                        {isFullyBilled && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Fully Inwarded / Billed
                          </span>
                        )}
                        {isAlreadyAdded && !isFullyBilled && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> In Draft GRN
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                        {name}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 font-mono flex-wrap">
                        <span>Ordered: <strong className="text-slate-800 dark:text-slate-200">{orderedQty} Pcs</strong></span>
                        {receivedQty > 0 && (
                          <>
                            <span>•</span>
                            <span>Received/Billed: <strong className="text-emerald-600 dark:text-emerald-400">{receivedQty} Pcs</strong></span>
                            <span>•</span>
                            <span>Pending: <strong className={pendingQty > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-400"}>{pendingQty} Pcs</strong></span>
                          </>
                        )}
                        <span>•</span>
                        <span>Cost: ₹{cost.toFixed(2)}</span>
                        <span>•</span>
                        <span>GST: {gst}%</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectProduct({
                            product_id: it.product_id || it.item_id || it.id || `PROD-${idx + 1}`,
                            code: sku,
                            name,
                            size,
                            color,
                            cost_price: cost,
                            invoice_rate: cost,
                            gst_rate: gst,
                            mrp,
                            quantity_ordered: orderedQty,
                            quantity_received: (pendingQty > 0 ? pendingQty : orderedQty) || 1,
                          });
                          onClose();
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition flex items-center gap-1 ${
                          isAlreadyAdded
                            ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white"
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isAlreadyAdded ? "Add More" : "Add to GRN"}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            /* Catalog tab */
            loading ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Searching master inventory items...
              </div>
            ) : products.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No products found matching "{searchTerm}".
              </div>
            ) : (
              products.map((p) => {
                const sku = p.sku || p.code || p.id;
                const name = p.name || p.title || "Product";
                const cost = Number(p.cost_price || p.buying_price || p.price || 100);
                const mrp = Number(p.mrp || p.price || cost * 1.5);
                const gst = Number(p.tax_rate || p.gst_rate || 18);
                const currentSize = itemSizeOverrides[p.id] || p.attributes?.size || p.size || "M";
                const currentColor = itemColorOverrides[p.id] || p.attributes?.color || p.color || "Standard";

                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-indigo-50/20 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-indigo-700 dark:text-indigo-400">
                          {sku}
                        </span>
                        {p.barcode && (
                          <span className="text-[10px] font-mono text-slate-400 inline-flex items-center gap-0.5">
                            <Barcode className="w-3 h-3" />
                            {p.barcode}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                        {name}
                      </div>

                      {/* Interactive Size & Color Parameters */}
                      <div className="flex items-center gap-2 pt-1">
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <span>Size:</span>
                          <select
                            value={currentSize}
                            onChange={(e) => setItemSizeOverrides({ ...itemSizeOverrides, [p.id]: e.target.value })}
                            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-bold text-slate-800 dark:text-slate-200"
                          >
                            {["XS", "S", "M", "L", "XL", "XXL", "28", "30", "32", "34", "36", "38", "40", "42", "Free"].map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <span>Color:</span>
                          <input
                            type="text"
                            value={currentColor}
                            onChange={(e) => setItemColorOverrides({ ...itemColorOverrides, [p.id]: e.target.value })}
                            placeholder="Color"
                            className="w-20 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-bold text-slate-800 dark:text-slate-200"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-right space-y-1 shrink-0">
                      <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                        Cost: ₹{cost.toFixed(2)}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        MRP: ₹{mrp.toFixed(2)} | GST: {gst}%
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectProduct({
                            product_id: p.id,
                            code: sku,
                            name,
                            size: currentSize,
                            color: currentColor,
                            cost_price: cost,
                            invoice_rate: cost,
                            gst_rate: gst,
                            mrp,
                            quantity_ordered: 0,
                            quantity_received: 1,
                          });
                          onClose();
                        }}
                        className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1 ml-auto"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add to GRN</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
