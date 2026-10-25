/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.1
 * Created      : 2026-10-25
 * Modified     : 2026-10-25
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Customer Hierarchy Dialog & Explorer
 */

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  X,
  Network,
  Building2,
  Store,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  Loader2,
  Users,
  Filter,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { CustomerDirectoryItem, RetailCustomerRecord } from "./types.ts";
import { CustomerHierarchyTree, HierarchyChildNode } from "./corporateWorkspace/CustomerHierarchyTree.tsx";
import { mapBackendCustomerToRecord } from "./CustMasterWs.tsx";

export interface CustomerHierarchyModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerItem: CustomerDirectoryItem | null;
  onSelectCustomer: (item: CustomerDirectoryItem, intent?: "view" | "edit" | "360") => void;
  onFilterDirectoryByParent?: (parentCustomer: { id: string; name: string; code: string | null }) => void;
}

const mapDependantsToNodes = (dependants: any[]): HierarchyChildNode[] => {
  return (dependants || []).map((dep: any, idx: number) => {
    let storeCode = "";
    let location = "";
    if (dep.notes) {
      const matchStore = dep.notes.match(/Store Code:\s*([^|]+)/i);
      if (matchStore) storeCode = matchStore[1].trim();
      const matchState = dep.notes.match(/State:\s*([^|]+)/i);
      if (matchState) location = matchState[1].trim();
    }
    const code =
      dep.dependantCustomerCode ||
      dep.dependant_customer_code ||
      dep.code ||
      storeCode ||
      "—";
    const name =
      dep.dependantCustomerName ||
      dep.dependant_customer_name ||
      dep.name ||
      "Child Account";
    const id =
      dep.dependantCustomerId ||
      dep.dependant_customer_id ||
      dep.id ||
      String(idx + 1);
    const status =
      dep.dependantCustomerStatus ||
      dep.dependant_customer_status ||
      dep.status ||
      "Active";
    const isActive =
      dep.dependantCustomerIsActive ??
      dep.dependant_customer_is_active ??
      (status.toLowerCase() === "active");

    return {
      id,
      code,
      name,
      storeCode: storeCode || undefined,
      location: location || undefined,
      status,
      isActive,
    };
  });
};

