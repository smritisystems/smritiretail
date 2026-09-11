/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.18.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Staff 360 Workspace & HR User Governance
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  KeyRound,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import { apiFetchV1 } from "../../lib/apiFetchV1.ts";
import { User } from "../../types.ts";
import { withCapability } from "../../types/architecture.ts";

export interface StaffMasterWsProps {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
}

type StaffTab = "overview" | "identity" | "employment" | "access" | "assignments" | "compensation" | "sessions" | "activity" | "lifecycle";

const STAFF_TABS: Array<{ id: StaffTab; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "Overview", icon: <CircleUserRound size={14} /> },
  { id: "identity", label: "Identity", icon: <UserRound size={14} /> },
  { id: "employment", label: "Employment", icon: <Building2 size={14} /> },
  { id: "access", label: "Roles & Permissions", icon: <ShieldCheck size={14} /> },
  { id: "assignments", label: "Assignments", icon: <MapPin size={14} /> },
  { id: "compensation", label: "Compensation", icon: <WalletCards size={14} /> },
  { id: "sessions", label: "Sessions", icon: <KeyRound size={14} /> },
  { id: "activity", label: "Activity & Audit", icon: <Activity size={14} /> },
  { id: "lifecycle", label: "Lifecycle", icon: <Clock3 size={14} /> },
];

const emptyStaff: User = {
  id: "", userId: "", employeeId: "", username: "", passwordHash: "", role: "CASHIER", status: "Active",
  photo: "", fullName: "", displayName: "", employeeCode: "", gender: "", dateOfBirth: "", mobile: "",
  email: "", emergencyContact: "", address: "", city: "", state: "", country: "India", pinCode: "",
  department: "", designation: "", branch: "", dateOfJoining: "", reportingManager: "", employmentType: "Permanent",
  allowedBranches: [], preferences: { theme: "dark", language: "English", timeZone: "Asia/Kolkata" }, notificationSettings: { salaryCredit: true, commissionEarned: true, targetAchievement: true, travelClaimApproval: true, leaveApproval: true, attendanceAlerts: true, holidayWeeklyOff: true, birthdayAnniversary: true, policyAnnouncements: true },
};

const displayValue = (value: unknown, fallback = "Not provided") => value === undefined || value === null || value === "" ? fallback : String(value);

