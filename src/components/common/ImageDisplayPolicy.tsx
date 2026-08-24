/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.0.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { Settings, ShieldCheck, X } from "lucide-react";

export interface DisplayPolicy {
  showInPos: boolean;
  posSize: "small" | "medium" | "large";
  showInSales: boolean;
  salesSize: "small" | "medium";
  showInPurchase: boolean;
  purchaseSize: "small" | "medium";
  showInInventory: boolean;
  inventorySize: "small" | "medium";
  hoverZoom: boolean;
}

export const DEFAULT_DISPLAY_POLICY: DisplayPolicy = {
  showInPos: true,
  posSize: "medium",
  showInSales: true,
  salesSize: "small",
  showInPurchase: true,
  purchaseSize: "small",
  showInInventory: false,
  inventorySize: "small",
  hoverZoom: true,
};

interface ImageDisplayPolicyModalProps {
  onClose: () => void;
  onSave: (policy: DisplayPolicy) => void;
}

export const ImageDisplayPolicyModal: React.FC<ImageDisplayPolicyModalProps> = ({
  onClose,
  onSave,
}) => {
  const [policy, setPolicy] = useState<DisplayPolicy>(DEFAULT_DISPLAY_POLICY);

  useEffect(() => {
    const saved = localStorage.getItem("smriti_spif_display_policy");
    if (saved) {
      try {
        setPolicy({ ...DEFAULT_DISPLAY_POLICY, ...JSON.parse(saved) });
      } catch (e) {
        console.error("Failed to parse display policy:", e);
      }
    }
  }, []);

  const handleToggle = (key: keyof DisplayPolicy) => {
    setPolicy((prev) => ({ ...prev, [key]: !prev[key] } as any));
  };

  const handleSelectChange = (key: keyof DisplayPolicy, val: string) => {
    setPolicy((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    localStorage.setItem("smriti_spif_display_policy", JSON.stringify(policy));
    onSave(policy);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-theme-surface-2 border-b border-theme-divider">
          <h3 className="text-sm font-bold uppercase font-mono tracking-wider text-theme-primary flex items-center space-x-2">
            <Settings size={16} className="text-emerald-400" />
            <span>Image Display Policy (SPIF)</span>
          </h3>
          <button
            onClick={onClose}
            className="text-theme-muted hover:text-theme-primary transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs text-theme-body max-h-[70vh] overflow-y-auto">
          <p className="text-theme-muted font-mono leading-relaxed">
            Configure how product images appear across catalog grids and transaction panels. Hiding images or using smaller sizes can improve loading speeds on slower connections.
          </p>

          <div className="space-y-4">
            {/* Global Settings */}
            <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold font-display text-theme-primary">Hover Zoom Preview</div>
                  <div className="text-[10px] text-theme-muted font-mono mt-0.5">Show high-res lightbox on click / zoom on hover</div>
                </div>
                <input
                  type="checkbox"
                  checked={policy.hoverZoom}
                  onChange={() => handleToggle("hoverZoom")}
                  className="rounded border-theme-divider text-blue-500 w-4 h-4 focus:ring-0 focus:ring-offset-0 bg-theme-surface-3 cursor-pointer"
                />
              </div>
            </div>

            {/* POS Billing Screen */}
            <div className="border border-theme-divider rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold font-display text-theme-primary">POS Billing Grid</div>
                  <div className="text-[10px] text-theme-muted font-mono mt-0.5">Render images in active POS checkout items</div>
                </div>
                <input
                  type="checkbox"
                  checked={policy.showInPos}
                  onChange={() => handleToggle("showInPos")}
                  className="rounded border-theme-divider text-blue-500 w-4 h-4 focus:ring-0 focus:ring-offset-0 bg-theme-surface-3 cursor-pointer"
                />
              </div>
              {policy.showInPos && (
                <div className="flex items-center justify-between pt-2 border-t border-theme-divider/40">
                  <span className="text-theme-muted font-mono">Thumbnail Size:</span>
                  <select
                    value={policy.posSize}
                    onChange={(e) => handleSelectChange("posSize", e.target.value)}
                    className="bg-theme-surface-3 border border-theme-divider rounded px-2 py-1 text-[11px] text-theme-body font-mono focus:outline-none"
                  >
                    <option value="small">Small (24x24)</option>
                    <option value="medium">Medium (48x48)</option>
                    <option value="large">Large (96x96)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Sales Grid */}
            <div className="border border-theme-divider rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold font-display text-theme-primary">Sales Invoice / Orders</div>
                  <div className="text-[10px] text-theme-muted font-mono mt-0.5">Show product thumbnails in Sales transactions</div>
                </div>
                <input
                  type="checkbox"
                  checked={policy.showInSales}
                  onChange={() => handleToggle("showInSales")}
                  className="rounded border-theme-divider text-blue-500 w-4 h-4 focus:ring-0 focus:ring-offset-0 bg-theme-surface-3 cursor-pointer"
                />
              </div>
              {policy.showInSales && (
                <div className="flex items-center justify-between pt-2 border-t border-theme-divider/40">
                  <span className="text-theme-muted font-mono">Thumbnail Size:</span>
                  <select
                    value={policy.salesSize}
                    onChange={(e) => handleSelectChange("salesSize", e.target.value)}
                    className="bg-theme-surface-3 border border-theme-divider rounded px-2 py-1 text-[11px] text-theme-body font-mono focus:outline-none"
                  >
                    <option value="small">Small (24x24)</option>
                    <option value="medium">Medium (48x48)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Purchase Grid */}
            <div className="border border-theme-divider rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold font-display text-theme-primary">Purchase Orders / GRN</div>
                  <div className="text-[10px] text-theme-muted font-mono mt-0.5">Show product thumbnails in Purchase transactions</div>
                </div>
                <input
                  type="checkbox"
                  checked={policy.showInPurchase}
                  onChange={() => handleToggle("showInPurchase")}
                  className="rounded border-theme-divider text-blue-500 w-4 h-4 focus:ring-0 focus:ring-offset-0 bg-theme-surface-3 cursor-pointer"
                />
              </div>
              {policy.showInPurchase && (
                <div className="flex items-center justify-between pt-2 border-t border-theme-divider/40">
                  <span className="text-theme-muted font-mono">Thumbnail Size:</span>
                  <select
                    value={policy.purchaseSize}
                    onChange={(e) => handleSelectChange("purchaseSize", e.target.value)}
                    className="bg-theme-surface-3 border border-theme-divider rounded px-2 py-1 text-[11px] text-theme-body font-mono focus:outline-none"
                  >
                    <option value="small">Small (24x24)</option>
                    <option value="medium">Medium (48x48)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Inventory Ledger */}
            <div className="border border-theme-divider rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold font-display text-theme-primary">Stock Entries / Ledgers</div>
                  <div className="text-[10px] text-theme-muted font-mono mt-0.5">Show product thumbnails in Inventory modules</div>
                </div>
                <input
                  type="checkbox"
                  checked={policy.showInInventory}
                  onChange={() => handleToggle("showInInventory")}
                  className="rounded border-theme-divider text-blue-500 w-4 h-4 focus:ring-0 focus:ring-offset-0 bg-theme-surface-3 cursor-pointer"
                />
              </div>
              {policy.showInInventory && (
                <div className="flex items-center justify-between pt-2 border-t border-theme-divider/40">
                  <span className="text-theme-muted font-mono">Thumbnail Size:</span>
                  <select
                    value={policy.inventorySize}
                    onChange={(e) => handleSelectChange("inventorySize", e.target.value)}
                    className="bg-theme-surface-3 border border-theme-divider rounded px-2 py-1 text-[11px] text-theme-body font-mono focus:outline-none"
                  >
                    <option value="small">Small (24x24)</option>
                    <option value="medium">Medium (48x48)</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-theme-surface-2 border-t border-theme-divider">
          <span className="text-[10px] text-theme-muted font-mono">
            SPIF display parameters apply globally.
          </span>
          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors shadow-lg cursor-pointer"
          >
            <ShieldCheck size={12} />
            <span>Apply Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
