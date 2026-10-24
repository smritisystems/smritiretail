/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-19
 * Modified     : 2026-10-19
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Capability    : withCapability("customer.crud", "CRM")
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Globe2,
  ShieldCheck,
  ShieldAlert,
  Building2,
  CheckCircle2,
  Link2,
  Plus,
  Loader2,
  X,
  CreditCard,
  FileText,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { apiFetchV1 } from "../../../lib/apiFetchV1";
import { RetailCustomerRecord, CustomerCompanyRelationship } from "../types";

export interface EnterpriseCustomerSearchResult {
  id: string;
  uuid?: string;
  code?: string;
  name: string;
  pan?: string;
  pan_number?: string;
  gstin?: string;
  gst_number?: string;
  mobile?: string;
  email?: string;
  city?: string;
  status?: string;
  customer_type?: string;
  customerType?: string;
  environment?: string;
  company_id?: string;
  companyId?: string;
  company_relationships?: CustomerCompanyRelationship[];
  companyRelationships?: CustomerCompanyRelationship[];
  outstanding?: number;
  credit_balance?: number;
}

interface EnterpriseCustomerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: RetailCustomerRecord) => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
  currentUser?: { role?: string; name?: string } | null;
  currentCompanyId?: string;
  currentCompanyCode?: string;
}

const PRIVILEGED_ROLES = [
  "SYSADMIN",
  "ADMIN",
  "MANAGER",
  "GROUP_CFO",
  "CENTRAL_CREDIT_MANAGER",
  "CORPORATE_AUDITOR"
];

