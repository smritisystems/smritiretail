/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.82.0
 * Created      : 2026-09-29
 * Modified     : 2026-10-15
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal Modal
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  X,
  Lock,
  Unlock,
  Plus,
  Tag,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Power,
  ShieldAlert,
  Info,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Product } from "../../../types.ts";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import { GovernedLookupCombobox } from "../GovernedLookupCombobox.tsx";

export interface VariantEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onUpdated: () => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

interface DeletionStatus {
  variant_id: string;
  variant_sku: string;
  is_active: boolean;
  can_hard_delete: boolean;
  transaction_count: number;
  blocking_reasons: string[];
  recommendation: string;
}

export const VariantEditModal: React.FC<VariantEditModalProps> = ({
  isOpen,
  onClose,
  product,
  onUpdated,
  onNotification,
}) => {
  // Core Identity State
  const [sku, setSku] = useState<string>("");
  const [primaryBarcode, setPrimaryBarcode] = useState<string>("");
  const [color, setColor] = useState<string>("");
  const [size, setSize] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(true);

  // Commercial Fields
  const [mrp, setMrp] = useState<string>("0");
  const [sellingPrice, setSellingPrice] = useState<string>("0");
  const [costPrice, setCostPrice] = useState<string>("0");

  // Secondary Barcodes
  const [secondaryBarcodes, setSecondaryBarcodes] = useState<string[]>([]);
  const [newBarcode, setNewBarcode] = useState<string>("");
  const [isAddingBarcode, setIsAddingBarcode] = useState<boolean>(false);

  // Status & Telemetry
  const [deletionStatus, setDeletionStatus] = useState<DeletionStatus | null>(null);
  const [deletionStatusTarget, setDeletionStatusTarget] = useState<string | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);
  const deletionStatusRequestId = useRef(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Master Lookup Catalog & Enforcement
  const [colorOptions, setColorOptions] = useState<string[]>([]);
  const [sizeOptions, setSizeOptions] = useState<string[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState<boolean>(false);

  // Deletion Confirmation Dialog State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [showBlockingDetails, setShowBlockingDetails] = useState<boolean>(false);

  // Identifier to use for API endpoints (product.code / sku or product.id)
  const targetId = product?.code || product?.sku || product?.id || "";

  // Fetch approved Master Lookup values
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsLoadingLookups(true);
    apiFetchV1<{ dimensions: Record<string, Array<{ code: string; name: string }>> }>("/item-domain/lookups")
      .then((data) => {
        if (!isMounted || !data?.dimensions) return;
        const colors = (data.dimensions.color || []).map((c) => c.name || c.code);
        const sizes = (data.dimensions.size || []).map((s) => s.name || s.code);
        setColorOptions(colors);
        setSizeOptions(sizes);
      })
      .catch((err) => {
        console.warn("Unable to load Master Lookups:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingLookups(false);
      });
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Master Lookup Validation Rules
  const isColorValid = useMemo(() => {
    if (!color.trim()) return true;
    if (colorOptions.length === 0) return true;
    const q = color.trim().toLowerCase();
    return colorOptions.some((c) => c.toLowerCase() === q);
  }, [color, colorOptions]);

  const isSizeValid = useMemo(() => {
    if (!size.trim()) return true;
    if (sizeOptions.length === 0) return true;
    const q = size.trim().toLowerCase();
    return sizeOptions.some((s) => s.toLowerCase() === q);
  }, [size, sizeOptions]);

  const hasMasterLookupError = !isColorValid || !isSizeValid;

  // Fetch pre-flight deletion and transaction status
  const loadDeletionStatus = useCallback(async () => {
    if (!product || !targetId) return;
    const requestId = ++deletionStatusRequestId.current;
    setIsLoadingStatus(true);
    try {
      const res = await apiFetchV1<DeletionStatus>(`/item-variants/${encodeURIComponent(targetId)}/deletion-status`);
      if (requestId === deletionStatusRequestId.current) {
        setDeletionStatus(res);
        setDeletionStatusTarget(targetId);
        if (res.is_active !== undefined) {
          setIsActive(res.is_active);
        }
      }
    } catch {
      // If domain status endpoint fails, fallback to conservative transacted assumption
      if (requestId === deletionStatusRequestId.current) {
        setDeletionStatus(null);
        setDeletionStatusTarget(targetId);
      }
    } finally {
      if (requestId === deletionStatusRequestId.current) setIsLoadingStatus(false);
    }
  }, [product, targetId]);

  useEffect(() => {
    if (isOpen && product) {
      // Do not carry another row's status into this edit session. Also invalidate
      // any older request that may resolve after the newly selected variant.
      deletionStatusRequestId.current += 1;
      setDeletionStatus(null);
      setDeletionStatusTarget(null);
      setIsLoadingStatus(true);
      setSku(product.code || product.sku || "");
      setPrimaryBarcode(product.barcode || "");
      setColor(product.color || (product.attributes as any)?.color || "");
      setSize(product.size || (product.attributes as any)?.size || "");
      setIsActive(product.isActive !== false && (product as any).is_active !== false);

      setMrp(String(product.mrp ?? "0"));
      setSellingPrice(String(product.price ?? "0"));
      setCostPrice(String((product as any)?.cost_price ?? product?.costPrice ?? "0"));

      const initialSecondary = Array.isArray((product as any)?.secondary_barcodes)
        ? (product as any)?.secondary_barcodes
        : Array.isArray(product.secondaryBarcodes)
        ? product.secondaryBarcodes
        : [];
      setSecondaryBarcodes(initialSecondary);
      setNewBarcode("");
      setIsAddingBarcode(false);
      setIsSaving(false);
      setShowDeleteConfirm(false);
      setShowBlockingDetails(false);

      void loadDeletionStatus();
    }
    return () => {
      deletionStatusRequestId.current += 1;
    };
  }, [isOpen, product, loadDeletionStatus]);

  // Identity edits require a positive backend preflight. A failed preflight
  // must never present the record as transaction-free.
  const statusIsCurrent = deletionStatusTarget === targetId && deletionStatus !== null;
  const isTransacted = statusIsCurrent ? !deletionStatus.can_hard_delete : true;

  const handleAddBarcode = () => {
    if (!product) return;
    const trimmed = newBarcode.trim().toUpperCase();
    if (!trimmed) return;
    if (trimmed === primaryBarcode.trim().toUpperCase() || secondaryBarcodes.includes(trimmed)) {
      onNotification?.("Validation Error", "Barcode already exists for this variant.", "error");
      return;
    }
    setSecondaryBarcodes((prev) => [...prev, trimmed]);
    setNewBarcode("");
    setIsAddingBarcode(false);
  };

  const handleRemoveBarcode = (index: number) => {
    setSecondaryBarcodes((prev) => prev.filter((_, i) => i !== index));
  };

  // Toggle active status
  const handleToggleStatus = async () => {
    if (!product || !targetId) return;
    const targetStatus = !isActive;
    setIsTogglingStatus(true);
    try {
      await apiFetchV1(`/item-variants/${encodeURIComponent(targetId)}/status?is_active=${targetStatus}`, {
        method: "PATCH",
      });
      setIsActive(targetStatus);
      onNotification?.(
        targetStatus ? "Variant Activated" : "Variant Deactivated",
        `Variant ${sku} is now ${targetStatus ? "Active for billing & purchase" : "Deactivated and barred from new transactions"}.`,
        targetStatus ? "success" : "warning"
      );
      onUpdated();
      void loadDeletionStatus();
    } catch (err: any) {
      onNotification?.("Status Update Failed", err?.message || "Failed to toggle variant status.", "error");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Save changes
  const handleSave = async () => {
    if (!product || !targetId) return;
    if (hasMasterLookupError) {
      onNotification?.(
        "Master Lookup Validation Error",
        "Color and Size must be selected strictly from Master Lookup. Arbitrary or unlisted words are not permissible.",
        "error"
      );
      return;
    }
    setIsSaving(true);
    try {
      const payload: Record<string, any> = {
        mrp: parseFloat(mrp) || 0,
        selling_price: parseFloat(sellingPrice) || 0,
        cost_price: parseFloat(costPrice) || 0,
        secondary_barcodes: secondaryBarcodes,
        is_active: isActive,
      };

      // Only pass identity updates if un-transacted to prevent backend 409 rejection
      if (!isTransacted) {
        if (sku.trim()) payload.variant_sku = sku.trim();
        if (primaryBarcode.trim()) payload.primary_barcode = primaryBarcode.trim().toUpperCase();
        if (color.trim()) payload.color = color.trim().toUpperCase();
        if (size.trim()) payload.size = size.trim().toUpperCase();
      }

      await apiFetchV1(`/item-variants/${encodeURIComponent(targetId)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      onNotification?.("Variant Updated", `Variant ${sku} updated successfully.`, "success");
      onUpdated();
      onClose();
    } catch (err: any) {
      onNotification?.("Update Failed", err?.message || "Failed to update variant.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Execute Guarded Permanent Hard Delete
  const handleConfirmPermanentDelete = async () => {
    if (!product || !targetId) return;
    setIsDeleting(true);
    try {
      const res = await apiFetchV1<any>(`/item-variants/${encodeURIComponent(targetId)}/hard-delete?delete_parent_if_empty=true`, {
        method: "DELETE",
      });

      onNotification?.(
        "Permanent Delete Successful",
        res?.message || `Variant SKU '${res?.released_sku || sku}' was physically removed and released for reuse.`,
        "success"
      );
      setShowDeleteConfirm(false);
      onUpdated();
      onClose();
    } catch (err: any) {
      onNotification?.(
        "Permanent Delete Blocked",
        err?.message || "Cannot delete variant due to protected transaction dependencies.",
        "error"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#1a2234] border border-[#c3c6d6] dark:border-[#434654] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col font-sans">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0] dark:border-[#2d3748] bg-slate-50/50 dark:bg-[#131b2e]/40">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-[#0f172a] dark:text-white flex items-center gap-2">
              Edit Variant
            </h2>
            {/* Status Pill */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                isActive
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-rose-500"}`} />
              {isActive ? "Active" : "Deactivated"}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] dark:hover:bg-[#2d3748] dark:hover:text-white transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Transaction Governance Banner */}
        <div className="px-6 py-2.5 bg-slate-100/70 dark:bg-[#131b2e] border-b border-[#e2e8f0] dark:border-[#2d3748] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {isLoadingStatus ? (
              <span className="flex items-center gap-1.5 text-slate-500">
                <RefreshCw size={12} className="animate-spin" /> Checking ledger activity...
              </span>
            ) : !statusIsCurrent ? (
              <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                <Lock size={13} className="text-amber-600 dark:text-amber-400" />
                <span>Ledger status unavailable — identity locked until verified</span>
              </span>
            ) : isTransacted ? (
              <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                <Lock size={13} className="text-amber-600 dark:text-amber-400" />
                <span>Transacted ({deletionStatus?.transaction_count ?? 1} records) — Identity locked</span>
                <button
                  type="button"
                  onClick={() => setShowBlockingDetails((prev) => !prev)}
                  className="underline hover:text-amber-800 text-[11px] ml-1 cursor-pointer"
                >
                  {showBlockingDetails ? "Hide Details" : "View Details"}
                </button>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                <Unlock size={13} className="text-emerald-600 dark:text-emerald-400" />
                <span>0 Transactions — Identity editable & eligible for Hard Delete</span>
              </span>
            )}
          </div>

          {/* Quick Deactivate / Reactivate Action */}
          <button
            type="button"
            disabled={isTogglingStatus}
            onClick={handleToggleStatus}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
              isActive
                ? "bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-800"
                : "bg-emerald-100 hover:bg-emerald-200 text-emerald-900 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800"
            }`}
            title={isActive ? "Deactivate variant to prevent new billing" : "Reactivate variant for billing"}
          >
            <Power size={11} />
            <span>{isTogglingStatus ? "Updating..." : isActive ? "Deactivate" : "Activate"}</span>
          </button>
        </div>

        {/* Blocking reasons expanded card */}
        {showBlockingDetails && deletionStatus && deletionStatus.blocking_reasons.length > 0 && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-1.5 animate-in fade-in duration-100">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-amber-600 dark:text-amber-400" />
              <span>Blocking Ledger Records:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] pl-1 font-mono">
              {deletionStatus.blocking_reasons.map((reason, idx) => (
                <li key={idx}>{reason}</li>
              ))}
            </ul>
            <p className="text-[11px] text-amber-800 dark:text-amber-300/90 pt-1 border-t border-amber-200 dark:border-amber-800/40">
              {deletionStatus.recommendation}
            </p>
          </div>
        )}

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          
          {/* Section 1: Variant Identity (SKU, Primary Barcode, Color, Size) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">
                Variant Identity
              </h3>
              {isTransacted && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Lock size={11} /> Protected by transactions
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                  SKU {isTransacted ? "" : <span className="text-blue-500 font-normal">(Editable)</span>}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    data-field-key="sku"
                    disabled={isTransacted}
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className={`w-full px-3 py-2 text-xs font-mono rounded-lg border transition ${
                      isTransacted
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed pr-8"
                        : "bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white border-blue-300 dark:border-blue-700 focus:ring-2 focus:ring-blue-500/20"
                    }`}
                  />
                  {isTransacted && <Lock size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                  Primary Barcode <span className="text-red-500">*</span> {isTransacted ? "" : <span className="text-blue-500 font-normal">(Editable)</span>}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    data-field-key="barcode"
                    disabled={isTransacted}
                    value={primaryBarcode}
                    onChange={(e) => setPrimaryBarcode(e.target.value.toUpperCase())}
                    className={`w-full px-3 py-2 text-xs font-mono rounded-lg border transition ${
                      isTransacted
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed pr-8"
                        : "bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white border-blue-300 dark:border-blue-700 focus:ring-2 focus:ring-blue-500/20"
                    }`}
                  />
                  {isTransacted && <Lock size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="variant-edit-size" className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1]">
                    Size {isTransacted ? "" : <span className="text-blue-500 font-normal">(Editable)</span>}
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    Master Lookup
                  </span>
                </div>
                <div className="relative">
                  <GovernedLookupCombobox
                    id="variant-edit-size"
                    value={size}
                    onChange={(val) => setSize(val.toUpperCase())}
                    options={sizeOptions}
                    placeholder="Select or search Size from Master..."
                    disabled={isTransacted}
                    hasError={!isSizeValid}
                    className="font-mono"
                  />
                  {isTransacted && (
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Lock size={13} className="text-slate-400" />
                    </div>
                  )}
                </div>
                {!isSizeValid && (
                  <p className="text-[10px] text-red-600 dark:text-red-400 mt-1 flex items-center gap-1 font-medium">
                    <AlertTriangle size={11} /> &ldquo;{size}&rdquo; is not present in Master Lookup. Unlisted words are not permissible.
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="variant-edit-color" className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1]">
                    Color {isTransacted ? "" : <span className="text-blue-500 font-normal">(Editable)</span>}
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    Master Lookup
                  </span>
                </div>
                <div className="relative">
                  <GovernedLookupCombobox
                    id="variant-edit-color"
                    value={color}
                    onChange={(val) => setColor(val.toUpperCase())}
                    options={colorOptions}
                    placeholder="Select or search Color from Master..."
                    disabled={isTransacted}
                    hasError={!isColorValid}
                    className="font-mono"
                  />
                  {isTransacted && (
                    <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none">
                      <Lock size={13} className="text-slate-400" />
                    </div>
                  )}
                </div>
                {!isColorValid && (
                  <p className="text-[10px] text-red-600 dark:text-red-400 mt-1 flex items-center gap-1 font-medium">
                    <AlertTriangle size={11} /> &ldquo;{color}&rdquo; is not present in Master Lookup. Unlisted words are not permissible.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Additional Barcodes */}
          <div>
            <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1.5">
              Additional Barcodes
            </label>
            <div className="flex flex-wrap items-center gap-2 p-2.5 bg-[#f8fafc] dark:bg-[#111827] border border-[#e2e8f0] dark:border-[#374151] rounded-xl min-h-[46px]">
              {secondaryBarcodes.map((bc, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-mono border border-blue-200 dark:border-blue-800"
                >
                  <Tag size={11} />
                  <span>{bc}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBarcode(idx)}
                    className="hover:text-red-600 transition cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}

              {isAddingBarcode ? (
                <div className="inline-flex items-center gap-1">
                  <input
                    type="text"
                    data-field-key="additional_barcode"
                    autoFocus
                    placeholder="Scan or enter barcode"
                    value={newBarcode}
                    onChange={(e) => setNewBarcode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddBarcode();
                      } else if (e.key === "Escape") {
                        setIsAddingBarcode(false);
                      }
                    }}
                    className="px-2 py-1 text-xs border border-blue-400 rounded-lg outline-none bg-white dark:bg-slate-900 font-mono w-44"
                  />
                  <button
                    type="button"
                    onClick={handleAddBarcode}
                    className="px-2 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingBarcode(false)}
                    className="px-1.5 py-1 text-slate-500 hover:text-slate-700 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingBarcode(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-[#94a3b8] text-xs font-semibold text-[#64748b] hover:border-[#2563eb] hover:text-[#2563eb] transition cursor-pointer"
                >
                  <Plus size={12} />
                  <span>Add barcode</span>
                </button>
              )}
            </div>
          </div>

          {/* Section 3: Commercial Fields (Always Mutable) */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#e2e8f0] dark:border-[#2d3748]">
            <div>
              <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                MRP (₹)
              </label>
              <input
                type="number"
                data-field-key="mrp"
                step="0.01"
                value={mrp}
                onChange={(e) => setMrp(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                Selling Price (₹)
              </label>
              <input
                type="number"
                data-field-key="selling_price"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#475569] dark:text-[#cbd5e1] block mb-1">
                Cost Price (₹)
              </label>
              <input
                type="number"
                data-field-key="cost_price"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#cbd5e1] dark:border-[#434654] bg-white dark:bg-[#111827] text-[#0f172a] dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#e2e8f0] dark:border-[#2d3748] bg-slate-50 dark:bg-[#131b2e]/60">
          
          {/* Permanent Delete Action Button */}
          <div>
            <button
              type="button"
              disabled={isDeleting || isLoadingStatus}
              onClick={() => {
                if (isTransacted) {
                  setShowBlockingDetails(true);
                } else {
                  setShowDeleteConfirm(true);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                isTransacted
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300"
                  : "bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-300 border border-red-200 dark:border-red-800"
              }`}
              title={
                isTransacted
                  ? "Transacted items cannot be deleted permanently. Click to see blocking reasons."
                  : "Permanently delete un-transacted variant from database."
              }
            >
              <Trash2 size={13} />
              <span>{isTransacted ? "Protected from Delete" : "Delete Permanently"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving || hasMasterLookupError}
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition cursor-pointer"
              title={hasMasterLookupError ? "Color and Size must be selected strictly from Master Lookup before saving" : "Save variant updates"}
            >
              {isSaving ? "Updating..." : "Update Variant"}
            </button>
          </div>
        </div>

      </div>

      {/* ── Permanent Hard Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white dark:bg-[#1c2438] border border-red-300 dark:border-red-900/80 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Permanently Delete Variant?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Physical removal from PostgreSQL Database
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span className="font-semibold">SKU to release:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{sku}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Barcode:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{primaryBarcode || "—"}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Color / Size:</span>
                <span>{color || "—"} / {size || "—"}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This variant has <strong className="text-emerald-600 dark:text-emerald-400">0 transactions</strong> across all sales invoices, GRNs, purchase orders, and stock movements. Physical deletion will permanently purge this record and release the SKU and Barcode strings for immediate reuse.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmPermanentDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>{isDeleting ? "Purging..." : "Confirm & Delete Permanently"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
