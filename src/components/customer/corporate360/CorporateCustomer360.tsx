/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-18
 * Modified     : 2026-10-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Capability   : withCapability("customer.crud", "CRM")
 */

import React, { useState, useEffect, useCallback } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";
import { CorporateCustomer360Data } from "./types.ts";
import { Customer360DashboardView } from "./Customer360DashboardView.tsx";
import { Customer } from "../../../types.ts";

export interface CorporateCustomer360Props {
  customerId?: string;
  customer?: any;
  currentUser?: { role?: string; name?: string; id?: string } | null;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
  onNavigateTab?: (tabId: string) => void;
  onBack?: () => void;
  onEditCustomer?: (customer: any) => void;
  onChange?: (field: string, value: any) => void;
  onSave?: () => void;
  onSaveAndNew?: () => void;
  onDuplicate?: () => void;
  onDeactivate?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
}

export const CorporateCustomer360: React.FC<CorporateCustomer360Props> = ({
  customerId = "CUST-REL-0001",
  customer: propCustomer,
  currentUser,
  onNotification,
  onBack,
  onChange,
  onSave,
  onSaveAndNew,
  onDuplicate,
  onDeactivate,
  isSaving = false,
  isDirty = false,
}) => {
  const [data, setData] = useState<CorporateCustomer360Data | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Authoritative data fetcher
  const load360Data = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetchV1<CorporateCustomer360Data>(
        `/crm/customers/${encodeURIComponent(customerId)}/corporate-360`
      );
      if (res && res.customer) {
        setData(res);
      } else {
        throw new Error("Invalid corporate customer response payload.");
      }
    } catch (err: any) {
      console.warn("[CorporateCustomer360] Live API error:", err);
      setError(err?.message || "Failed to load corporate profile.");
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    load360Data();
  }, [load360Data]);

  // Skeleton Loading UI
  if (isLoading && !data && !propCustomer) {
    return (
      <div className="p-6 space-y-4 max-w-7xl mx-auto animate-pulse">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
        <div className="h-44 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800"></div>
        <div className="h-12 bg-slate-100 dark:bg-slate-800/40 rounded-xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-64 bg-slate-100 dark:bg-slate-800/60 rounded-xl"></div>
          <div className="h-64 bg-slate-100 dark:bg-slate-800/60 rounded-xl"></div>
          <div className="h-64 bg-slate-100 dark:bg-slate-800/60 rounded-xl"></div>
        </div>
      </div>
    );
  }

  // Error State with Retry
  if (error && !data && !propCustomer) {
    return (
      <div className="p-6 max-w-xl mx-auto mt-12 bg-white dark:bg-[#1e222d] border border-rose-200 dark:border-rose-900 rounded-2xl shadow-xl text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600 mx-auto">
          <AlertCircle size={24} />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Unable to Load Corporate Customer Profile
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {error}
          </p>
        </div>
        <button
          type="button"
          onClick={load360Data}
          className="px-4 py-2 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-2"
        >
          <RefreshCw size={14} />
          <span>Retry Loading Profile</span>
        </button>
      </div>
    );
  }

  return (
    <Customer360DashboardView
      customerId={customerId}
      customer={propCustomer || data?.customer}
      corporate360Data={data}
      currentUser={currentUser}
      onChange={onChange}
      onSave={onSave}
      onSaveAndNew={onSaveAndNew}
      onDuplicate={onDuplicate}
      onDeactivate={onDeactivate}
      onBack={onBack}
      onNotification={onNotification}
      isSaving={isSaving}
      isDirty={isDirty}
    />
  );
};