export const EnterpriseCustomerSearchModal: React.FC<EnterpriseCustomerSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectCustomer,
  onNotification,
  currentUser,
  currentCompanyId = "COMP-001",
  currentCompanyCode = "001"
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [results, setResults] = useState<EnterpriseCustomerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [linkingCustomerId, setLinkingCustomerId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Model C fast relationship linking form state
  const [linkCreditLimit, setLinkCreditLimit] = useState<string>("500000");
  const [linkCreditDays, setLinkCreditDays] = useState<string>("30");
  const [linkCreditHold, setLinkCreditHold] = useState<boolean>(false);
  const [linkCustomerGroup, setLinkCustomerGroup] = useState<string>("CG-Corporate");
  const [isSubmittingLink, setIsSubmittingLink] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check RBAC role authorization
  const isAuthorized = useMemo(() => {
    if (!currentUser?.role) return true; // Default permissive in development mode
    const roleUpper = currentUser.role.trim().toUpperCase();
    return PRIVILEGED_ROLES.includes(roleUpper) || roleUpper.includes("ADMIN") || roleUpper.includes("SYSADMIN");
  }, [currentUser]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setResults([]);
      setSelectedCustomerId(null);
      setLinkingCustomerId(null);
      setErrorMessage(null);
      setIsSearching(false);
      setIsSubmittingLink(false);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Debounced search querying privileged enterprise search endpoint
  useEffect(() => {
    if (!isOpen || !isAuthorized) return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      setErrorMessage(null);
      try {
        const data = await apiFetchV1<EnterpriseCustomerSearchResult[]>(
          `/crm/enterprise/customers/search?q=${encodeURIComponent(trimmed)}&limit=20`
        );
        setResults(data || []);
      } catch (err: any) {
        console.error("[Enterprise Search] Query error:", err);
        setErrorMessage(err?.detail?.message || err?.message || "Failed to execute cross-company discovery query.");
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, isAuthorized]);

  if (!isOpen) return null;

  // Determine if a customer has an existing relationship with the active operating company
  const checkHasActiveRelationship = (cust: EnterpriseCustomerSearchResult): boolean => {
    const rels = cust.company_relationships || cust.companyRelationships || [];
    return rels.some(
      r =>
        (r.company_id && r.company_id === currentCompanyId) ||
        (r.companyId && r.companyId === currentCompanyId) ||
        (r.status === "Active" && (r.company_id === currentCompanyId || r.companyId === currentCompanyId))
    );
  };

  // Convert EnterpriseCustomerSearchResult to standard RetailCustomerRecord
  const formatAsRetailRecord = (cust: EnterpriseCustomerSearchResult): RetailCustomerRecord => {
    const cPan = cust.pan_number || cust.pan || "";
    const cGst = cust.gst_number || cust.gstin || "";
    const rels = cust.company_relationships || cust.companyRelationships || [];
    return {
      id: cust.id,
      code: cust.code || cust.id,
      name: cust.name,
      phone: cust.mobile || "",
      email: cust.email || "",
      panNumber: cPan,
      gstin: cGst,
      lstNumber: "",
      lstDate: "",
      cstNumber: "",
      cstDate: "",
      religion: "Hindu",
      ethnicity: "Asian",
      ageGroup: ">=20 - <35",
      profession: "Corporate Enterprise",
      customerType: cust.customer_type || cust.customerType || "Corporate",
      profileNotes: "",
      companyCode: currentCompanyCode,
      environment: cust.environment || "Corporate",
      flatFileFormat: "GUI with Delimiter Format",
      isTaxInclusive: true,
      delimiter: ";",
      buyingFactor: 1.0,
      sellingFactor: 1.0,
      isDependant: false,
      primaryAccountCode: "",
      primaryAccountName: "",
      applyParentMailingInfo: false,
      dependants: [],
      gender: "Male",
      dateOfBirth: "",
      isMarried: false,
      weddingAnniversary: "",
      loyaltyPgmId: "",
      loyaltyPgmCode: "",
      loyaltyTier: "Standard",
      loyaltyPointsBalance: 0,
      paymentCategory: "CREDIT",
      paymentTerm: "Net 30 Days",
      creditLimit: parseFloat(linkCreditLimit) || 500000,
      creditDays: parseInt(linkCreditDays, 10) || 30,
      creditUsed: 0,
      transportMode: "By-Road",
      transportCode: "VRL",
      transitDays: 2,
      bankCode: "",
      bankLocation: "",
      retailFactor: 1.0,
      dealerFactor: 0.85,
      destinationTaxType: "318#GST_RETAIL",
      allowCashBill: true,
      allowDcGen: false,
      allowCreditInvoice: true,
      allowMiscIssue: false,
      allowMiscReceipts: false,
      isPreSaleFormApplicable: false,
      preSaleFormName: "",
      isPostSaleFormApplicable: false,
      postSaleFormName: "",
      status: (cust.status === "Inactive" || cust.status === "Blocked" || cust.status === "Suspended") ? cust.status : "Active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      priceGroup: "CORP#Standard Corporate",
      customerGroupId: linkCustomerGroup || "CG-Corporate",
      customer_group_id: linkCustomerGroup || "CG-Corporate",
      companyRelationships: rels,
      mailingAddresses: [
        {
          code: "001",
          addressType: "mailing",
          contactPerson: cust.name,
          address1: "Corporate Headquarters",
          address2: "",
          address3: "",
          address4: "",
          address5: "",
          locality: "",
          city: cust.city || "Mumbai",
          postalCode: "400001",
          state: "Maharashtra",
          zone: "West",
          country: "India",
          officePhone: "",
          homePhone: "",
          mobilePhone: cust.mobile || "",
          faxNumber: "",
          email1: cust.email || "",
          email2: "",
          email3: "",
          isDefault: true
        }
      ]
    };
  };

  // Handle direct selection for customers already linked to current company
  const handleSelectDirect = (cust: EnterpriseCustomerSearchResult) => {
    const record = formatAsRetailRecord(cust);
    onSelectCustomer(record);
    onNotification?.(
      "Customer Record Loaded",
      `Loaded '${cust.name}' (${cust.code || cust.id}) from enterprise directory into active workspace.`,
      "info"
    );
    onClose();
  };

  // Handle creating Model C relationship to link customer to current company
  const handleConfirmModelCLinking = async (cust: EnterpriseCustomerSearchResult) => {
    setIsSubmittingLink(true);
    setErrorMessage(null);
    try {
      const payload = {
        company_id: currentCompanyId,
        credit_limit: parseFloat(linkCreditLimit) || 0,
        credit_days: parseInt(linkCreditDays, 10) || 0,
        credit_hold: linkCreditHold,
        customer_group_id: linkCustomerGroup || "CG-Corporate"
      };

      const newRel = await apiFetchV1<CustomerCompanyRelationship>(
        `/crm/customers/${cust.id}/company-relationships`,
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      );

      const updatedRels = [...(cust.company_relationships || []), newRel];
      const updatedCust: EnterpriseCustomerSearchResult = {
        ...cust,
        company_relationships: updatedRels,
        companyRelationships: updatedRels
      };

      onNotification?.(
        "Commercial Terms Established",
        `Successfully linked '${cust.name}' to Company (${currentCompanyId}) with Credit Limit ₹${(parseFloat(linkCreditLimit) || 0).toLocaleString("en-IN")}.`,
        "success"
      );

      const record = formatAsRetailRecord(updatedCust);
      onSelectCustomer(record);
      onClose();
    } catch (err: any) {
      console.error("[Enterprise Linking] Error:", err);
      const msg = err?.detail?.message || err?.message || "Failed to establish Model C commercial relationship.";
      setErrorMessage(String(msg));
      onNotification?.("Model C Linking Failed", String(msg), "error");
    } finally {
      setIsSubmittingLink(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        data-testid="enterprise-customer-search-modal"
      >
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Globe2 size={20} className="stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                Privileged Cross-Company Customer Search
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                  BD-4
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Discover enterprise customers across all group operating companies and link via Model C terms.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            title="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm flex-1">
          {/* Statutory WORM Audit Banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs flex items-start gap-2.5 text-slate-600 dark:text-slate-300">
            <ShieldCheck size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Statutory Governance & Compliance Notice (BD-4):
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Every enterprise query is cryptographically logged in <code className="font-mono">compliance_immutable_audit_logs</code> with
                user credentials, search keywords, and SHA-256 tamper-evident payload verification.
              </p>
            </div>
          </div>

          {/* RBAC Warning if user lacks authorization */}
          {!isAuthorized && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
              <ShieldAlert size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Privileged Role Required</strong>
                <span>
                  Your active session does not carry enterprise cross-company search authorization. Cross-company discovery is
                  reserved for System Administrators, Group CFOs, and Central Credit Managers.
                </span>
              </div>
            </div>
          )}

          {/* Search Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Enterprise Tenant Customer Query
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                disabled={!isAuthorized}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search across all companies by Customer Name, Code, PAN, Mobile, or GSTIN..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
              {isSearching && (
                <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-500 animate-spin" />
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 px-1">
              <span>Type at least 2 characters to initiate group search.</span>
              <span>Active Company: <strong className="font-mono text-slate-700 dark:text-slate-300">{currentCompanyId}</strong></span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Results List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
              <span>Search Results ({results.length})</span>
            </div>

            {results.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 dark:text-slate-500 space-y-1">
                {searchQuery.trim().length >= 2 ? (
                  isSearching ? (
                    <div className="flex items-center justify-center gap-2 text-xs text-indigo-500 font-medium">
                      <Loader2 size={16} className="animate-spin" />
                      <span>Scanning enterprise group customer registries...</span>
                    </div>
                  ) : (
                    <span>No customer identities found matching "{searchQuery}" in tenant directory.</span>
                  )
                ) : (
                  <span>Enter a search term above to perform live multi-company lookup.</span>
                )}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {results.map((cust) => {
                  const hasActiveRel = checkHasActiveRelationship(cust);
                  const isLinking = linkingCustomerId === cust.id;
                  const cPan = cust.pan_number || cust.pan || "";
                  const cGst = cust.gst_number || cust.gstin || "";
                  const rels = cust.company_relationships || cust.companyRelationships || [];

                  return (
                    <div
                      key={cust.id}
                      className={`p-4 rounded-xl border transition ${
                        hasActiveRel
                          ? "bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800"
                          : "bg-indigo-50/30 dark:bg-indigo-950/10 border-indigo-200/80 dark:border-indigo-900/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                              {cust.name}
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                              {cust.code || cust.id}
                            </span>
                            {cPan && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                                PAN: {cPan}
                              </span>
                            )}
                            {hasActiveRel ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                <CheckCircle2 size={11} /> Linked in Current Company
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                                <Globe2 size={11} /> Discovered in Group
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-4 flex-wrap">
                            {cGst && <span>GSTIN: <strong className="font-mono text-slate-700 dark:text-slate-300">{cGst}</strong></span>}
                            {cust.mobile && <span>Mobile: <strong>{cust.mobile}</strong></span>}
                            {cust.email && <span>Email: <strong>{cust.email}</strong></span>}
                            {cust.city && <span>City: <strong>{cust.city}</strong></span>}
                          </div>

                          {/* Existing Model C Relationships across group */}
                          <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Building2 size={12} /> Commercial Terms:
                            </span>
                            {rels.length > 0 ? (
                              rels.map((r, rIdx) => (
                                <span
                                  key={r.id || rIdx}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                >
                                  {r.company_id || r.companyId}: Limit ₹{Number(r.credit_limit || r.creditLimit || 0).toLocaleString("en-IN")} ({r.credit_days || r.creditDays || 0}d)
                                </span>
                              ))
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">No existing company relationships</span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="shrink-0">
                          {hasActiveRel ? (
                            <button
                              type="button"
                              onClick={() => handleSelectDirect(cust)}
                              className="px-3.5 py-1.5 text-xs font-bold rounded-xl text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 flex items-center gap-1.5 transition shadow-xs"
                            >
                              <span>Open Record</span>
                              <ArrowRight size={13} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setLinkingCustomerId(isLinking ? null : cust.id);
                                setLinkCreditLimit("500000");
                                setLinkCreditDays("30");
                                setLinkCreditHold(false);
                                setLinkCustomerGroup("CG-Corporate");
                              }}
                              className="px-3.5 py-1.5 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 flex items-center gap-1.5 transition shadow-xs"
                            >
                              <Link2 size={13} />
                              <span>{isLinking ? "Cancel" : "Link (Model C)"}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline Fast Model C Linking Panel */}
                      {isLinking && !hasActiveRel && (
                        <div className="mt-4 pt-3.5 border-t border-indigo-200/80 dark:border-indigo-900/60 space-y-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                              <CreditCard size={14} /> Establish Model C Commercial Terms for Company ({currentCompanyId})
                            </span>
                            <span className="text-[10px] text-slate-400">Independent Legal Entity Terms</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                Credit Limit (₹)
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={linkCreditLimit}
                                onChange={(e) => setLinkCreditLimit(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                Payment Terms (Days)
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={linkCreditDays}
                                onChange={(e) => setLinkCreditDays(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                Customer Group
                              </label>
                              <input
                                type="text"
                                value={linkCustomerGroup}
                                onChange={(e) => setLinkCustomerGroup(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={linkCreditHold}
                                onChange={(e) => setLinkCreditHold(e.target.checked)}
                                className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                                Put on Credit Hold initially
                              </span>
                            </label>

                            <button
                              type="button"
                              onClick={() => handleConfirmModelCLinking(cust)}
                              disabled={isSubmittingLink}
                              className="px-4 py-1.5 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-xs transition"
                            >
                              {isSubmittingLink ? (
                                <>
                                  <Loader2 size={13} className="animate-spin" />
                                  <span>Establishing Terms...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 size={13} />
                                  <span>Confirm Model C Linking</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Building2 size={14} className="text-indigo-500" />
            <span>Model C Architecture: Tenant-Level Master Identity with Multi-Company Terms</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