export const CustomerHierarchyModal: React.FC<CustomerHierarchyModalProps> = ({
  isOpen,
  onClose,
  customerItem,
  onSelectCustomer,
  onFilterDirectoryByParent,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [parentRecord, setParentRecord] = useState<RetailCustomerRecord | null>(null);
  const [childrenNodes, setChildrenNodes] = useState<HierarchyChildNode[]>([]);
  const [isParentMissing, setIsParentMissing] = useState<boolean>(false);
  const [isParentDeactivated, setIsParentDeactivated] = useState<boolean>(false);
  const [parentStatusText, setParentStatusText] = useState<string>("");

  const [resolvedRole, setResolvedRole] = useState<"parent" | "child" | "standalone">(() => {
    if (!customerItem) return "standalone";
    if (
      customerItem.is_dependant ||
      customerItem.parent_customer_id ||
      customerItem.parent_customer_code ||
      customerItem.relationship_type === "child"
    ) {
      return "child";
    }
    if (
      (customerItem.child_count && customerItem.child_count > 0) ||
      customerItem.relationship_type === "parent"
    ) {
      return "parent";
    }
    return "standalone";
  });

  const isChild = resolvedRole === "child";
  const isParent = resolvedRole === "parent";

  useEffect(() => {
    if (!customerItem) {
      setResolvedRole("standalone");
      return;
    }
    if (
      customerItem.is_dependant ||
      customerItem.parent_customer_id ||
      customerItem.parent_customer_code ||
      customerItem.relationship_type === "child"
    ) {
      setResolvedRole("child");
    } else if (
      (customerItem.child_count && customerItem.child_count > 0) ||
      customerItem.relationship_type === "parent"
    ) {
      setResolvedRole("parent");
    } else {
      setResolvedRole("standalone");
    }
  }, [customerItem]);

  const loadHierarchyData = useCallback(async () => {
    if (!customerItem) return;
    setLoading(true);
    setError("");
    setIsParentMissing(false);
    setIsParentDeactivated(false);
    setParentStatusText("");

    const initialIsChild = Boolean(
      customerItem.is_dependant ||
      customerItem.parent_customer_id ||
      customerItem.parent_customer_code ||
      customerItem.relationship_type === "child"
    );

    try {
      if (initialIsChild) {
        // Child customer: resolve parent identity first
        const parentId =
          customerItem.parent_customer_id ||
          customerItem.parent_customer_code ||
          customerItem.primary_account_code;
        if (!parentId) {
          // Child marked as dependant but parent_customer_id is null
          setIsParentMissing(true);
          setResolvedRole("child");
          const childBackend = await apiFetchV1<any>(`/crm/customers/${encodeURIComponent(customerItem.id)}`);
          setParentRecord(mapBackendCustomerToRecord(childBackend));
          setChildrenNodes([]);
          return;
        }

        try {
          // Fetch parent customer record
          const parentBackend = await apiFetchV1<any>(`/crm/customers/${encodeURIComponent(parentId)}`);
          const mappedParent = mapBackendCustomerToRecord(parentBackend);
          setParentRecord(mappedParent);
          setResolvedRole("child");

          // Check if parent is active or deactivated
          const status = String(parentBackend.status || "Active");
          const isActive = parentBackend.is_active !== false && status.toLowerCase() === "active";
          if (!isActive) {
            setIsParentDeactivated(true);
            setParentStatusText(status);
          }

          // Fetch dependants of the parent
          try {
            const dependants = await apiFetchV1<any[]>(`/crm/customers/${encodeURIComponent(mappedParent.id || parentId)}/dependants`);
            const mappedNodes = mapDependantsToNodes(dependants);
            if (mappedNodes.length > 0) {
              setChildrenNodes(mappedNodes);
            } else {
              setChildrenNodes([{
                id: customerItem.id,
                code: customerItem.code || "—",
                name: customerItem.name,
                status: customerItem.status || "Active",
                isActive: customerItem.is_active !== false,
              }]);
            }
          } catch {
            // Dependants call fallback
            setChildrenNodes([{
              id: customerItem.id,
              code: customerItem.code || "—",
              name: customerItem.name,
              status: customerItem.status || "Active",
              isActive: customerItem.is_active !== false,
            }]);
          }
        } catch {
          // Parent account could not be found or was deleted (Missing parent case)
          setIsParentMissing(true);
          setResolvedRole("child");
          const childBackend = await apiFetchV1<any>(`/crm/customers/${encodeURIComponent(customerItem.id)}`);
          setParentRecord(mapBackendCustomerToRecord(childBackend));
          setChildrenNodes([]);
        }
      } else {
        // Customer is root (either parent or standalone): fetch self first
        const selfBackend = await apiFetchV1<any>(`/crm/customers/${encodeURIComponent(customerItem.id)}`);
        const mappedSelf = mapBackendCustomerToRecord(selfBackend);
        setParentRecord(mappedSelf);

        try {
          // Dynamically check canonical dependants table
          const targetId = mappedSelf.id || customerItem.id;
          const dependants = await apiFetchV1<any[]>(`/crm/customers/${encodeURIComponent(targetId)}/dependants`);
          const mappedNodes = mapDependantsToNodes(dependants);
          if (mappedNodes.length > 0) {
            setChildrenNodes(mappedNodes);
            setResolvedRole("parent");
          } else {
            setChildrenNodes([]);
            setResolvedRole("standalone");
          }
        } catch {
          const fallbackCount = customerItem.child_count ?? 0;
          setChildrenNodes([]);
          setResolvedRole(fallbackCount > 0 ? "parent" : "standalone");
        }
      }
    } catch (err: any) {
      setError(err?.message || "Could not load customer hierarchy details.");
    } finally {
      setLoading(false);
    }
  }, [customerItem]);

  useEffect(() => {
    if (isOpen) {
      void loadHierarchyData();
    } else {
      setParentRecord(null);
      setChildrenNodes([]);
      setError("");
    }
  }, [isOpen, loadHierarchyData]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !customerItem) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-hierarchy-dialog-title"
        className="bg-white dark:bg-[#191c1e] text-slate-900 dark:text-slate-100 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Modal Header */}
        <header className="px-5 py-4 bg-[#f2f4f6] dark:bg-[#131b2e] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00355f] text-white flex items-center justify-center shadow-xs">
              <Network size={20} className="text-sky-300" />
            </div>
            <div>
              <h2 id="customer-hierarchy-dialog-title" className="text-sm font-bold text-[#00355f] dark:text-[#8ebdf9]">
                Customer Parent–Child Hierarchy
              </h2>
              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                <span>Account: <strong className="text-slate-800 dark:text-slate-200">{customerItem.name}</strong></span>
                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">({customerItem.code || "—"})</span>
                {isParent && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                    Parent Account ({childrenNodes.length} {childrenNodes.length === 1 ? "child" : "children"})
                  </span>
                )}
                {isChild && !isParentMissing && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    Child Account
                  </span>
                )}
                {isChild && isParentMissing && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1">
                    <AlertCircle size={10} /> Unlinked / Missing Parent
                  </span>
                )}
                {!isParent && !isChild && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    Standalone Account
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close hierarchy viewer"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition"
          >
            <X size={18} />
          </button>
        </header>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <Loader2 size={24} className="animate-spin mx-auto text-[#00355f] dark:text-[#8ebdf9]" />
              <p className="text-xs font-semibold">Tracing parent–child hierarchy from canonical relationship store…</p>
            </div>
          ) : error ? (
            <div role="alert" className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-800 dark:text-red-200 text-xs">
              <strong>Error Loading Hierarchy:</strong> {error}
            </div>
          ) : (
            <>
              {/* Context Notice Banner */}
              {isParent && (
                <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-sky-900 dark:text-sky-200">
                    <Building2 size={16} className="text-sky-700 dark:text-sky-400 shrink-0" />
                    <span>
                      <strong>Corporate Parent Account:</strong> Controls credit limits and billing visibility for {childrenNodes.length} subordinate {childrenNodes.length === 1 ? "child account" : "child accounts"}.
                    </span>
                  </div>
                  {onFilterDirectoryByParent && (
                    <button
                      type="button"
                      onClick={() => {
                        onFilterDirectoryByParent({
                          id: customerItem.id,
                          name: customerItem.name,
                          code: customerItem.code,
                        });
                        onClose();
                      }}
                      className="px-2.5 py-1 bg-sky-700 hover:bg-sky-800 text-white rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition shadow-2xs shrink-0"
                    >
                      <Filter size={11} />
                      <span>Filter Directory to Children</span>
                    </button>
                  )}
                </div>
              )}

              {isChild && !isParentMissing && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                    <Store size={16} className="text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <div>
                      <span>
                        <strong>Linked Subordinate Child:</strong> Subordinated to parent corporate account <strong>{parentRecord?.name || customerItem.primary_account_name || "Parent Account"}</strong> ({parentRecord?.code || customerItem.primary_account_code || "—"}).
                      </span>
                      {isParentDeactivated && (
                        <div className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold mt-0.5 flex items-center gap-1">
                          <AlertTriangle size={12} />
                          <span>Parent account is currently {parentStatusText || "Inactive"}. Child account retains historical relationship.</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {parentRecord && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCustomer({
                          id: parentRecord.id,
                          code: parentRecord.code,
                          name: parentRecord.name,
                          mobile: parentRecord.phone || "",
                          customer_group_id: parentRecord.customerGroupId || null,
                          customer_group_name: null,
                          is_dependant: false,
                          primary_account_name: null,
                          primary_account_code: null,
                          status: parentRecord.status || "Active",
                          is_active: parentRecord.status?.toLowerCase() === "active",
                          relationship_type: "parent",
                          child_count: childrenNodes.length
                        }, "view");
                        onClose();
                      }}
                      className="px-2.5 py-1 bg-[#00355f] text-white hover:bg-[#0f4c81] rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition shadow-2xs shrink-0"
                    >
                      <Building2 size={11} />
                      <span>Open Parent Account</span>
                    </button>
                  )}
                </div>
              )}

              {isChild && isParentMissing && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block text-amber-950 dark:text-amber-100 font-bold">
                      Parent Customer Record Unavailable or Unlinked
                    </strong>
                    <p className="text-[11px] mt-0.5 text-amber-800 dark:text-amber-300">
                      This customer is marked as a dependent child account, but its parent customer record (Parent ID: <code className="font-mono">{customerItem.parent_customer_id || "Unspecified"}</code>) could not be retrieved from the active database or has been deleted.
                    </p>
                  </div>
                </div>
              )}

              {!isParent && !isChild && (
                <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <Users size={16} className="text-slate-500 shrink-0" />
                  <span>
                    <strong>Standalone Account:</strong> Operates as an independent retail or commercial entity. No corporate parent or linked child accounts.
                  </span>
                </div>
              )}

              {/* Visual Tree Component */}
              {parentRecord && (
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <CustomerHierarchyTree
                    customer={parentRecord}
                    childrenNodes={childrenNodes}
                    onSelectCustomer={(code) => {
                      const matched = childrenNodes.find((c) => c.code === code);
                      if (matched) {
                        onSelectCustomer({
                          id: matched.id,
                          code: matched.code,
                          name: matched.name,
                          mobile: null,
                          customer_group_id: null,
                          customer_group_name: null,
                          status: matched.status || "Active",
                          is_active: true,
                        }, "view");
                        onClose();
                      }
                    }}
                  />
                </div>
              )}

              {/* Hierarchy Roster Table */}
              <div className="bg-white dark:bg-[#191c1e] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Hierarchy Account Roster ({childrenNodes.length + (parentRecord && !isParentMissing ? 1 : (isParentMissing ? 1 : 0))})
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 font-bold text-[10px] uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="p-2.5">Role</th>
                        <th className="p-2.5">Code</th>
                        <th className="p-2.5">Customer Name</th>
                        <th className="p-2.5">Store / City</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {/* Parent Row */}
                      {parentRecord && !isParentMissing && (
                        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 font-semibold bg-sky-50/40 dark:bg-sky-950/20">
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                              Parent Account
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-[#00355f] dark:text-[#8ebdf9]">
                            {parentRecord.code || "—"}
                          </td>
                          <td className="p-2.5">
                            <div className="font-bold">{parentRecord.name}</div>
                            {parentRecord.gstin && (
                              <div className="text-[10px] font-mono text-slate-500 font-normal">
                                GSTIN: {parentRecord.gstin}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">
                            Corporate HQ
                          </td>
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isParentDeactivated ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                              {isParentDeactivated ? (parentStatusText || "Inactive") : "Active"}
                            </span>
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectCustomer({
                                  id: parentRecord.id,
                                  code: parentRecord.code,
                                  name: parentRecord.name,
                                  mobile: parentRecord.phone || "",
                                  customer_group_id: parentRecord.customerGroupId || null,
                                  customer_group_name: null,
                                  is_dependant: false,
                                  primary_account_name: null,
                                  primary_account_code: null,
                                  status: parentRecord.status || "Active",
                                  is_active: parentRecord.status?.toLowerCase() === "active",
                                  relationship_type: "parent",
                                  child_count: childrenNodes.length
                                }, "view");
                                onClose();
                              }}
                              className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 rounded text-[11px] font-bold inline-flex items-center gap-1 transition"
                            >
                              <ExternalLink size={10} />
                              <span>Open</span>
                            </button>
                          </td>
                        </tr>
                      )}

                      {/* Missing Parent Fallback Row */}
                      {isChild && isParentMissing && (
                        <tr className="bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                              Missing Parent
                            </span>
                          </td>
                          <td className="p-2.5 font-mono text-slate-500">
                            {customerItem.primary_account_code || "—"}
                          </td>
                          <td className="p-2.5 italic">
                            Parent record unavailable (ID: {customerItem.parent_customer_id || "Unknown"})
                          </td>
                          <td className="p-2.5 text-slate-400">—</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                              Unavailable
                            </span>
                          </td>
                          <td className="p-2.5 text-right text-slate-400">—</td>
                        </tr>
                      )}

                      {/* Current Child Row if parent missing */}
                      {isChild && isParentMissing && (
                        <tr className="bg-emerald-50/30 dark:bg-emerald-950/20">
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              Child Account
                            </span>
                          </td>
                          <td className="p-2.5 font-mono font-bold text-[#00355f] dark:text-[#8ebdf9]">
                            {customerItem.code || "—"}
                          </td>
                          <td className="p-2.5 font-bold">
                            {customerItem.name}
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">—</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              {customerItem.status || "Active"}
                            </span>
                          </td>
                          <td className="p-2.5 text-right text-slate-400">—</td>
                        </tr>
                      )}

                      {/* Children Rows */}
                      {childrenNodes.length === 0 && !isChild ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-500">
                            No child accounts subordinated to this customer.
                          </td>
                        </tr>
                      ) : (
                        childrenNodes.map((node) => {
                          const isCurrent = node.id === customerItem.id || node.code === customerItem.code;
                          return (
                            <tr
                              key={node.id}
                              className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${isCurrent ? "bg-emerald-50/60 dark:bg-emerald-950/30 font-semibold" : ""}`}
                            >
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isCurrent ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                                  {isCurrent ? "Current Account" : "Child Account"}
                                </span>
                              </td>
                              <td className="p-2.5 font-mono text-[#00355f] dark:text-[#8ebdf9]">
                                {node.code}
                              </td>
                              <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                                {node.name}
                              </td>
                              <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                {node.storeCode ? `Store ${node.storeCode}` : (node.location || "—")}
                              </td>
                              <td className="p-2.5">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  {node.status || "Active"}
                                </span>
                              </td>
                              <td className="p-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectCustomer({
                                      id: node.id,
                                      code: node.code,
                                      name: node.name,
                                      mobile: null,
                                      customer_group_id: null,
                                      customer_group_name: null,
                                      status: node.status || "Active",
                                      is_active: true,
                                    }, "view");
                                    onClose();
                                  }}
                                  className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 rounded text-[11px] font-bold inline-flex items-center gap-1 transition"
                                >
                                  <ExternalLink size={10} />
                                  <span>Open</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="px-5 py-3 bg-[#f2f4f6] dark:bg-[#131b2e] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500 text-[11px]">
            Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-[10px]">Esc</kbd> or click outside to close.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#00355f] text-white hover:bg-[#0f4c81] rounded-lg font-bold text-xs shadow-xs transition"
          >
            Close Hierarchy
          </button>
        </footer>
      </div>
    </div>
  );
};
