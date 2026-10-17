/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { 
  X, Printer, FileText, FileSpreadsheet, Check, 
  Building2, ShieldCheck, MapPin, Users, CreditCard, 
  Clock, Award, CheckSquare, Square, Info
} from "lucide-react";
import { VendorDetail } from "../../types/vendor.ts";
import { withCapability } from "../../types/architecture.ts";

interface VendorPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: VendorDetail | null;
  initialWithData?: boolean;
}

const VendorPrintModalBase: React.FC<VendorPrintModalProps> = ({
  isOpen,
  onClose,
  vendor,
  initialWithData = true,
}) => {
  const [withData, setWithData] = useState<boolean>(initialWithData && Boolean(vendor));
  const [includeBanking, setIncludeBanking] = useState<boolean>(true);
  const [includeDeclaration, setIncludeDeclaration] = useState<boolean>(true);
  const [tenantName, setTenantName] = useState<string>("Tattly Threads");
  const [branchName, setBranchName] = useState<string>("Main Corporate Branch");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cName = localStorage.getItem("smriti_company_name");
      const bName = localStorage.getItem("smriti_branch_name");
      if (cName) setTenantName(cName);
      if (bName) setBranchName(bName);
    }
  }, []);

  useEffect(() => {
    if (vendor && initialWithData) {
      setWithData(true);
    } else if (!vendor) {
      setWithData(false);
    }
  }, [vendor, initialWithData]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const currentDate = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const currentTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Reusable Blank Box for Character Inputs (PAN, GSTIN, Bank A/c, IFSC)
  const renderCharBoxes = (count: number, label?: string, filledStr?: string) => {
    const chars = filledStr ? filledStr.split("").slice(0, count) : [];
    return (
      <div className="flex flex-col">
        {label && <span className="text-[9px] font-semibold text-slate-600 mb-0.5">{label}</span>}
        <div className="flex items-center space-x-1">
          {Array.from({ length: count }).map((_, idx) => (
            <div
              key={idx}
              className="w-5 h-6 border border-slate-400 bg-slate-50 flex items-center justify-center font-mono text-[11px] font-bold text-slate-900 uppercase"
            >
              {chars[idx] || ""}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const printableDocument = (
    <div className="vendor-printable-sheet bg-white text-slate-900 p-8 max-w-[820px] mx-auto min-h-[1120px] text-[11px] font-sans leading-relaxed shadow-sm">
      {/* ─────────────────── DOCUMENT HEADER ─────────────────── */}
      <div className="border-b-2 border-slate-900 pb-3 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-base font-black tracking-wider text-indigo-900">
                SMRITI RETAIL OS
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 font-mono border border-slate-300 font-bold">
                ENTERPRISE ERP
              </span>
            </div>
            <h1 className="text-lg font-black text-slate-950 uppercase tracking-tight mt-1">
              {tenantName}
            </h1>
            <p className="text-[10px] text-slate-600">
              Procurement & Vendor Compliance Division • {branchName}
            </p>
          </div>

          <div className="text-right text-[10px] font-mono space-y-0.5">
            <div className="font-bold text-slate-800">
              FORM REF: {withData && vendor ? `KYC-VEND-${vendor.code}` : "SMRITI-KYC-BLANK-V2"}
            </div>
            <div className="text-slate-500">Date: {currentDate} {currentTime}</div>
            <div className="text-slate-500">
              Mode: {withData && vendor ? "Verified Master Record" : "Standard Blank Onboarding"}
            </div>
          </div>
        </div>

        {/* Title Banner */}
        <div className="mt-3 py-1.5 px-3 bg-slate-900 text-white flex items-center justify-between rounded-xs">
          <span className="font-bold text-xs uppercase tracking-wider">
            {withData && vendor
              ? "Universal Vendor Registration & Statutory KYC Dossier"
              : "Vendor Onboarding & Statutory KYC Registration Form"}
          </span>
          {withData && vendor && (
            <span className="font-mono text-[10px] bg-indigo-600 px-2 py-0.5 rounded font-bold">
              CODE: {vendor.code} • STATUS: {vendor.status}
            </span>
          )}
        </div>
      </div>

      {/* ─────────────────── SECTION 1: BUSINESS IDENTITY ─────────────────── */}
      <div className="mb-4">
        <div className="bg-slate-100 px-2.5 py-1 border-l-4 border-indigo-600 font-bold text-[11px] text-slate-900 uppercase tracking-wider mb-2">
          1. General Business Entity Identity
        </div>

        <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
          <tbody>
            <tr>
              <td className="border border-slate-300 bg-slate-50 p-2 font-semibold w-1/4">Legal Business Name</td>
              <td className="border border-slate-300 p-2 font-bold w-1/4" colSpan={3}>
                {withData && vendor ? (
                  vendor.legalName
                ) : (
                  <div className="h-5 border-b border-dotted border-slate-400"></div>
                )}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 bg-slate-50 p-2 font-semibold">Trade / Brand Name</td>
              <td className="border border-slate-300 p-2" colSpan={3}>
                {withData && vendor ? (
                  vendor.tradeName || vendor.legalName
                ) : (
                  <div className="h-5 border-b border-dotted border-slate-400"></div>
                )}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 bg-slate-50 p-2 font-semibold">Constitution of Entity</td>
              <td className="border border-slate-300 p-2">
                {withData && vendor ? (
                  <span className="font-mono font-bold text-indigo-900">{vendor.partyType || "ORGANIZATION"}</span>
                ) : (
                  <span className="text-[9.5px] text-slate-700">
                    [ ] Proprietorship &nbsp; [ ] Partnership &nbsp; [ ] Pvt Ltd &nbsp; [ ] Public Ltd &nbsp; [ ] LLP
                  </span>
                )}
              </td>
              <td className="border border-slate-300 bg-slate-50 p-2 font-semibold">Supplier Category</td>
              <td className="border border-slate-300 p-2">
                {withData && vendor ? (
                  <span className="font-bold text-slate-800">
                    {vendor.commercial?.supplierType || "DISTRIBUTOR"}
                  </span>
                ) : (
                  <span className="text-[9.5px] text-slate-700">
                    [ ] Manufacturer &nbsp; [ ] Distributor &nbsp; [ ] Wholesaler &nbsp; [ ] Service
                  </span>
                )}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 bg-slate-50 p-2 font-semibold">Primary Contact Phone</td>
              <td className="border border-slate-300 p-2 font-mono">
                {withData && vendor ? (
                  vendor.phone || vendor.mobile || "N/A"
                ) : (
                  <div className="h-4 border-b border-dotted border-slate-400"></div>
                )}
              </td>
              <td className="border border-slate-300 bg-slate-50 p-2 font-semibold">Official Email</td>
              <td className="border border-slate-300 p-2 font-mono">
                {withData && vendor ? (
                  vendor.email || "N/A"
                ) : (
                  <div className="h-4 border-b border-dotted border-slate-400"></div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ─────────────────── SECTION 2: STATUTORY & TAX ─────────────────── */}
      <div className="mb-4">
        <div className="bg-slate-100 px-2.5 py-1 border-l-4 border-indigo-600 font-bold text-[11px] text-slate-900 uppercase tracking-wider mb-2">
          2. Statutory & Tax Registrations
        </div>

        <div className="border border-slate-300 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            {/* GSTIN */}
            <div>
              <span className="text-[9.5px] font-bold text-slate-700 block mb-1">
                Goods & Services Tax Identification Number (GSTIN)
              </span>
              {renderCharBoxes(15, undefined, withData && vendor ? (vendor.gstin || vendor.compliance?.gstin) : undefined)}
              {withData && vendor?.gstin && (
                <span className="text-[9px] text-emerald-700 font-bold mt-1 inline-block">
                  ✓ Verified GST Profile
                </span>
              )}
            </div>

            {/* PAN */}
            <div>
              <span className="text-[9.5px] font-bold text-slate-700 block mb-1">
                Permanent Account Number (PAN)
              </span>
              {renderCharBoxes(10, undefined, withData && vendor ? (vendor.pan || vendor.compliance?.pan) : undefined)}
              {withData && vendor?.pan && (
                <span className="text-[9px] text-emerald-700 font-bold mt-1 inline-block">
                  ✓ Verified Corporate PAN
                </span>
              )}
            </div>
          </div>

          {/* MSME & TDS Parameters */}
          <table className="w-full border-collapse border border-slate-300 text-[10.5px] mt-2">
            <tbody>
              <tr>
                <td className="border border-slate-300 bg-slate-50 p-2 font-semibold w-1/4">MSME / Udyam Reg. No.</td>
                <td className="border border-slate-300 p-2 font-mono w-1/4">
                  {withData && vendor ? (
                    vendor.compliance?.msmeRegistrationNo || vendor.commercial?.msmeRegistrationNo || "NOT APPLICABLE"
                  ) : (
                    <div className="h-4 border-b border-dotted border-slate-400"></div>
                  )}
                </td>
                <td className="border border-slate-300 bg-slate-50 p-2 font-semibold w-1/4">MSME Classification</td>
                <td className="border border-slate-300 p-2 w-1/4">
                  {withData && vendor ? (
                    <span className="font-bold">
                      {vendor.compliance?.msmeCategory || vendor.commercial?.msmeCategory || "NOT_APPLICABLE"}
                    </span>
                  ) : (
                    <span className="text-[9.5px]">
                      [ ] Micro &nbsp; [ ] Small &nbsp; [ ] Medium &nbsp; [ ] N/A
                    </span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-300 bg-slate-50 p-2 font-semibold">TDS Section Applicable</td>
                <td className="border border-slate-300 p-2 font-mono">
                  {withData && vendor ? (
                    `${vendor.commercial?.tdsSection || "194Q"} (${vendor.commercial?.tdsRate ?? 0.1}%)`
                  ) : (
                    <span className="text-[9.5px]">
                      [ ] 194Q (Goods) &nbsp; [ ] 194C (Contracts) &nbsp; [ ] Other: _____
                    </span>
                  )}
                </td>
                <td className="border border-slate-300 bg-slate-50 p-2 font-semibold">Tax Treatment Scheme</td>
                <td className="border border-slate-300 p-2">
                  {withData && vendor ? (
                    vendor.commercial?.taxTreatment || "REGISTERED_REGULAR"
                  ) : (
                    <span className="text-[9.5px]">
                      [ ] Regular &nbsp; [ ] Composition &nbsp; [ ] SEZ &nbsp; [ ] Unregistered
                    </span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────── SECTION 3: ADDRESSES & GODOWNS ─────────────────── */}
      <div className="mb-4">
        <div className="bg-slate-100 px-2.5 py-1 border-l-4 border-indigo-600 font-bold text-[11px] text-slate-900 uppercase tracking-wider mb-2">
          3. Registered Office & Dispatch Locations
        </div>

        <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="border border-slate-300 p-2 w-28">Type</th>
              <th className="border border-slate-300 p-2">Complete Address</th>
              <th className="border border-slate-300 p-2 w-28">City & State</th>
              <th className="border border-slate-300 p-2 w-20">PIN Code</th>
              <th className="border border-slate-300 p-2 w-28">GSTIN at Premise</th>
            </tr>
          </thead>
          <tbody>
            {withData && vendor && vendor.addresses && vendor.addresses.length > 0 ? (
              vendor.addresses.map((addr, idx) => (
                <tr key={idx}>
                  <td className="border border-slate-300 p-2 font-bold text-indigo-950">
                    {addr.addressType} {addr.isPrimary && "(PRIMARY)"}
                  </td>
                  <td className="border border-slate-300 p-2">
                    {addr.addressLine1} {addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
                  </td>
                  <td className="border border-slate-300 p-2">
                    {addr.city}{addr.state ? `, ${addr.state}` : ""}
                  </td>
                  <td className="border border-slate-300 p-2 font-mono">{addr.pincode || "—"}</td>
                  <td className="border border-slate-300 p-2 font-mono text-[9.5px]">{addr.gstin || vendor.gstin || "—"}</td>
                </tr>
              ))
            ) : withData && vendor && (vendor.addressLine1 || vendor.city) ? (
              <tr>
                <td className="border border-slate-300 p-2 font-bold">REGISTERED</td>
                <td className="border border-slate-300 p-2">{vendor.addressLine1 || "Registered Address"}</td>
                <td className="border border-slate-300 p-2">{vendor.city}{vendor.state ? `, ${vendor.state}` : ""}</td>
                <td className="border border-slate-300 p-2 font-mono">{vendor.pincode || "—"}</td>
                <td className="border border-slate-300 p-2 font-mono">{vendor.gstin || "—"}</td>
              </tr>
            ) : (
              <>
                <tr>
                  <td className="border border-slate-300 p-2 font-bold bg-slate-50">Registered Office</td>
                  <td className="border border-slate-300 p-2 h-10"></td>
                  <td className="border border-slate-300 p-2"></td>
                  <td className="border border-slate-300 p-2"></td>
                  <td className="border border-slate-300 p-2"></td>
                </tr>
                <tr>
                  <td className="border border-slate-300 p-2 font-bold bg-slate-50">Warehouse / Godown</td>
                  <td className="border border-slate-300 p-2 h-10"></td>
                  <td className="border border-slate-300 p-2"></td>
                  <td className="border border-slate-300 p-2"></td>
                  <td className="border border-slate-300 p-2"></td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* ─────────────────── SECTION 4: KEY CONTACTS ─────────────────── */}
      <div className="mb-4">
        <div className="bg-slate-100 px-2.5 py-1 border-l-4 border-indigo-600 font-bold text-[11px] text-slate-900 uppercase tracking-wider mb-2">
          4. Key Personnel & Authorized Contacts Directory
        </div>

        <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="border border-slate-300 p-2 w-32">Role / Category</th>
              <th className="border border-slate-300 p-2">Contact Name</th>
              <th className="border border-slate-300 p-2 w-32">Designation / Dept</th>
              <th className="border border-slate-300 p-2 w-28">Mobile Number</th>
              <th className="border border-slate-300 p-2">Email Address</th>
            </tr>
          </thead>
          <tbody>
            {withData && vendor && vendor.contacts && vendor.contacts.length > 0 ? (
              vendor.contacts.map((c, idx) => (
                <tr key={idx}>
                  <td className="border border-slate-300 p-2 font-bold text-slate-800">
                    {c.contactCategory} {c.isPrimary && "(PRIMARY)"}
                  </td>
                  <td className="border border-slate-300 p-2 font-semibold">{c.contactName}</td>
                  <td className="border border-slate-300 p-2">{c.designation || c.department || "—"}</td>
                  <td className="border border-slate-300 p-2 font-mono">{c.mobile || c.phone || "—"}</td>
                  <td className="border border-slate-300 p-2 font-mono text-[9.5px]">{c.email || "—"}</td>
                </tr>
              ))
            ) : (
              <>
                <tr>
                  <td className="border border-slate-300 p-2 font-semibold bg-slate-50">Primary / Proprietor</td>
                  <td className="border border-slate-300 p-2 h-7"></td>
                  <td className="border border-slate-300 p-2"></td>
                  <td className="border border-slate-300 p-2"></td>
                  <td className="border border-slate-300 p-2"></td>
                </tr>
                <tr>
                  <td className="border border-slate-300 p-2 font-semibold bg-slate-50">Accounts & Billing</td>
                  <td className="border border-slate-300 p-2 h-7"></td>
                  <td className="border border-slate-300 p-2"></td>
                  <td className="border border-slate-300 p-2"></td>
                  <td className="border border-slate-300 p-2"></td>
                </tr>
                <tr>
                  <td className="border border-slate-300 p-2 font-semibold bg-slate-50">Dispatch & Logistics</td>
                  <td className="border border-slate-300 p-2 h-7"></td>
                  <td className="border border-slate-300 p-2"></td>
                  <td className="border border-slate-300 p-2"></td>
                  <td className="border border-slate-300 p-2"></td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* ─────────────────── SECTION 5: COMMERCIAL TERMS ─────────────────── */}
      <div className="mb-4">
        <div className="bg-slate-100 px-2.5 py-1 border-l-4 border-indigo-600 font-bold text-[11px] text-slate-900 uppercase tracking-wider mb-2">
          5. Commercial Parameters & Settlement Terms
        </div>

        <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
          <tbody>
            <tr>
              <td className="border border-slate-300 bg-slate-50 p-2 font-semibold w-1/4">Agreed Payment Terms</td>
              <td className="border border-slate-300 p-2 font-bold w-1/4">
                {withData && vendor ? (
                  `${vendor.commercial?.paymentTermsDays ?? 30} Days (Net)`
                ) : (
                  <span>_____ Days Net from Invoice Date</span>
                )}
              </td>
              <td className="border border-slate-300 bg-slate-50 p-2 font-semibold w-1/4">Commercial Classification</td>
              <td className="border border-slate-300 p-2 w-1/4 font-semibold">
                {withData && vendor ? (
                  vendor.commercial?.commercialClassification || "APPROVED"
                ) : (
                  <span>[ ] Preferred &nbsp; [ ] Approved &nbsp; [ ] Trial</span>
                )}
              </td>
            </tr>
            <tr>
              <td className="border border-slate-300 bg-slate-50 p-2 font-semibold">Authorized Credit Limit</td>
              <td className="border border-slate-300 p-2 font-mono">
                {withData && vendor ? (
                  `₹ ${Number(vendor.commercial?.outstandingLiability ?? 0).toLocaleString("en-IN")}`
                ) : (
                  <span>₹ _______________________</span>
                )}
              </td>
              <td className="border border-slate-300 bg-slate-50 p-2 font-semibold">Payment Mode</td>
              <td className="border border-slate-300 p-2">
                <span>Direct Bank Transfer (NEFT / RTGS)</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ─────────────────── SECTION 6: DISBURSEMENT BANK ACCOUNTS ─────────────────── */}
      {includeBanking && (
        <div className="mb-4">
          <div className="bg-slate-100 px-2.5 py-1 border-l-4 border-indigo-600 font-bold text-[11px] text-slate-900 uppercase tracking-wider mb-2">
            6. Disbursement & Settlement Bank Accounts (NEFT / RTGS)
          </div>

          {withData && vendor && vendor.bankAccounts && vendor.bankAccounts.length > 0 ? (
            <table className="w-full border-collapse border border-slate-300 text-[10.5px]">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="border border-slate-300 p-2">Bank & Branch</th>
                  <th className="border border-slate-300 p-2">Beneficiary / Account Holder</th>
                  <th className="border border-slate-300 p-2">Account Number</th>
                  <th className="border border-slate-300 p-2">IFSC Code</th>
                  <th className="border border-slate-300 p-2 w-24">Type / Status</th>
                </tr>
              </thead>
              <tbody>
                {vendor.bankAccounts.map((b, idx) => (
                  <tr key={idx}>
                    <td className="border border-slate-300 p-2 font-semibold">
                      {b.bankName} {b.branch ? `(${b.branch})` : ""}
                    </td>
                    <td className="border border-slate-300 p-2">{b.accountHolderName}</td>
                    <td className="border border-slate-300 p-2 font-mono font-bold text-slate-900">
                      {b.accountNumber}
                    </td>
                    <td className="border border-slate-300 p-2 font-mono">{b.ifsc}</td>
                    <td className="border border-slate-300 p-2 text-[10px]">
                      <span className="font-bold">{b.accountType}</span> • {b.verificationStatus}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="border border-slate-300 p-3 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-[10.5px]">
                <div>
                  <span className="font-semibold text-slate-700">Bank Name & Branch:</span>
                  <div className="h-5 border-b border-dotted border-slate-400 mt-1"></div>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Account Holder Name (As per Bank Records):</span>
                  <div className="h-5 border-b border-dotted border-slate-400 mt-1"></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <span className="text-[9.5px] font-bold text-slate-700 block mb-1">
                    Bank Account Number (Fill right-aligned if fewer than 18 digits)
                  </span>
                  {renderCharBoxes(16, undefined, undefined)}
                </div>
                <div>
                  <span className="text-[9.5px] font-bold text-slate-700 block mb-1">
                    RTGS / NEFT IFSC Code (11 Digits)
                  </span>
                  {renderCharBoxes(11, undefined, undefined)}
                </div>
              </div>

              <div className="flex items-center space-x-6 text-[10px] text-slate-700 pt-1">
                <span>Account Type: &nbsp; [ ] Current &nbsp; [ ] Cash Credit &nbsp; [ ] Savings</span>
                <span>Cancelled Cheque Leaf Attached: &nbsp; [ ] Yes &nbsp; [ ] No</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────── SECTION 7: STATUTORY DECLARATION & SIGN-OFF ─────────────────── */}
      {includeDeclaration && (
        <div className="mt-5 border-t-2 border-slate-900 pt-3">
          <div className="bg-slate-50 p-2.5 border border-slate-300 rounded-xs mb-4 text-[9.5px] text-slate-700 leading-normal">
            <p className="font-bold text-slate-900 mb-1">
              STATUTORY UNDERTAKING & COMPLIANCE CONFIRMATION:
            </p>
            <p>
              We hereby declare that all particulars, statutory registration numbers, and banking details furnished herein are true, complete, and legally valid. We undertake to comply with all provisions of the Indian Goods and Services Tax (GST) Act, e-invoicing mandates, and applicable TDS/TCS regulations. We agree to promptly notify {tenantName} of any changes in our registration, bank mandate, or MSME status within 7 calendar days.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-4">
            {/* Vendor Signature Box */}
            <div className="border border-slate-400 p-3 h-32 flex flex-col justify-between">
              <span className="font-bold text-[10px] uppercase tracking-wider text-slate-800">
                For & On Behalf of Vendor / Supplier:
              </span>
              <div className="border-t border-slate-300 pt-1 flex items-end justify-between text-[9px] text-slate-500">
                <div>
                  <div>Authorized Signatory & Seal</div>
                  <div>Name: ______________________</div>
                </div>
                <div className="text-right">
                  <div>Date: ____________</div>
                  <div>Place: ___________</div>
                </div>
              </div>
            </div>

            {/* SMRITI Internal Verification Box */}
            <div className="border border-slate-400 p-3 h-32 flex flex-col justify-between bg-slate-50/50">
              <span className="font-bold text-[10px] uppercase tracking-wider text-slate-800">
                SMRITI Universal Master — Verification & Authorization:
              </span>
              <div className="border-t border-slate-300 pt-1 flex items-end justify-between text-[9px] text-slate-500">
                <div>
                  <div>Procurement Head / Internal Audit</div>
                  <div>Vendor Master ID: {withData && vendor ? vendor.id : "________________"}</div>
                </div>
                <div className="text-right">
                  <div>Authorized Seal</div>
                  <div>Approved Date: ________</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Footer */}
      <div className="text-center text-[8.5px] text-slate-500 mt-6 pt-2 border-t border-slate-200">
        This is an official computer-generated document • Page 1 of 1
      </div>
    </div>
  );

  return (
    <>
      {/* ─────────────────── SCREEN PREVIEW MODAL ─────────────────── */}
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-md no-print">
        {/* Top Floating Command Bar */}
        <div className="h-16 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
              <Printer size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>Vendor Form Print & Export Studio</span>
                <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                  A4 FORMAT
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {withData && vendor
                  ? `Active Dossier: ${vendor.legalName} (${vendor.code})`
                  : "Blank Vendor Onboarding & KYC Application Form (Offline Registration)"}
              </p>
            </div>
          </div>

          {/* Mode Switcher Pills */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80 space-x-1">
            <button
              onClick={() => setWithData(true)}
              disabled={!vendor}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                withData
                  ? "bg-indigo-600 text-white shadow-sm"
                  : !vendor
                  ? "opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-600"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              title={!vendor ? "Select a vendor in the directory to print with data" : "Print form with current vendor data"}
            >
              <FileText size={14} />
              <span>With Data (Filled Dossier)</span>
            </button>

            <button
              onClick={() => setWithData(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                !withData
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Print blank form for manual onboarding and KYC submission"
            >
              <FileSpreadsheet size={14} />
              <span>Without Data (Blank Form)</span>
            </button>
          </div>

          {/* Options & Action Controls */}
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={includeBanking}
                onChange={(e) => setIncludeBanking(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-0"
              />
              <span>Banking</span>
            </label>

            <label className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={includeDeclaration}
                onChange={(e) => setIncludeDeclaration(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-indigo-600 focus:ring-0"
              />
              <span>Declaration</span>
            </label>

            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center space-x-2 transition"
            >
              <Printer size={15} />
              <span>Print Document</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
              title="Close Preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Document Canvas Viewport */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-100/90 dark:bg-slate-950 flex justify-center">
          <div className="w-full max-w-[820px] shadow-xl rounded border border-slate-200 dark:border-slate-800">
            {printableDocument}
          </div>
        </div>
      </div>

      {/* ─────────────────── NATIVE @MEDIA PRINT CONTAINER ─────────────────── */}
      {typeof document !== "undefined" &&
        ReactDOM.createPortal(
          <div className="print-only-container" id="smriti-vendor-print-root">
            {printableDocument}
          </div>,
          document.body
        )}
    </>
  );
};

export const VendorPrintModal = withCapability(VendorPrintModalBase, {
  entity: "vendor",
  capability: "vendor.print",
  role: "SPECIALIZED_UI",
  canonicalOwner: "VendorMasterWs.tsx",
  decisionId: "ADR-VEND-01",
});

export default VendorPrintModal;

