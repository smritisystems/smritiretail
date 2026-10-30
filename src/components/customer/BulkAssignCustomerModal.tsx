/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-10-26
 * Modified     : 2026-10-26
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability   : withCapability("customer.crud", "CRM")
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Search,
  Users,
  CheckSquare,
  Square,
  AlertCircle,
  Network,
  ArrowRight,
  Loader2,
  Check,
  Building2,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import type {
  AssignableChildCandidate,
  BulkAssignDependantsRequest,
  BulkAssignDependantsResponse,
} from "./types.ts";

export interface BulkAssignCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentCustomer: { id: string; name: string; code?: string };
  onAssigned?: (response: BulkAssignDependantsResponse) => void;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info") => void;
}

export const BulkAssignCustomerModal: React.FC<BulkAssignCustomerModalProps> = ({
  isOpen,
  onClose,
  parentCustomer,
  onAssigned,
  onNotification,
}) => {
  const [candidates, setCandidates] = useState<AssignableChildCandidate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [standaloneOnly, setStandaloneOnly] = useState<boolean>(false);
  const [relationType, setRelationType] = useState<string>("Child");
  const [applySameMailing, setApplySameMailing] = useState<boolean>(false);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string>("");

  const loadCandidates = useCallback(async (query: string = "") => {
    if (!parentCustomer.id) return;
    setLoading(true);
    setErrorBanner("");
    try {
      const qParam = query.trim() ? `&q=${encodeURIComponent(query.trim())}` : "";
      const url = `/crm/customers/${encodeURIComponent(parentCustomer.id)}/assignable-children?limit=100${qParam}`;
      const data = await apiFetchV1<AssignableChildCandidate[]>(url);
      setCandidates(data || []);
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to load candidate accounts.");
    } finally {
      setLoading(false);
    }
  }, [parentCustomer.id]);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      setSearchTerm("");
      setErrorBanner("");
      loadCandidates("");
    }
  }, [isOpen, loadCandidates]);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      loadCandidates(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm, isOpen, loadCandidates]);

  const filteredCandidates = useMemo(() => {
    if (!standaloneOnly) return candidates;
    return candidates.filter((c) => !c.is_dependant && !c.current_parent_id);
  }, [candidates, standaloneOnly]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredCandidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCandidates.map((c) => c.id)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0) return;

    setSubmitting(true);
    setErrorBanner("");

    try {
      const payload: BulkAssignDependantsRequest = {
        dependant_customer_ids: Array.from(selectedIds),
        relation: relationType,
        apply_same_mailing: applySameMailing,
        replace_existing: replaceExisting,
      };

      const result = await apiFetchV1<BulkAssignDependantsResponse>(
        `/crm/customers/${encodeURIComponent(parentCustomer.id)}/bulk-assign-dependants`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      if (result.errors && result.errors.length > 0) {
        onNotification?.(
          "Bulk Assignment Completed with Warnings",
          `Assigned ${result.assigned_count} subordinates. ${result.errors.length} skipped.`,
          "info"
        );
      } else {
        onNotification?.(
          "Subordinates Assigned",
          `Successfully linked ${result.assigned_count} subordinate accounts to ${parentCustomer.name}.`,
          "success"
        );
      }

      onAssigned?.(result);
      onClose();
    } catch (err: any) {
      setErrorBanner(err.message || "Failed to commit bulk assignments.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      data-testid="bulk-assign-customer-modal"
    >
      <div className="bg-white dark:bg-[#1a1f2c] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Network size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Bulk Assign Subordinate Accounts
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold">
                  {parentCustomer.code || "PAR"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Designate parent holding: <span className="font-bold text-slate-700 dark:text-slate-200">{parentCustomer.name}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 transition"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Banner */}
        {errorBanner && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorBanner}</span>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="px-6 pt-4 pb-2 shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/60">
          <div className="relative flex-1 min-w-[260px]">
            <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search candidate accounts by name, code, or phone..."
              className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition"
              data-testid="bulk-candidate-search-input"
            />
          </div>

          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={standaloneOnly}
                onChange={(e) => setStandaloneOnly(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                data-testid="filter-standalone-only-checkbox"
              />
              <span>Standalone Accounts Only</span>
            </label>

            <button
              type="button"
              onClick={handleSelectAll}
              disabled={filteredCandidates.length === 0}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
              data-testid="bulk-select-all-btn"
            >
              {selectedIds.size > 0 && selectedIds.size === filteredCandidates.length ? (
                <>
                  <CheckSquare size={14} className="text-indigo-600" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square size={14} />
                  <span>Select All ({filteredCandidates.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Candidate List Table */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 size={24} className="animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs text-slate-500">Loading candidate customer accounts...</p>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Users size={28} className="mx-auto text-slate-400" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No eligible candidate accounts found
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                All matching customers are either already linked, part of the ancestor chain, or do not exist in this tenant.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="p-3">Customer Code</th>
                    <th className="p-3">Account Name</th>
                    <th className="p-3">Classification</th>
                    <th className="p-3">Current Hierarchy Status</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredCandidates.map((c) => {
                    const isSelected = selectedIds.has(c.id);
                    const hasOtherParent = Boolean(c.current_parent_id && c.current_parent_name);

                    return (
                      <tr
                        key={c.id}
                        onClick={() => handleToggleSelect(c.id)}
                        className={`cursor-pointer transition ${
                          isSelected
                            ? "bg-indigo-50/70 dark:bg-indigo-950/40"
                            : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                        }`}
                        data-testid={`candidate-row-${c.code || c.id}`}
                      >
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(c.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            data-testid={`candidate-checkbox-${c.code || c.id}`}
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-indigo-700 dark:text-indigo-300">
                          {c.code}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                          {c.mobile && <div className="text-[10px] font-mono text-slate-400">{c.mobile}</div>}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {c.customer_group_name || "General"}
                        </td>
                        <td className="p-3">
                          {hasOtherParent ? (
                            <div className="text-[11px] text-amber-700 dark:text-amber-400 flex items-center gap-1 font-medium">
                              <Building2 size={12} className="shrink-0" />
                              <span>Re-linking from: {c.current_parent_name}</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              Standalone
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.status.toLowerCase() === "active"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Assignment Options & Footer */}
        <form onSubmit={handleSubmit} className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Relationship Designation:
              </label>
              <select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value)}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200"
                data-testid="relationship-type-select"
              >
                <option value="Child">Child Outlet</option>
                <option value="Branch">Store Branch</option>
                <option value="Regional Hub">Regional Hub</option>
                <option value="Division">Division / Zonal Unit</option>
                <option value="Franchise">Franchise Partner</option>
              </select>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={applySameMailing}
                  onChange={(e) => setApplySameMailing(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  data-testid="apply-same-mailing-checkbox"
                />
                <span>Inherit Parent Billing Address</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  data-testid="replace-existing-checkbox"
                />
                <span>Re-link from Prior Parent</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500">
              <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedIds.size}</span> accounts selected for linking
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={selectedIds.size === 0 || submitting}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="confirm-bulk-assign-btn"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Assigning Subordinates...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Assign {selectedIds.size} Subordinates</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
