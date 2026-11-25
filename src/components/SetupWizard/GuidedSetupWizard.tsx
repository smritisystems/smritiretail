/**
 * Project      : SMRITI Retail OS
 * Author       : SMRITI Systems
 * Version      : 7.0.0
 * Classification: Nontechnical Guided Setup
 */

import React, { useState } from "react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { isValidGSTIN } from "../../utils/validators.ts";

interface GuidedSetupWizardProps {
  onComplete?: () => void;
}

interface SetupUserCredential {
  username: string;
  role: string;
  temp_password?: string;
}

interface CompanySetupResponse {
  success?: boolean;
  detail?: string;
  company?: {
    users?: SetupUserCredential[];
  };
}

export const GuidedSetupWizard: React.FC<GuidedSetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [managerCredential, setManagerCredential] = useState<SetupUserCredential | null>(null);
  const [credentialsCopied, setCredentialsCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [gstin, setGstin] = useState("");
  const [useGst, setUseGst] = useState(true);
  const [storeName, setStoreName] = useState("Main Store");
  const [paymentModes, setPaymentModes] = useState({ cash: true, upi: true, card: true, credit: false });
  const [staffName, setStaffName] = useState("");
  const [username, setUsername] = useState("");
  const invalidGstin = useGst && Boolean(gstin.trim()) && !isValidGSTIN(gstin);

  const next = () => {
    if (step === 2 && invalidGstin) return;
    if (step === 5 && !username.trim()) return;
    setStep((current) => Math.min(6, current + 1));
  };
  const back = () => setStep((current) => Math.max(1, current - 1));

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const normalizedGstin = useGst ? gstin.trim().toUpperCase() : "";
      const validGstin = normalizedGstin && isValidGSTIN(normalizedGstin);
      const result = await apiFetchV1<CompanySetupResponse>("/company/setup", {
        method: "POST",
        body: JSON.stringify({
          businessInfo: {
            name: businessName.trim(),
            tradeName: tradeName.trim() || businessName.trim(),
            businessType: "retail",
            gstin: normalizedGstin,
            pan: validGstin ? normalizedGstin.slice(2, 12) : "",
            state: validGstin ? normalizedGstin.slice(0, 2) : "",
          },
          orgStructure: {
            layout: "single",
            stores: [{
              id: "st-main",
              name: storeName,
              code: "MAIN",
              type: "Company Owned",
              address: "",
              landmark: "",
              city: "",
              state: "",
              pinCode: "",
              contactPerson: staffName,
              mobile: "",
              email: "",
            }],
          },
          operations: {
            modules: { pos: true, inventory: true, purchase: true, sales: true, crm: true, barcode: true, terms: true, exchange: false, batch: false, serial: false },
          },
          accounting: {
            gstType: useGst ? "regular" : "exempt",
            createLedgers: true,
            roundOffMode: "auto",
            bankName: "",
            accountNo: "",
            ifsc: "",
          },
          inventory: {
            valuation: "FIFO",
            negativeStock: "block",
            baseUOM: "Nos",
          },
          pos: {
            printerWidth: "80mm",
            paymentModes,
          },
          users: {
            staff: [{
              id: "u-main",
              name: staffName.trim() || "Store Manager",
              username: username.trim(),
              role: "Store Manager",
              email: "",
            }],
          },
        }),
      });
      if (!result?.success) throw new Error(result?.detail || "Setup could not be completed.");
      const users = result.company?.users || [];
      const managerUsername = username.trim();
      setManagerCredential(users.find((user) => user.username === managerUsername) || users[0] || null);
      setCredentialsCopied(false);
      setCopyError("");
      setStep(7);
    } catch (caught: any) {
      setError(caught?.message || "Setup could not be completed.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyManagerCredentials = async () => {
    if (!managerCredential?.temp_password) return;
    try {
      await navigator.clipboard.writeText(
        `Username: ${managerCredential.username}\nTemporary password: ${managerCredential.temp_password}`,
      );
      setCredentialsCopied(true);
      setCopyError("");
    } catch {
      setCredentialsCopied(false);
      setCopyError("Copy is unavailable here. Select and copy the username and password above.");
    }
  };

  return (
    <main className="mx-auto max-w-3xl p-4 md:p-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-sky-700">First-time setup</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Get your shop ready</h1>
          </div>
          <span className="text-sm font-bold text-slate-500">{step === 7 ? "Setup complete" : `Step ${step} of 6`}</span>
        </div>

        <div className="mb-8 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${(Math.min(step, 6) / 6) * 100}%` }} />
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold">What is your shop called?</h2>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Registered or legal name</span>
              <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-4" placeholder="Example: A. S. Shoes" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Display name</span>
              <input value={tradeName} onChange={(event) => setTradeName(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-4" placeholder="Example: AS Shoes" />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold">Does your shop charge GST?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setUseGst(true)} className={`min-h-24 rounded-xl border-2 p-4 text-left ${useGst ? "border-sky-600 bg-sky-50" : "border-slate-200"}`}>
                <strong>Yes, I have GST</strong>
                <p className="mt-1 text-xs text-slate-500">You can enter it now or add it after setup.</p>
              </button>
              <button type="button" onClick={() => setUseGst(false)} className={`min-h-24 rounded-xl border-2 p-4 text-left ${!useGst ? "border-sky-600 bg-sky-50" : "border-slate-200"}`}>
                <strong>No GST yet</strong>
                <p className="mt-1 text-xs text-slate-500">You can enable GST after setup.</p>
              </button>
            </div>
            {useGst && (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold">GST number</span>
                <input
                  value={gstin}
                  onChange={(event) => setGstin(event.target.value.toUpperCase())}
                  maxLength={15}
                  aria-invalid={invalidGstin}
                  aria-describedby={invalidGstin ? "gstin-error" : "gstin-help"}
                  className={`min-h-12 w-full rounded-xl border px-4 uppercase ${invalidGstin ? "border-red-500" : "border-slate-300"}`}
                  placeholder="22AAAAA0000A1Z5"
                />
                {invalidGstin ? (
                  <p id="gstin-error" role="alert" className="mt-2 text-sm text-red-700">
                    Check the GST number. It should be 15 characters, like 22AAAAA0000A1Z5.
                  </p>
                ) : (
                  <span id="gstin-help" className="sr-only">Optional. Enter a valid 15-character GST number or leave blank to add it later.</span>
                )}
              </label>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold">Name your shop location</h2>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Store name</span>
              <input value={storeName} onChange={(event) => setStoreName(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-4" />
            </label>
            <p className="rounded-xl bg-sky-50 p-4 text-sm text-sky-900">For now, SMRITI will create one main store. Additional branches can be added later.</p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold">How should customers pay?</h2>
            <div className="grid grid-cols-2 gap-3">
              {([["cash", "Cash"], ["upi", "UPI"], ["card", "Card"], ["credit", "Credit / Account"]] as const).map(([key, label]) => (
                <label key={key} className="flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 p-4">
                  <input type="checkbox" checked={paymentModes[key]} onChange={(event) => setPaymentModes((current) => ({ ...current, [key]: event.target.checked }))} className="h-5 w-5" />
                  <span className="font-semibold">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold">Create the first manager account</h2>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Manager name</span>
              <input value={staffName} onChange={(event) => setStaffName(event.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 px-4" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Choose a unique login name</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-slate-300 px-4"
                placeholder="e.g. as-shoes-manager"
                autoComplete="username"
                required
              />
              <span className="mt-2 block text-xs text-slate-500">
                Login names must be unique across SMRITI accounts.
              </span>
            </label>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold">Review and start</h2>
            <dl className="grid gap-3 rounded-xl border border-slate-200 p-4 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Shop</dt><dd className="font-bold">{businessName}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Store</dt><dd className="font-bold">{storeName}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">GST</dt><dd className="font-bold">{useGst ? gstin || "To be provided" : "Not enabled"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Payments</dt><dd className="font-bold">{Object.entries(paymentModes).filter(([, enabled]) => enabled).map(([key]) => key.toUpperCase()).join(", ")}</dd></div>
            </dl>
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          </div>
        )}

        {step === 7 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold">Your shop is ready</h2>
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
              Save the manager sign-in details now. The temporary password will not be shown again after you leave this page.
            </p>
            {managerCredential?.temp_password ? (
              <>
                <dl className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <div>
                    <dt className="text-sm text-slate-500">Manager login name</dt>
                    <dd className="select-all break-all font-mono font-bold">{managerCredential.username}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Temporary password</dt>
                    <dd className="select-all break-all font-mono font-bold">{managerCredential.temp_password}</dd>
                  </div>
                </dl>
                <button type="button" onClick={copyManagerCredentials} className="min-h-11 rounded-xl border border-sky-300 px-4 text-sm font-bold text-sky-800">
                  {credentialsCopied ? "Credentials copied" : "Copy sign-in details"}
                </button>
                {copyError && <p role="alert" className="text-sm text-red-700">{copyError}</p>}
              </>
            ) : (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                Setup completed, but the temporary password was not returned. Ask your system administrator to reset the manager password before signing in.
              </p>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
          {step <= 6 ? (
            <button type="button" onClick={back} disabled={step === 1} className="min-h-11 rounded-xl border border-slate-300 px-5 text-sm font-bold disabled:opacity-40">
              Back
            </button>
          ) : <span />}
          {step < 6 ? (
            <button type="button" onClick={next} disabled={(step === 1 && !businessName.trim()) || (step === 2 && invalidGstin) || (step === 5 && !username.trim())} className="min-h-11 rounded-xl bg-sky-700 px-6 text-sm font-bold text-white disabled:opacity-40">
              Continue
            </button>
          ) : step === 6 ? (
            <button type="button" onClick={submit} disabled={submitting} className="min-h-11 rounded-xl bg-emerald-700 px-6 text-sm font-bold text-white disabled:opacity-40">
              {submitting ? "Preparing shop..." : "Start using SMRITI"}
            </button>
          ) : (
            <button type="button" onClick={onComplete} className="min-h-11 rounded-xl bg-emerald-700 px-6 text-sm font-bold text-white">
              Go to SMRITI
            </button>
          )}
        </div>
      </section>
    </main>
  );
};
