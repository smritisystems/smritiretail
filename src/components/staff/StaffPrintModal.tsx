/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.33.3
 * Created      : 2026-07-10
 * Modified     : 2026-09-17
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Staff Print Center (A4 Registration & Remittance Form + CR-80 Physical ID Card)
 */

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { CreditCard, FileText, Printer, X } from "lucide-react";
import { User } from "../../types.ts";

interface StaffPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: User;
}

type PrintMode = "form" | "id";
type LogoPosition = "left" | "center" | "right";

const formEmploymentFields: Array<{ label: string; key: keyof User }> = [
  { label: "Full name", key: "fullName" },
  { label: "Display name", key: "displayName" },
  { label: "Employee ID", key: "employeeId" },
  { label: "Employee code", key: "employeeCode" },
  { label: "Department", key: "department" },
  { label: "Designation", key: "designation" },
  { label: "Home branch", key: "branch" },
  { label: "Date of joining", key: "dateOfJoining" },
  { label: "Employment type", key: "employmentType" },
  { label: "Reporting manager", key: "reportingManager" },
];

const fallbackLogo = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><text x='50%' y='68%' text-anchor='middle' font-family='Arial, sans-serif' font-size='64' font-weight='700' fill='%23111827'>M</text></svg>";
const knownCompanyLogos: Record<string, string> = {
  "COMP-001": "/myImages/tattly_logo_black.png",
  "001": "/myImages/tattly_logo_black.png",
};
const knownCompanyAddresses: Record<string, string> = {
  "COMP-001": "Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery, near HP Petrol Pump, Mumbai, Maharashtra - 400003",
  "001": "Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery, near HP Petrol Pump, Mumbai, Maharashtra - 400003",
};

const valueFor = (staff: User, key: keyof User, withData: boolean) => {
  if (!withData) return "";
  const value = staff[key];
  return value === undefined || value === null || value === "" ? "" : String(value);
};

/**
 * Deterministic SVG 1D Barcode generator for Staff ID scanning.
 * Used for cashier badge scan at POS counter or warehouse clock-in.
 */