const StaffMasterWsBase: React.FC<StaffMasterWsProps> = ({ currentUser, onNotification }) => {
  const [staff, setStaff] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selected, setSelected] = useState<User>(emptyStaff);
  const [activeTab, setActiveTab] = useState<StaffTab>("overview");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editDraft, setEditDraft] = useState({ fullName: "", displayName: "", department: "", designation: "", branch: "", status: "Active" });
  const [showNew, setShowNew] = useState(false);
  const [newStaff, setNewStaff] = useState({ fullName: "", username: "", password: "", role: "CASHIER" });

  const loadStaff = async () => {
    setLoading(true);
    try {
      const response = await apiFetchV1<{ users?: User[] }>("/users/");
      const rows = Array.isArray(response) ? response : response?.users || [];
      setStaff(rows);
      if (!selectedId && rows[0]?.id) setSelectedId(rows[0].id);
    } catch (error: any) {
      onNotification?.("Staff Load Error", error?.message || "Unable to load staff records.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStaff(); }, []);

  useEffect(() => {
    if (!selectedId) return;
    setDetailLoading(true);
    apiFetchV1<User>(`/users/${selectedId}`)
      .then((user) => {
        setSelected(user);
        setEditDraft({ fullName: user.fullName, displayName: user.displayName, department: user.department, designation: user.designation, branch: user.branch, status: user.status });
      })
      .catch((error: any) => onNotification?.("Staff Detail Error", error?.message || "Unable to load staff details.", "error"))
      .finally(() => setDetailLoading(false));
  }, [selectedId, onNotification]);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staff;
    return staff.filter((person) => [person.fullName, person.username, person.role, person.department, person.designation, person.branch]
      .some((value) => String(value || "").toLowerCase().includes(query)));
  }, [search, staff]);

  const activeCount = staff.filter((person) => person.status === "Active").length;
  const adminCount = staff.filter((person) => ["SYSADMIN", "ADMIN", "MANAGER"].includes(String(person.role))).length;

  const handleCreate = async () => {
    if (!newStaff.fullName || !newStaff.username || !newStaff.password) {
      onNotification?.("Required Fields", "Name, username, and an explicit temporary password are required.", "error");
      return;
    }
    try {
      const created = await apiFetchV1<User>("/users/", { method: "POST", body: { fullName: newStaff.fullName, username: newStaff.username, role: newStaff.role, passwordHash: newStaff.password } });
      onNotification?.("Staff Created", `${newStaff.fullName} was added to Staff 360.`, "success");
      setNewStaff({ fullName: "", username: "", password: "", role: "CASHIER" });
      setShowNew(false);
      setSelectedId(created.id);
      await loadStaff();
    } catch (error: any) {
      onNotification?.("Staff Creation Failed", error?.message || "Unable to create staff account.", "error");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await apiFetchV1<User>(`/users/${selected.id}`, { method: "PATCH", body: editDraft });
      setSelected(updated);
      setIsEditing(false);
      onNotification?.("Staff Updated", `${updated.fullName} was saved successfully.`, "success");
      await loadStaff();
    } catch (error: any) {
      onNotification?.("Staff Update Failed", error?.message || "Unable to save staff changes.", "error");
    } finally {
      setSaving(false);
    }
  };

  const renderField = (label: string, value: unknown, sensitive = false) => (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{sensitive ? "Restricted field" : displayValue(value)}</div>
    </div>
  );

  const renderUnavailable = (title: string, description: string) => (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 p-8 text-center">
      <XCircle size={28} className="text-slate-400" />
      <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-slate-500">{description}</p>
    </div>
  );

  const renderTab = () => {
    if (detailLoading) return <div className="p-8 text-sm text-slate-500">Loading staff record...</div>;
    if (!selectedId) return renderUnavailable("Select a staff member", "Choose a staff record from the directory to inspect its governed workspace.");
    switch (activeTab) {
      case "overview":
        return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {renderField("Account status", selected.status)}
          {renderField("Employee code", selected.employeeCode || selected.employeeId)}
          {renderField("Role", selected.role)}
          {renderField("Department", selected.department)}
          {renderField("Designation", selected.designation)}
          {renderField("Current branch", selected.branch)}
          {renderField("Last login", undefined)}
          {renderField("MFA status", undefined)}
          {renderField("Risk flags", "None reported")}
        </div>;
      case "identity":
        return <div className="grid gap-3 sm:grid-cols-2">{renderField("Full name", selected.fullName)}{renderField("Display name", selected.displayName)}{renderField("Username", selected.username)}{renderField("Email", selected.email)}{renderField("Mobile", selected.mobile)}{renderField("Date of birth", selected.dateOfBirth)}{renderField("Address", selected.address)}{renderField("Photo", selected.photo ? "Available" : "Not provided")}</div>;
      case "employment":
        return <div className="grid gap-3 sm:grid-cols-2">{renderField("Employee ID", selected.employeeId)}{renderField("Employment type", selected.employmentType)}{renderField("Date of joining", selected.dateOfJoining)}{renderField("Reporting manager", selected.reportingManager)}{renderField("Department", selected.department)}{renderField("Designation", selected.designation)}{renderField("Emergency contact", selected.emergencyContact)}</div>;
      case "access":
        return <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2">{renderField("System role", selected.role)}{renderField("Role source", "Enum role")}{renderField("Menu access", "Resolved by security policy")}{renderField("Sensitive data", "Permission-gated")}</div>{renderUnavailable("Permission diff requires access contract", "The current backend exposes menu access policy but not a staff-specific effective-permission diff endpoint. No permissions are fabricated here.")}</div>;
      case "assignments":
        return <div className="grid gap-3 sm:grid-cols-2">{renderField("Company", "Resolved by active tenant context")}{renderField("Default branch", selected.branchId || selected.branch)}{renderField("Allowed branches", selected.allowedBranches?.join(", "))}{renderField("Store assignments", undefined)}</div>;
      case "compensation":
        return <div className="grid gap-3 sm:grid-cols-2">{renderField("Compensation access", "Restricted by staff.compensation permission")}{renderField("Salary", selected.salary?.fixedMonthly, true)}{renderField("Payment details", selected.payment?.bankDetails, true)}{renderField("Performance metrics", selected.performance?.monthlySales, true)}</div>;
      case "sessions": return renderUnavailable("Session management is not connected", "The next access-domain contract should expose active sessions, devices, revocation, MFA, and forced password reset state.");
      case "activity": return renderUnavailable("Staff audit stream is not connected", "Staff mutations should be backed by authoritative server audit events before this tab presents history.");
      case "lifecycle": return <div className="grid gap-3 sm:grid-cols-2">{renderField("Current lifecycle", selected.status)}{renderField("Termination state", "Not terminated")}{renderField("Password reset", "Use explicit reset contract")}{renderField("Last state change", undefined)}</div>;
    }
  };

  return <div className="flex h-full min-h-0 overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/70">
      <div className="space-y-3 border-b border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Users size={18} className="text-indigo-600" /><span className="text-sm font-black">Staff Directory</span></div><div className="flex gap-1"><button title="Refresh staff" onClick={loadStaff} className="rounded-lg border border-slate-200 p-1.5 dark:border-slate-700"><RefreshCw size={14} /></button><button title="Create staff" onClick={() => setShowNew(true)} className="rounded-lg bg-indigo-600 p-1.5 text-white"><Plus size={14} /></button></div></div>
        <div className="relative"><Search size={14} className="absolute left-3 top-2.5 text-slate-400" /><input aria-label="Search staff" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff, role, branch..." className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs outline-none dark:border-slate-700 dark:bg-slate-800" /></div>
      </div>
      <div className="grid grid-cols-3 gap-2 border-b border-slate-200 p-3 text-center dark:border-slate-800"><div><div className="text-lg font-black">{staff.length}</div><div className="text-[10px] text-slate-500">Staff</div></div><div><div className="text-lg font-black text-emerald-600">{activeCount}</div><div className="text-[10px] text-slate-500">Active</div></div><div><div className="text-lg font-black text-indigo-600">{adminCount}</div><div className="text-[10px] text-slate-500">Admin</div></div></div>
      <div className="min-h-0 flex-1 overflow-y-auto">{loading ? <div className="p-6 text-xs text-slate-500">Loading staff directory...</div> : filteredStaff.map((person) => <button key={person.id} onClick={() => { setSelectedId(person.id); setActiveTab("overview"); }} className={`w-full border-b border-slate-100 p-3 text-left dark:border-slate-800 ${person.id === selectedId ? "border-l-4 border-l-indigo-600 bg-indigo-50 dark:bg-indigo-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}><div className="flex items-center justify-between"><span className="truncate text-xs font-bold">{displayValue(person.fullName, person.username)}</span><span className="text-[9px] font-mono text-indigo-600">{person.role}</span></div><div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{displayValue(person.designation, "Operator")}</span><span>{displayValue(person.branch, "No branch")}</span></div></button>)}</div>
    </aside>
    <section className="min-w-0 flex-1 overflow-y-auto"><div className="border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/70"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs uppercase tracking-widest text-indigo-600"><ShieldCheck size={14} />Staff 360</div><h1 className="mt-1 text-xl font-black">{displayValue(selected.fullName, "Staff & User Access Management")}</h1><p className="mt-1 text-xs text-slate-500">Identity, employment, access scope, sensitive data, sessions, audit, and lifecycle governance.</p></div><div className="flex items-center gap-2"><div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700"><CheckCircle2 size={14} className="text-emerald-500" />{currentUser?.role || "Authorized operator"}</div>{selectedId && !isEditing && <button onClick={() => setIsEditing(true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Edit Staff</button>}{isEditing && <><button onClick={() => setIsEditing(false)} className="rounded-lg border px-3 py-2 text-xs">Cancel</button><button disabled={saving} onClick={handleSave} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">{saving ? "Saving..." : "Save Changes"}</button></>}</div></div>{isEditing && <div className="mt-4 grid gap-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/20 sm:grid-cols-2"><input aria-label="Edit full name" value={editDraft.fullName} onChange={(e) => setEditDraft({ ...editDraft, fullName: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Full name" /><input aria-label="Edit display name" value={editDraft.displayName} onChange={(e) => setEditDraft({ ...editDraft, displayName: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Display name" /><input aria-label="Edit department" value={editDraft.department} onChange={(e) => setEditDraft({ ...editDraft, department: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Department" /><input aria-label="Edit designation" value={editDraft.designation} onChange={(e) => setEditDraft({ ...editDraft, designation: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Designation" /><input aria-label="Edit branch" value={editDraft.branch} onChange={(e) => setEditDraft({ ...editDraft, branch: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Branch" /><select aria-label="Edit status" value={editDraft.status} onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option>Active</option><option>Inactive</option><option>Suspended</option></select></div>}<div className="mt-5 flex gap-1 overflow-x-auto">{STAFF_TABS.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === tab.id ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{tab.icon}{tab.label}</button>)}</div></div><div className="p-5">{renderTab()}</div></section>
    {showNew && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-900"><div className="flex items-center justify-between"><h2 className="text-base font-black">Create Staff Account</h2><button title="Close" onClick={() => setShowNew(false)}>×</button></div><p className="mt-1 text-xs text-slate-500">An explicit temporary password is required. No default credentials are generated.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><input aria-label="Full name" placeholder="Full name" value={newStaff.fullName} onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" /><input aria-label="Username" placeholder="Username" value={newStaff.username} onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" /><input aria-label="Temporary password" type="password" placeholder="Temporary password" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" /><select aria-label="Role" value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="CASHIER">CASHIER</option><option value="MANAGER">MANAGER</option><option value="ADMIN">ADMIN</option></select></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowNew(false)} className="rounded-lg border px-3 py-2 text-xs">Cancel</button><button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Create Staff</button></div></div></div>}
  </div>;
};

export const StaffMasterWs = withCapability(StaffMasterWsBase, {
  entity: "hr_domain",
  capability: "hr.staff_master",
  role: "CANONICAL",
  canonicalOwner: "StaffMasterWs.tsx",
  decisionId: "ADR-HR-001",
});

export default StaffMasterWs;
