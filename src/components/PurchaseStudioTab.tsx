/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.68.0
 * Created      : 2026-07-10
 * Modified     : 2026-10-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Target UI    : Purchase Studio — Generation + Workspace (Phase B)
 *
 * Changelog (v4.0.0 — Phase B):
 *   - Added top-level tab switcher: "Generate PO" vs "Workspace"
 *   - POWorkspaceTab integrated for status-aware PO list + actions
 *   - Generation tabs (Sizewise / Standard) remain unchanged
 */

import React, { useState } from "react";
import { PoGenerateTab } from "./purchase/PoGenerateTab.tsx";
import {
  PoSizewiseTab,
  SizewisePOLine,
  SizewisePOHeader,
  SIZE_SCALE_PRESETS,
} from "./purchase/PoSizewiseTab.tsx";
import { POWorkspaceTab } from "./purchase/POWorkspaceTab.tsx";
import { AutoPOModal } from "./procurement/AutoPOModal.tsx";
import { ConsignmentStudioModal } from "./procurement/ConsignmentStudioModal.tsx";
import { SupplierPaymentModal } from "./procurement/SupplierPaymentModal.tsx";
import { Product } from "../types.ts";
import {
  convertSizewiseToStandardLines,
  convertStandardToSizewiseLines,
  syncSizewiseHeaderToStandard,
  syncStandardHeaderToSizewise,
  detectSizesFromLines,
} from "./purchase/poModeConversion.ts";
import type {
  PurchaseOrderHeader,
  PurchaseOrderLineItem,
} from "./purchase/types.ts";

type TopLevelView = "generate" | "workspace";

interface PurchaseStudioTabProps {
  products?: Product[];
  onRefreshProducts?: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
  currentUser?: { role: string; name: string } | null;
  onClose?: () => void;
  onNavigateTab?: (tab: string) => void;
  initialMode?: "standard" | "sizewise";
}

