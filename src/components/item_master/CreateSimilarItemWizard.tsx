/**
 * Project      : SMRITI Retail OS v7.0
 * Module       : Create Similar Item Wizard (Rapid Varianting Engine)
 * Author       : Jawahar Ramkripal Mallah
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 */

import React, { useState } from "react";
import { SmritiDialog } from "../../layout_engine/components/SmritiDialog.tsx";
import { Product } from "../../types.js";
import { SPK } from "../../kernel/SPK.js";
import { CreateItemCommand } from "../../kernel/commands/CreateItemCommand.js";
import { Copy, Sparkles, CheckCircle2, ArrowRight, Save, Package } from "lucide-react";

interface CreateSimilarItemWizardProps {
  isOpen: boolean;
  onClose: () => void;
  sourceProduct: Product | null;
  onRefreshProducts: () => Promise<void>;
  onNotification?: (title: string, msg: string, type?: "success" | "error") => void;
}

export const CreateSimilarItemWizard: React.FC<CreateSimilarItemWizardProps> = ({
  isOpen,
  onClose,
  sourceProduct,
  onRefreshProducts,
  onNotification
}) => {
  if (!isOpen || !sourceProduct) return null;

  const [newName, setNewName] = useState<string>(`${sourceProduct.name} - Variant`);
  const [newColor, setNewColor] = useState<string>(sourceProduct.color || "Black");
  const [newSize, setNewSize] = useState<string>(sourceProduct.size || "M");
  const [newMrp, setNewMrp] = useState<number>(sourceProduct.mrp || sourceProduct.price || 100);
  const [newPrice, setNewPrice] = useState<number>(sourceProduct.price || 100);
  const [newBarcode, setNewBarcode] = useState<string>(`${Math.floor(8900000000000 + Math.random() * 9000000000)}`);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleExecuteCreateSimilar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSubmitting(true);
    try {
      const newSku = `SKU-${Math.floor(100000 + Math.random() * 900000)}`;
      await SPK.commands.execute(
        new CreateItemCommand({
          code: newSku,
          sku: newSku,
          name: newName,
          category: sourceProduct.category,
          brand: sourceProduct.brand,
          color: newColor,
          size: newSize,
          mrp: newMrp,
          price: newPrice,
          purchase_price: sourceProduct.purchase_price || sourceProduct.costPrice || 60,
          costPrice: sourceProduct.purchase_price || sourceProduct.costPrice || 60,
          stock: 10,
          stock_qty: 10,
          uom: sourceProduct.uom || "Pcs",
          hsnCode: sourceProduct.hsnCode || sourceProduct.hsn_code || "8471",
          gstPercentage: sourceProduct.gstPercentage || sourceProduct.gst_rate || 18,
          barcode: newBarcode,
          warehouse: sourceProduct.warehouse || "Central WH-01",
          status: "Active",
          primaryImageUrl: sourceProduct.primaryImageUrl,
          attributes: { ...(sourceProduct.attributes || {}), Color: newColor, Size: newSize }
        })
      );

      if (onRefreshProducts) await onRefreshProducts();
      if (onNotification) onNotification("Similar Item Created", `Created variant SKU ${newName}`, "success");
      onClose();
    } catch (err: any) {
      if (onNotification) onNotification("Creation Failed", err.message || "Could not clone item", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SmritiDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create Similar Item Wizard"
      subtitle={`Source SKU: ${sourceProduct.sku || sourceProduct.code} | ${sourceProduct.name}`}
      icon={Copy}
      maxWidthClass="max-w-xl"
      footerActions={
        <div className="flex justify-end gap-2 font-mono text-xs">
          <button onClick={onClose} className="px-3 py-2 text-theme-muted hover:text-theme-heading font-bold cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleExecuteCreateSimilar}
            disabled={isSubmitting}
            className="px-4 py-2 bg-[var(--c-seef-accent)] hover:opacity-90 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Sparkles className="w-4 h-4" /> {isSubmitting ? "Creating..." : "Create Similar SKU"}
          </button>
        </div>
      }
    >
      <form onSubmit={handleExecuteCreateSimilar} className="space-y-4 font-mono text-xs text-theme-body py-1">
        <div className="p-3 bg-theme-surface-1 border border-theme-divider rounded-xl space-y-1">
          <div className="text-[10px] text-theme-muted uppercase font-bold">Source Product Reference:</div>
          <div className="font-bold text-theme-heading text-xs">{sourceProduct.name}</div>
          <div className="text-[11px] text-theme-muted">
            Category: {sourceProduct.category} | Brand: {sourceProduct.brand || "Smriti"}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-theme-muted font-bold mb-1">New Product Title</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded font-bold text-theme-heading"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-theme-muted font-bold mb-1">Color Variant</label>
              <input
                type="text"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded text-theme-heading"
              />
            </div>
            <div>
              <label className="block text-theme-muted font-bold mb-1">Size Variant</label>
              <input
                type="text"
                value={newSize}
                onChange={(e) => setNewSize(e.target.value)}
                className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded text-theme-heading"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-theme-muted font-bold mb-1">MRP Price (₹)</label>
              <input
                type="number"
                step="0.01"
                value={newMrp}
                onChange={(e) => setNewMrp(parseFloat(e.target.value) || 0)}
                className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded text-theme-heading font-bold"
              />
            </div>
            <div>
              <label className="block text-theme-muted font-bold mb-1">Retail Selling Price (₹)</label>
              <input
                type="number"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded text-emerald-400 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-theme-muted font-bold mb-1">New Primary Barcode</label>
            <input
              type="text"
              value={newBarcode}
              onChange={(e) => setNewBarcode(e.target.value)}
              className="w-full p-2 bg-theme-surface-2 border border-theme-divider rounded font-bold text-theme-heading"
              required
            />
          </div>
        </div>
      </form>
    </SmritiDialog>
  );
};
