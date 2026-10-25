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
 * Target UI    : Recursive N-Tier Customer Hierarchy Tree
 * Capability   : withCapability("customer.crud", "CRM")
 */

import React, { useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Network,
  Store,
  ExternalLink,
  PlusCircle,
  FolderTree,
} from "lucide-react";
import type { CustomerHierarchyNode, CustomerHierarchyTreeResponse } from "./types.ts";

export interface CustomerHierarchyTreeProps {
  tree: CustomerHierarchyTreeResponse;
  targetCustomerId: string;
  onSelectCustomer?: (customer: { id: string; code: string; name: string }) => void;
  onOpenBulkAssign?: (customer: { id: string; code: string; name: string }) => void;
}

const getDepthBadge = (depth: number) => {
  if (depth === 0) {
    return {
      label: "Root Holding",
      className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
      icon: <Building2 size={12} className="shrink-0" />,
    };
  }
  if (depth === 1) {
    return {
      label: "Zonal / Hub",
      className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-200 dark:border-sky-800",
      icon: <GitBranch size={12} className="shrink-0" />,
    };
  }
  return {
    label: `Tier ${depth} Outlet`,
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    icon: <Store size={12} className="shrink-0" />,
  };
};

interface TreeNodeItemProps {
  node: CustomerHierarchyNode;
  targetCustomerId: string;
  depth: number;
  onSelectCustomer?: (customer: { id: string; code: string; name: string }) => void;
  onOpenBulkAssign?: (customer: { id: string; code: string; name: string }) => void;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  targetCustomerId,
  depth,
  onSelectCustomer,
  onOpenBulkAssign,
}) => {
  const [expanded, setExpanded] = useState<boolean>(true);
  const isTarget = node.id === targetCustomerId || node.code === targetCustomerId;
  const hasChildren = node.children && node.children.length > 0;
  const badge = getDepthBadge(depth);

  return (
    <div className="flex flex-col w-full" data-testid={`tree-node-${node.code || node.id}`}>
      {/* Node row */}
      <div
        className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition group ${
          isTarget
            ? "bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 shadow-xs ring-1 ring-indigo-400"
            : "bg-white dark:bg-[#1a1f2c] border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
        }`}
        style={{ marginLeft: `${Math.min(depth * 24, 120)}px` }}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              aria-label={expanded ? "Collapse node" : "Expand node"}
              data-testid={`toggle-node-${node.code || node.id}`}
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <div className="w-6 h-6 flex items-center justify-center text-slate-300 dark:text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
          )}

          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wide ${badge.className}`}
            >
              {badge.icon}
              <span>{badge.label}</span>
            </span>

            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
              {node.code}
            </span>

            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
              {node.name}
            </span>

            {isTarget && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-600 text-white shadow-2xs">
                Current Focus
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              node.status?.toLowerCase() === "active"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            {node.status || "Active"}
          </span>

          {hasChildren && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
              {node.children.length} {node.children.length === 1 ? "child" : "children"}
            </span>
          )}

          {onOpenBulkAssign && (
            <button
              type="button"
              onClick={() => onOpenBulkAssign({ id: node.id, code: node.code, name: node.name })}
              className="px-2 py-1 rounded-md text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 transition"
              title="Bulk assign subordinate accounts under this customer"
              data-testid={`bulk-assign-btn-${node.code || node.id}`}
            >
              <PlusCircle size={12} />
              <span>Assign</span>
            </button>
          )}

          {onSelectCustomer && (
            <button
              type="button"
              onClick={() => onSelectCustomer({ id: node.id, code: node.code, name: node.name })}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="Open customer 360 / master"
              data-testid={`open-customer-btn-${node.code || node.id}`}
            >
              <ExternalLink size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Recursive children rendering */}
      {hasChildren && expanded && (
        <div className="flex flex-col gap-2 mt-2 border-l-2 border-slate-200 dark:border-slate-800 ml-4 pl-2">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              targetCustomerId={targetCustomerId}
              depth={depth + 1}
              onSelectCustomer={onSelectCustomer}
              onOpenBulkAssign={onOpenBulkAssign}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const CustomerHierarchyTree: React.FC<CustomerHierarchyTreeProps> = ({
  tree,
  targetCustomerId,
  onSelectCustomer,
  onOpenBulkAssign,
}) => {
  // Compute breadcrumbs path to target customer
  const findPath = (
    current: CustomerHierarchyNode,
    target: string,
    currentPath: CustomerHierarchyNode[] = []
  ): CustomerHierarchyNode[] | null => {
    const newPath = [...currentPath, current];
    if (current.id === target || current.code === target) {
      return newPath;
    }
    for (const child of current.children || []) {
      const res = findPath(child, target, newPath);
      if (res) return res;
    }
    return null;
  };

  const breadcrumbs = findPath(tree.root, targetCustomerId) || [tree.root];

  return (
    <div className="flex flex-col w-full space-y-4" data-testid="recursive-customer-hierarchy-tree">
      {/* Breadcrumb Trail */}
      <div className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-2 overflow-x-auto text-xs">
        <FolderTree size={14} className="text-indigo-600 shrink-0" />
        <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider shrink-0">
          Ancestry Trail:
        </span>
        <div className="flex items-center gap-1.5 min-w-0">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.id}>
                {idx > 0 && <span className="text-slate-400">/</span>}
                <button
                  type="button"
                  onClick={() => onSelectCustomer?.({ id: crumb.id, code: crumb.code, name: crumb.name })}
                  className={`px-2 py-0.5 rounded font-mono text-xs transition ${
                    isLast
                      ? "bg-indigo-600 text-white font-bold"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                  data-testid={`breadcrumb-crumb-${crumb.code || crumb.id}`}
                >
                  {crumb.name} ({crumb.code})
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Tree Meta Summary */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-500">
        <div className="flex items-center gap-3">
          <span>
            Total Nodes: <strong className="text-slate-900 dark:text-white">{tree.total_nodes}</strong>
          </span>
          <span>•</span>
          <span>
            Max Tier Depth: <strong className="text-slate-900 dark:text-white">{tree.max_depth}</strong>
          </span>
          {tree.is_multi_tier && (
            <>
              <span>•</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                Multi-Tier Corporate Structure
              </span>
            </>
          )}
        </div>
      </div>

      {/* Recursive Root Item */}
      <div className="flex flex-col gap-2">
        <TreeNodeItem
          node={tree.root}
          targetCustomerId={targetCustomerId}
          depth={0}
          onSelectCustomer={onSelectCustomer}
          onOpenBulkAssign={onOpenBulkAssign}
        />
      </div>
    </div>
  );
};
