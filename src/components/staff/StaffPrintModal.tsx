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

const formFields: Array<{ label: string; key: keyof User }> = [
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

  const photoUrl = withData && staff.photo ? staff.photo : "";
  const identityCode = withData ? (staff.employeeCode || staff.employeeId || "") : "";
  const initial = (staff.fullName || "Staff").charAt(0).toUpperCase();
  const issueDate = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const display = (value: string) => value || "____________________________";
  const addressParts = withData
    ? [staff.address, staff.landmark, [staff.city, staff.state, staff.pinCode].filter(Boolean).join(", ")].filter(Boolean)
    : [];
  const logoPositionClass = idLogoPosition === "center" ? "left-1/2 -translate-x-1/2" : idLogoPosition === "right" ? "right-0" : "left-0";

  const formDocument = (
    <div className="relative mx-auto box-border min-h-[297mm] w-[210mm] overflow-hidden bg-white p-[14mm] text-slate-900 shadow-sm print:shadow-none">
      <div className="absolute left-0 top-0 h-2 w-full bg-slate-900" />
      <img src={logoUrl} alt="" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 w-[125mm] -translate-x-1/2 -translate-y-1/2 opacity-[0.04] grayscale" />
      <div className="relative -mx-[14mm] -mt-[14mm] mb-5 border-b-2 border-slate-900 bg-white px-[14mm] pb-5 pt-[12mm] text-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-[18mm] w-[42mm] items-center justify-center"><img src={logoUrl} alt="Company logo" className="h-full w-full object-contain mix-blend-multiply" /></div>
            <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.24em] text-slate-500">People & access record</div>
            <h1 className="mt-1 text-xl font-black uppercase tracking-tight">Staff Registration Form</h1>
            <p className="text-[10px] text-slate-500">Identity, employment, contact, and branch assignment record</p>
            </div>
          </div>
          <div className="text-right font-mono text-[10px] text-slate-500">
            <div className="font-bold text-slate-700">FORM STAFF-360</div>
            <div>MODE: {withData ? "FILLED" : "BLANK"}</div>
            <div>{new Date().toLocaleDateString("en-IN")}</div>
          </div>
        </div>
      </div>

      <div className="relative mb-2 flex items-center gap-2 border-b border-slate-200 pb-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-950"><span className="flex h-5 w-5 items-center justify-center bg-slate-700 text-[9px] text-white">01</span>Identity & employment</div>
      <div className="relative grid grid-cols-[1fr_112px] gap-5">
        <div className="grid grid-cols-2 gap-3">
          {formFields.map((field) => (
            <div key={field.key} className="border-b border-slate-300 pb-2">
              <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{field.label}</div>
              <div className="mt-1 min-h-5 text-xs font-semibold">{display(valueFor(staff, field.key, withData))}</div>
            </div>
          ))}
        </div>
        <div className="flex h-32 w-28 items-center justify-center overflow-hidden border border-slate-400 bg-slate-50">
          {photoUrl ? <img src={photoUrl} alt="Staff" className="h-full w-full object-cover" /> : <span className="text-4xl font-black text-slate-400">{withData ? initial : ""}</span>}
        </div>
      </div>

      <div className="relative mt-5 border border-slate-300 border-t-2 border-t-slate-900">
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-950"><span className="flex h-5 w-5 items-center justify-center bg-slate-700 text-[9px] text-white">02</span>Contact details</div>
        <div className="grid grid-cols-[1fr_1fr] gap-4 p-3 text-xs">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Primary phone / mobile</div>
            <div className="mt-1 border-b border-slate-300 pb-2 font-semibold">{display(valueFor(staff, "mobile", withData))}</div>
          </div>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Email</div>
            <div className="mt-1 border-b border-slate-300 pb-2 font-semibold">{display(valueFor(staff, "email", withData))}</div>
          </div>
          <div className="col-span-2">
            <div className="text-[9px] font-bold uppercase tracking-wide text-slate-500">Residential address</div>
            <div className="mt-1 min-h-10 border-b border-slate-300 pb-2 font-semibold">{display(addressParts.join(" | "))}</div>
          </div>
        </div>
      </div>

      <div className="relative mt-6 border border-slate-300 border-t-2 border-t-slate-900">
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-950"><span className="flex h-5 w-5 items-center justify-center bg-slate-700 text-[9px] text-white">03</span>Declaration and acknowledgement</div>
        <div className="grid grid-cols-2 gap-8 p-4 text-[10px] text-slate-700">
          <div>I confirm that the information recorded above is complete and accurate.</div>
          <div className="space-y-6"><div>Staff signature: ____________________</div><div>Authorized signature: _______________</div></div>
        </div>
      </div>
      {companyAddress && <div className="absolute bottom-[5mm] left-[14mm] right-[14mm] border-t border-slate-300 pt-2 text-center text-[8px] font-medium text-slate-500"><div>{companyAddress}</div><div className="mt-0.5 text-[7px] font-medium tracking-normal text-slate-400">SMRITI OS Retail Suite -- Powered by SMRITI SYSTEMS | SMRITISYS.COM</div></div>}
    </div>
  );

  const idCard = (
    <div className="relative mx-auto flex h-[54mm] w-[85.6mm] flex-col overflow-hidden bg-white p-3 text-slate-900 shadow-lg print:shadow-none" style={{ borderStyle: "solid", borderWidth: idBorderEnabled ? "2px" : "0", borderColor: idBorderColor }}>
      <img src={logoUrl} alt="" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-[42mm] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.035] grayscale mix-blend-multiply" />
      {idBottomBorderEnabled && <div className="absolute bottom-0 left-0 h-1.5 w-full" style={{ backgroundColor: idBorderColor }} />}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-200 pb-1 pt-[12mm]">
        <span className="absolute right-0 top-0 text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">Staff ID</span>
        <div className={`absolute top-0 flex h-[12mm] w-[25mm] items-center justify-center ${logoPositionClass}`}><img src={logoUrl} alt="Company logo" className="h-full w-full object-contain mix-blend-multiply" /></div>
      </div>
      <div className="relative z-10 flex flex-1 -translate-y-1 items-center gap-3 py-3">
        <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden border-2 border-slate-400 bg-slate-100">
          {photoUrl ? <img src={photoUrl} alt="Staff ID" className="h-full w-full object-cover grayscale" /> : <span className="text-3xl font-black text-slate-950">{withData ? initial : ""}</span>}
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="truncate text-[15px] font-black tracking-tight">{display(withData ? staff.fullName : "")}</div>
          <div className="truncate text-[10px] font-semibold text-slate-600">{display(withData ? staff.designation : "")}</div>
          <div className="truncate text-[9px] text-slate-600">{display(withData ? staff.branch : "")}</div>
          <div className="font-mono text-[9px] font-bold text-slate-900">ID / {display(identityCode)}</div>
          <div className="text-[8px] text-slate-500">Issued: {withData ? issueDate : "____________"}</div>
        </div>
      </div>
      <div className="relative z-10 flex min-h-[8mm] flex-col justify-center border-t border-slate-200 pt-1 text-center text-[5px] leading-[1.15] text-slate-500"><div className="break-words">{companyName || "Authorized staff identification"} · {companyAddress || "Return if found"}</div><span className="mt-0.5 block text-[6px] font-medium tracking-normal text-slate-400">SMRITI OS Retail Suite -- Powered by SMRITI SYSTEMS | SMRITISYS.COM</span></div>
    </div>
  );

  const idCardBack = (
    <div className="relative mx-auto flex h-[54mm] w-[85.6mm] flex-col overflow-hidden bg-white p-3 text-slate-900 shadow-lg print:shadow-none" style={{ borderStyle: "solid", borderWidth: idBorderEnabled ? "2px" : "0", borderColor: idBorderColor }}>
      <img src={logoUrl} alt="" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-[46mm] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.035] grayscale mix-blend-multiply" />
      {idBottomBorderEnabled && <div className="absolute bottom-0 left-0 h-1.5 w-full" style={{ backgroundColor: idBorderColor }} />}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-200 pb-1 pt-[12mm]">
        <div className={`absolute top-0 flex h-[12mm] w-[25mm] items-center justify-center ${logoPositionClass}`}><img src={logoUrl} alt="Company logo" className="h-full w-full object-contain mix-blend-multiply" /></div>
        <span className="absolute right-0 top-0 text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">Reverse</span>
      </div>
      <div className="relative z-10 flex flex-1 flex-col justify-center gap-2 py-2 text-center">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-800">Property of {companyName || "the organization"}</div>
        <div className="text-[9px] font-semibold text-slate-600">If found, return to HR / Administration</div>
        <div className="mx-auto max-w-[66mm] border-y border-slate-200 py-2 text-[7px] leading-tight text-slate-500">{companyAddress || "Company address"}</div>
        <div className="text-[7px] font-semibold text-slate-500">This card is not transferable.</div>
        <div className="pt-1 text-[7px] font-semibold text-slate-600">Authorized signature: ____________________</div>
      </div>
      <div className="relative z-10 flex min-h-[6mm] items-center justify-center border-t border-slate-200 pt-1 text-center text-[6px] font-medium tracking-normal text-slate-400">SMRITI OS Retail Suite -- Powered by SMRITI SYSTEMS | SMRITISYS.COM</div>
    </div>
  );

  const printable = mode === "id" ? <div className="flex flex-col gap-4">{idCard}{idCardBack}</div> : formDocument;

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/70 backdrop-blur-sm print:hidden">
        <div className="flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3"><Printer size={19} className="text-indigo-600" /><div><h2 className="text-sm font-black">Staff Print Center</h2><p className="text-xs text-slate-500">A4 form and physical ID card</p></div></div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
            <button onClick={() => setMode("form")} className={`rounded-md px-3 py-1.5 text-xs font-bold ${mode === "form" ? "bg-indigo-600 text-white" : "text-slate-500"}`}><FileText size={13} className="mr-1 inline" />Staff form</button>
            <button onClick={() => setMode("id")} className={`rounded-md px-3 py-1.5 text-xs font-bold ${mode === "id" ? "bg-indigo-600 text-white" : "text-slate-500"}`}><CreditCard size={13} className="mr-1 inline" />Physical ID</button>
          </div>
          <div className="flex items-center gap-2">
            {mode === "id" && <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-500">Logo</span>
              {(["left", "center", "right"] as LogoPosition[]).map((position) => <button key={position} onClick={() => setIdLogoPosition(position)} className={`rounded-md px-2 py-1 text-[10px] font-bold capitalize ${idLogoPosition === position ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>{position}</button>)}
              <span className="text-[10px] font-bold text-slate-500">Border</span>
              {["#1f2937", "#64748b", "#cbd5e1"].map((color) => <button key={color} title={`Border ${color}`} aria-label={`Border ${color}`} onClick={() => setIdBorderColor(color)} className={`h-4 w-4 rounded-full border-2 ${idBorderColor === color ? "border-slate-950 ring-1 ring-slate-400" : "border-white"}`} style={{ backgroundColor: color }} />)}
              <button onClick={() => setIdBorderEnabled((enabled) => !enabled)} className={`rounded-md px-2 py-1 text-[10px] font-bold ${idBorderEnabled ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>{idBorderEnabled ? "On" : "Off"}</button>
              <button onClick={() => setIdBottomBorderEnabled((enabled) => !enabled)} className={`rounded-md px-2 py-1 text-[10px] font-bold ${idBottomBorderEnabled ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}>Bottom {idBottomBorderEnabled ? "On" : "Off"}</button>
            </div>}
            <div className="flex rounded-lg border border-slate-200 p-1 dark:border-slate-700"><button disabled={!staff.id} onClick={() => setWithData(true)} className={`rounded-md px-3 py-1.5 text-xs font-bold ${withData ? "bg-indigo-600 text-white" : "text-slate-500"}`}>With Data</button><button onClick={() => setWithData(false)} className={`rounded-md px-3 py-1.5 text-xs font-bold ${!withData ? "bg-indigo-600 text-white" : "text-slate-500"}`}>Without Data</button></div>
            <button onClick={() => window.print()} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white"><Printer size={14} className="mr-1 inline" />Print</button>
            <button title="Close" onClick={onClose} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"><X size={16} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 p-8 dark:bg-slate-950"><div className={mode === "id" ? "flex min-h-full items-start justify-center" : "mx-auto max-w-[820px]"}>{printable}</div></div>
      </div>
      {typeof document !== "undefined" && ReactDOM.createPortal(<div className="print-only-container" id="smriti-staff-print-root"><style>{"@page { size: A4 portrait; margin: 0; }"}</style>{printable}</div>, document.body)}
    </>
  );
};

export default StaffPrintModal;