function StaffBarcode({ value }: { value: string }) {
  if (!value) return null;
  const safeVal = value.replace(/[^A-Za-z0-9_-]/g, "");
  const chars = Array.from(safeVal.length > 0 ? safeVal : "STAFF");
  const bars = chars.flatMap((char) => {
    const code = char.charCodeAt(0);
    return [
      (code % 3) + 1,
      ((code >> 1) % 2) + 1,
      ((code >> 2) % 3) + 1,
      ((code >> 3) % 2) + 1,
    ];
  });
  const totalWidth = bars.reduce((a, b) => a + b, 0) + (bars.length - 1);
  let currentX = 0;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${totalWidth} 20`}
        className="h-5 w-full max-w-[45mm] object-contain"
        preserveAspectRatio="none"
      >
        {bars.map((w, idx) => {
          const x = currentX;
          currentX += w + 1;
          return idx % 2 === 0 ? (
            <rect key={idx} x={x} y={0} width={w} height={20} fill="#0f172a" />
          ) : null;
        })}
      </svg>
      <span className="font-mono text-[7px] tracking-widest text-slate-800 font-bold mt-0.5">
        *{value}*
      </span>
    </div>
  );
}

const StaffPrintModal: React.FC<StaffPrintModalProps> = ({ isOpen, onClose, staff }) => {
  const [mode, setMode] = useState<PrintMode>("form");
  const [withData, setWithData] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState(fallbackLogo);
  const [idBorderColor, setIdBorderColor] = useState("#1f2937");
  const [idBorderEnabled, setIdBorderEnabled] = useState(true);
  const [idBottomBorderEnabled, setIdBottomBorderEnabled] = useState(true);
  const [idLogoPosition, setIdLogoPosition] = useState<LogoPosition>("left");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const companyId = localStorage.getItem("smriti_company_id") || localStorage.getItem("smriti_company_code") || "";
      const storedCompanyName = localStorage.getItem("smriti_company_name") || "";
      const normalizedName = storedCompanyName.toLowerCase();
      setCompanyName(storedCompanyName || (knownCompanyLogos[companyId] ? "Tattly Threads" : ""));
      setCompanyAddress(localStorage.getItem("smriti_company_address") || localStorage.getItem("smriti_company_address_display") || knownCompanyAddresses[companyId] || "");
      try {
        const branding = JSON.parse(localStorage.getItem("smriti_branding_config") || "{}");
        const companyLogo = localStorage.getItem(`smriti_company_logo_${companyId}`) || localStorage.getItem("smriti_company_logo_url");
        const configuredAddress = branding.companyAddressDisplay || branding.companyAddress || branding.address;
        if (typeof configuredAddress === "string" && configuredAddress.trim()) setCompanyAddress(configuredAddress.trim());
        if (typeof branding.logoUrl === "string" && branding.logoUrl.trim()) {
          setLogoUrl(branding.logoUrl);
        } else if (companyLogo) {
          setLogoUrl(companyLogo);
        } else if (normalizedName.includes("tattly threads") || knownCompanyLogos[companyId]) {
          setLogoUrl("/myImages/tattly_logo_black.png");
        } else {
          setLogoUrl(fallbackLogo);
        }
      } catch {
        setLogoUrl(knownCompanyLogos[companyId] ? knownCompanyLogos[companyId] : fallbackLogo);
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setMode("form");
      setWithData(true);
    }
  }, [isOpen, staff.id]);

  if (!isOpen) return null;

  const payment = staff.payment || ({} as NonNullable<User["payment"]>);
  const photoUrl = withData && staff.photo ? staff.photo : "";
  const identityCode = withData ? (staff.employeeCode || staff.employeeId || "") : "";
  const initial = (staff.fullName || "Staff").charAt(0).toUpperCase();
  const issueDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const display = (value: string | undefined | null) => (withData && value ? String(value) : "____________________________");
  const addressParts = withData
    ? [staff.address, staff.landmark, [staff.city, staff.state, staff.pinCode].filter(Boolean).join(", ")].filter(Boolean)
    : [];
  const logoPositionClass = idLogoPosition === "center" ? "left-1/2 -translate-x-1/2" : idLogoPosition === "right" ? "right-0" : "left-0";

  // Bank values
  const bankNameVal = payment.bankName || payment.bankDetails || "";
  const accountNoVal = payment.accountNumber || "";
  const ifscVal = payment.ifscCode || "";
  const branchVal = payment.branchName || "";
  const accountTypeVal = payment.accountType || "Savings";
  const beneficiaryVal = payment.nameAsPerBank || staff.fullName || "";
  const paymentModeVal = payment.paymentMode || "Bank Transfer";
  const upiVal = payment.upi || "";

  // Statutory KYC values
  const panVal = payment.panNumber || "";
  const aadhaarVal = payment.aadhaarNumber || "";
  const uanVal = payment.providentFundUan || "";
  const esicVal = payment.esicNumber || "";
  const bloodGroupVal = payment.bloodGroup || "";
  const fatherSpouseVal = payment.fatherSpouseName || "";
  const maritalStatusVal = payment.maritalStatus || "";
  const emergencyRelationVal = payment.emergencyContactRelation || "";

  const formDocument = (
    <div className="relative mx-auto box-border min-h-[297mm] w-[210mm] overflow-hidden bg-white p-[12mm] text-slate-900 shadow-sm print:shadow-none font-sans">
      <div className="absolute left-0 top-0 h-2 w-full bg-slate-900" />
      <img src={logoUrl} alt="" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 w-[125mm] -translate-x-1/2 -translate-y-1/2 opacity-[0.035] grayscale" />
      
      {/* ── Document Header ── */}
      <div className="relative -mx-[12mm] -mt-[12mm] mb-3 border-b-2 border-slate-900 bg-white px-[12mm] pb-3 pt-[10mm] text-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-[16mm] w-[38mm] items-center justify-center">
              <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain mix-blend-multiply" />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-slate-500">Official Personnel &amp; Remittance Register</div>
              <h1 className="mt-0.5 text-lg font-black uppercase tracking-tight">Staff Registration &amp; Remittance Form</h1>
              <p className="text-[10px] text-slate-500">Identity, Statutory KYC, Employment, and Bank Remittance Record</p>
            </div>
          </div>
          <div className="text-right font-mono text-[9px] text-slate-500">
            <div className="font-bold text-slate-800">FORM STAFF-360</div>
            <div>MODE: {withData ? "FILLED" : "BLANK"}</div>
            <div>DATE: {new Date().toLocaleDateString("en-IN")}</div>
          </div>
        </div>
      </div>

      {/* ── Section 01: Identity & Employment ── */}
      <div className="relative mb-1 flex items-center gap-2 border-b border-slate-200 pb-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-950">
        <span className="flex h-4 w-4 items-center justify-center bg-slate-800 text-[8px] text-white rounded-sm font-bold">01</span>
        Identity &amp; Employment
      </div>
      <div className="relative grid grid-cols-[1fr_95px] gap-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          {formEmploymentFields.map((field) => (
            <div key={field.key} className="border-b border-slate-200 pb-1">
              <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">{field.label}</div>
              <div className="mt-0.5 min-h-4 text-[11px] font-semibold">{display(valueFor(staff, field.key, withData))}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center">
          <div className="flex h-28 w-24 items-center justify-center overflow-hidden border border-slate-400 bg-slate-50 rounded">
            {photoUrl ? <img src={photoUrl} alt="Staff" className="h-full w-full object-cover" /> : <span className="text-3xl font-black text-slate-300">{withData ? initial : "Photo"}</span>}
          </div>
          {identityCode && withData && (
            <div className="mt-1 text-center">
              <StaffBarcode value={identityCode} />
            </div>
          )}
        </div>
      </div>

      {/* ── Section 02: Contact & Personal Details ── */}
      <div className="relative mt-2.5 border border-slate-300 border-t-2 border-t-slate-800">
        <div className="flex items-center gap-2 bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-950">
          <span className="flex h-4 w-4 items-center justify-center bg-slate-800 text-[8px] text-white rounded-sm font-bold">02</span>
          Personal &amp; Contact Details
        </div>
        <div className="grid grid-cols-3 gap-2.5 p-2 text-xs">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Primary Mobile</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-semibold">{display(valueFor(staff, "mobile", withData))}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Alternate Mobile</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-semibold">{display(valueFor(staff, "alternateMobile", withData))}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Email Address</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-semibold">{display(valueFor(staff, "email", withData))}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Father / Spouse Name</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-semibold">{display(fatherSpouseVal)}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Emergency Contact &amp; Relation</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-semibold">
              {display(staff.emergencyContact ? `${staff.emergencyContact} ${emergencyRelationVal ? `(${emergencyRelationVal})` : ""}` : "")}
            </div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Date of Birth / Gender</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-semibold">
              {display(staff.dateOfBirth ? `${staff.dateOfBirth} / ${staff.gender || "Unspecified"}` : "")}
            </div>
          </div>
          <div className="col-span-3">
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Residential Address</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-semibold">{display(addressParts.join(", "))}</div>
          </div>
        </div>
      </div>

      {/* ── Section 03: Statutory KYC & Identification ── */}
      <div className="relative mt-2.5 border border-slate-300 border-t-2 border-t-slate-800">
        <div className="flex items-center gap-2 bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-950">
          <span className="flex h-4 w-4 items-center justify-center bg-slate-800 text-[8px] text-white rounded-sm font-bold">03</span>
          Statutory KYC &amp; Identification (EPFO / ESIC / Income Tax)
        </div>
        <div className="grid grid-cols-3 gap-2.5 p-2 text-xs">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">PAN Card Number</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-mono font-bold">{display(panVal)}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Aadhaar Card Number</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-mono font-bold">{display(aadhaarVal)}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Blood Group</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-bold text-rose-700">{display(bloodGroupVal)}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">EPFO UAN Number</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-mono font-semibold">{display(uanVal)}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">ESIC IP Number</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-mono font-semibold">{display(esicVal)}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Marital Status</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-semibold">{display(maritalStatusVal)}</div>
          </div>
        </div>
      </div>

      {/* ── Section 04: Banking & Salary Remittance ── */}
      <div className="relative mt-2.5 border border-slate-300 border-t-2 border-t-slate-800">
        <div className="flex items-center gap-2 bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-950">
          <span className="flex h-4 w-4 items-center justify-center bg-slate-800 text-[8px] text-white rounded-sm font-bold">04</span>
          Banking &amp; Salary Remittance (Payment of Wages Act)
        </div>
        <div className="grid grid-cols-3 gap-2.5 p-2 text-xs">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Bank Name</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-bold">{display(bankNameVal)}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Account Number</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-mono font-bold">{display(accountNoVal)}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">IFSC Code</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-mono font-bold">{display(ifscVal)}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Branch Name</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-semibold">{display(branchVal)}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Account Type</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-semibold">{display(accountTypeVal)}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Beneficiary / Passbook Name</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-semibold">{display(beneficiaryVal)}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Remittance Mode</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-semibold">{display(paymentModeVal)}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">UPI ID / VPA</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-mono font-semibold">{display(upiVal)}</div>
          </div>
          <div>
            <div className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Salary Scale / Monthly Fixed</div>
            <div className="mt-0.5 border-b border-slate-200 pb-1 text-[11px] font-semibold">
              {display(staff.salary?.fixedMonthly ? `₹${Number(staff.salary.fixedMonthly).toLocaleString('en-IN')}` : "")}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 05: Declaration & Acknowledgement ── */}
      <div className="relative mt-2.5 border border-slate-300 border-t-2 border-t-slate-800">
        <div className="flex items-center gap-2 bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-950">
          <span className="flex h-4 w-4 items-center justify-center bg-slate-800 text-[8px] text-white rounded-sm font-bold">05</span>
          Declaration &amp; Authorized Signatures
        </div>
        <div className="grid grid-cols-3 gap-6 p-3 text-[9px] text-slate-700">
          <div className="col-span-3 text-[8.5px] leading-relaxed text-slate-600">
            I hereby declare that all particulars furnished above regarding my identity, personal details, statutory identification (PAN, Aadhaar, UAN, ESIC), and bank remittance account are true, correct, and complete to the best of my knowledge. I authorize direct credit of my salary and applicable retail commissions to the declared bank account.
          </div>
          <div className="pt-6 border-t border-slate-300 text-center font-bold">
            Staff / Employee Signature
          </div>
          <div className="pt-6 border-t border-slate-300 text-center font-bold">
            HR / Store Manager Verification
          </div>
          <div className="pt-6 border-t border-slate-300 text-center font-bold">
            Authorized Signatory &amp; Official Seal
          </div>
        </div>
      </div>

      {/* ── Document Footer ── */}
      {companyAddress && (
        <div className="absolute bottom-[3mm] left-[12mm] right-[12mm] border-t border-slate-200 pt-1 text-center text-[7.5px] font-medium text-slate-500">
          <div>{companyAddress}</div>
          <div className="mt-0.5 text-[6.5px] font-medium tracking-normal text-slate-400">
            SMRITI OS Retail Suite — Powered by SMRITI SYSTEMS | SMRITISYS.COM
          </div>
        </div>
      )}
    </div>
  );

  const idCard = (
    <div
      className="relative mx-auto flex h-[54mm] w-[85.6mm] flex-col overflow-hidden bg-white p-2.5 text-slate-900 shadow-lg print:shadow-none"
      style={{
        borderStyle: "solid",
        borderWidth: idBorderEnabled ? "2px" : "0",
        borderColor: idBorderColor,
      }}
    >
      <img
        src={logoUrl}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-[42mm] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.035] grayscale mix-blend-multiply"
      />
      {idBottomBorderEnabled && (
        <div className="absolute bottom-0 left-0 h-1.5 w-full" style={{ backgroundColor: idBorderColor }} />
      )}
      
      {/* Top Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-200 pb-1 pt-[10mm]">
        <div className="flex items-center gap-1.5 absolute right-0 top-0">
          {bloodGroupVal && (
            <span className="bg-rose-700 text-white text-[7.5px] font-bold px-1 py-0.2 rounded">
              BG: {bloodGroupVal}
            </span>
          )}
          <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-slate-500">Staff ID</span>
        </div>
        <div className={`absolute top-0 flex h-[10mm] w-[24mm] items-center justify-center ${logoPositionClass}`}>
          <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain mix-blend-multiply" />
        </div>
      </div>

      {/* Middle Card Content */}
      <div className="relative z-10 flex flex-1 items-center gap-2.5 py-1.5">
        <div className="flex flex-col items-center shrink-0">
          <div className="flex h-16 w-14 items-center justify-center overflow-hidden border border-slate-400 bg-slate-100 rounded">
            {photoUrl ? (
              <img src={photoUrl} alt="Staff ID" className="h-full w-full object-cover" />
            ) : (
              <span className="text-2xl font-black text-slate-900">{withData ? initial : ""}</span>
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="truncate text-[13px] font-black tracking-tight">{display(withData ? staff.fullName : "")}</div>
          <div className="truncate text-[9px] font-bold text-slate-700">{display(withData ? staff.designation : "")}</div>
          <div className="truncate text-[8px] text-slate-600">{display(withData ? staff.branch : "")}</div>
          <div className="font-mono text-[8px] font-bold text-slate-900">ID: {display(identityCode)}</div>
          <div className="text-[7.5px] text-slate-500">Issued: {withData ? issueDate : "____________"}</div>
        </div>
      </div>

      {/* Scannable Barcode for POS Cashier/Sales Scan */}
      {identityCode && withData && (
        <div className="relative z-10 -mt-1 flex justify-center">
          <StaffBarcode value={identityCode} />
        </div>
      )}

      {/* Bottom Legal Disclaimer */}
      <div className="relative z-10 flex min-h-[5mm] flex-col justify-center border-t border-slate-200 pt-0.5 text-center text-[4.5px] leading-[1.1] text-slate-500">
        <div className="break-words">
          {companyName || "Authorized staff identification"} · {companyAddress || "Return if found"}
        </div>
      </div>
    </div>
  );

  const idCardBack = (
    <div
      className="relative mx-auto flex h-[54mm] w-[85.6mm] flex-col overflow-hidden bg-white p-2.5 text-slate-900 shadow-lg print:shadow-none"
      style={{
        borderStyle: "solid",
        borderWidth: idBorderEnabled ? "2px" : "0",
        borderColor: idBorderColor,
      }}
    >
      <img
        src={logoUrl}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-[46mm] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.035] grayscale mix-blend-multiply"
      />
      {idBottomBorderEnabled && (
        <div className="absolute bottom-0 left-0 h-1.5 w-full" style={{ backgroundColor: idBorderColor }} />
      )}

      {/* Top Reverse Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-200 pb-1 pt-[10mm]">
        <div className={`absolute top-0 flex h-[10mm] w-[24mm] items-center justify-center ${logoPositionClass}`}>
          <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain mix-blend-multiply" />
        </div>
        <span className="absolute right-0 top-0 text-[8px] font-bold uppercase tracking-[0.16em] text-slate-500">Reverse</span>
      </div>

      {/* Reverse Content */}
      <div className="relative z-10 flex flex-1 flex-col justify-center gap-1 py-1 text-center">
        <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-800">
          Property of {companyName || "the organization"}
        </div>
        <div className="text-[8px] font-semibold text-slate-600">If found, return immediately to HR / Administration</div>
        
        {/* Emergency Metadata */}
        <div className="mx-auto w-full max-w-[72mm] rounded bg-slate-50 border border-slate-200 p-1 text-[7px] text-left grid grid-cols-2 gap-1 text-slate-700">
          <div>
            <span className="font-bold text-slate-900">Emergency Contact: </span>
            <span>{staff.emergencyContact || "________________"}</span>
          </div>
          <div>
            <span className="font-bold text-slate-900">Blood Group: </span>
            <span className="font-bold text-rose-700">{bloodGroupVal || "—"}</span>
          </div>
          <div>
            <span className="font-bold text-slate-900">Validity: </span>
            <span>Valid through employment</span>
          </div>
          <div>
            <span className="font-bold text-slate-900">Branch: </span>
            <span>{staff.branch || "Head Office"}</span>
          </div>
        </div>

        <div className="mx-auto max-w-[72mm] text-[6.5px] leading-tight text-slate-500">
          {companyAddress || "Company registered office address"}
        </div>
        <div className="text-[6.5px] font-semibold text-slate-500">This card is non-transferable and remains company property.</div>
        <div className="text-[6.5px] font-semibold text-slate-700">
          Authorized HR Signatory: __________________________
        </div>
      </div>

      {/* Bottom Legal Disclaimer */}
      <div className="relative z-10 flex min-h-[5mm] items-center justify-center border-t border-slate-200 pt-0.5 text-center text-[5.5px] font-medium tracking-normal text-slate-400">
        SMRITI OS Retail Suite — Powered by SMRITI SYSTEMS | SMRITISYS.COM
      </div>
    </div>
  );

  const printable = mode === "id" ? <div className="flex flex-col gap-4">{idCard}{idCardBack}</div> : formDocument;

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/70 backdrop-blur-sm print:hidden">
        <div className="flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <Printer size={19} className="text-indigo-600" />
            <div>
              <h2 className="text-sm font-black">Staff Print Center</h2>
              <p className="text-xs text-slate-500">Statutory A4 Registration &amp; Remittance Form + Physical CR-80 ID Card</p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
            <button
              id="btn-print-mode-form"
              onClick={() => setMode("form")}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                mode === "form" ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <FileText size={13} className="mr-1 inline" />
              Staff Form (A4)
            </button>
            <button
              id="btn-print-mode-id"
              onClick={() => setMode("id")}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                mode === "id" ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <CreditCard size={13} className="mr-1 inline" />
              Physical ID Card
            </button>
          </div>
          <div className="flex items-center gap-2">
            {mode === "id" && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-500">Logo</span>
                {(["left", "center", "right"] as LogoPosition[]).map((position) => (
                  <button
                    key={position}
                    onClick={() => setIdLogoPosition(position)}
                    className={`rounded-md px-2 py-1 text-[10px] font-bold capitalize ${
                      idLogoPosition === position ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {position}
                  </button>
                ))}
                <span className="text-[10px] font-bold text-slate-500">Border</span>
                {["#1f2937", "#64748b", "#cbd5e1"].map((color) => (
                  <button
                    key={color}
                    title={`Border ${color}`}
                    aria-label={`Border ${color}`}
                    onClick={() => setIdBorderColor(color)}
                    className={`h-4 w-4 rounded-full border-2 ${
                      idBorderColor === color ? "border-slate-950 ring-1 ring-slate-400" : "border-white"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
                <button
                  onClick={() => setIdBorderEnabled((enabled) => !enabled)}
                  className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                    idBorderEnabled ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {idBorderEnabled ? "Border On" : "Border Off"}
                </button>
                <button
                  onClick={() => setIdBottomBorderEnabled((enabled) => !enabled)}
                  className={`rounded-md px-2 py-1 text-[10px] font-bold ${
                    idBottomBorderEnabled ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  Bottom {idBottomBorderEnabled ? "On" : "Off"}
                </button>
              </div>
            )}
            <div className="flex rounded-lg border border-slate-200 p-1 dark:border-slate-700">
              <button
                id="btn-print-with-data"
                disabled={!staff.id}
                onClick={() => setWithData(true)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                  withData ? "bg-indigo-600 text-white" : "text-slate-500"
                }`}
              >
                With Data
              </button>
              <button
                id="btn-print-without-data"
                onClick={() => setWithData(false)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                  !withData ? "bg-indigo-600 text-white" : "text-slate-500"
                }`}
              >
                Without Data (Blank)
              </button>
            </div>
            <button
              id="btn-trigger-print"
              onClick={() => window.print()}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors"
            >
              <Printer size={14} className="mr-1 inline" />
              Print
            </button>
            <button
              title="Close"
              aria-label="Close"
              onClick={onClose}
              className="rounded-lg border border-slate-200 p-2 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 p-6 dark:bg-slate-950">
          <div className={mode === "id" ? "flex min-h-full items-start justify-center py-4" : "mx-auto max-w-[840px]"}>
            {printable}
          </div>
        </div>
      </div>
      {typeof document !== "undefined" &&
        ReactDOM.createPortal(
          <div className="print-only-container" id="smriti-staff-print-root">
            <style>{"@page { size: A4 portrait; margin: 0; }"}</style>
            {printable}
          </div>,
          document.body
        )}
    </>
  );
};

export default StaffPrintModal;