export const PurchaseStudioTab: React.FC<PurchaseStudioTabProps> = ({
  products = [],
  onRefreshProducts,
  onNotification,
  currentUser,
  onClose,
  onNavigateTab,
  initialMode,
}) => {
  // ── Top-level view: Generate vs Workspace ────────────────────────────────
  const [topView, setTopView] = useState<TopLevelView>("generate");
  const [showAutoPOModal, setShowAutoPOModal] = useState<boolean>(false);
  const [showConsignmentModal, setShowConsignmentModal] = useState<boolean>(false);
  const [showSupplierPaymentModal, setShowSupplierPaymentModal] = useState<boolean>(false);

  // ── Generation sub-mode (persisted) ─────────────────────────────────────
  const [poMode, setPoMode] = useState<"standard" | "sizewise">(() => {
    if (initialMode) return initialMode;
    try {
      const saved = localStorage.getItem("smriti_po_ux_mode");
      if (saved === "standard" || saved === "sizewise") return saved;
    } catch {
      // localStorage unavailable
    }
    return "sizewise";
  });

  // ── Order to Edit in Sizewise mode ──────────────────────────────────────
  const [orderToEdit, setOrderToEdit] = useState<string | null>(null);

  // ── Unified Document State (Single Source of Truth across Sizewise & Standard) ──
  const [sharedSizewiseLines, setSharedSizewiseLines] = useState<SizewisePOLine[]>([]);
  const [sharedStandardLines, setSharedStandardLines] = useState<PurchaseOrderLineItem[]>([]);
  const [sharedSizewiseHeader, setSharedSizewiseHeader] = useState<SizewisePOHeader | undefined>(undefined);
  const [sharedStandardHeader, setSharedStandardHeader] = useState<PurchaseOrderHeader | undefined>(undefined);
  const [sharedSizes, setSharedSizes] = useState<string[]>(() => SIZE_SCALE_PRESETS.FOOTWEAR_EU.sizes);

  const handleModeChange = (mode: "standard" | "sizewise") => {
    if (mode === "standard" && poMode === "sizewise") {
      // Convert Sizewise -> Standard barcode-wise lines
      const activeSw = sharedSizewiseLines.filter((l) => l.totalQty > 0 || l.itemCode || l.articleNo);
      if (activeSw.length > 0) {
        const converted = convertSizewiseToStandardLines(
          activeSw,
          products,
          sharedSizewiseHeader?.commonTaxPercent ?? 5
        );
        if (converted.length > 0) {
          setSharedStandardLines(converted);
        }
      }
      const newStdHeader = syncSizewiseHeaderToStandard(
        sharedSizewiseHeader || {},
        sharedStandardHeader
      );
      setSharedStandardHeader(newStdHeader);
    } else if (mode === "sizewise" && poMode === "standard") {
      // Convert Standard barcode-wise lines -> Sizewise horizontal matrix
      const activeStd = sharedStandardLines.filter(
        (l) => l.orderQty > 0 || Boolean(l.stockNo?.trim()) || Boolean(l.barcode?.trim())
      );
      if (activeStd.length > 0) {
        const detectedSizes = detectSizesFromLines(activeStd, sharedSizes);
        setSharedSizes(detectedSizes);
        const converted = convertStandardToSizewiseLines(
          activeStd,
          detectedSizes,
          sharedStandardHeader?.deliveryDate,
          sharedStandardHeader?.commonTaxPercent ?? 5
        );
        if (converted.length > 0) {
          setSharedSizewiseLines(converted);
        }
      }
      const newSwHeader = syncStandardHeaderToSizewise(
        sharedStandardHeader || {},
        sharedSizewiseHeader
      );
      setSharedSizewiseHeader(newSwHeader);
    }

    setPoMode(mode);
    try {
      localStorage.setItem("smriti_po_ux_mode", mode);
    } catch {
      // localStorage unavailable
    }
  };

  // ── Open a PO in generation view (called from Workspace) ─────────────────
  const handleOpenPOFromWorkspace = (orderNo: string) => {
    setTopView("generate");
    setPoMode("sizewise");
    setOrderToEdit(orderNo);
  };

  return (
    <div className="flex flex-col h-full w-full">

      {/* ── Studio Header / Top Nav ──────────────────────────────────────── */}
      <div className="bg-slate-900 text-white px-4 py-1.5 flex items-center justify-between text-xs border-b border-slate-800 shrink-0">

        {/* Left: Top-level view switcher */}
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-indigo-400 text-base">shopping_bag</span>
          <span className="font-semibold text-slate-300 mr-1">Purchase Studio</span>

          {/* View pill switcher */}
          <div className="inline-flex rounded-md shadow-xs bg-slate-800 p-0.5 border border-slate-700">
            <button
              type="button"
              id="purchase-studio-generate-tab"
              onClick={() => setTopView("generate")}
              className={`px-3 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
                topView === "generate"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">add_box</span>
              Generate PO
            </button>
            <button
              type="button"
              id="purchase-studio-workspace-tab"
              onClick={() => setTopView("workspace")}
              className={`px-3 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
                topView === "workspace"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">receipt_long</span>
              Workspace
            </button>
          </div>

          {/* Sub-mode switcher (only when in Generate view) */}
          {topView === "generate" && (
            <>
              <span className="text-slate-700 mx-1 select-none">|</span>
              <span className="text-slate-500 mr-1 hidden sm:inline">Mode:</span>
              <div className="inline-flex rounded-md shadow-xs bg-slate-800 p-0.5 border border-slate-700">
                <button
                  type="button"
                  id="po-mode-sizewise-btn"
                  onClick={() => handleModeChange("sizewise")}
                  className={`px-3 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
                    poMode === "sizewise"
                      ? "bg-slate-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">view_column</span>
                  Sizewise
                </button>
                <button
                  type="button"
                  id="po-mode-standard-btn"
                  onClick={() => handleModeChange("standard")}
                  className={`px-3 py-1 rounded text-xs font-medium transition flex items-center gap-1.5 ${
                    poMode === "standard"
                      ? "bg-slate-600 text-white shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">table_rows</span>
                  Standard
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right: Keyboard hints & Tools */}
        <div className="flex items-center gap-3 text-slate-400 text-[11px]">
          <button
            type="button"
            id="purchase-studio-autopo-btn"
            onClick={() => setShowAutoPOModal(true)}
            className="px-2.5 py-1 rounded text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition flex items-center gap-1.5"
            title="Open Automated Reorder & Stock Deficit Purchase Order Generator"
          >
            <span className="material-symbols-outlined text-[14px]">auto_mode</span>
            Auto-PO Generator
          </button>
          <button
            type="button"
            id="purchase-studio-consignment-btn"
            onClick={() => setShowConsignmentModal(true)}
            className="px-2.5 py-1 rounded text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition flex items-center gap-1.5 cursor-pointer"
            title="Open Vendor Consignment Aging & Settlements Studio"
          >
            <span className="material-symbols-outlined text-[14px]">inventory_2</span>
            Consignment
          </button>
          <button
            type="button"
            id="purchase-studio-supplier-pay-btn"
            onClick={() => setShowSupplierPaymentModal(true)}
            className="px-2.5 py-1 rounded text-xs font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition flex items-center gap-1.5 cursor-pointer"
            title="Open Supplier Invoices Aging & Payment Scheduling"
          >
            <span className="material-symbols-outlined text-[14px]">payments</span>
            Payment Aging
          </button>
          {topView === "generate" && (
            <>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">
                Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono">F2</kbd> items
              </span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-300 font-mono">Ctrl+S</kbd> save
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Content Area ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">

        {/* Workspace View */}
        {topView === "workspace" && (
          <POWorkspaceTab
            currentUser={currentUser}
            onNotification={onNotification}
            onOpenPO={handleOpenPOFromWorkspace}
          />
        )}

        {/* Generate View — sizewise */}
        {topView === "generate" && poMode === "sizewise" && (
          <PoSizewiseTab
            products={products}
            currentUser={currentUser}
            onNotification={onNotification}
            onClose={onClose}
            onNavigateTab={onNavigateTab}
            sizes={sharedSizes}
            onSizesChange={setSharedSizes}
            orderToEdit={orderToEdit}
            onClearOrderToEdit={() => setOrderToEdit(null)}
            initialLines={sharedSizewiseLines}
            initialHeader={sharedSizewiseHeader}
            onLinesChange={setSharedSizewiseLines}
            onHeaderChange={setSharedSizewiseHeader}
          />
        )}

        {/* Generate View — standard */}
        {topView === "generate" && poMode === "standard" && (
          <PoGenerateTab
            products={products}
            currentUser={currentUser}
            onNotification={onNotification}
            onClose={onClose}
            onNavigateTab={onNavigateTab}
            initialLineItems={sharedStandardLines}
            initialHeader={sharedStandardHeader}
            onLineItemsChange={setSharedStandardLines}
            onHeaderChange={setSharedStandardHeader}
          />
        )}
      </div>

      {/* Auto-PO Reorder Modal */}
      {showAutoPOModal && (
        <AutoPOModal
          isOpen={showAutoPOModal}
          onClose={() => setShowAutoPOModal(false)}
          onNotification={onNotification}
        />
      )}

      {/* Consignment Sourcing & Settlement Modal */}
      {showConsignmentModal && (
        <ConsignmentStudioModal
          isOpen={showConsignmentModal}
          onClose={() => setShowConsignmentModal(false)}
          onNotification={onNotification}
        />
      )}

      {/* Supplier Invoices Aging & Payment Modal */}
      {showSupplierPaymentModal && (
        <SupplierPaymentModal
          isOpen={showSupplierPaymentModal}
          onClose={() => setShowSupplierPaymentModal(false)}
          onNotification={onNotification}
        />
      )}
    </div>
  );
};

export default PurchaseStudioTab;
