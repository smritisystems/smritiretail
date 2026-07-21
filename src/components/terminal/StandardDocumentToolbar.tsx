/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.0.0
 * Created      : 2026-07-20
 * Modified     : 2026-07-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";

interface StandardDocumentToolbarProps {
  onNew?: () => void;
  onSave?: () => void;
  onHold?: () => void;
  onRecall?: () => void;
  onImport?: () => void;
  onPrint?: () => void;
  onHistory?: () => void;
  onToggleDrawer?: (drawerId: string) => void;
  activeDrawerId?: string | null;
  onSearchClick?: () => void;
  canCheckout?: boolean;
  onCheckout?: () => void;
}

export const StandardDocumentToolbar: React.FC<StandardDocumentToolbarProps> = ({
  onNew,
  onSave,
  onHold,
  onRecall,
  onImport,
  onPrint,
  onHistory,
  onToggleDrawer,
  activeDrawerId,
  onSearchClick,
  canCheckout,
  onCheckout
}) => {
  return (
    <div className="h-12 bg-[#1e293b] border-b border-slate-700 px-4 flex items-center justify-between shrink-0 font-sans select-none">
      {/* Primary Actions */}
      <div className="flex items-center space-x-2">
        <button
          onClick={onNew}
          className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
          title="New Document (ESC / Alt+N)"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          <span>New</span>
        </button>

        {onHold && (
          <button
            onClick={onHold}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded transition-colors"
            title="Hold Current Bill (F2)"
          >
            <span className="material-symbols-outlined text-sm text-amber-400">pause</span>
            <span>Hold</span>
          </button>
        )}

        {onRecall && (
          <button
            onClick={onRecall}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded transition-colors"
            title="Recall Held Bill"
          >
            <span className="material-symbols-outlined text-sm text-blue-400">restore</span>
            <span>Recall</span>
          </button>
        )}

        <button
          onClick={onSearchClick}
          className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded transition-colors"
          title="Universal Search (Ctrl+K)"
        >
          <span className="material-symbols-outlined text-sm text-emerald-400">search</span>
          <span>Search</span>
          <kbd className="bg-slate-900 px-1 py-0.5 rounded text-[9px] font-mono text-slate-400 border border-slate-700">Ctrl+K</kbd>
        </button>
      </div>

      {/* Drawer Triggers */}
      {onToggleDrawer && (
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => onToggleDrawer("transport")}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded border text-xs font-medium transition-colors ${
              activeDrawerId === "transport"
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
            title="Transport & E-Way Bill Details"
          >
            <span className="material-symbols-outlined text-sm">local_shipping</span>
            <span>Transport</span>
          </button>

          <button
            onClick={() => onToggleDrawer("gst")}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded border text-xs font-medium transition-colors ${
              activeDrawerId === "gst"
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
            title="GSTIN & Tax Details"
          >
            <span className="material-symbols-outlined text-sm">receipt</span>
            <span>GST</span>
          </button>

          <button
            onClick={() => onToggleDrawer("coupons")}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded border text-xs font-medium transition-colors ${
              activeDrawerId === "coupons"
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
            title="Promotions & Loyalty Coupons"
          >
            <span className="material-symbols-outlined text-sm">local_offer</span>
            <span>Promos</span>
          </button>

          <button
            onClick={() => onToggleDrawer("salesperson")}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded border text-xs font-medium transition-colors ${
              activeDrawerId === "salesperson"
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
            title="Salesperson & Commission Assignment"
          >
            <span className="material-symbols-outlined text-sm">badge</span>
            <span>Salesperson</span>
          </button>

          <button
            onClick={() => onToggleDrawer("remarks")}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded border text-xs font-medium transition-colors ${
              activeDrawerId === "remarks"
                ? "bg-blue-600 border-blue-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
            title="Remarks & Attachments"
          >
            <span className="material-symbols-outlined text-sm">notes</span>
            <span>Remarks</span>
          </button>
        </div>
      )}

      {/* Checkout / Finish Action */}
      {onCheckout && (
        <button
          disabled={!canCheckout}
          onClick={onCheckout}
          className={`flex items-center space-x-1.5 text-xs font-bold uppercase px-4 py-1.5 rounded transition-colors ${
            canCheckout
              ? "bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-lg shadow-emerald-900/30"
              : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
          }`}
          title="Checkout & Pay (F12)"
        >
          <span className="material-symbols-outlined text-sm">check_circle</span>
          <span>Checkout (F12)</span>
        </button>
      )}
    </div>
  );
};
