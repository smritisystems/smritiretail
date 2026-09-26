/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 6.42.0
 * Created      : 2026-09-19
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Spec         : §10, §33 — Multi-vendor relationship display.
 * Shows PRIMARY / PREFERRED / SECONDARY vendors for a product.
 * Pure display component — data comes from the backend decision object.
 */

import React from "react";

export interface AssignmentRelationship {
  vendorName: string;
  priority: "PRIMARY" | "PREFERRED" | "SECONDARY";
  status: "ACTIVE" | "INACTIVE" | "RESTRICTED";
  level?: string;         // BARCODE / SKU / STYLE / BRAND / CATEGORY
  effectiveFrom?: string;
  effectiveTo?: string;
}

interface Props {
  assignments: AssignmentRelationship[];
  currentVendorId?: string;
  compact?: boolean;
}

const PRIORITY_ORDER: Record<string, number> = { PRIMARY: 0, PREFERRED: 1, SECONDARY: 2 };

const priorityBadge = (p: string) => {
  const c =
    p === "PRIMARY"   ? "bg-green-100 text-green-800 border-green-200" :
    p === "PREFERRED" ? "bg-blue-100 text-blue-800 border-blue-200" :
                        "bg-[#eeedf3] text-[#434652] border-[#c4c6d4]";
  return (
    <span className={"text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wide " + c}>
      {p}
    </span>
  );
};

export const POAssignmentInfo: React.FC<Props> = ({ assignments, compact = false }) => {
  if (!assignments || assignments.length === 0) {
    return (
      <div className="text-xs text-[#737685] italic py-1">
        No vendor assignments found for this product.
      </div>
    );
  }

  const sorted = [...assignments].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-0.5">
        {sorted.map((a, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className={a.priority === "PRIMARY" ? "w-1.5 h-1.5 rounded-full bg-green-500" : "w-1.5 h-1.5 rounded-full bg-[#c4c6d4]"} />
            <span className="font-medium text-[#434652]">{a.vendorName}</span>
            {priorityBadge(a.priority)}
            {a.status !== "ACTIVE" && (
              <span className="text-[9px] text-red-500 font-semibold">{a.status}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="border border-[#c4c6d4] rounded-lg overflow-hidden">
      <div className="bg-[#eeedf3] px-3 py-1.5 text-[10px] font-bold uppercase text-[#434652] tracking-wider border-b border-[#c4c6d4]">
        Vendor Relationships
      </div>
      <div className="divide-y divide-[#eeedf3]">
        {sorted.map((a, i) => (
          <div key={i} className={a.priority === "PRIMARY" ? "flex items-center gap-3 px-3 py-2 bg-green-50/40" : "flex items-center gap-3 px-3 py-2"}>
            <span className={a.priority === "PRIMARY" ? "w-2 h-2 rounded-full shrink-0 bg-green-500" : a.priority === "PREFERRED" ? "w-2 h-2 rounded-full shrink-0 bg-blue-400" : "w-2 h-2 rounded-full shrink-0 bg-[#c4c6d4]"} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[#1a1b20] truncate">{a.vendorName}</span>
                {priorityBadge(a.priority)}
                {a.status !== "ACTIVE" && (
                  <span className="text-[9px] font-bold text-red-600 border border-red-200 bg-red-50 px-1 rounded">
                    {a.status}
                  </span>
                )}
              </div>
              {a.level && (
                <div className="text-[10px] text-[#737685] mt-0.5">
                  Matched at: <strong>{a.level}</strong> level
                  {a.effectiveFrom && (
                    <span className="ml-2">{a.effectiveFrom}{a.effectiveTo ? " to " + a.effectiveTo : ""}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default POAssignmentInfo;
