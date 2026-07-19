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
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { apiFetchV1 } from "../lib/apiFetchV1";
import { Search, Plus, Trash2, Box, RefreshCw, Barcode } from "lucide-react";
import { Product } from "../types.js";

interface BarcodeMappingSectionProps {
  products: Product[];
  onNotification: (title: string, message: string, type?: "success" | "error") => void;
  onRefreshProducts: () => Promise<void>;
}

export const BarcodeMappingSection: React.FC<BarcodeMappingSectionProps> = ({ products, onNotification, onRefreshProducts }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [newBarcodeValue, setNewBarcodeValue] = useState("");
  const [newBarcodeType, setNewBarcodeType] = useState("EAN-13");
  const [isAdding, setIsAdding] = useState(false);

  // Filter products for mapping
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedProduct = products.find(p => p.id === selectedProductId);

  const handleAddBarcode = async () => {
    if (!selectedProductId) return onNotification("Error", "Please select a product first", "error");
    if (!newBarcodeValue.trim()) return onNotification("Error", "Please enter a barcode value", "error");

    setIsAdding(true);
    try {
      await apiFetchV1(`/inventory/${selectedProductId}/barcodes`, {
        method: "POST",
        body: JSON.stringify({ type: newBarcodeType, value: newBarcodeValue.trim() })
      });
      onNotification("Success", "Barcode alias added successfully", "success");
      setNewBarcodeValue("");
      await onRefreshProducts();
    } catch (err: any) {
      onNotification("Error", err.message || "Failed to add barcode", "error");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveBarcode = async (productId: string, barcodeValue: string) => {
    if (!confirm("Remove this barcode alias?")) return;
    try {
      await apiFetchV1(`/inventory/${productId}/barcodes/${encodeURIComponent(barcodeValue)}`, {
        method: "DELETE"
      });
      onNotification("Success", "Barcode alias removed", "success");
      await onRefreshProducts();
    } catch (err: any) {
      onNotification("Error", err.message || "Failed to remove barcode", "error");
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-bold font-display text-theme-body flex items-center gap-2">
          <Barcode className="text-indigo-400" />
          Barcode-to-Product Mapping Module
        </h2>
        <p className="text-xs text-theme-muted mt-1">Manage secondary barcodes, GS1 aliases, and internal tags mapped to your Item Master.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Col: Product Selection */}
        <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-theme-divider bg-theme-surface-1">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
              <input 
                type="text" 
                placeholder="Search products..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-theme-surface-2 border border-theme-divider text-theme-body rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar p-2 space-y-1">
            {filteredProducts.map(p => (
              <div 
                key={p.id}
                onClick={() => setSelectedProductId(p.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedProductId === p.id ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-theme-surface-1 border-transparent hover:bg-theme-surface-hover'}`}
              >
                <div className="font-bold text-sm text-theme-body truncate">{p.name}</div>
                <div className="text-[10px] text-theme-muted font-mono mt-1 flex justify-between">
                  <span>{p.code}</span>
                  <span>{(p.barcodes?.length || 0)} aliases</span>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="p-8 text-center text-theme-muted text-xs">No products found</div>
            )}
          </div>
        </div>

        {/* Right Col: Mapping Details */}
        <div className="md:col-span-2">
          {selectedProduct ? (
            <div className="space-y-6">
              <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-theme-surface-3 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Box size={24} className="text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-theme-body">{selectedProduct.name}</h3>
                    <div className="text-xs text-theme-muted mt-1 font-mono">SKU: {selectedProduct.code} | Primary Barcode: {selectedProduct.barcode}</div>
                  </div>
                </div>
              </div>

              <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 space-y-4">
                <h4 className="text-sm font-bold text-theme-body">Add New Barcode Alias</h4>
                <div className="flex gap-3">
                  <select 
                    value={newBarcodeType}
                    onChange={e => setNewBarcodeType(e.target.value)}
                    className="w-40 bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option>EAN-13</option>
                    <option>EAN-8</option>
                    <option>UPC-A</option>
                    <option>Code128</option>
                    <option>GS1 Digital Link (QR)</option>
                    <option>Internal Tag</option>
                  </select>
                  <input 
                    type="text" 
                    placeholder="Scan or type barcode value..." 
                    value={newBarcodeValue}
                    onChange={e => setNewBarcodeValue(e.target.value)}
                    className="flex-1 bg-theme-surface-1 border border-theme-divider text-theme-body rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <button 
                    onClick={handleAddBarcode}
                    disabled={isAdding}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                  >
                    {isAdding ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                    Link Barcode
                  </button>
                </div>
              </div>

              <div className="bg-theme-surface-1 border border-theme-divider rounded-xl overflow-hidden">
                <div className="p-4 border-b border-theme-divider bg-theme-surface-2 flex justify-between items-center">
                  <h4 className="text-sm font-bold text-theme-body">Mapped Barcodes ({(selectedProduct.barcodes?.length || 0)})</h4>
                </div>
                {selectedProduct.barcodes && selectedProduct.barcodes.length > 0 ? (
                  <div className="divide-y divide-theme-divider">
                    {selectedProduct.barcodes.map((bc, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between hover:bg-theme-surface-hover transition-colors">
                        <div className="flex items-center gap-4">
                          <Barcode size={18} className="text-theme-muted" />
                          <div>
                            <div className="text-sm font-bold text-theme-body font-mono">{bc.value}</div>
                            <div className="text-[10px] text-theme-muted uppercase mt-0.5">{bc.type}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleRemoveBarcode(selectedProduct.id, bc.value)}
                          className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Remove mapping"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-theme-muted">
                    <Barcode size={32} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No secondary barcodes mapped</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-theme-muted border border-theme-divider border-dashed rounded-xl p-12 bg-theme-surface-1/50">
               <Box size={48} className="mb-4 opacity-20" />
               <p className="text-sm font-semibold">Select a Product</p>
               <p className="text-xs text-center mt-2 max-w-xs">Select an item from the master catalog on the left to view and manage its barcode mappings.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
