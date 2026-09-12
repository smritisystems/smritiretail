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
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  ClipboardCheck,
  Clock3,
  KeyRound,
  MapPin,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
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
import { collectCustomerOptions } from "./staffCustomerLoader";
import StaffPrintModal from "./StaffPrintModal.tsx";
import { dateAfter, validateReassignment } from "./staffPlacementHelpers.ts";

export interface StaffMasterWsProps {
  currentUser?: { role: string; name: string } | null;
  onNotification?: (title: string, message: string, type: "success" | "error" | "info" | "warning") => void;
}

type StaffTab = "overview" | "identity" | "employment" | "attendance" | "leave" | "access" | "assignments" | "compensation" | "sessions" | "activity" | "lifecycle";

const STAFF_TABS: Array<{ id: StaffTab; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "Overview", icon: <CircleUserRound size={14} /> },
  { id: "identity", label: "Identity", icon: <UserRound size={14} /> },
  { id: "employment", label: "Employment", icon: <Building2 size={14} /> },
  { id: "attendance", label: "Attendance", icon: <CalendarDays size={14} /> },
  { id: "leave", label: "Leave", icon: <ClipboardCheck size={14} /> },
  { id: "access", label: "Roles & Permissions", icon: <ShieldCheck size={14} /> },
  { id: "assignments", label: "Assignments", icon: <MapPin size={14} /> },
  { id: "compensation", label: "Compensation", icon: <WalletCards size={14} /> },
  { id: "sessions", label: "Sessions", icon: <KeyRound size={14} /> },
  { id: "activity", label: "Activity & Audit", icon: <Activity size={14} /> },
  { id: "lifecycle", label: "Lifecycle", icon: <Clock3 size={14} /> },
];

const STORE_ROLE_OPTIONS = ["Sales Executive", "Store Manager", "Cashier", "Brand Promoter", "Visual Merchandiser", "Stock Associate", "Security" ];

const emptyStaff: User = {
  id: "", userId: "", employeeId: "", username: "", passwordHash: "", role: "CASHIER", status: "Active",
  photo: "", fullName: "", displayName: "", employeeCode: "", gender: "", dateOfBirth: "", mobile: "",
  email: "", emergencyContact: "", address: "", city: "", state: "", country: "India", pinCode: "",
  department: "", designation: "", branch: "", dateOfJoining: "", reportingManager: "", employmentType: "Permanent",
  allowedBranches: [], preferences: { theme: "dark", language: "English", timeZone: "Asia/Kolkata" }, notificationSettings: { salaryCredit: true, commissionEarned: true, targetAchievement: true, travelClaimApproval: true, leaveApproval: true, attendanceAlerts: true, holidayWeeklyOff: true, birthdayAnniversary: true, policyAnnouncements: true },
};

const displayValue = (value: unknown, fallback = "Not provided") => value === undefined || value === null || value === "" ? fallback : String(value);

const storeCode = (location: { store_code?: string; storeCode?: string }) => location.store_code || location.storeCode || "Store code unavailable";
const storeName = (location: { location_name?: string; locationName?: string }) => location.location_name || location.locationName || "Store name unavailable";
const storeLabel = (location: { store_code?: string; storeCode?: string; location_name?: string; locationName?: string }) => `${storeCode(location)} · ${storeName(location)}`;

