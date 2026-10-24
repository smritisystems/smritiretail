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

export interface CorporateCustomer360Props {
  customerId?: string;
  customer?: any;
  onBack?: () => void;
  onEditCustomer?: (customer: any) => void;
  onSave?: () => void;
  onDeactivate?: () => void;
  isSaving?: boolean;
  isDirty?: boolean;
}

export const CorporateCustomer360: React.FC<CorporateCustomer360Props> = ({
  customerId,
  customer: propCustomer,
  onBack,
  onEditCustomer,
  onSave,
  onDeactivate,
  isSaving = false,
  isDirty = false,
}) => {
  const resolvedCustomerId = customerId || propCustomer?.id || propCustomer?.code;
  const [data, setData] = useState<CorporateCustomer360Data | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(resolvedCustomerId));
  const [error, setError] = useState<string | null>(null);

  // Authoritative data fetcher
  const load360Data = useCallback(async () => {
    if (!resolvedCustomerId) return;
    setIsLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await apiFetchV1<CorporateCustomer360Data>(
        `/crm/customers/${encodeURIComponent(resolvedCustomerId)}/corporate-360`
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
  }, [resolvedCustomerId]);

  useEffect(() => {
    if (!resolvedCustomerId) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    load360Data();
  }, [load360Data]);

  if (!resolvedCustomerId) {
    return (
      <div className="p-6 max-w-xl mx-auto mt-12 bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Select a customer to view the dashboard</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">Open a customer from Customer Master to see its profile, commercial terms, transactions, and pending PSV reconciliation.</p>
        {onBack && (
          <button type="button" onClick={onBack} className="px-3 py-2 rounded-lg bg-[#0066cc] text-white text-sm font-semibold">
            Open Customer Master
          </button>
        )}
      </div>
    );
  }

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
  if (error && !data) {
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
        <div className="flex justify-center gap-2">
          {onBack && <button type="button" onClick={onBack} className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-xs font-semibold rounded-lg">Back to Customer Master</button>}
          <button
            type="button"
            onClick={load360Data}
            className="px-4 py-2 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold rounded-lg transition inline-flex items-center gap-2"
          >
            <RefreshCw size={14} />
            <span>Retry Loading Profile</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <Customer360DashboardView
      customerId={customerId}
      customer={data?.customer || propCustomer}
      corporate360Data={data}
      onEditCustomer={onEditCustomer}
      onSave={onSave}
      onDeactivate={onDeactivate}
      onBack={onBack}
      isSaving={isSaving}
      isDirty={isDirty}
    />
  );
};
