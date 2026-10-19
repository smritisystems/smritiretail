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

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  UserPlus,
  X,
  User,
  Building2,
  Phone,
  Mail,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
  CreditCard,
  ChevronRight,
  Zap
} from "lucide-react";
import { apiFetchV1 } from "../../../lib/apiFetchV1";
import { RetailCustomerRecord } from "../types";
import { DuplicateCheckResult } from "./types";

interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (createdCustomer: RetailCustomerRecord) => void;
  onNotification?: (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
}

export const CreateCustomerModal: React.FC<CreateCustomerModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  onNotification
}) => {
  // Form fields
  const [customerType, setCustomerType] = useState<"Retail" | "Corporate">("Retail");
  const [name, setName] = useState<string>("");
  const [mobile, setMobile] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [customerGroup, setCustomerGroup] = useState<string>("CG-Retail");
  const [priceGroup, setPriceGroup] = useState<string>("TI#Tech Infotech Ltd");

  // Corporate fields
  const [panNumber, setPanNumber] = useState<string>("");
  const [gstin, setGstin] = useState<string>("");
  const [creditLimit, setCreditLimit] = useState<string>("500000");
  const [creditDays, setCreditDays] = useState<string>("30");
  const [paymentTerm, setPaymentTerm] = useState<string>("Net 30");

  // Duplicate Check State
  const [dupCheckResult, setDupCheckResult] = useState<DuplicateCheckResult | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState<boolean>(false);
  const [allowDuplicateOverride, setAllowDuplicateOverride] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Focus ref
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setMobile("");
      setEmail("");
      setPanNumber("");
      setGstin("");
      setDupCheckResult(null);
      setAllowDuplicateOverride(false);
      setCustomerType("Retail");
      setCustomerGroup("CG-Retail");
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Adjust default group on type toggle
  const handleTypeChange = (newType: "Retail" | "Corporate") => {
    setCustomerType(newType);
    if (newType === "Corporate") {
      setCustomerGroup("CG-Corporate");
      setPriceGroup("CORP#Standard Corporate");
    } else {
      setCustomerGroup("CG-Retail");
      setPriceGroup("TI#Tech Infotech Ltd");
    }
    setDupCheckResult(null);
  };

  // Debounced Duplicate Detection
  const checkDuplicate = useCallback(async (currentMobile: string, currentGstin: string, currentName: string) => {
    const cleanMobile = currentMobile.replace(/\D/g, "");
    const cleanGstin = currentGstin.trim().toUpperCase();

    // Trigger only when reasonable length entered
    if (cleanMobile.length < 10 && cleanGstin.length < 15) {
      setDupCheckResult(null);
      return;
    }

    setIsCheckingDuplicate(true);
    try {
      const res = await apiFetchV1<DuplicateCheckResult>("/crm/customers/check-duplicate", {
        method: "POST",
        body: JSON.stringify({
          name: currentName.trim() || undefined,
          mobile: cleanMobile.length === 10 ? cleanMobile : undefined,
          gstin: cleanGstin.length === 15 ? cleanGstin : undefined
        })
      });
      setDupCheckResult(res);
    } catch (err) {
      // Duplicate check failover — non-blocking
      console.warn("[CreateCustomerModal] Duplicate check check failed:", err);
    } finally {
      setIsCheckingDuplicate(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mobile || gstin) {
        checkDuplicate(mobile, gstin, name);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [mobile, gstin, name, checkDuplicate]);

  if (!isOpen) return null;

  const isHardDuplicate = dupCheckResult?.decision === "HARD_DUPLICATE";
  const isPossibleDuplicate = dupCheckResult?.decision === "POSSIBLE_DUPLICATE";

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanName = name.trim();
    if (!cleanName) {
      onNotification?.("Validation Error", "Customer name is required.", "error");
      nameInputRef.current?.focus();
      return;
    }

    const cleanMobile = mobile.replace(/\D/g, "");
    if (!cleanMobile || cleanMobile.length !== 10) {
      onNotification?.("Validation Error", "A valid 10-digit mobile number is mandatory.", "error");
      return;
    }

    if (isHardDuplicate) {
      onNotification?.(
        "Account Exists",
        dupCheckResult?.reason || "A customer with this identity is already recorded in the system.",
        "error"
      );
      return;
    }

    if (isPossibleDuplicate && !allowDuplicateOverride) {
      onNotification?.(
        "Duplicate Review Required",
        "Please review the potential duplicate candidate or check the override authorization box.",
        "warning"
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const isCorp = customerType === "Corporate";
      const payload: any = {
        name: cleanName,
        mobile: cleanMobile,
        email: email.trim() || undefined,
        customer_group_id: isCorp ? "CG-Corporate" : customerGroup,
        customer_type: customerType,
        environment: customerType,
        price_group: priceGroup,
        status: "Active",
        tags: [customerType, isCorp ? "B2B" : "Individual"].filter(Boolean),
        allow_duplicate_override: allowDuplicateOverride
      };

      if (isCorp) {
        if (panNumber.trim()) payload.pan_number = panNumber.trim().toUpperCase();
        if (gstin.trim()) payload.gst_number = gstin.trim().toUpperCase();
        payload.payment_term = paymentTerm;
        payload.transit_days = 2;
        payload.flat_file_format = "GUI with Delimiter Format";
        payload.delimiter = ";";
        payload.credit_limit = Number(creditLimit) || 0;
        payload.credit_days = Number(creditDays) || 0;
      }

      // Authoritative Server-Side Customer Creation (generates code and internal UUID)
      const res = await apiFetchV1<any>("/crm/customers", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const newRecord: RetailCustomerRecord = {
        id: res.id || `cust-${Date.now()}`,
        code: res.code || `CUST-${Date.now()}`,
        name: res.name || cleanName,
        phone: res.mobile || cleanMobile,
        email: res.email || email.trim(),
        customerType: res.customer_type || customerType,
        environment: res.environment || customerType,
        customerGroupId: res.customer_group_id || payload.customer_group_id,
        customer_group_id: res.customer_group_id || payload.customer_group_id,
        priceGroup: priceGroup,
        gstin: res.gst_number || (isCorp ? gstin.trim().toUpperCase() : ""),
        panNumber: res.pan_number || (isCorp ? panNumber.trim().toUpperCase() : ""),
        religion: "Hindu",
        ethnicity: "Asian",
        ageGroup: ">=20 - <35",
        profession: "",
        profileNotes: "",
        companyCode: "001",
        flatFileFormat: "GUI with Delimiter Format",
        storeCode: "",
        billingStoreCode: "",
        shippingStoreCode: "",
        isTaxInclusive: true,
        is_tax_inclusive: true,
        pricingBasis: "MRP",
        pricing_basis: "MRP",
        allowPromotionsOnRate: false,
        allow_promotions_on_rate: false,
        delimiter: ";",
        buyingFactor: 1.0,
        sellingFactor: 1.0,
        mailingAddresses: [],
        isDependant: false,
        primaryAccountCode: "",
        primaryAccountName: "",
        applyParentMailingInfo: false,
        dependants: [],
        gender: "Female",
        dateOfBirth: "",
        isMarried: false,
        weddingAnniversary: "",
        loyaltyPgmId: "",
        loyaltyPgmCode: "",
        loyaltyTier: "Standard",
        loyaltyPointsBalance: 0,
        paymentCategory: "CASH",
        paymentTerm: isCorp ? paymentTerm : "Policy Not Configured",
        creditLimit: isCorp ? Number(creditLimit) || 0 : 0,
        creditDays: isCorp ? Number(creditDays) || 0 : 0,
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
        allowMiscReceipts: true,
        lstNumber: "",
        lstDate: "",
        cstNumber: "",
        cstDate: "",
        isPreSaleFormApplicable: false,
        preSaleFormName: "",
        isPostSaleFormApplicable: false,
        postSaleFormName: "",
        status: "Active",
        createdAt: new Date().toISOString().split("T")[0],
        updatedAt: new Date().toISOString().split("T")[0]
      };

      onNotification?.(
        "Customer Created",
        `New account "${newRecord.name}" (${newRecord.code}) created successfully.`,
        "success"
      );
      onCreated(newRecord);
      onClose();
    } catch (err: any) {
      console.error("[CreateCustomerModal] Create error:", err);
      const rawMsg = err?.detail?.reason || err?.detail?.message || err?.message || "Failed to create customer.";
      onNotification?.("Creation Failed", String(rawMsg), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-white dark:bg-[#1e222d] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-customer-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#00355f] text-white rounded-xl shadow-xs">
              <UserPlus size={18} />
            </div>
            <div>
              <h2 id="new-customer-title" className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                New Customer Account
              </h2>
              <p className="text-[11px] text-slate-500">
                Create retail shopper or corporate enterprise customer profile
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreateCustomer} className="flex-1 overflow-y-auto max-h-[75vh] p-6 space-y-5">
          {/* Step 1: Customer Type Selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              1. Customer Profile Type
            </label>
            <div className="grid grid-cols-2 gap-2.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
              <button
                type="button"
                onClick={() => handleTypeChange("Retail")}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                  customerType === "Retail"
                    ? "bg-white dark:bg-[#191c1e] text-[#00355f] dark:text-[#8ebdf9] shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <User size={15} />
                <span>Retail / Individual (Fast Path)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange("Corporate")}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition ${
                  customerType === "Corporate"
                    ? "bg-[#00355f] text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <Building2 size={15} />
                <span>Corporate / B2B Enterprise</span>
              </button>
            </div>
          </div>

          {/* Step 2: Essential Identity & Contact */}
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              2. Essential Identity & Contact
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Customer / Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  data-field-key="customer_name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={customerType === "Corporate" ? "e.g. Reliance Retail Limited" : "e.g. Ramesh Kumar Sharma"}
                  className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#00355f]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Mobile Number (10 Digits) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">+91</span>
                  <input
                    type="tel"
                    data-field-key="mobile_phone"
                    required
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))}
                    placeholder="9820012345"
                    className="w-full pl-11 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-[#00355f]"
                  />
                  {isCheckingDuplicate && (
                    <span className="absolute right-3 top-2.5">
                      <Loader2 size={14} className="animate-spin text-slate-400" />
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  data-field-key="email_address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com"
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#00355f]"
                />
              </div>
            </div>
          </div>

          {/* Real-time Duplicate Banner */}
          {dupCheckResult && (
            <div className="animate-in fade-in duration-200">
              {isHardDuplicate ? (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl space-y-1.5">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-xs">
                    <ShieldAlert size={15} />
                    <span>Duplicate Account Detected</span>
                  </div>
                  <p className="text-xs text-red-800 dark:text-red-200 leading-relaxed">
                    {dupCheckResult.reason}
                  </p>
                  {dupCheckResult.existing_customer && (
                    <div className="p-2 bg-white/70 dark:bg-slate-900/60 rounded-lg text-[11px] font-mono text-red-900 dark:text-red-200 space-y-0.5">
                      <div>Existing Account: <strong>{dupCheckResult.existing_customer.name}</strong></div>
                      <div>Code: {dupCheckResult.existing_customer.code} | Status: {dupCheckResult.existing_customer.status}</div>
                    </div>
                  )}
                </div>
              ) : isPossibleDuplicate ? (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                    <AlertCircle size={15} />
                    <span>Possible Duplicate Found</span>
                  </div>
                  <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                    {dupCheckResult.reason}
                  </p>
                  <label className="flex items-center gap-2 pt-1 text-xs font-semibold text-amber-900 dark:text-amber-200 cursor-pointer">
                    <input
                      type="checkbox"
                      data-field-key="allow_duplicate_override"
                      checked={allowDuplicateOverride}
                      onChange={(e) => setAllowDuplicateOverride(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Verified: This is a distinct customer (Override Duplicate Warning)</span>
                  </label>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                  <CheckCircle2 size={14} />
                  <span>Identity clear. Mobile and credentials are distinct.</span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Conditional Corporate / B2B Fields */}
          {customerType === "Corporate" && (
            <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-[#00355f] dark:text-[#8ebdf9] font-bold text-xs uppercase tracking-wider">
                <Building2 size={14} />
                <span>3. Corporate & Statutory Details</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Company PAN (10 Characters)
                  </label>
                  <input
                    type="text"
                    data-field-key="pan_number"
                    maxLength={10}
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                    placeholder="AAACR9121R"
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono uppercase focus:outline-hidden focus:ring-2 focus:ring-[#00355f]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Primary State GSTIN (15 Digits)
                  </label>
                  <input
                    type="text"
                    data-field-key="gst_number"
                    maxLength={15}
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="27AAACR9121R1Z5"
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono uppercase focus:outline-hidden focus:ring-2 focus:ring-[#00355f]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Credit Limit (₹)
                  </label>
                  <input
                    type="number"
                    data-field-key="credit_limit"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="500000"
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-[#00355f]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={paymentTerm}
                    onChange={(e) => setPaymentTerm(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-[#00355f]"
                  >
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 45">Net 45 Days</option>
                    <option value="Net 60">Net 60 Days</option>
                    <option value="Advance">Immediate / Advance</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Server-Side Generation Notice */}
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
            <Zap size={13} className="text-amber-500" />
            <span>Customer Code & Canonical UUID will be generated authoritative server-side by SMRITI IdentityEngine.</span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isHardDuplicate || (isPossibleDuplicate && !allowDuplicateOverride)}
              className="px-5 py-2 bg-[#00355f] dark:bg-[#8ebdf9] text-white dark:text-[#001c37] hover:bg-[#0f4c81] rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              <span>{customerType === "Corporate" ? "Create Corporate Account" : "Create Customer (Fast Path)"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
