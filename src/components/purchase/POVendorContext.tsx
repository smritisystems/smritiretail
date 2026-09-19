/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 6.42.0
 * Created      : 2026-09-19
 * Modified     : 2026-09-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Spec         : §2, §3 — Vendor context bar: policy pill + vendor status.
 * Shown inside the PO header after a vendor is selected.
 */

import React, { useEffect, useState } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1";

interface Props {
  vendorId: string;
  vendorName?: string;
  /** Optional override — if not provided, loaded from /purchase/purchasing-policy */
  policyName?: string;
  vendorStatus?: string;
  onViewPolicy?: () => void;
}

export const POVendorContext: React.FC<Props> = ({
  vendorId, vendorName, policyName: policyProp, vendorStatus: statusProp, onViewPolicy,
}) => {
  const [policyName, setPolicyName] = useState(policyProp ?? "");
  const [vendorStatus, setVendorStatus] = useState(statusProp ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!vendorId) { setPolicyName(""); setVendorStatus(""); return; }
    let cancelled = false;
    setLoading(true);
    apiFetchV1("/purchase/purchasing-policy?vendor_id=" + encodeURIComponent(vendorId))
      .then((d: any) => {
        if (!cancelled) {
          setPolicyName(d?.business_template ?? d?.template_name ?? "General Retail");
          setVendorStatus(d?.vendor_status ?? "Active");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPolicyName("General Retail");
          setVendorStatus("Active");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [vendorId]);

  if (!vendorId) return null;

  const statusColor =
    vendorStatus?.toLowerCase() === "active"   ? "bg-green-100 text-green-800 border-green-200" :
    vendorStatus?.toLowerCase() === "inactive"  ? "bg-red-100 text-red-800 border-red-200" :
    "bg-[#eeedf3] text-[#434652] border-[#c4c6d4]";

  return (
    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
      {/* Policy pill */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold text-[#737685] uppercase tracking-wide">Policy</span>
        {loading ? (
          <div className="animate-pulse h-4 w-20 bg-[#eeedf3] rounded-full" />
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e8eeff] text-[#00296d] border border-[#c4c6d4]">
            {policyName || "General Retail"}
          </span>
        )}
        {onViewPolicy && !loading && (
          <button type="button" onClick={onViewPolicy}
            className="text-[10px] text-[#00296d] underline hover:no-underline font-semibold">
            View Policy
          </button>
        )}
      </div>

      {/* Separator */}
      <span className="text-[#c4c6d4] text-xs">|</span>

      {/* Vendor status pill */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold text-[#737685] uppercase tracking-wide">Vendor Status</span>
        {loading ? (
          <div className="animate-pulse h-4 w-14 bg-[#eeedf3] rounded-full" />
        ) : (
          <span className={"inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border " + statusColor}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
            {vendorStatus || "Active"}
          </span>
        )}
      </div>
    </div>
  );
};

export default POVendorContext;
