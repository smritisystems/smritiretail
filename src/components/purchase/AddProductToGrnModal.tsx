/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.33.1
 * Created      : 2026-09-20
 * Modified     : 2026-09-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability    : @SmritiCapability("PURCHASE", "ADD_PRODUCT_TO_GRN")
 * Target UI    : Add Product From Master Catalog to GRN Workspace
 */

import React, { useState, useEffect, useCallback } from "react";
import { Search, X, Package, Plus, Barcode } from "lucide-react";
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
}

interface AddProductToGrnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (prod: SelectedGrnProduct) => void;
}

export const AddProductToGrnModal: React.FC<AddProductToGrnModalProps> = ({
  isOpen,
  onClose,
  onSelectProduct,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

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
    if (isOpen) {
      fetchProducts(searchTerm);
    }
  }, [isOpen, fetchProducts, searchTerm]);

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
                Add Product from Master Catalog
              </h3>
              <p className="text-xs text-slate-500">
                Search item database to inward without PO or add ad-hoc SKU
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

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by SKU, Product Name, Brand, or Barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
              autoFocus
            />
          </div>
        </div>

        {/* Product Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
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
              const size = p.attributes?.size || p.size || "STD";
              const color = p.attributes?.color || p.color || "Standard";

              return (
                <div
                  key={p.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-800 hover:bg-indigo-50/20 transition flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 flex-1 min-w-0">
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
                    <div className="text-[11px] text-slate-500 flex items-center gap-3">
                      <span>Category: {p.category || "General"}</span>
                      <span>•</span>
                      <span>Size/Col: {size} / {color}</span>
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
                          size,
                          color,
                          cost_price: cost,
                          invoice_rate: cost,
                          gst_rate: gst,
                          mrp,
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
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
