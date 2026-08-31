/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 2.1.2
 * Created      : 2026-07-10
 * Modified     : 2026-07-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useDrillDown } from "./drilldown_store.tsx";
import { SmritiScrollArea } from "../SmritiScrollArea.tsx";
import { getCustomers, getCustomerGroups, updateCustomerStatus, updateCustomerTags, getSalesInvoices, getSalesReturns } from "../../services/customerStore.ts";
import { resolveCustomerPolicy } from "../../services/custPolicyEngine.ts";
import { Customer, CustomerGroup, Quotation, SalesOrder } from "../../types";
import { apiFetchV1 } from "../../lib/apiFetchV1";
import { useLayoutEngine } from "../../layout_engine/layout_store";
import { useResponsiveLayout } from "../../layout_engine/responsive_manager";
import { useWorkspace } from "../../contexts/WorkspaceContext.tsx";

export const DrillDownSidePanel: React.FC = () => {
  const { activePanel, closePanel } = useDrillDown();
  const { focusMode } = useWorkspace();
  const { preferences } = useLayoutEngine();
  const { effectivePosition } = useResponsiveLayout(preferences.position);

  // Compute dock-aware positioning offsets
  const topOffset = focusMode ? "0px" : "48px";
  const rightOffset = (!focusMode && effectivePosition === "right" && !preferences.collapsed) ? "220px" : "0px";
  const bottomOffset = (!focusMode && effectivePosition === "bottom") ? "56px" : "0px";

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [group, setGroup] = useState<CustomerGroup | null>(null);
  const [invoice, setInvoice] = useState<any | null>(null);

  // Recent Activity tab states
  const [activeTab, setActiveTab] = useState<"profile" | "activity">("profile");
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loadingActivity, setLoadingActivity] = useState<boolean>(false);

  useEffect(() => {
    const loadCustomer = () => {
      if (activePanel && activePanel.entityType === "customer") {
        setActiveTab("profile"); // Default to profile tab on open/change
        const customers = getCustomers();
        const groups = getCustomerGroups();
        const foundCust = customers.find(c => c.id === activePanel.entityId);
        if (foundCust) {
          setCustomer(foundCust);
          const foundGrp = groups.find(g => g.id === foundCust.customerGroupId);
          setGroup(foundGrp || null);
        } else {
          setCustomer(null);
          setGroup(null);
        }
      } else {
        setCustomer(null);
        setGroup(null);
      }
      if (activePanel && activePanel.entityType === "invoice") {
        setInvoice(null);
        const invoiceKey = activePanel.entityId;
        const encodedKey = encodeURIComponent(invoiceKey);
        apiFetchV1(`/sales/invoices/${encodedKey}`)
          .catch(() => apiFetchV1(`/sales/invoices/by-number/${invoiceKey}`))
          .catch(() => apiFetchV1(`/sales/invoices?q=${encodedKey}&limit=1`)
            .then((result) => {
              const matches = Array.isArray(result) ? result : result?.items || [];
              const invoiceId = matches[0]?.id;
              if (!invoiceId) throw new Error("Sales invoice not found");
              return apiFetchV1(`/sales/invoices/${encodeURIComponent(invoiceId)}`);
            }))
          .then((data) => setInvoice(data))
          .catch((error) => console.error("Failed to load invoice details:", error));
      } else {
        setInvoice(null);
      }
    };

    loadCustomer();

    window.addEventListener("smriti_customer_updated", loadCustomer);
    return () => {
      window.removeEventListener("smriti_customer_updated", loadCustomer);
    };
  }, [activePanel]);

  // Load customer activity (Quotations and Orders)
  useEffect(() => {
    if (activePanel && activePanel.entityType === "customer" && customer) {
      setLoadingActivity(true);
      // Migrated: GET /api/sales/quotations|orders (Express unmounted) → apiFetchV1
      Promise.all([
        apiFetchV1(`/sales/quotations/?customer=${encodeURIComponent(customer.name)}`),
        apiFetchV1(`/sales/orders/?customer=${encodeURIComponent(customer.name)}`)
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
        .catch(err => {
          console.error("Failed to fetch customer activity:", err);
        })
        .finally(() => {
          setLoadingActivity(false);
        });
    }
  }, [activePanel, customer]);

  const handleStatusChange = (newStatus: "Active" | "Inactive" | "Blocked") => {
    if (!customer) return;
    const updated = updateCustomerStatus(customer.id, newStatus);
    const found = updated.find(c => c.id === customer.id);
    if (found) {
      setCustomer(found);
    }
  };

  const handleUpdateTags = (newTags: string[]) => {
    if (!customer) return;
    const updated = updateCustomerTags(customer.id, newTags);
    const found = updated.find(c => c.id === customer.id);
    if (found) {
      setCustomer(found);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
  };

  // Compute values
  const policy = customer && group ? resolveCustomerPolicy(customer, group) : null;
  
  const currentOutstanding = customer?.outstanding || 0;
  const creditLimit = policy?.unlimitedCredit ? Infinity : (policy?.creditLimit || 0);
  const isUnlimited = policy?.unlimitedCredit || false;
  
  const availableCredit = isUnlimited ? Infinity : Math.max(0, creditLimit - currentOutstanding);
  const usagePercent = isUnlimited ? 0 : (creditLimit > 0 ? Math.min(100, Math.round((currentOutstanding / creditLimit) * 100)) : 0);

  const getUsageColor = (pct: number) => {
    if (pct >= 90) return "bg-rose-500";
    if (pct >= 75) return "bg-amber-500";
    return "bg-blue-500";
  };

  const handleWhatsApp = () => {
    if (!customer) return;
    const msg = `Dear ${customer.name}, your outstanding balance is ${formatCurrency(customer.outstanding)}. Please settle at your earliest convenience. - SMRITI Retail OS`;
    window.open(`https://wa.me/${customer.mobile}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleEmail = () => {
    if (!customer?.email) return;
    window.open(`mailto:${customer.email}?subject=Statement of Outstanding&body=${encodeURIComponent("Dear " + customer.name + ",\n\nYour current outstanding balance is " + formatCurrency(customer.outstanding) + ".\n\nWarm regards,\nSMRITI Retail OS")}`, "_blank");
  };

  interface ActivityItem {
    id: string;
    type: "Quotation" | "Order" | "Invoice";
    docNo: string;
    date: string;
    amount: number;
    status: string;
    icon: string;
    colorClass: string;
    statusColorClass: string;
  }

  const timelineActivities: ActivityItem[] = [
    ...quotations.map(q => ({
      id: q.id,
      type: "Quotation" as const,
      docNo: q.quotationNo,
      date: q.date,
      amount: q.grandTotal,
      status: q.status,
      icon: "description",
      colorClass: "text-blue-400 bg-blue-950/40 border-blue-800/40",
      statusColorClass: 
        q.status === "Approved" || q.status === "Converted" ? "bg-emerald-950/50 text-emerald-400 border-emerald-800/40" :
        q.status === "Cancelled" || q.status === "Rejected" ? "bg-rose-950/50 text-rose-400 border-rose-800/40" :
        q.status === "Submitted" ? "bg-indigo-950/50 text-indigo-400 border-indigo-800/40" :
        "bg-slate-850 text-slate-400 border-slate-800"
    })),
    ...orders.map(so => ({
      id: so.id,
      type: "Order" as const,
      docNo: so.orderNo,
      date: so.date,
      amount: so.grandTotal,
      status: so.status,
      icon: "shopping_cart",
      colorClass: "text-amber-400 bg-amber-950/40 border-amber-800/40",
      statusColorClass: 
        so.status === "Confirmed" || so.status === "Shipped" || so.status === "Approved" ? "bg-emerald-950/50 text-emerald-400 border-emerald-800/40" :
        so.status === "Cancelled" || so.status === "Rejected" ? "bg-rose-950/50 text-rose-400 border-rose-800/40" :
        so.status === "Submitted" ? "bg-indigo-950/50 text-indigo-400 border-indigo-800/40" :
        "bg-slate-850 text-slate-400 border-slate-800"
    })),
    ...getSalesInvoices().filter(inv => inv.customerId === customer?.id).map(inv => ({
      id: inv.id,
      type: "Invoice" as const,
      docNo: inv.invoiceNo,
      date: inv.date,
      amount: inv.grandTotal,
      status: inv.status,
      icon: "receipt",
      colorClass: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40",
      statusColorClass: 
        inv.status === "Approved" ? "bg-emerald-950/50 text-emerald-400 border-emerald-800/40" :
        inv.status === "Cancelled" ? "bg-rose-950/50 text-rose-400 border-rose-800/40" :
        inv.status === "Submitted" ? "bg-indigo-950/50 text-indigo-400 border-indigo-800/40" :
        "bg-slate-850 text-slate-400 border-slate-800"
    }))
  ];

  // Sort by date descending
  timelineActivities.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return timeB - timeA;
  });

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AnimatePresence>
      {activePanel && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            onClick={closePanel}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40"
          />
          
          {/* Panel */}
          <motion.div 
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            style={{
              top: topOffset,
              right: rightOffset,
              bottom: bottomOffset,
            }}
            className="fixed w-[420px] bg-theme-surface-1 border-l border-theme-divider shadow-2xl z-50 flex flex-col font-sans text-theme-body select-text"
          >
            {/* Header */}
            <div className="flex justify-between items-center px-5 py-3 border-b border-theme-divider bg-theme-surface-2">
              <div>
                <h2 className="text-base font-bold font-display text-theme-body">{activePanel.title}</h2>
                <div className="text-xs text-theme-muted uppercase font-mono tracking-wider mt-0.5 flex items-center space-x-2">
                  <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono">{activePanel.entityType}</span>
                  <span>•</span>
                  <span>{activePanel.entityId}</span>
                </div>
              </div>
              <button onClick={closePanel} className="text-theme-muted hover:text-theme-body transition-colors p-1 rounded-lg hover:bg-theme-surface-hover cursor-pointer">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            
            {/* Contextual Toolbar */}
            <div className="flex bg-theme-surface-2 border-b border-theme-divider p-2 space-x-1.5 shrink-0">
               {activePanel.entityType === "customer" && customer ? (
                 <>
                   <button 
                     onClick={handleWhatsApp}
                     className="flex-1 flex justify-center items-center space-x-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-xs font-semibold text-emerald-700 transition-colors cursor-pointer"
                   >
                     <span className="material-symbols-outlined text-[14px]">chat</span>
                     <span>WhatsApp</span>
                   </button>
                   {customer.email && (
                     <button 
                       onClick={handleEmail}
                       className="flex-1 flex justify-center items-center space-x-1 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-xs font-semibold text-blue-700 transition-colors cursor-pointer"
                     >
                       <span className="material-symbols-outlined text-[14px]">mail</span>
                       <span>Email Statement</span>
                     </button>
                   )}
                   <button 
                     onClick={() => window.print()}
                     className="flex-1 flex justify-center items-center space-x-1 py-1.5 bg-theme-surface-1 hover:bg-theme-surface-hover border border-theme-divider rounded text-xs font-semibold text-theme-body transition-colors cursor-pointer"
                   >
                     <span className="material-symbols-outlined text-[14px]">print</span>
                     <span>Print Profile</span>
                   </button>
                 </>
               ) : (
                 <>
                   <button className="flex-1 flex justify-center items-center space-x-1 py-1.5 bg-theme-surface-1 hover:bg-theme-surface-hover border border-theme-divider rounded text-xs font-semibold text-theme-body transition-colors cursor-pointer">
                     <span className="material-symbols-outlined text-[14px]">edit</span>
                     <span>Edit</span>
                   </button>
                   <button onClick={(e) => { e.stopPropagation(); window.print(); }} className="flex-1 flex justify-center items-center space-x-1 py-1.5 bg-theme-surface-1 hover:bg-theme-surface-hover border border-theme-divider rounded text-xs font-semibold text-theme-body transition-colors cursor-pointer">
                     <span className="material-symbols-outlined text-[14px]">print</span>
                     <span>Print</span>
                   </button>
                 </>
               )}
            </div>

            {/* Tab Selector */}
            {activePanel.entityType === "customer" && customer && (
              <div className="flex border-b border-theme-divider bg-theme-surface-2 px-4 shrink-0">
                <button
                  onClick={() => setActiveTab("profile")}
                  className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer ${
                    activeTab === "profile"
                      ? "border-blue-600 text-blue-700 font-bold bg-theme-surface-1"
                      : "border-transparent text-theme-muted hover:text-theme-body"
                  }`}
                >
                  Profile & Policies
                </button>
                <button
                  onClick={() => setActiveTab("activity")}
                  className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors cursor-pointer ${
                    activeTab === "activity"
                      ? "border-blue-600 text-blue-700 font-bold bg-theme-surface-1"
                      : "border-transparent text-theme-muted hover:text-theme-body"
                  }`}
                >
                  Recent Activity ({timelineActivities.length})
                </button>
              </div>
            )}

            {/* Dynamic Content based on Entity Type */}
            <SmritiScrollArea className="flex-1 p-5 space-y-5 bg-theme-surface-1">
               
               {activePanel.entityType === 'customer' && customer && group && policy ? (
                 activeTab === "profile" ? (
                   <>
                   {/* IDENTITY SECTION */}
                   <div className="space-y-2">
                     <h3 className="text-[10px] font-bold text-theme-muted uppercase tracking-wider font-mono">Customer Identity</h3>
                     <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 space-y-3">
                       <div className="flex justify-between border-b border-theme-divider/60 pb-2">
                         <span className="text-xs text-theme-muted">Full Name</span>
                         <span className="text-xs font-bold text-theme-body">{customer.name}</span>
                       </div>
                       <div className="flex justify-between border-b border-theme-divider/60 pb-2">
                         <span className="text-xs text-theme-muted">Mobile Phone</span>
                         <span className="text-xs font-semibold text-theme-body font-mono">{customer.mobile}</span>
                       </div>
                       {customer.email && (
                         <div className="flex justify-between border-b border-theme-divider/60 pb-2">
                           <span className="text-xs text-theme-muted">Email Address</span>
                           <span className="text-xs text-theme-body font-mono">{customer.email}</span>
                         </div>
                       )}
                       {customer.gstNumber && (
                         <div className="flex justify-between border-b border-theme-divider/60 pb-2">
                           <span className="text-xs text-theme-muted">GSTIN</span>
                           <span className="text-xs font-semibold text-blue-600 font-mono">{customer.gstNumber}</span>
                         </div>
                       )}
                       <div className="flex justify-between">
                         <span className="text-xs text-theme-muted">Segment Group</span>
                         <span className="text-xs font-semibold text-amber-600">{group.name}</span>
                       </div>
                     </div>
                   </div>

                   {/* CUSTOMER TAGS SECTION */}
                   <div className="space-y-2">
                     <h3 className="text-[10px] font-bold text-theme-muted uppercase tracking-wider font-mono">Customer Tags</h3>
                     <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 space-y-3">
                       <div className="flex flex-wrap gap-1.5">
                         {(customer.tags || []).length === 0 ? (
                           <span className="text-xs text-theme-muted italic">No custom tags assigned</span>
                         ) : (
                           (customer.tags || []).map(tag => (
                             <span 
                               key={tag} 
                               className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 font-mono"
                             >
                               <span>{tag}</span>
                               <button
                                 type="button"
                                 onClick={() => {
                                   const nextTags = (customer.tags || []).filter(t => t !== tag);
                                   handleUpdateTags(nextTags);
                                 }}
                                 className="hover:bg-blue-100 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center text-[10px] font-bold text-blue-600 focus:outline-none cursor-pointer"
                               >
                                 &times;
                               </button>
                             </span>
                           ))
                         )}
                       </div>
                       
                       <div className="flex items-center space-x-2 pt-2 border-t border-theme-divider/60">
                         <input
                           type="text"
                           placeholder="Type tag and press Enter..."
                           id="add-tag-input"
                           className="flex-1 bg-theme-surface-1 border border-theme-divider rounded-lg px-2.5 py-1 text-xs text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                           onKeyDown={(e) => {
                             if (e.key === "Enter") {
                               const input = e.currentTarget;
                               const val = input.value.trim();
                               if (val) {
                                 const currentTags = customer.tags || [];
                                 if (!currentTags.includes(val)) {
                                   const nextTags = [...currentTags, val];
                                   handleUpdateTags(nextTags);
                                 }
                                 input.value = "";
                               }
                             }
                           }}
                         />
                         <button
                           type="button"
                           onClick={() => {
                             const input = document.getElementById("add-tag-input") as HTMLInputElement;
                             const val = input?.value?.trim();
                             if (val) {
                               const currentTags = customer.tags || [];
                               if (!currentTags.includes(val)) {
                                 const nextTags = [...currentTags, val];
                                 handleUpdateTags(nextTags);
                               }
                               if (input) input.value = "";
                             }
                           }}
                           className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2.5 py-1.5 font-bold rounded-lg transition-colors cursor-pointer font-sans"
                         >
                           Add
                         </button>
                       </div>
                     </div>
                   </div>

                   {/* LIVE STATUS TOGGLE */}
                   <div className="space-y-2">
                     <h3 className="text-[10px] font-bold text-theme-muted uppercase tracking-wider font-mono">Account Status Toggle</h3>
                     <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 flex items-center justify-between">
                       <span className="text-xs text-theme-muted">Current Status:</span>
                       <div className="flex space-x-1">
                         {(["Active", "Inactive", "Blocked"] as const).map(st => (
                           <button
                             key={st}
                             onClick={() => handleStatusChange(st)}
                             className={`px-2.5 py-1 text-xs font-bold rounded transition-colors cursor-pointer ${
                               customer.status === st
                                 ? st === "Active"
                                   ? "bg-emerald-600 text-white"
                                   : st === "Blocked"
                                   ? "bg-rose-600 text-white"
                                   : "bg-slate-600 text-white"
                                 : "bg-theme-surface-1 text-theme-muted hover:bg-theme-surface-hover hover:text-theme-body border border-theme-divider"
                             }`}
                           >
                             {st}
                           </button>
                         ))}
                       </div>
                     </div>
                   </div>

                   {/* CREDIT & METRICS SECTION */}
                   <div className="space-y-2">
                     <h3 className="text-[10px] font-bold text-theme-muted uppercase tracking-wider font-mono">Live Credit Metrics</h3>
                     <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 space-y-4">
                       <div className="grid grid-cols-2 gap-4">
                         <div className="bg-theme-surface-1 border border-theme-divider/60 p-2.5 rounded-lg text-center">
                           <div className="text-[10px] text-theme-muted font-mono uppercase">Outstanding</div>
                           <div className="text-base font-bold text-rose-600 font-mono mt-0.5">{formatCurrency(currentOutstanding)}</div>
                         </div>
                         <div className="bg-theme-surface-1 border border-theme-divider/60 p-2.5 rounded-lg text-center">
                           <div className="text-[10px] text-theme-muted font-mono uppercase">Available Credit</div>
                           <div className="text-base font-bold text-emerald-600 font-mono mt-0.5">
                             {isUnlimited ? "Unlimited" : formatCurrency(availableCredit)}
                           </div>
                         </div>
                       </div>

                       {!isUnlimited && (
                         <div className="space-y-1.5">
                           <div className="flex justify-between text-xs">
                             <span className="text-theme-muted">Credit Limit Usage:</span>
                             <span className="font-semibold text-theme-body font-mono">{usagePercent}% ({formatCurrency(currentOutstanding)} / {formatCurrency(creditLimit)})</span>
                           </div>
                           <div className="w-full bg-theme-surface-3 rounded-full h-2 overflow-hidden">
                             <div 
                               className={`h-full rounded-full transition-all duration-300 ${getUsageColor(usagePercent)}`}
                               style={{ width: `${usagePercent}%` }}
                             />
                           </div>
                         </div>
                       )}
                     </div>
                   </div>

                   {/* RESOLVED POLICY PARAMETERS */}
                   <div className="space-y-2">
                     <h3 className="text-[10px] font-bold text-theme-muted uppercase tracking-wider font-mono">Resolved Credit Policy</h3>
                     <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 space-y-3">
                       <div className="flex justify-between border-b border-theme-divider/60 pb-2">
                         <span className="text-xs text-theme-muted">Allowed Credit Terms</span>
                         <span className="text-xs font-semibold text-theme-body font-mono">{policy.creditDays} Net Days</span>
                       </div>
                       <div className="flex justify-between border-b border-theme-divider/60 pb-2">
                         <span className="text-xs text-theme-muted">Allowed Grace Days</span>
                         <span className="text-xs font-semibold text-theme-body font-mono">{policy.graceDays} Days</span>
                       </div>
                       <div className="flex justify-between border-b border-theme-divider/60 pb-2">
                         <span className="text-xs text-theme-muted">Auto Block Sales on Limit</span>
                         <span className={`text-xs font-bold font-mono ${policy.autoBlockSales ? "text-rose-600" : "text-emerald-600"}`}>
                           {policy.autoBlockSales ? "Active" : "Disabled"}
                         </span>
                       </div>
                       <div className="flex justify-between border-b border-theme-divider/60 pb-2">
                         <span className="text-xs text-theme-muted">Credit Hold Status</span>
                         <span className={`text-xs font-bold font-mono ${policy.creditHold ? "text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded" : "text-emerald-600"}`}>
                           {policy.creditHold ? "Blocked" : "Clear"}
                         </span>
                       </div>
                       <div className="flex justify-between border-b border-theme-divider/60 pb-2">
                         <span className="text-xs text-theme-muted">Max Discount Allowed</span>
                         <span className="text-xs font-semibold text-theme-body font-mono">{policy.maxDiscountPercent}%</span>
                       </div>
                       <div className="flex justify-between">
                         <span className="text-xs text-theme-muted">Preferred Payment Mode</span>
                         <span className="text-xs font-semibold text-blue-600 font-mono">{policy.preferredPaymentMethod || "None"}</span>
                       </div>
                     </div>
                   </div>

                    {/* LEDGER DOCUMENTS SECTION */}
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-theme-muted uppercase tracking-wider font-mono">Ledger Documents (Invoices & Returns)</h3>
                      <div className="bg-theme-surface-2 border border-theme-divider rounded-xl overflow-hidden divide-y divide-theme-divider/60 font-sans">
                        {getSalesInvoices().filter(inv => inv.customerId === customer.id).map(inv => (
                          <div key={inv.id} className="p-3 flex justify-between items-center hover:bg-theme-surface-hover transition-colors">
                            <div>
                              <div className="text-xs font-semibold text-theme-body">{inv.invoiceNo}</div>
                              <div className="text-[10px] text-theme-muted font-mono">{inv.date}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold text-emerald-600 font-mono">₹{inv.grandTotal.toLocaleString('en-IN')}</div>
                              <span className="text-[9px] font-semibold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-mono">
                                {inv.status}
                              </span>
                            </div>
                          </div>
                        ))}
                        {getSalesReturns().filter(ret => {
                          const originalInv = getSalesInvoices().find(inv => inv.id === ret.originalInvoiceId);
                          return originalInv?.customerId === customer.id;
                        }).map(ret => (
                          <div key={ret.id} className="p-3 flex justify-between items-center hover:bg-theme-surface-hover transition-colors">
                            <div>
                              <div className="text-xs font-semibold text-rose-600">{ret.returnNo}</div>
                              <div className="text-[10px] text-theme-muted font-mono">Ref: {getSalesInvoices().find(inv => inv.id === ret.originalInvoiceId)?.invoiceNo || 'N/A'}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold text-rose-600 font-mono">-₹{ret.grandTotal.toLocaleString('en-IN')}</div>
                              <span className="text-[9px] font-semibold uppercase bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded font-mono">
                                {ret.status}
                              </span>
                            </div>
                          </div>
                        ))}
                        {getSalesInvoices().filter(inv => inv.customerId === customer.id).length === 0 &&
                         getSalesReturns().filter(ret => {
                           const originalInv = getSalesInvoices().find(inv => inv.id === ret.originalInvoiceId);
                           return originalInv?.customerId === customer.id;
                         }).length === 0 && (
                          <div className="p-4 text-center text-xs text-theme-muted">
                            No ledger transactions recorded.
                          </div>
                        )}
                      </div>
                    </div>
                 </>
               ) : (
                 /* TIMELINE ACTIVITY SECTION */
                 <div className="space-y-4 animate-in fade-in duration-200">
                   <div className="flex items-center justify-between">
                     <h3 className="text-[10px] font-bold text-theme-muted uppercase tracking-wider font-mono">
                       Document Activity Timeline
                     </h3>
                     <span className="text-[10px] font-semibold text-theme-muted font-mono">
                       {timelineActivities.length} Records
                     </span>
                   </div>

                   {loadingActivity ? (
                     <div className="py-12 flex flex-col items-center justify-center space-y-2 text-theme-muted text-xs">
                       <span className="material-symbols-outlined animate-spin text-blue-600">sync</span>
                       <span>Loading timeline...</span>
                     </div>
                   ) : timelineActivities.length === 0 ? (
                     <div className="py-12 text-center bg-theme-surface-2 border border-theme-divider rounded-xl">
                       <span className="material-symbols-outlined text-theme-muted text-3xl mb-2">history</span>
                       <p className="text-xs text-theme-muted">No recent Quotations, Orders, or Invoices found.</p>
                     </div>
                   ) : (
                     <div className="relative pl-6 border-l border-theme-divider space-y-6">
                       {timelineActivities.map((act) => (
                         <div key={`${act.type}-${act.id}`} className="relative">
                           {/* Left bullet marker */}
                           <span className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border border-theme-surface-1 flex items-center justify-center shadow-xs ${
                             act.type === "Quotation" ? "bg-blue-500" :
                             act.type === "Order" ? "bg-amber-500" :
                             "bg-emerald-500"
                           }`}>
                             <span className="material-symbols-outlined text-[10px] text-white font-bold">
                               {act.icon}
                             </span>
                           </span>

                           {/* Timeline Card */}
                           <div className="bg-theme-surface-2 border border-theme-divider hover:border-theme-muted transition-colors p-3.5 rounded-xl space-y-2.5">
                             <div className="flex justify-between items-start">
                               <div>
                                 <div className="flex items-center space-x-1.5">
                                   <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border font-mono ${act.colorClass}`}>
                                     {act.type}
                                   </span>
                                   <span className="text-xs font-bold text-theme-body font-mono">
                                     {act.docNo}
                                   </span>
                                 </div>
                                 <div className="text-[10px] text-theme-muted font-mono mt-1">
                                   {formatDate(act.date)}
                                 </div>
                               </div>
                               <div className="text-right space-y-1">
                                 <div className="text-xs font-extrabold text-theme-body font-mono">
                                   {formatCurrency(act.amount)}
                                 </div>
                                 <span className={`inline-block text-[9px] font-bold uppercase border px-1.5 py-0.5 rounded font-mono ${act.statusColorClass}`}>
                                   {act.status}
                                 </span>
                               </div>
                             </div>
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
               )
             ) : (
                 <>
                   {/* Generic Details Section */}
                   <div>
                      <h3 className="text-[10px] font-bold text-theme-muted uppercase tracking-wider font-mono mb-3">Core Details</h3>
                      <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-4 space-y-3">
                        {activePanel.entityType === 'invoice' ? (
                          <>
                            <div className="flex justify-between">
                              <span className="text-xs text-theme-muted">Invoice Date</span>
                              <span className="text-xs font-semibold text-theme-body font-mono">{invoice?.date || "Loading..."}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs text-theme-muted">Created At</span>
                              <span className="text-xs font-semibold text-theme-body font-mono">{invoice?.created_at ? new Date(invoice.created_at).toLocaleString("en-IN") : "Loading..."}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between">
                            <span className="text-xs text-theme-muted">Created</span>
                            <span className="text-xs font-semibold text-theme-body font-mono">Not available</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-xs text-theme-muted">Status</span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono uppercase">Active</span>
                        </div>
                        {activePanel.entityType === 'invoice' && (
                          <div className="flex justify-between">
                            <span className="text-xs text-theme-muted">Amount</span>
                            <span className="text-xs font-semibold text-theme-body font-mono">{invoice ? formatCurrency(Number(invoice.grand_total || 0)) : "Loading..."}</span>
                          </div>
                        )}
                      </div>
                   </div>

                   {/* Related Documents Section */}
                   <div>
                      <h3 className="text-[10px] font-bold text-theme-muted uppercase tracking-wider font-mono mb-3">Related Documents</h3>
                      <div className="space-y-2">
                         <button 
                            onClick={() => {
                              window.dispatchEvent(
                                new CustomEvent("smriti_navigate_module", {
                                  detail: { moduleId: "business-ledger" },
                                })
                              );
                              closePanel();
                            }}
                            className="w-full text-left bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider rounded-lg p-3 transition-colors group flex justify-between items-center cursor-pointer"
                         >
                            <div>
                              <div className="text-sm font-semibold text-theme-body group-hover:text-blue-600">View Ledger</div>
                              <div className="text-xs text-theme-muted">Financial transactions</div>
                            </div>
                            <span className="material-symbols-outlined text-theme-muted group-hover:text-blue-600">arrow_forward_ios</span>
                         </button>
                         <button 
                            onClick={() => {
                              window.dispatchEvent(
                                new CustomEvent("smriti_navigate_module", {
                                  detail: {
                                    moduleId: "stock-ledger",
                                    searchQuery: activePanel.entityId,
                                  },
                                })
                              );
                              closePanel();
                            }}
                            className="w-full text-left bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider rounded-lg p-3 transition-colors group flex justify-between items-center cursor-pointer"
                         >
                            <div>
                              <div className="text-sm font-semibold text-theme-body group-hover:text-blue-600">Stock Movement</div>
                              <div className="text-xs text-theme-muted">Inventory tracking</div>
                            </div>
                            <span className="material-symbols-outlined text-theme-muted group-hover:text-blue-600">arrow_forward_ios</span>
                         </button>
                      </div>
                   </div>
                 </>
               )}

            </SmritiScrollArea>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
