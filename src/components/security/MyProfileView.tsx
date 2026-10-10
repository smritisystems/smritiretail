/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 6.45.2  |  Created: 2026-09-26
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Source Module: Security — My Profile View
 */
import React, { useState, useEffect, useCallback } from "react";
import { UserCircle2, Pencil, Save, X, RefreshCw, Mail, Phone, Building2, User } from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetch.ts";

interface Profile {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: string;
  status: string;
  branchCode?: string;
  lastLogin?: string;
}

interface Notification { type: "success" | "error" | "warning"; message: string; }
interface Props { onNotification?: (n: Notification) => void; }

const fmtDate = (ts?: string) => {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
      "  " + new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch { return ts; }
};

const getCurrentUserId = (): string => {
  try {
    const raw = localStorage.getItem("smriti_auth_token") || localStorage.getItem("token") || "";
    if (!raw) return "";
    const parts = raw.split(".");
    if (parts.length < 2) return "";
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.sub || payload.user_id || payload.id || "";
  } catch { return ""; }
};

export const MyProfileView: React.FC<Props> = ({ onNotification }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Profile>>({});

  const notify = useCallback(
    (type: Notification["type"], message: string) => onNotification?.({ type, message }),
    [onNotification],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const uid = getCurrentUserId();
      if (!uid) throw new Error("No session");
      const res: any = await apiFetchV1(`/users/${uid}`);
      const p: Profile = {
        id: res.id || res.userId || uid,
        username: res.username || uid,
        fullName: res.fullName || res.displayName || res.username || uid,
        email: res.email,
        phone: res.phone,
        role: res.role || "—",
        status: res.status || "Active",
        branchCode: res.companyCode || res.branchCode,
        lastLogin: res.lastLogin || res.last_login,
      };
      setProfile(p);
      setForm(p);
    } catch {
      notify("error", "Could not load your profile. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await apiFetchV1(`/users/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: form.fullName, email: form.email, phone: form.phone }),
      });
      notify("success", "Profile updated successfully.");
      setProfile(prev => prev ? { ...prev, ...form } : prev);
      setEditing(false);
    } catch (e: any) {
      notify("error", e?.message ?? "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw size={22} className="animate-spin text-[#1e40af]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#94a3b8]">
        <User size={36} className="mb-2 text-[#cbd5e1]" />
        <p className="text-sm font-semibold text-[#64748b]">Profile not available</p>
        <button type="button" onClick={() => void load()} className="mt-3 text-xs text-[#1e40af] underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full p-6 space-y-5">

        {/* Avatar card */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-xs flex items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-[#eff6ff] border border-[#bfdbfe] text-[#1e40af] font-bold text-2xl flex items-center justify-center shrink-0 uppercase">
            {profile.fullName.slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-[#0f172a] font-display">{profile.fullName}</h3>
            <p className="text-xs text-[#64748b] font-mono mt-0.5">@{profile.username}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full border text-[10px] font-bold capitalize bg-[#eff6ff] text-[#1e40af] border-[#bfdbfe]">
                {profile.role}
              </span>
              <span className={"px-2 py-0.5 rounded-full border text-[10px] font-bold " + (profile.status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200")}>
                {profile.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!editing ? (
              <button type="button" onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-[#cbd5e1] bg-white text-[#475569] rounded-xl hover:bg-[#f8fafc] transition">
                <Pencil size={13} /> Edit
              </button>
            ) : (
              <>
                <button type="button" onClick={() => { setEditing(false); setForm(profile); }}
                  className="p-2 rounded-xl border border-[#cbd5e1] text-[#64748b] hover:bg-[#f8fafc] transition">
                  <X size={14} />
                </button>
                <button type="button" onClick={() => void handleSave()} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#1e40af] text-white rounded-xl hover:bg-[#1d4ed8] transition disabled:opacity-50">
                  <Save size={13} /> {saving ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Detail fields */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748b] mb-4">Operator Details</h4>
          <div className="space-y-4">
            {[
              { icon: UserCircle2, label: "Full Name",     key: "fullName",   editable: true  },
              { icon: Mail,        label: "Email Address", key: "email",      editable: true  },
              { icon: Phone,       label: "Phone",         key: "phone",      editable: true  },
              { icon: Building2,   label: "Branch Code",   key: "branchCode", editable: false },
            ].map(({ icon: Icon, label, key, editable }) => (
              <div key={key} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] flex items-center justify-center shrink-0">
                  <Icon size={14} className="text-[#64748b]" />
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-[10px] font-bold uppercase text-[#94a3b8] tracking-wide">{label}</label>
                  {editing && editable ? (
                    <input
                      type="text"
                      value={(form as any)[key] || ""}
                      onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                      aria-label={label}
                      className="block w-full mt-0.5 text-sm text-[#0f172a] bg-[#f8fafc] border border-[#cbd5e1] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1e40af] focus:ring-2 focus:ring-[#1e40af]/20"
                    />
                  ) : (
                    <div className="text-sm font-semibold text-[#0f172a] mt-0.5">
                      {(profile as any)[key] || <span className="text-[#94a3b8] italic">Not set</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Session info */}
        <div className="bg-white border border-[#e2e8f0] rounded-2xl p-6 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#64748b] mb-3">Session Information</h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-[#94a3b8] text-[10px] font-bold uppercase">Last Login</p>
              <p className="font-semibold text-[#334155] mt-0.5">{fmtDate(profile.lastLogin)}</p>
            </div>
            <div>
              <p className="text-[#94a3b8] text-[10px] font-bold uppercase">Operator ID</p>
              <p className="font-mono font-bold text-[#1e40af] mt-0.5">{profile.username}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyProfileView;
