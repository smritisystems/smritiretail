/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 6.45.2  |  Created: 2026-09-26
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Source Module: Security — Change Password View
 */
import React, { useState } from "react";
import { Eye, EyeOff, KeyRound, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetch.ts";

interface Notification { type: "success" | "error" | "warning"; message: string; }
interface Props { onNotification?: (n: Notification) => void; }

const StrengthBar: React.FC<{ password: string }> = ({ password }) => {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
    password.length >= 12,
  ].filter(Boolean).length;

  const label  = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"][score];
  const color  = ["", "bg-rose-500", "bg-amber-400", "bg-yellow-400", "bg-emerald-400", "bg-emerald-600"][score];

  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className={"h-1 flex-1 rounded-full transition-colors " + (i <= score ? color : "bg-[#e2e8f0]")} />
        ))}
      </div>
      <p className={"text-[10px] font-bold mt-1 " + (score < 3 ? "text-rose-600" : score < 4 ? "text-amber-600" : "text-emerald-600")}>
        {label}
      </p>
    </div>
  );
};

export const ChangePasswordView: React.FC<Props> = ({ onNotification }) => {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const notify = (type: Notification["type"], message: string) => onNotification?.({ type, message });

  const rules = [
    { ok: form.next.length >= 8,          label: "At least 8 characters" },
    { ok: /[A-Z]/.test(form.next),        label: "Contains uppercase letter" },
    { ok: /[0-9]/.test(form.next),        label: "Contains a number" },
    { ok: /[^A-Za-z0-9]/.test(form.next), label: "Contains a special character" },
    { ok: form.next === form.confirm && form.confirm.length > 0, label: "Passwords match" },
  ];

  const allValid = rules.every(r => r.ok) && form.current.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allValid) return;
    setSaving(true);
    setError("");
    try {
      await apiFetchV1("/users/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: form.current, new_password: form.next }),
      });
      setSuccess(true);
      setForm({ current: "", next: "", confirm: "" });
      notify("success", "Your password has been updated successfully.");
    } catch (e: any) {
      const msg = e?.message ?? "Failed to update password. Check your current password.";
      setError(msg);
      notify("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const ToggleBtn: React.FC<{ field: "current" | "next" | "confirm" }> = ({ field }) => (
    <button
      type="button"
      onClick={() => setShow(prev => ({ ...prev, [field]: !prev[field] }))}
      aria-label={show[field] ? "Hide password" : "Show password"}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#475569] transition"
    >
      {show[field] ? <EyeOff size={15} /> : <Eye size={15} />}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto">
      <div className="max-w-lg mx-auto w-full p-6">

        {/* Header card */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 mb-5 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 bg-[#eff6ff] border border-[#bfdbfe] rounded-xl flex items-center justify-center shrink-0">
            <KeyRound size={22} className="text-[#1e40af]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#0f172a] font-display">Change Password</h2>
            <p className="text-xs text-[#64748b] mt-0.5">Update your operator account password</p>
          </div>
        </div>

        {success && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-5 text-xs text-emerald-800">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
            Your password has been changed. Please use the new password on your next login.
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-5 text-xs text-rose-700">
            <AlertTriangle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={e => void handleSubmit(e)} className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-xs space-y-5">

          {/* Current */}
          <div>
            <label htmlFor="cp-current" className="block text-xs font-bold text-[#475569] mb-1.5">Current Password</label>
            <div className="relative">
              <input
                id="cp-current"
                type={show.current ? "text" : "password"}
                value={form.current}
                onChange={e => setForm(prev => ({ ...prev, current: e.target.value }))}
                required
                autoComplete="current-password"
                placeholder="Enter your current password"
                className="w-full pr-10 pl-4 py-2.5 text-sm border border-[#cbd5e1] rounded-xl bg-[#f8fafc] focus:outline-none focus:border-[#1e40af] focus:ring-2 focus:ring-[#1e40af]/20"
              />
              <ToggleBtn field="current" />
            </div>
          </div>

          {/* New */}
          <div>
            <label htmlFor="cp-new" className="block text-xs font-bold text-[#475569] mb-1.5">New Password</label>
            <div className="relative">
              <input
                id="cp-new"
                type={show.next ? "text" : "password"}
                value={form.next}
                onChange={e => setForm(prev => ({ ...prev, next: e.target.value }))}
                required
                autoComplete="new-password"
                placeholder="Create a strong password"
                className="w-full pr-10 pl-4 py-2.5 text-sm border border-[#cbd5e1] rounded-xl bg-[#f8fafc] focus:outline-none focus:border-[#1e40af] focus:ring-2 focus:ring-[#1e40af]/20"
              />
              <ToggleBtn field="next" />
            </div>
            <StrengthBar password={form.next} />
          </div>

          {/* Confirm */}
          <div>
            <label htmlFor="cp-confirm" className="block text-xs font-bold text-[#475569] mb-1.5">Confirm New Password</label>
            <div className="relative">
              <input
                id="cp-confirm"
                type={show.confirm ? "text" : "password"}
                value={form.confirm}
                onChange={e => setForm(prev => ({ ...prev, confirm: e.target.value }))}
                required
                autoComplete="new-password"
                placeholder="Repeat the new password"
                className={"w-full pr-10 pl-4 py-2.5 text-sm border rounded-xl bg-[#f8fafc] focus:outline-none focus:ring-2 " +
                  (form.confirm && form.next !== form.confirm
                    ? "border-rose-400 focus:border-rose-400 focus:ring-rose-400/20"
                    : form.confirm && form.next === form.confirm
                      ? "border-emerald-400 focus:border-emerald-400 focus:ring-emerald-400/20"
                      : "border-[#cbd5e1] focus:border-[#1e40af] focus:ring-[#1e40af]/20")}
              />
              <ToggleBtn field="confirm" />
            </div>
          </div>

          {/* Rules checklist */}
          <div className="bg-[#f8fafc] rounded-xl p-4 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] mb-2">Password Requirements</p>
            {rules.map(r => (
              <div key={r.label} className="flex items-center gap-2 text-xs">
                {r.ok
                  ? <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                  : <div className="w-3 h-3 rounded-full border border-[#cbd5e1] shrink-0" />}
                <span className={r.ok ? "text-emerald-700" : "text-[#94a3b8]"}>{r.label}</span>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={!allValid || saving}
            className="w-full py-3 text-sm font-bold bg-[#1e40af] hover:bg-[#1d4ed8] text-white rounded-xl transition disabled:opacity-40 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af] min-h-[44px]"
          >
            <ShieldCheck size={16} />
            {saving ? "Updating Password…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordView;
