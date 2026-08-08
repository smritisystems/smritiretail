/**
 * Project      : SMRITI Retail OS
 * Module       : UCIF v1.0 — Extracted Customer Inspector Component
 * Standard     : UCIF-004 / AFR-001 (FROZEN)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { SmritiScrollArea } from "../SmritiScrollArea.tsx";
import { getCustomers, getCustomerGroups, updateCustomerStatus, updateCustomerTags, getSalesInvoices, getSalesReturns } from "../../services/customerStore.ts";
import { resolveCustomerPolicy } from "../../services/customerPolicyEngine.ts";
import { Customer, CustomerGroup, Quotation, SalesOrder } from "../../types";
import { apiFetchV1 } from "../../lib/apiFetchV1";
import { LineageGraph, LineageNode } from "./LineageGraph.tsx";

interface CustomerInspectorPanelProps {
  entityId: string;
  onClose?: () => void;
}

export const CustomerInspectorPanel: React.FC<CustomerInspectorPanelProps> = ({ entityId }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [group, setGroup] = useState<CustomerGroup | null>(null);

  // Recent Activity tab states
  const [activeTab, setActiveTab] = useState<"profile" | "activity">("profile");
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loadingActivity, setLoadingActivity] = useState<boolean>(false);

  useEffect(() => {
    const loadCustomer = () => {
      if (entityId) {
        setActiveTab("profile");
        const customers = getCustomers();
        const groups = getCustomerGroups();
        const foundCust = customers.find((c) => c.id === entityId);
        if (foundCust) {
          setCustomer(foundCust);
          const foundGrp = groups.find((g) => g.id === foundCust.customerGroupId);
          setGroup(foundGrp || null);
        } else {
          setCustomer(null);
          setGroup(null);
        }
      } else {
        setCustomer(null);
        setGroup(null);
      }
    };

    loadCustomer();

    window.addEventListener("smriti_customer_updated", loadCustomer);
    return () => {
      window.removeEventListener("smriti_customer_updated", loadCustomer);
    };
  }, [entityId]);

  useEffect(() => {
    if (entityId && customer) {
      setLoadingActivity(true);
      Promise.all([
        apiFetchV1(`/sales/quotations/?customer=${encodeURIComponent(customer.name)}`),
        apiFetchV1(`/sales/orders/?customer=${encodeURIComponent(customer.name)}`),
      ])
        .then(([qData, oData]) => {
          const qRaw = qData?.quotations ?? qData ?? [];
          const oRaw = oData?.orders ?? oData ?? [];
          const qFiltered = Array.isArray(qRaw)
            ? qRaw.filter((q: any) => q.customerName.toLowerCase() === customer.name.toLowerCase())
            : [];
          const oFiltered = Array.isArray(oRaw)
            ? oRaw.filter((so: any) => so.customerName.toLowerCase() === customer.name.toLowerCase())
            : [];
          setQuotations(qFiltered);
          setOrders(oFiltered);
        })
        .catch((err) => {
          console.error("Failed to fetch customer activity:", err);
        })
        .finally(() => {
          setLoadingActivity(false);
        });
    }
  }, [entityId, customer]);

  const handleStatusChange = (newStatus: "Active" | "Inactive" | "Blocked") => {
    if (!customer) return;
    const updated = updateCustomerStatus(customer.id, newStatus);
    const found = updated.find((c) => c.id === customer.id);
    if (found) {
      setCustomer(found);
    }
  };

  const handleUpdateTags = (newTags: string[]) => {
    if (!customer) return;
    const updated = updateCustomerTags(customer.id, newTags);
    const found = updated.find((c) => c.id === customer.id);
    if (found) {
      setCustomer(found);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
  };

  const policy = customer && group ? resolveCustomerPolicy(customer, group) : null;
  const currentOutstanding = customer?.outstanding || 0;
  const creditLimit = policy?.unlimitedCredit ? Infinity : policy?.creditLimit || 0;
  const isUnlimited = policy?.unlimitedCredit || false;
  const availableCredit = isUnlimited ? Infinity : Math.max(0, creditLimit - currentOutstanding);

  let creditBadgeColor = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  let creditBadgeText = "GOOD CREDIT";

  if (!isUnlimited) {
    const usageRatio = creditLimit > 0 ? currentOutstanding / creditLimit : 0;
    if (usageRatio >= 1.0) {
      creditBadgeColor = "bg-rose-500/10 text-rose-500 border-rose-500/20";
      creditBadgeText = "CREDIT EXCEEDED";
    } else if (usageRatio >= 0.8) {
      creditBadgeColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";
      creditBadgeText = "HIGH CREDIT UTILIZATION";
    }
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-theme-muted">
        <span className="material-symbols-outlined text-4xl mb-2">person_search</span>
        <p className="text-sm font-medium">Customer details not found</p>
        <p className="text-xs text-theme-muted/60 mt-1">ID: {entityId}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-theme-divider bg-theme-surface-2 flex items-start gap-3 flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-theme-accent/15 text-theme-accent font-bold text-lg flex items-center justify-center flex-shrink-0">
          {customer.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-theme-text truncate">{customer.name}</h3>
            <span className={`px-2 py-0.5 text-xs rounded-full border ${creditBadgeColor}`}>
              {creditBadgeText}
            </span>
          </div>
          <p className="text-xs text-theme-muted truncate mt-0.5">{customer.code || customer.id}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-theme-divider bg-theme-surface-1 flex-shrink-0">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "profile"
              ? "border-theme-accent text-theme-accent font-semibold"
              : "border-transparent text-theme-muted hover:text-theme-text"
          }`}
        >
          Profile & Financials
        </button>
        <button
          onClick={() => setActiveTab("activity")}
          className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
            activeTab === "activity"
              ? "border-theme-accent text-theme-accent font-semibold"
              : "border-transparent text-theme-muted hover:text-theme-text"
          }`}
        >
          Recent Activity
        </button>
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "profile" ? (
          <div className="p-4 space-y-4">
            {/* Financial Summary */}
            <div className="bg-theme-surface-2 p-3 rounded-lg border border-theme-divider space-y-2">
              <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Financial Snapshot</span>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <p className="text-xs text-theme-muted">Outstanding</p>
                  <p className="text-sm font-bold text-rose-500">{formatCurrency(currentOutstanding)}</p>
                </div>
                <div>
                  <p className="text-xs text-theme-muted">Available Credit</p>
                  <p className="text-sm font-bold text-emerald-500">
                    {isUnlimited ? "Unlimited" : formatCurrency(availableCredit)}
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Contact Info</span>
              <div className="bg-theme-surface-1 p-3 rounded-lg border border-theme-divider space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-theme-muted">Phone:</span>
                  <span className="font-medium text-theme-text">{customer.phone || customer.mobile || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-theme-muted">Email:</span>
                  <span className="font-medium text-theme-text">{customer.email || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-theme-muted">GSTIN:</span>
                  <span className="font-medium text-theme-text">{(customer as any).gstin || (customer as any).gst || "—"}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">Quotations & Orders</span>
            {loadingActivity ? (
              <div className="text-xs text-theme-muted">Loading activity...</div>
            ) : (
              <div className="space-y-2 text-xs">
                <div>
                  <p className="font-medium text-theme-text mb-1">Recent Orders ({orders.length})</p>
                  {orders.slice(0, 5).map((o, idx) => (
                    <div key={idx} className="flex justify-between py-1 border-b border-theme-divider/50">
                      <span>{o.id || (o as any).name}</span>
                      <span className="font-medium">{formatCurrency((o as any).grandTotal || 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
