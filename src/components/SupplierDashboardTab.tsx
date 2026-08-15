/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { SmritiScrollArea } from "./SmritiScrollArea.tsx";
import { DrillableLink } from "./drilldown/DrillableLink.tsx";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";
import { CreateSupplierModal } from "./CreateSupplierModal.tsx";

interface SupplierDashboardTabProps {
  currentUser?: { role: string; name: string } | null;
}

export const SupplierDashboardTab: React.FC<SupplierDashboardTabProps> = ({ currentUser }) => {
  const isReadOnly = currentUser?.role === "Report User";
  const [activeSubTab, setActiveSubTab] = useState<
    "dashboard" | "directory" | "performance"
  >("dashboard");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSuppliers = async () => {
    setLoadingSuppliers(true);
    try {
      const data = await apiFetchV1("/purchase/suppliers/");
      setSuppliers(data || []);
    } catch (e) {
      console.warn("Failed to fetch suppliers", e);
      setSuppliers([]);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    recordAuditAction("VIEW", "suppliers", activeSubTab, `Switched supplier dashboard view to: ${activeSubTab}`);
  }, [activeSubTab]);

  return (
    <div className="flex flex-col h-full bg-theme-surface-1 text-theme-primary font-sans">
      {isReadOnly && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-6 py-2.5 flex items-center space-x-2 text-amber-400 text-xs">
          <span className="material-symbols-outlined text-sm">warning</span>
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Write operations are prohibited.</span>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-theme-divider bg-theme-surface-2 px-6 py-4">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-primary tracking-tight">
            Supplier & Vendor Management
          </h2>
          <p className="text-xs text-theme-muted mt-1 max-w-2xl">
            Centralized hub for vendor directories, outstanding payables, supply
            chain performance, and procurement tracking.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow"
          >
            <span className="material-symbols-outlined text-base">add_business</span>
            + Create Supplier
          </button>
          <div className="flex items-center gap-3 bg-theme-surface-3 px-4 py-2 rounded-lg border border-theme-divider">
            <div className="text-right">
              <div className="text-[10px] font-mono text-theme-muted uppercase font-bold">
                Total Payables
              </div>
              <div className="text-sm font-bold text-rose-400 font-mono">
                ₹0.00
              </div>
            </div>
            <div className="w-px h-8 bg-theme-divider mx-2"></div>
            <div className="text-right">
              <div className="text-[10px] font-mono text-theme-muted uppercase font-bold">
                Active Vendors
              </div>
              <div className="text-sm font-bold text-emerald-400 font-mono">
                {suppliers.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center px-6 bg-theme-surface-2 border-b border-theme-divider gap-2">
        {(["dashboard", "directory", "performance"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider font-mono border-b-2 transition-colors ${
              activeSubTab === tab
                ? "border-blue-500 text-blue-400 bg-theme-surface-3"
                : "border-transparent text-theme-muted hover:text-theme-primary hover:bg-theme-surface-hover"
            }`}
          >
            {tab === "dashboard" && "Procurement Dashboard"}
            {tab === "directory" && "Vendor Directory"}
            {tab === "performance" && "Vendor Performance"}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <SmritiScrollArea className="flex-1 bg-theme-base p-6">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeSubTab === "dashboard" && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold text-theme-muted font-display uppercase tracking-wider">
                      Open POs
                    </h4>
                    <span className="material-symbols-outlined text-blue-400 text-lg">
                      receipt_long
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-theme-primary font-mono">
                    0
                  </div>
                  <div className="text-[10px] text-theme-muted mt-1 font-mono">
                    Valued at ₹0.00
                  </div>
                </div>
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold text-theme-muted font-display uppercase tracking-wider">
                      GRNs Pending
                    </h4>
                    <span className="material-symbols-outlined text-amber-400 text-lg">
                      inventory_2
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-theme-primary font-mono">
                    0
                  </div>
                  <div className="text-[10px] text-theme-muted mt-1 flex items-center gap-1 font-mono">
                    0 Overdue
                  </div>
                </div>
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold text-theme-muted font-display uppercase tracking-wider">
                      Total Payables
                    </h4>
                    <span className="material-symbols-outlined text-rose-400 text-lg">
                      account_balance_wallet
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-theme-primary font-mono">
                    ₹0.00
                  </div>
                  <div className="text-[10px] text-theme-muted mt-1 font-mono">
                    Across {suppliers.length} Vendors
                  </div>
                </div>
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold text-theme-muted font-display uppercase tracking-wider">
                      Avg Delivery Time
                    </h4>
                    <span className="material-symbols-outlined text-emerald-400 text-lg">
                      local_shipping
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-theme-primary font-mono">
                    0.0 Days
                  </div>
                  <div className="text-[10px] text-theme-muted mt-1 flex items-center gap-1 font-mono">
                    On-time fulfilment
                  </div>
                </div>
              </div>

              {/* Recent Transactions & Outstanding */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Procurements */}
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-lg">
                  <div className="p-4 border-b border-theme-divider bg-theme-surface-3 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-theme-primary font-display uppercase tracking-wider">
                      Recent POs
                    </h3>
                  </div>
                  <div className="p-8 text-center text-xs font-mono text-theme-muted">
                    No recent purchase orders recorded.
                  </div>
                </div>

                {/* Aging Summary */}
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-lg">
                  <div className="p-4 border-b border-theme-divider bg-theme-surface-3">
                    <h3 className="text-sm font-bold text-theme-primary font-display uppercase tracking-wider">
                      Payables Aging
                    </h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-theme-muted font-medium">
                            0 - 30 Days
                          </span>
                          <span className="font-mono font-bold text-emerald-400">
                            ₹0.00
                          </span>
                        </div>
                        <div className="w-full bg-theme-surface-3 rounded-full h-2">
                          <div
                            className="bg-emerald-500 h-2 rounded-full"
                            style={{ width: "0%" }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-theme-muted font-medium">
                            31 - 60 Days
                          </span>
                          <span className="font-mono font-bold text-amber-400">
                            ₹0.00
                          </span>
                        </div>
                        <div className="w-full bg-theme-surface-3 rounded-full h-2">
                          <div
                            className="bg-amber-500 h-2 rounded-full"
                            style={{ width: "0%" }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-theme-muted font-medium">
                            61 - 90 Days
                          </span>
                          <span className="font-mono font-bold text-orange-400">
                            ₹0.00
                          </span>
                        </div>
                        <div className="w-full bg-theme-surface-3 rounded-full h-2">
                          <div
                            className="bg-orange-500 h-2 rounded-full"
                            style={{ width: "0%" }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-theme-muted font-medium">
                            &gt; 90 Days
                          </span>
                          <span className="font-mono font-bold text-rose-400">
                            ₹20,000
                          </span>
                        </div>
                        <div className="w-full bg-theme-surface-3 rounded-full h-2">
                          <div
                            className="bg-rose-500 h-2 rounded-full"
                            style={{ width: "10%" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === "directory" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-theme-primary font-display uppercase tracking-wider">
                  Vendor Directory ({suppliers.length})
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search vendors by name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-theme-surface-2 border border-theme-divider rounded-lg px-3 py-1.5 text-xs text-theme-body placeholder-theme-muted focus:outline-none focus:border-blue-500 w-64"
                  />
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  >
                    + New Vendor
                  </button>
                </div>
              </div>

              {suppliers.length === 0 ? (
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-12 text-center space-y-4 shadow-lg">
                  <div className="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
                    <span className="material-symbols-outlined text-2xl">storefront</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-theme-primary">No Supplier Masters Found</h4>
                    <p className="text-xs text-theme-muted mt-1 max-w-md mx-auto">
                      There are no registered supplier masters in the system. Click "+ Create Supplier" below to create your first vendor record.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5 shadow"
                  >
                    <span className="material-symbols-outlined text-base">add_business</span>
                    + Create Supplier Master
                  </button>
                </div>
              ) : (
                <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden shadow-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-theme-surface-3 border-b border-theme-divider text-[10px] uppercase tracking-wider text-theme-muted font-mono">
                        <th className="px-4 py-3 font-semibold">Vendor ID</th>
                        <th className="px-4 py-3 font-semibold">Supplier Name</th>
                        <th className="px-4 py-3 font-semibold">GSTIN</th>
                        <th className="px-4 py-3 font-semibold">Contact / Phone</th>
                        <th className="px-4 py-3 font-semibold">Location</th>
                        <th className="px-4 py-3 font-semibold text-right">Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs divide-y divide-theme-divider">
                      {suppliers
                        .filter(s => 
                          !searchQuery || 
                          s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (s.code && s.code.toLowerCase().includes(searchQuery.toLowerCase()))
                        )
                        .map((s) => (
                          <tr
                            key={s.id}
                            className="hover:bg-theme-surface-hover transition-colors cursor-pointer group"
                          >
                            <td className="px-4 py-3 font-mono text-blue-400 font-bold">
                              {s.code || s.id}
                            </td>
                            <td className="px-4 py-3 font-medium text-theme-body group-hover:text-blue-400">
                              <DrillableLink context={{ entityType: "supplier", entityId: s.id, title: s.name }}>
                                {s.name}
                              </DrillableLink>
                            </td>
                            <td className="px-4 py-3 font-mono text-theme-muted">
                              {s.gst_number || "N/A"}
                            </td>
                            <td className="px-4 py-3 text-theme-muted font-mono">
                              {s.mobile || s.email || "N/A"}
                            </td>
                            <td className="px-4 py-3 text-theme-muted">
                              {s.city ? `${s.city}, ${s.state || ''}` : 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-medium text-theme-muted">
                              ₹0.00
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeSubTab === "performance" && (
            <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-8 shadow-lg text-center">
              <span className="material-symbols-outlined text-6xl text-theme-muted mb-4 block">
                query_stats
              </span>
              <h3 className="text-lg font-bold text-theme-primary font-display uppercase tracking-wider">
                Vendor Scorecards
              </h3>
              <p className="text-theme-muted text-sm mt-2 max-w-md mx-auto">
                Track On-Time Delivery (OTD), Defect Rates, and Fulfillment
                Accuracy for all registered suppliers.
              </p>
              <button className="mt-6 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors">
                Generate Evaluation Report
              </button>
            </div>
          )}
        </motion.div>
      </SmritiScrollArea>
    </div>
  );
};