const StaffMasterWsBase: React.FC<StaffMasterWsProps> = ({ currentUser, onNotification }) => {
  const [staff, setStaff] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selected, setSelected] = useState<User>(emptyStaff);
  const [activeTab, setActiveTab] = useState<StaffTab>("overview");
  const [search, setSearch] = useState("");
  const [showDirectory, setShowDirectory] = useState(true);
  const [showPrint, setShowPrint] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editDraft, setEditDraft] = useState({ fullName: "", displayName: "", department: "", designation: "", branch: "", status: "Active", role: "CASHIER" });
  const [showNew, setShowNew] = useState(false);
  const [newStaff, setNewStaff] = useState({ fullName: "", username: "", password: "", role: "CASHIER" });
  const [attendance, setAttendance] = useState<Array<{ id: string; attendance_date: string; status: string; check_in_at?: string; check_out_at?: string }>>([]);
  const [attendanceFrom, setAttendanceFrom] = useState("");
  const [attendanceTo, setAttendanceTo] = useState("");
  const [leaveRequests, setLeaveRequests] = useState<Array<{ id: string; leave_type: string; start_date: string; end_date: string; total_days: number; status: string; reason?: string }>>([]);
  const [placements, setPlacements] = useState<Array<{ id: string; placement_type: string; host_store_code?: string; host_store_name?: string; host_customer_id?: string; internal_branch_id?: string; internal_branch_code?: string; internal_branch_name?: string; internal_store_code?: string; internal_store_name?: string; role_at_location?: string; stock_model: string; effective_from: string; effective_to?: string; status: string }>>([]);
  const [hrLoading, setHrLoading] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [reassignSaving, setReassignSaving] = useState(false);
  const [reassignRoleMode, setReassignRoleMode] = useState("Sales Executive");
  const [reassignDraft, setReassignDraft] = useState({ placementType: "THIRD_PARTY_STORE", internalBranchId: "", internalStoreId: "", hostCustomerId: "", hostDeliveryLocationId: "", roleAtLocation: "", stockModel: "OUTRIGHT_SALE", effectiveFrom: new Date().toISOString().slice(0, 10) });
  const [showAssign, setShowAssign] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignRoleMode, setAssignRoleMode] = useState("Sales Executive");
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [locations, setLocations] = useState<Array<{ id: string; store_code?: string; storeCode?: string; location_name?: string; locationName?: string; address_line1?: string; city?: string; state?: string; pincode?: string }>>([]);
  const [assignDraft, setAssignDraft] = useState({ placementType: "THIRD_PARTY_STORE", internalBranchId: "", internalStoreId: "", customerId: "", locationId: "", roleAtLocation: "", effectiveFrom: new Date().toISOString().slice(0, 10) });
  const [branches, setBranches] = useState<Array<{ id: string; code?: string; name?: string }>>([]);
  const [stores, setStores] = useState<Array<{ id: string; code?: string; name?: string; branch_id?: string }>>([]);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const response = await apiFetchV1<{ users?: User[] }>("/staff/directory");
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
    apiFetchV1<User>(`/staff/directory/${selectedId}`)
      .then((user) => {
        setSelected(user);
        setEditDraft({ fullName: user.fullName, displayName: user.displayName, department: user.department, designation: user.designation, branch: user.branch, status: user.status, role: user.role });
      })
      .catch((error: any) => onNotification?.("Staff Detail Error", error?.message || "Unable to load staff details.", "error"))
      .finally(() => setDetailLoading(false));
  }, [selectedId, onNotification]);

  useEffect(() => {
    if (!selectedId || !["attendance", "leave", "assignments"].includes(activeTab)) return;
    setHrLoading(true);
    let endpoint = "";
    if (activeTab === "attendance") {
      endpoint = `/staff/attendance?user_id=${encodeURIComponent(selectedId)}`;
      if (attendanceFrom) endpoint += `&from_date=${attendanceFrom}`;
      if (attendanceTo) endpoint += `&to_date=${attendanceTo}`;
    } else if (activeTab === "leave") {
      endpoint = `/staff/leave/requests?user_id=${encodeURIComponent(selectedId)}`;
    } else {
      endpoint = `/staff/placements?user_id=${encodeURIComponent(selectedId)}&_staff360=${Date.now()}`;
    }
    apiFetchV1<{ records?: typeof attendance; requests?: typeof leaveRequests; placements?: typeof placements }>(endpoint, { cache: "no-store" })
      .then(async (data) => {
        if (activeTab === "attendance") {
          setAttendance(Array.isArray(data.records) ? data.records : []);
          return;
        }
        if (activeTab === "leave") {
          setLeaveRequests(Array.isArray(data.requests) ? data.requests : []);
          return;
        }
        if (activeTab === "assignments") {
          if (data.placements?.length) {
            setPlacements(data.placements);
            return;
          }
          const retry = await apiFetchV1<{ placements?: typeof placements }>(`${endpoint}&_retry=${Date.now()}`, { cache: "no-store" });
          setPlacements(retry.placements || []);
        }
      })
      .catch((error: any) => onNotification?.("HR Data Error", error?.message || "Unable to load HR records.", "error"))
      .finally(() => setHrLoading(false));
  }, [activeTab, selectedId, attendanceFrom, attendanceTo, onNotification]);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staff;
    return staff.filter((person) => [person.fullName, person.username, person.role, person.department, person.designation, person.branch]
      .some((value) => String(value || "").toLowerCase().includes(query)));
  }, [search, staff]);

  const activeCount = staff.filter((person) => person.status === "Active").length;
  const adminCount = staff.filter((person) => ["SYSADMIN", "ADMIN", "MANAGER"].includes(String(person.role))).length;
  const profileFields = [selected.fullName, selected.employeeId || selected.employeeCode, selected.email, selected.mobile, selected.department, selected.designation, selected.branch, selected.dateOfJoining, selected.reportingManager, selected.photo];
  const profileCompletion = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);
  const photoUrl = selected.photo && !selected.photo.startsWith("data:") ? selected.photo : "";

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
      const updated = await apiFetchV1<User>(`/staff/directory/${selected.id}/profile`, { method: "PATCH", body: editDraft });
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

  const openAssign = async () => {
    setShowAssign(true);
    setAssignDraft({ placementType: "THIRD_PARTY_STORE", internalBranchId: "", internalStoreId: "", customerId: "", locationId: "", roleAtLocation: "", effectiveFrom: new Date().toISOString().slice(0, 10) });
    setAssignRoleMode("Sales Executive");
    if (customers.length) return;
    try {
      const rows = await collectCustomerOptions((endpoint) => apiFetchV1<any>(endpoint));
      setCustomers(rows);
    } catch (error: any) {
      onNotification?.("Customer Load Error", error?.message || "Unable to load approved customers.", "error");
    }
  };

  const openReassign = async () => {
    const activePlacement = placements.find((placement) => placement.status === "ACTIVE");
    if (!activePlacement) return;
    setShowReassign(true);
    setReassignRoleMode("Sales Executive");
    setReassignDraft((draft) => ({ ...draft, placementType: "THIRD_PARTY_STORE", hostCustomerId: "", hostDeliveryLocationId: "", roleAtLocation: "", effectiveFrom: dateAfter(activePlacement.effective_from) }));
    if (customers.length) return;
    try {
      const rows = await collectCustomerOptions((endpoint) => apiFetchV1<any>(endpoint));
      setCustomers(rows);
    } catch (error: any) {
      onNotification?.("Customer Load Error", error?.message || "Unable to load approved customers.", "error");
    }
  };

  const handleAssign = async () => {
    if (assignDraft.placementType === "INTERNAL_BRANCH" && !assignDraft.internalBranchId) {
      onNotification?.("Branch Required", "Select the company-owned branch for this assignment.", "error");
      return;
    }
    if (assignDraft.placementType !== "INTERNAL_BRANCH" && (!assignDraft.customerId || !assignDraft.locationId)) {
      onNotification?.("Location Required", "Select a customer and approved delivery location.", "error");
      return;
    }
    setAssignSaving(true);
    try {
      const created = await apiFetchV1<{ id: string }>(`/staff/users/${selected.id}/placements`, {
        method: "POST",
        body: assignDraft.placementType === "INTERNAL_BRANCH"
          ? { placement_type: "INTERNAL_BRANCH", internal_branch_id: assignDraft.internalBranchId, internal_store_id: assignDraft.internalStoreId || undefined, role_at_location: assignDraft.roleAtLocation || undefined, stock_model: "OUTRIGHT_SALE", effective_from: assignDraft.effectiveFrom }
          : { placement_type: "THIRD_PARTY_STORE", host_customer_id: assignDraft.customerId, host_delivery_location_id: assignDraft.locationId, role_at_location: assignDraft.roleAtLocation || undefined, stock_model: "OUTRIGHT_SALE", effective_from: assignDraft.effectiveFrom },
      });
      await apiFetchV1(`/staff/placements/${created.id}/decision`, { method: "PATCH", body: { status: "ACTIVE", approval_reason: "Approved from Staff 360" } });
      setShowAssign(false);
      setActiveTab("assignments");
      onNotification?.("Staff Assigned", "The approved store placement is now active.", "success");
      const data = await apiFetchV1<{ placements?: typeof placements }>(`/staff/placements?user_id=${encodeURIComponent(selected.id)}&_staff360=${Date.now()}`, { cache: "no-store" });
      setPlacements(data.placements || []);
    } catch (error: any) {
      onNotification?.("Assignment Failed", error?.message || "Unable to assign the staff member.", "error");
    } finally {
      setAssignSaving(false);
    }
  };

  useEffect(() => {
    if (!showAssign) return;
    apiFetchV1<{ branches?: typeof branches; stores?: typeof stores }>("/staff/placement-options")
      .then((data) => { setBranches(data.branches || []); setStores(data.stores || []); })
      .catch(async () => {
        const [branchRows, storeRows] = await Promise.all([
          apiFetchV1<any[]>("/masters/branches"),
          apiFetchV1<any[]>("/masters/stores"),
        ]);
        setBranches(Array.isArray(branchRows) ? branchRows : []);
        setStores(Array.isArray(storeRows) ? storeRows : []);
      })
      .catch(() => { setBranches([]); setStores([]); });
  }, [showAssign]);

  useEffect(() => {
    if (assignDraft.placementType !== "INTERNAL_BRANCH" || !assignDraft.internalBranchId) return;
    setAssignDraft((draft) => ({ ...draft, internalStoreId: "" }));
  }, [assignDraft.placementType, assignDraft.internalBranchId]);

  useEffect(() => {
    if (!assignDraft.customerId) { setLocations([]); return; }
    apiFetchV1<any[]>(`/crm/customers/${assignDraft.customerId}/delivery-locations`)
      .then((rows) => setLocations(Array.isArray(rows) ? rows : []))
      .catch(() => setLocations([]));
  }, [assignDraft.customerId]);

  useEffect(() => {
    if (!reassignDraft.hostCustomerId) { setLocations([]); return; }
    apiFetchV1<any[]>(`/crm/customers/${reassignDraft.hostCustomerId}/delivery-locations`)
      .then((rows) => setLocations(Array.isArray(rows) ? rows : []))
      .catch(() => setLocations([]));
  }, [reassignDraft.hostCustomerId]);

  const handleReassign = async () => {
    const activePlacement = placements.find((placement) => placement.status === "ACTIVE");
    if (!activePlacement) return;
    const validation = validateReassignment(
      {
        placementType: reassignDraft.placementType,
        hostCustomerId: reassignDraft.hostCustomerId || undefined,
        hostDeliveryLocationId: reassignDraft.hostDeliveryLocationId || undefined,
        internalBranchId: reassignDraft.internalBranchId || undefined,
        internalStoreId: reassignDraft.internalStoreId || undefined,
        roleAtLocation: reassignDraft.roleAtLocation || undefined,
        stockModel: reassignDraft.stockModel,
        effectiveFrom: reassignDraft.effectiveFrom,
      },
      activePlacement,
    );
    if (!validation.valid) {
      onNotification?.(validation.errorTitle || "Validation Error", validation.errorMessage || "Check reassignment values.", "error");
      return;
    }
    setReassignSaving(true);
    try {
      const result = await apiFetchV1<{ replacement: typeof placements[number] }>(`/staff/users/${selected.id}/placements/reassign`, {
        method: "POST",
        body: {
          current_placement_id: activePlacement.id,
          placement_type: reassignDraft.placementType,
          host_customer_id: reassignDraft.hostCustomerId || undefined,
          host_delivery_location_id: reassignDraft.hostDeliveryLocationId || undefined,
          role_at_location: reassignDraft.roleAtLocation || undefined,
          stock_model: reassignDraft.stockModel,
          effective_from: reassignDraft.effectiveFrom,
        },
      });
      setShowReassign(false);
      onNotification?.("Placement Reassignment Submitted", "The previous placement was closed and the replacement is pending manager approval.", "success");
      const data = await apiFetchV1<{ placements?: typeof placements }>(`/staff/placements?user_id=${encodeURIComponent(selected.id)}&_staff360=${Date.now()}`, { cache: "no-store" });
      setPlacements(data.placements || (result.replacement ? [result.replacement] : []));
    } catch (error: any) {
      onNotification?.("Placement Reassignment Failed", error?.message || "Unable to reassign this staff member.", "error");
    } finally {
      setReassignSaving(false);
    }
  };

  const handleApprovePlacement = async (placementId: string) => {
    try {
      await apiFetchV1(`/staff/placements/${placementId}/decision`, {
        method: "PATCH",
        body: { status: "ACTIVE", approval_reason: "Approved from Staff 360" },
      });
      onNotification?.("Placement Approved", "The placement is now active.", "success");
      const data = await apiFetchV1<{ placements?: typeof placements }>(`/staff/placements?user_id=${encodeURIComponent(selected.id)}&_staff360=${Date.now()}`, { cache: "no-store" });
      setPlacements(data.placements || []);
    } catch (error: any) {
      onNotification?.("Approval Failed", error?.message || "Unable to approve placement.", "error");
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
        return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950/30"><div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-indigo-700 dark:text-indigo-300"><span>Profile completion</span><span className="font-black">{profileCompletion}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-950"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${profileCompletion}%` }} /></div></div><div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30"><div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300"><BadgeCheck size={14} />Identity status</div><div className="mt-2 text-sm font-bold">{selected.email && selected.mobile ? "Contact details present" : "Contact details incomplete"}</div></div><div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><div className="text-[10px] uppercase tracking-wide text-slate-500">Photo visibility</div><div className="mt-2 text-sm font-bold">{photoUrl ? "Object URL available" : "Not provided"}</div></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {renderField("Account status", selected.status)}
          {renderField("Employee code", selected.employeeCode || selected.employeeId)}
          {renderField("Role", selected.role)}
          {renderField("Department", selected.department)}
          {renderField("Designation", selected.designation)}
          {renderField("Current branch", selected.branch)}
          {renderField("Last login", undefined)}
          {renderField("MFA status", undefined)}
          {renderField("Risk flags", "None reported")}
        </div></div>;
      case "identity":
        return <div className="space-y-4"><div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">{photoUrl ? <img src={photoUrl} alt={`${displayValue(selected.fullName, "Staff")} profile`} className="h-20 w-20 rounded-xl object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-indigo-100 text-2xl font-black text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{displayValue(selected.fullName, "S").charAt(0).toUpperCase()}</div>}<div><div className="text-sm font-bold">Staff photo</div><div className="mt-1 text-xs text-slate-500">{photoUrl ? "Loaded from an approved object-storage URL." : selected.photo ? "Legacy inline image is hidden until migrated to object storage." : "No photo has been added."}</div></div></div><div className="grid gap-3 sm:grid-cols-2">{renderField("Full name", selected.fullName)}{renderField("Display name", selected.displayName)}{renderField("Username", selected.username)}{renderField("Email", selected.email)}{renderField("Mobile", selected.mobile)}{renderField("Date of birth", selected.dateOfBirth)}{renderField("Address", selected.address)}{renderField("Photo", photoUrl ? "Object URL available" : "Not provided")}</div></div>;
      case "employment":
        return <div className="grid gap-3 sm:grid-cols-2">{renderField("Employee ID", selected.employeeId)}{renderField("Employment type", selected.employmentType)}{renderField("Date of joining", selected.dateOfJoining)}{renderField("Reporting manager", selected.reportingManager)}{renderField("Department", selected.department)}{renderField("Designation", selected.designation)}{renderField("Emergency contact", selected.emergencyContact)}</div>;
      case "attendance":
        return hrLoading ? <div className="p-8 text-sm text-slate-500">Loading attendance...</div> : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300">Date Range:</span>
                <input
                  aria-label="From date"
                  type="date"
                  value={attendanceFrom}
                  onChange={(e) => setAttendanceFrom(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs outline-none dark:border-slate-700 dark:bg-slate-800"
                />
                <span className="text-slate-400">to</span>
                <input
                  aria-label="To date"
                  type="date"
                  value={attendanceTo}
                  onChange={(e) => setAttendanceTo(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs outline-none dark:border-slate-700 dark:bg-slate-800"
                />
                {(attendanceFrom || attendanceTo) && (
                  <button
                    onClick={() => { setAttendanceFrom(""); setAttendanceTo(""); }}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {renderField("Records this view", attendance.length)}
              {renderField("Present / late", attendance.filter((record) => ["PRESENT", "LATE"].includes(record.status)).length)}
              {renderField("Leave / absent", attendance.filter((record) => ["LEAVE", "ABSENT"].includes(record.status)).length)}
            </div>
            {attendance.length ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="grid grid-cols-4 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  <span>Date</span><span>Status</span><span>Check in</span><span>Check out</span>
                </div>
                {attendance.map((record) => (
                  <div key={record.id} className="grid grid-cols-4 gap-3 border-b border-slate-100 px-4 py-3 text-xs last:border-0 dark:border-slate-800">
                    <span>{record.attendance_date}</span>
                    <span className="font-bold">{record.status}</span>
                    <span>{record.check_in_at ? new Date(record.check_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</span>
                    <span>{record.check_out_at ? new Date(record.check_out_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}</span>
                  </div>
                ))}
              </div>
            ) : renderUnavailable("No attendance records", "Attendance will appear here after an authorized attendance entry is recorded.")}
          </div>
        );
      case "leave":
        return hrLoading ? <div className="p-8 text-sm text-slate-500">Loading leave requests...</div> : leaveRequests.length ? <div className="space-y-3">{leaveRequests.map((request) => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div><div className="text-sm font-bold">{request.leave_type} leave · {request.total_days} day{request.total_days === 1 ? "" : "s"}</div><div className="mt-1 text-xs text-slate-500">{request.start_date} to {request.end_date}{request.reason ? ` · ${request.reason}` : ""}</div></div><span className="rounded-full border border-amber-200 px-2 py-1 text-[10px] font-bold text-amber-700 dark:border-amber-900 dark:text-amber-300">{request.status}</span></div>)}</div> : renderUnavailable("No leave requests", "Leave applications and manager decisions will appear here from the canonical HR workflow.");
      case "access":
        return <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2">{renderField("Type of staff role", selected.role)}{renderField("Role source", "System access role")}{renderField("Menu access", "Resolved by security policy")}{renderField("Sensitive data", "Permission-gated")}</div><div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/20"><label className="text-[10px] font-bold uppercase tracking-wide text-slate-500" htmlFor="staff-role-editor">Type of staff role</label><select id="staff-role-editor" aria-label="Type of staff role" value={editDraft.role} onChange={(event) => { setEditDraft({ ...editDraft, role: event.target.value }); setIsEditing(true); }} className="mt-2 w-full rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="CASHIER">CASHIER</option><option value="MANAGER">MANAGER</option><option value="REPORT_USER">REPORT USER</option><option value="VIEWER">VIEWER</option><option value="SYSADMIN">SYSADMIN</option></select><p className="mt-2 text-xs text-slate-500">Use Save Changes above to apply the access role.</p></div>{renderUnavailable("Permission diff requires access contract", "The current backend exposes menu access policy but not a staff-specific effective-permission diff endpoint. No permissions are fabricated here.")}</div>;
      case "assignments": {
        const activePlacement = placements.find((placement) => placement.status === "ACTIVE");
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid gap-3 sm:grid-cols-2">{renderField("Company", "Resolved by active tenant context")}{renderField("Default store code", selected.branchId || selected.branch)}{renderField("Allowed branches", selected.allowedBranches?.join(", "))}</div>
              <div className="flex gap-2">
                <button onClick={openAssign} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Assign Store</button>
                {activePlacement && <button onClick={openReassign} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">Reassign</button>}
              </div>
            </div>
            {placements.length ? (
              <div className="space-y-3">{placements.map((placement) => <div key={placement.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-sm font-bold">{placement.placement_type === "INTERNAL_BRANCH" ? `${placement.internal_store_code ? `${placement.internal_store_code} · ${placement.internal_store_name || "Unnamed store"}` : `${placement.internal_branch_code || "No code"} · ${placement.internal_branch_name || "Internal branch"}`}` : `${placement.host_store_code || "No code"} · ${placement.host_store_name || "Partner store"}`}</div><div className="mt-1 text-xs text-slate-500">{placement.placement_type === "INTERNAL_BRANCH" ? `${placement.internal_store_code ? "Company-owned store" : "Company branch only"}` : `Partner store: ${placement.host_store_code || "Not provided"} · ${placement.host_store_name || "Store name not provided"}`}{placement.role_at_location ? ` · Role: ${placement.role_at_location}` : ""}</div></div><div className="flex items-center gap-2"><span className="rounded-full border border-indigo-200 px-2 py-1 text-[10px] font-bold text-indigo-700 dark:border-indigo-900 dark:text-indigo-300">{placement.status}</span>{placement.status === "PENDING" && <button onClick={() => handleApprovePlacement(placement.id)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-700">Approve</button>}</div></div><div className="mt-3 grid gap-3 text-xs sm:grid-cols-3"><div><div className="text-[10px] uppercase text-slate-500">Stock model</div><div className="mt-1 font-bold">{placement.stock_model}</div></div><div><div className="text-[10px] uppercase text-slate-500">Effective from</div><div className="mt-1 font-bold">{placement.effective_from}</div></div><div><div className="text-[10px] uppercase text-slate-500">Effective to</div><div className="mt-1 font-bold">{placement.effective_to || "Ongoing"}</div></div></div></div>)}</div>
            ) : renderUnavailable("No placement assigned", "Assign this staff member to an internal branch or approved partner store code to track location-specific attendance and sell-through.")}
            {showAssign && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
                <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-900">
                  <div className="flex items-center justify-between"><h2 className="text-base font-black">Assign Store</h2><button title="Close" onClick={() => setShowAssign(false)}>×</button></div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <select aria-label="Company" disabled value={selected.companyId || "ACTIVE_COMPANY"} onChange={() => undefined} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value={selected.companyId || "ACTIVE_COMPANY"}>{selected.companyId || "Active company"}</option></select>
                    <select aria-label="Assignment type" value={assignDraft.placementType} onChange={(e) => setAssignDraft({ ...assignDraft, placementType: e.target.value, internalBranchId: "", internalStoreId: "", customerId: "", locationId: "" })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="INTERNAL_BRANCH">Company branch / store</option><option value="THIRD_PARTY_STORE">Partner store</option></select>
                    {assignDraft.placementType === "INTERNAL_BRANCH" ? <>
                      <select aria-label="Company branch" value={assignDraft.internalBranchId} onChange={(e) => setAssignDraft({ ...assignDraft, internalBranchId: e.target.value, internalStoreId: "" })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="">Select company branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code || "No code"} · {branch.name || "Unnamed branch"}</option>)}</select>
                      <select aria-label="Company store" value={assignDraft.internalStoreId} onChange={(e) => setAssignDraft({ ...assignDraft, internalStoreId: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" disabled={!assignDraft.internalBranchId}><option value="">Branch-only assignment</option>{stores.filter((store) => store.branch_id === assignDraft.internalBranchId).map((store) => <option key={store.id} value={store.id}>{store.code || "No code"} · {store.name || "Unnamed store"}</option>)}</select>
                    </> : <>
                    <select aria-label="Customer" value={assignDraft.customerId} onChange={(e) => setAssignDraft({ ...assignDraft, customerId: e.target.value, locationId: "" })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                      <option value="">Select customer</option>
                      {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                    </select>
                    <select aria-label="Delivery location" value={assignDraft.locationId} onChange={(e) => setAssignDraft({ ...assignDraft, locationId: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" disabled={!assignDraft.customerId}>
                      <option value="">Select store</option>
                      {locations.map((loc) => <option key={loc.id} value={loc.id}>{storeLabel(loc)}</option>)}
                    </select>
                    </>}
                    <div className="space-y-2"><select aria-label="Role at store" value={assignRoleMode} onChange={(e) => { setAssignRoleMode(e.target.value); setAssignDraft({ ...assignDraft, roleAtLocation: e.target.value === "__CUSTOM__" ? "" : e.target.value }); }} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="">Select role at store</option>{STORE_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}<option value="__CUSTOM__">Add new store role...</option></select>{assignRoleMode === "__CUSTOM__" && <input aria-label="New role at store" value={assignDraft.roleAtLocation} onChange={(e) => setAssignDraft({ ...assignDraft, roleAtLocation: e.target.value })} className="w-full rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Enter new role at store" />}</div>
                    <input aria-label="Effective from" type="date" value={assignDraft.effectiveFrom} onChange={(e) => setAssignDraft({ ...assignDraft, effectiveFrom: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
                  </div>
                  <div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowAssign(false)} className="rounded-lg border px-3 py-2 text-xs">Cancel</button><button disabled={assignSaving} onClick={handleAssign} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">{assignSaving ? "Assigning..." : "Create Placement"}</button></div>
                </div>
              </div>
            )}
            {showReassign && activePlacement && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
                <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-900">
                  <div className="flex items-center justify-between"><h2 className="text-base font-black">Reassign Store</h2><button title="Close" onClick={() => setShowReassign(false)}>×</button></div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <select aria-label="Reassign customer" value={reassignDraft.hostCustomerId} onChange={(e) => { setReassignDraft({ ...reassignDraft, hostCustomerId: e.target.value, hostDeliveryLocationId: "" }); }} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800">
                      <option value="">Select customer</option>
                      {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
                    </select>
                    <select aria-label="Reassign delivery location" value={reassignDraft.hostDeliveryLocationId} onChange={(e) => setReassignDraft({ ...reassignDraft, hostDeliveryLocationId: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" disabled={!reassignDraft.hostCustomerId}>
                      <option value="">Select store</option>
                      {locations.filter((loc) => loc.id && reassignDraft.hostCustomerId).map((loc) => <option key={loc.id} value={loc.id}>{storeLabel(loc)}</option>)}
                    </select>
                    <div className="space-y-2"><select aria-label="Role at store" value={reassignRoleMode} onChange={(e) => { setReassignRoleMode(e.target.value); setReassignDraft({ ...reassignDraft, roleAtLocation: e.target.value === "__CUSTOM__" ? "" : e.target.value }); }} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="">Select role at store</option>{STORE_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role}</option>)}<option value="__CUSTOM__">Add new store role...</option></select>{reassignRoleMode === "__CUSTOM__" && <input aria-label="New role at store" value={reassignDraft.roleAtLocation} onChange={(e) => setReassignDraft({ ...reassignDraft, roleAtLocation: e.target.value })} className="w-full rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Enter new role at store" />}</div>
                    <input aria-label="Effective from" type="date" value={reassignDraft.effectiveFrom} onChange={(e) => setReassignDraft({ ...reassignDraft, effectiveFrom: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
                  </div>
                  <div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowReassign(false)} className="rounded-lg border px-3 py-2 text-xs">Cancel</button><button disabled={reassignSaving} onClick={handleReassign} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">{reassignSaving ? "Submitting..." : "Submit Reassignment"}</button></div>
                </div>
              </div>
            )}
          </div>
        );
      }
      case "compensation":
        return <div className="grid gap-3 sm:grid-cols-2">{renderField("Compensation access", "Restricted by staff.compensation permission")}{renderField("Salary", selected.salary?.fixedMonthly, true)}{renderField("Payment details", selected.payment?.bankDetails, true)}{renderField("Performance metrics", selected.performance?.monthlySales, true)}</div>;
      case "sessions": return renderUnavailable("Session management is not connected", "The next access-domain contract should expose active sessions, devices, revocation, MFA, and forced password reset state.");
      case "activity": return renderUnavailable("Staff audit stream is not connected", "Staff mutations should be backed by authoritative server audit events before this tab presents history.");
      case "lifecycle": return <div className="grid gap-3 sm:grid-cols-2">{renderField("Current lifecycle", selected.status)}{renderField("Termination state", "Not terminated")}{renderField("Password reset", "Use explicit reset contract")}{renderField("Last state change", undefined)}</div>;
    }
  };

  return <div className="relative flex h-full min-h-0 overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"><button title={showDirectory ? "Hide Staff Directory" : "Show Staff Directory"} aria-label={showDirectory ? "Hide Staff Directory" : "Show Staff Directory"} onClick={() => setShowDirectory((visible) => !visible)} className="absolute bottom-5 left-5 z-40 rounded-lg border border-slate-300 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">{showDirectory ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}</button><button title="Print staff form or physical ID" aria-label="Print staff form or physical ID" onClick={() => setShowPrint(true)} className="absolute bottom-5 left-16 z-40 rounded-lg border border-slate-300 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"><Printer size={16} /></button>
    {showDirectory && <aside className="flex w-80 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/70">
      <div className="space-y-3 border-b border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Users size={18} className="text-indigo-600" /><span className="text-sm font-black">Staff Directory</span></div><div className="flex gap-1"><button title="Refresh staff" onClick={loadStaff} className="rounded-lg border border-slate-200 p-1.5 dark:border-slate-700"><RefreshCw size={14} /></button><button title="Create staff" onClick={() => setShowNew(true)} className="rounded-lg bg-indigo-600 p-1.5 text-white"><Plus size={14} /></button></div></div>
        <div className="relative"><Search size={14} className="absolute left-3 top-2.5 text-slate-400" /><input aria-label="Search staff" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search staff, role, branch..." className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs outline-none dark:border-slate-700 dark:bg-slate-800" /></div>
      </div>
      <div className="grid grid-cols-3 gap-2 border-b border-slate-200 p-3 text-center dark:border-slate-800"><div><div className="text-lg font-black">{staff.length}</div><div className="text-[10px] text-slate-500">Staff</div></div><div><div className="text-lg font-black text-emerald-600">{activeCount}</div><div className="text-[10px] text-slate-500">Active</div></div><div><div className="text-lg font-black text-indigo-600">{adminCount}</div><div className="text-[10px] text-slate-500">Admin</div></div></div>
      <div className="min-h-0 flex-1 overflow-y-auto">{loading ? <div className="p-6 text-xs text-slate-500">Loading staff directory...</div> : filteredStaff.map((person) => <button key={person.id} onClick={() => { setSelectedId(person.id); setActiveTab("overview"); }} className={`w-full border-b border-slate-100 p-3 text-left dark:border-slate-800 ${person.id === selectedId ? "border-l-4 border-l-indigo-600 bg-indigo-50 dark:bg-indigo-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}><div className="flex items-center justify-between"><span className="truncate text-xs font-bold">{displayValue(person.fullName, person.username)}</span><span className="text-[9px] font-mono text-indigo-600">{person.role}</span></div><div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{displayValue(person.designation, "Operator")}</span><span>{displayValue(person.branch, "No branch")}</span></div></button>)}</div>
    </aside>}
    <section className="min-w-0 flex-1 overflow-y-auto"><div className="border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/70"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs uppercase tracking-widest text-indigo-600"><ShieldCheck size={14} />Staff 360</div><h1 className="mt-1 text-xl font-black">{displayValue(selected.fullName, "Staff & User Access Management")}</h1><p className="mt-1 text-xs text-slate-500">Identity, employment, access scope, sensitive data, sessions, audit, and lifecycle governance.</p></div><div className="flex items-center gap-2"><div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-700"><CheckCircle2 size={14} className="text-emerald-500" />{currentUser?.role || "Authorized operator"}</div>{selectedId && !isEditing && <button onClick={() => setIsEditing(true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Edit Staff</button>}{isEditing && <><button onClick={() => setIsEditing(false)} className="rounded-lg border px-3 py-2 text-xs">Cancel</button><button disabled={saving} onClick={handleSave} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">{saving ? "Saving..." : "Save Changes"}</button></>}</div></div>{isEditing && <div className="mt-4 grid gap-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/20 sm:grid-cols-2"><input aria-label="Edit full name" value={editDraft.fullName} onChange={(e) => setEditDraft({ ...editDraft, fullName: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Full name" /><input aria-label="Edit display name" value={editDraft.displayName} onChange={(e) => setEditDraft({ ...editDraft, displayName: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Display name" /><input aria-label="Edit department" value={editDraft.department} onChange={(e) => setEditDraft({ ...editDraft, department: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Department" /><input aria-label="Edit designation" value={editDraft.designation} onChange={(e) => setEditDraft({ ...editDraft, designation: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Designation" /><input aria-label="Edit branch" value={editDraft.branch} onChange={(e) => setEditDraft({ ...editDraft, branch: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="Branch" /><select aria-label="Edit status" value={editDraft.status} onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option>Active</option><option>Inactive</option><option>Suspended</option></select></div>}<div className="mt-5 flex gap-1 overflow-x-auto">{STAFF_TABS.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${activeTab === tab.id ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}`}>{tab.icon}{tab.label}</button>)}</div></div><div className="p-5">{renderTab()}</div></section>
    {showNew && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl dark:bg-slate-900"><div className="flex items-center justify-between"><h2 className="text-base font-black">Create Staff Account</h2><button title="Close" onClick={() => setShowNew(false)}>×</button></div><p className="mt-1 text-xs text-slate-500">An explicit temporary password is required. No default credentials are generated.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><input aria-label="Full name" placeholder="Full name" value={newStaff.fullName} onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" /><input aria-label="Username" placeholder="Username" value={newStaff.username} onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" /><input aria-label="Temporary password" type="password" placeholder="Temporary password" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800" /><select aria-label="Role" value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })} className="rounded-lg border p-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="CASHIER">CASHIER</option><option value="MANAGER">MANAGER</option><option value="ADMIN">ADMIN</option></select></div><div className="mt-5 flex justify-end gap-2"><button onClick={() => setShowNew(false)} className="rounded-lg border px-3 py-2 text-xs">Cancel</button><button onClick={handleCreate} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Create Staff</button></div></div></div>}
    {showPrint && <StaffPrintModal isOpen={showPrint} onClose={() => setShowPrint(false)} staff={selected} />}
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
