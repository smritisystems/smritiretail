/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
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
 * Capability   : withCapability("customer.crud", "CRM")
 */

import React from "react";
import { Network, Store, GitBranch, AlertCircle } from "lucide-react";
import type { CustomerDirectoryItem } from "./types.ts";

export interface CustomerDirectoryRelationshipCellProps {
  customer: CustomerDirectoryItem;
  onOpenHierarchy?: (customer: CustomerDirectoryItem) => void;
  onFilterByParent?: (parent: { id: string; name: string; code?: string }) => void;
}

export const CustomerDirectoryRelationshipCell: React.FC<CustomerDirectoryRelationshipCellProps> = ({
  customer,
  onOpenHierarchy,
  onFilterByParent,
}) => {
  const isParent = ((customer.child_count ?? 0) > 0) || customer.relationship_type === "parent";
  const isChild = Boolean(
    customer.is_dependant ||
    customer.parent_customer_code ||
    customer.primary_account_code ||
    customer.relationship_type === "child"
  );
  const parentName = customer.parent_customer_name || customer.primary_account_name;
  const parentCode = customer.parent_customer_code || customer.primary_account_code;
  const parentActive = customer.primary_account_is_active ?? (
    customer.primary_account_status ? customer.primary_account_status.toLowerCase() === "active" : true
  );
  const isParentMissing = isChild && !parentName && !parentCode;

  if (isParent) {
    return (
      <div className="space-y-1" data-testid={`relationship-cell-parent-${customer.code || customer.id}`}>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800"
          data-testid="relationship-badge-parent"
        >
          <Network size={11} className="text-indigo-600 dark:text-indigo-400" />
          Parent Account
        </span>
        <div>
          <button
            type="button"
            onClick={() => onOpenHierarchy?.(customer)}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            title="Open full customer hierarchy tree"
            data-testid={`parent-child-count-btn-${customer.code || customer.id}`}
            aria-label={`View hierarchy: ${customer.child_count ?? 0} child accounts for ${customer.name}`}
          >
            <GitBranch size={11} />
            <span>{customer.child_count ?? 0} {(customer.child_count ?? 0) === 1 ? "child account" : "child accounts"}</span>
          </button>
        </div>
        {onFilterByParent && (
          <div>
            <button
              type="button"
              onClick={() => onFilterByParent({ id: customer.id, name: customer.name, code: customer.code || undefined })}
              className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 underline"
              title="Filter directory to only show children of this parent"
              data-testid={`filter-children-btn-${customer.code || customer.id}`}
            >
              Filter directory to children
            </button>
          </div>
        )}
      </div>
    );
  }

  if (isChild) {
    return (
      <div className="space-y-1" data-testid={`relationship-cell-child-${customer.code || customer.id}`}>
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
          data-testid="relationship-badge-child"
        >
          <Store size={11} className="text-amber-600 dark:text-amber-400" />
          Child Account
        </span>
        {isParentMissing ? (
          <div className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400" data-testid="unlinked-parent-alert">
            <AlertCircle size={11} className="shrink-0" />
            <span>Unlinked Parent Account</span>
          </div>
        ) : (
          <div className="text-[11px]">
            <span className="text-slate-400 mr-1">Parent:</span>
            <button
              type="button"
              onClick={() => onOpenHierarchy?.(customer)}
              className="font-semibold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline text-left inline-flex items-center gap-1"
              title="View parent hierarchy and sibling accounts"
              data-testid={`child-parent-link-${customer.code || customer.id}`}
              aria-label={`View hierarchy of parent ${parentName || ""}`}
            >
              <span>{parentName || "Unknown Parent"}</span>
              {parentCode && <span className="font-mono text-[10px] text-slate-500">{`(${parentCode})`}</span>}
            </button>
            {!parentActive && (
              <div
                className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900"
                data-testid="inactive-parent-badge"
              >
                <AlertCircle size={10} />
                <span>Parent Inactive</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0.5" data-testid={`relationship-cell-standalone-${customer.code || customer.id}`}>
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
        data-testid="relationship-badge-standalone"
      >
        Standalone
      </span>
      <div className="text-[10px] text-slate-400">Independent account</div>
    </div>
  );
};
