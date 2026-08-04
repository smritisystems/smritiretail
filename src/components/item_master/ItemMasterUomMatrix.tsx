/**
 * Project      : SMRITI Retail OS
 * Module       : Multi-UOM & Packaging Unit Matrix (SLGP-001 v2.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com. All Rights Reserved.
 * Version      : 5.4.0
 */

import React from "react";
import { Package, Layers, Plus, Trash2, ArrowRight } from "lucide-react";

export interface UomConversion {
  id: string;
  packagingUom: string;
  conversionFactor: number; // e.g. 1 Box = 12 Base Units
  mrp: number;
  barcode?: string;
}

interface ItemMasterUomMatrixProps {
  baseUom: string;
  conversions: UomConversion[];
  onChange: (updated: UomConversion[]) => void;
  isReadOnly?: boolean;
}

export const ItemMasterUomMatrix: React.FC<ItemMasterUomMatrixProps> = ({
  baseUom,
  conversions,
  onChange,
  isReadOnly = false
}) => {
  const handleAdd = () => {
    const newItem: UomConversion = {
      id: `uom_${Date.now()}`,
      packagingUom: "Box",
      conversionFactor: 12,
      mrp: 0
    };
    onChange([...conversions, newItem]);
  };

  const handleRemove = (id: string) => {
    onChange(conversions.filter((c) => c.id !== id));
  };

  const handleUpdate = (id: string, field: keyof UomConversion, val: any) => {
    onChange(
      conversions.map((c) => (c.id === id ? { ...c, [field]: val } : c))
    );
  };

  return (
    <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-theme-heading flex items-center gap-2">
            <Layers className="w-4 h-4 text-[var(--c-seef-accent)]" /> Multi-UOM & Packaging Matrix
          </h4>
          <p className="text-xs text-theme-muted">
            Define secondary packaging units (e.g., Box, Carton, Case) and unit conversion rates relative to base unit ({baseUom || "Pcs"}).
          </p>
        </div>

        {!isReadOnly && (
          <button
            type="button"
            onClick={handleAdd}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-theme-surface-2 border border-theme-divider text-[var(--c-seef-accent)] hover:bg-theme-surface-hover flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Packaging UOM
          </button>
        )}
      </div>

      {conversions.length === 0 ? (
        <div className="p-4 text-center text-xs font-mono text-theme-muted border border-dashed border-theme-divider rounded-lg">
          No secondary packaging UOMs configured. Product is billed strictly in base unit ({baseUom || "Pcs"}).
        </div>
      ) : (
        <div className="space-y-3">
          {conversions.map((c) => (
            <div
              key={c.id}
              className="p-3 bg-theme-surface-2 border border-theme-divider rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={c.packagingUom}
                  onChange={(e) => handleUpdate(c.id, "packagingUom", e.target.value)}
                  placeholder="Packaging UOM (e.g. Box)"
                  disabled={isReadOnly}
                  className="w-32 p-1.5 bg-theme-surface-1 border border-theme-divider rounded text-theme-heading font-bold"
                />
                <ArrowRight className="w-4 h-4 text-theme-muted shrink-0" />
                <span className="text-theme-muted font-mono">1 {c.packagingUom} =</span>
                <input
                  type="number"
                  value={c.conversionFactor}
                  onChange={(e) => handleUpdate(c.id, "conversionFactor", parseFloat(e.target.value) || 1)}
                  disabled={isReadOnly}
                  className="w-20 p-1.5 bg-theme-surface-1 border border-theme-divider rounded text-theme-heading font-mono text-center"
                />
                <span className="text-theme-muted font-mono">{baseUom || "Pcs"}</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-theme-muted font-mono">Pack MRP ₹</span>
                  <input
                    type="number"
                    value={c.mrp}
                    onChange={(e) => handleUpdate(c.id, "mrp", parseFloat(e.target.value) || 0)}
                    disabled={isReadOnly}
                    className="w-24 p-1.5 bg-theme-surface-1 border border-theme-divider rounded text-emerald-500 font-mono text-right font-bold"
                  />
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemove(c.id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
