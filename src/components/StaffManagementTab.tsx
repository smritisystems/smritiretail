/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.2
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { 
  Users, 
  Briefcase, 
  IndianRupee, 
  Bell, 
  CreditCard, 
  Activity, 
  Search, 
  Plus, 
  MapPin, 
  Calendar, 
  Edit3, 
  Trash2,
  Lock,
  Check,
  X,
  AlertTriangle
} from "lucide-react";
import { User } from "../types.js";
import { useNotifications } from "../notifications/notification_store.tsx";
import { recordAuditAction } from "../lib/apiFetch.ts";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";

interface StaffManagementTabProps {
  currentUser?: { role: string; name: string } | null;
}

export const StaffManagementTab: React.FC<StaffManagementTabProps> = ({ currentUser }) => {
  const { addNotification } = useNotifications();
  const isReadOnly = currentUser?.role === "Report User";
  const [staff, setStaff] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"info" | "salary" | "notifications" | "payment" | "performance">("info");
  const [loading, setLoading] = useState<boolean>(true);

  // Form Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  
  // Modal Fields
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("smriti123");
  const [role, setRole] = useState("Cashier");
  const [designation, setDesignation] = useState("");
  const [department, setDepartment] = useState("Sales");
  const [branch, setBranch] = useState("Andheri West, Mumbai");
  const [fixedMonthly, setFixedMonthly] = useState<number>(30000);
  const [status, setStatus] = useState<User["status"]>("Active");
  const [allowedBranches, setAllowedBranches] = useState<string>("Andheri West, Mumbai");

  // Debounced search query audit logging
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timer = setTimeout(() => {
      recordAuditAction("SEARCH", "employees", "search", `Search performed for staff employee: "${searchQuery}"`);
    }, 1200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedStaff) {
      recordAuditAction("TRANSACTION_VIEW", "employees", selectedStaff.id, `Viewed staff employee details: ${selectedStaff.fullName}`);
    }
  }, [selectedStaff]);

  // Master collections for ID-to-name resolution
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  const fetchMasters = async () => {
    try {
      const [departmentValues, designationValues, branchValues] = await Promise.all([
        apiFetchV1("/masters/lookup/department/values"),
        apiFetchV1("/masters/lookup/designation/values"),
        apiFetchV1("/masters/branches")
      ]);
      setDepartments(departmentValues);
      setDesignations(designationValues);
      setBranches(branchValues);
    } catch (err) {
      console.error("Failed to load masters for staff resolution:", err);
    }
  };

  const getDepartmentName = (deptIdOrName: string) => {
    const d = departments.find(x => x.id === deptIdOrName);
    return d ? d.name : deptIdOrName;
  };
  const getDesignationName = (desigIdOrName: string) => {
    const d = designations.find(x => x.id === desigIdOrName);
    return d ? d.name : desigIdOrName;
  };
  const getBranchName = (branchIdOrName: string) => {
    const b = branches.find(x => x.id === branchIdOrName);
    return b ? b.name : branchIdOrName;
  };

  const getDepartmentDisplay = (u: User) => {
    return getDepartmentName(u.departmentId || u.department || "");
  };
  const getDesignationDisplay = (u: User) => {
    return getDesignationName(u.designationId || u.designation || "");
  };
  const getBranchDisplay = (u: User) => {
    return getBranchName(u.branchId || u.branch || "");
  };

  const fetchStaff = async () => {
    try {
      setLoading(true);
      // Migrated: GET /api/users (Express, returns array) → GET /api/v1/users/ (FastAPI, returns { total, users })
      const data = await apiFetchV1("/users/");
      const staffList: User[] = data?.users ?? data ?? [];
      setStaff(staffList);

      if (selectedStaff) {
        const found = staffList.find((u: User) => u.id === selectedStaff.id);
        if (found) setSelectedStaff(found);
      } else if (staffList.length > 0) {
        setSelectedStaff(staffList[0]);
      }
    } catch (err: any) {
      addNotification({
        title: "Database Sync Error",
        message: err.message || "Failed to retrieve staff ledger.",
        type: "alert",
        priority: "high"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetchMasters();
  }, []);

  const handleOpenAddModal = () => {
    setModalMode("add");
    setFullName("");
    setUsername("");
    setPassword("smriti123");
    setRole("Cashier");
    setDesignation(designations[0]?.id || "Sales Executive");
    setDepartment(departments[0]?.id || "Sales");
    setBranch(branches[0]?.id || "Andheri West, Mumbai");
    setFixedMonthly(30000);
    setStatus("Active");
    setAllowedBranches(branches[0]?.name || "Andheri West, Mumbai");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (s: User) => {
    setModalMode("edit");
    setFullName(s.fullName);
    setUsername(s.username);
    setRole(s.role);
    setDesignation(s.designationId || s.designation || "");
    setDepartment(s.departmentId || s.department || "");
    setBranch(s.branchId || s.branch || "");
    setFixedMonthly(s.salary?.fixedMonthly || 25000);
    setStatus(s.status);
    setAllowedBranches(s.allowedBranches ? s.allowedBranches.join(", ") : s.branch);
    setIsModalOpen(true);
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      addNotification({
        title: "Access Denied",
        message: "Operating under a Read-Only Report User role. Write operations are prohibited.",
        type: "alert",
        priority: "high"
      });
      return;
    }
    try {
      const payload: Partial<User> = {
        fullName,
        username,
        role,
        designation: designations.find(d => d.id === designation)?.name || designation,
        department: departments.find(d => d.id === department)?.name || department,
        branch: branches.find(b => b.id === branch)?.name || branch,
        designationId: designation,
        departmentId: department,
        branchId: branch,
        status,
        allowedBranches: allowedBranches.split(",").map(b => b.trim()).filter(Boolean),
        salary: {
          fixedMonthly: Number(fixedMonthly),
          commission: selectedStaff?.salary?.commission || { type: "None", value: 0 },
          travelAllowance: selectedStaff?.salary?.travelAllowance || { type: "None", value: 0 },
          otherAllowances: selectedStaff?.salary?.otherAllowances || { da: 0, mobile: 0, internet: 0, fuel: 0 }
        }
      };

      if (modalMode === "add") {
        // Migrated: POST /api/users (Express) → POST /api/v1/users/ (FastAPI — StaffUserCreate schema)
        await apiFetchV1("/users/", {
          method: "POST",
          body: JSON.stringify({
            full_name: fullName,
            username,
            password,
            role,
            designation: designations.find(d => d.id === designation)?.name || designation,
            department: departments.find(d => d.id === department)?.name || department,
            branch: branches.find(b => b.id === branch)?.name || branch,
            designation_id: designation,
            department_id: department,
            branch_id: branch,
            status,
            allowed_branches: allowedBranches.split(",").map(b => b.trim()).filter(Boolean),
            salary: {
              fixed_monthly: Number(fixedMonthly),
            },
          }),
        });

        addNotification({
          title: "Employee Added",
          message: `Operator profile for '${fullName}' registered successfully.`,
          type: "activity",
          priority: "low"
        });
      } else {
        // Migrated: PUT /api/users/{id} (Express) → PATCH /api/v1/users/{id} (FastAPI)
        await apiFetchV1(`/users/${selectedStaff?.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            full_name: fullName,
            role,
            designation: designations.find(d => d.id === designation)?.name || designation,
            department: departments.find(d => d.id === department)?.name || department,
            branch: branches.find(b => b.id === branch)?.name || branch,
            designation_id: designation,
            department_id: department,
            branch_id: branch,
            status,
            allowed_branches: allowedBranches.split(",").map(b => b.trim()).filter(Boolean),
            salary: {
              fixed_monthly: Number(fixedMonthly),
              commission: selectedStaff?.salary?.commission || { type: "None", value: 0 },
              travel_allowance: selectedStaff?.salary?.travelAllowance || { type: "None", value: 0 },
            },
          }),
        });

        addNotification({
          title: "Profile Updated",
          message: `Profile details for '${fullName}' synchronized successfully.`,
          type: "activity",
          priority: "low"
        });
      }

      setIsModalOpen(false);
      fetchStaff();
    } catch (err: any) {
      addNotification({
        title: "Operation Failed",
        message: err.message || "User management operation failed.",
        type: "alert",
        priority: "high"
      });
    }
  };

  const handleStatusChange = async (userId: string, newStatus: User["status"]) => {
    if (isReadOnly) {
      addNotification({
        title: "Access Denied",
        message: "Operating under a Read-Only Report User role. Write operations are prohibited.",
        type: "alert",
        priority: "high"
      });
      return;
    }
    try {
      // Migrated: PUT /api/users/{id} (Express) → PATCH /api/v1/users/{id} (FastAPI)
      await apiFetchV1(`/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });

      addNotification({
        title: "Status Synchronized",
        message: `Employee status successfully shifted to '${newStatus}'.`,
        type: "activity",
        priority: "low"
      });
      fetchStaff();
    } catch (err: any) {
      addNotification({
        title: "Update Blocked",
        message: err.message || "Failed to update employee status.",
        type: "alert",
        priority: "high"
      });
    }
  };

  const handleDeleteStaff = async (userId: string, name: string) => {
    if (isReadOnly) {
      addNotification({
        title: "Access Denied",
        message: "Operating under a Read-Only Report User role. Write operations are prohibited.",
        type: "alert",
        priority: "high"
      });
      return;
    }
    if (!window.confirm(`Are you sure you want to mark '${name}' as Resigned/Inactive? (This prevents login credentials from functioning.)`)) {
      return;
    }

    try {
      // Migrated: DELETE /api/users/{id} (Express) → DELETE /api/v1/users/{id} (FastAPI)
      await apiFetchV1(`/users/${userId}`, { method: "DELETE" });

      addNotification({
        title: "Employee Deactivated",
        message: `'${name}' status set to 'Inactive' permanently.`,
        type: "activity",
        priority: "low"
      });
      fetchStaff();
    } catch (err: any) {
      addNotification({
        title: "Deactivation Blocked",
        message: err.message || "Failed to soft-delete user record.",
        type: "alert",
        priority: "high"
      });
    }
  };

  const filteredStaff = staff.filter(s => 
    s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getDepartmentDisplay(s).toLowerCase().includes(searchQuery.toLowerCase()) ||
    getDesignationDisplay(s).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadgeClass = (s: User["status"]) => {
    switch (s) {
      case "Active":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "Inactive":
        return "bg-theme-surface-3 text-theme-muted border border-theme-divider";
      case "Suspended":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
      case "Locked":
        return "bg-red-500/10 text-red-500 border border-red-500/30 font-bold animate-pulse";
      case "Resigned":
        return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
    }
  };

  return (
    <div className="space-y-6">
      {isReadOnly && (
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center space-x-2 text-amber-400 text-xs shadow-lg">
          <span className="material-symbols-outlined text-[14px]">warning</span>
          <span className="font-mono uppercase tracking-wider font-bold">Read-Only Mode:</span>
          <span>Operating under a Read-Only Report User role. Modifying or registering employee profiles is prohibited.</span>
        </div>
      )}
      {/* Title block */}
      <div className="flex justify-between items-end border-b border-theme-divider pb-4">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-body flex items-center gap-2">
            <Users className="text-blue-500" />
            Staff & Operator Management
          </h2>
          <p className="text-xs text-theme-muted mt-1">
            Maintain the unified single source of truth for operator logins, payroll allowances, and location security credentials.
          </p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          disabled={isReadOnly}
          className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${isReadOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <Plus size={16} /> Add Employee
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Staff Directory */}
        <div className="lg:col-span-1 bg-theme-surface-2 border border-theme-divider rounded-xl flex flex-col h-[700px]">
          <div className="p-4 border-b border-theme-divider bg-theme-surface-1 rounded-t-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" size={16} />
              <input 
                type="text" 
                placeholder="Search staff by name, ID, dept..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-theme-surface-2 border border-theme-divider rounded-lg text-sm text-theme-body focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading && staff.length === 0 ? (
              <div className="p-8 text-center text-xs text-theme-muted font-mono animate-pulse">
                Syncing Operator Registries...
              </div>
            ) : filteredStaff.map(s => (
              <div 
                key={s.id}
                onClick={() => setSelectedStaff(s)}
                className={`p-3 rounded-lg cursor-pointer transition-all border ${
                  selectedStaff?.id === s.id 
                    ? "bg-blue-500/10 border-blue-500/30" 
                    : "bg-theme-surface-1 border-transparent hover:bg-theme-surface-hover"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-theme-body">{s.fullName}</h4>
                      <span className={`text-[8px] px-1.5 py-0.25 rounded-full font-bold uppercase ${getStatusBadgeClass(s.status)}`}>
                        {s.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-theme-muted font-mono mt-0.5">{s.employeeId} • @{s.username}</div>
                  </div>
                  <span className="px-2 py-0.5 bg-theme-surface-3 text-[10px] rounded text-theme-muted uppercase font-bold">
                    {s.role.split(" ")[0]}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-theme-muted mt-2 border-t border-theme-divider/40 pt-1.5">
                  <div className="flex items-center gap-1.5">
                    <Briefcase size={11} /> 
                    <span className="truncate max-w-[120px]">{getDesignationDisplay(s)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin size={10} />
                    <span className="truncate text-[10px] max-w-[100px]">{getBranchDisplay(s).split(",")[0]}</span>
                  </div>
                </div>
              </div>
            ))}

            {filteredStaff.length === 0 && !loading && (
              <div className="p-8 text-center text-theme-muted text-sm">No active operator profiles found.</div>
            )}
          </div>
        </div>

        {/* Right Column: Staff Details */}
        <div className="lg:col-span-2">
          {selectedStaff ? (
            <div className="space-y-4">
              {/* Header Card */}
              <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-display font-bold text-2xl border border-blue-500/30">
                    {String(selectedStaff.fullName || "S").charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-theme-body">{selectedStaff.fullName}</h2>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${getStatusBadgeClass(selectedStaff.status)}`}>
                        {selectedStaff.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-theme-muted mt-1">
                      <span className="font-mono">{selectedStaff.employeeId}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Briefcase size={12}/> {getDepartmentDisplay(selectedStaff)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><MapPin size={12}/> {getBranchDisplay(selectedStaff)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto">
                  {/* Status Change Dropdown */}
                  <div className="flex items-center gap-1.5 bg-theme-surface-2 border border-theme-divider rounded-lg px-2 py-1">
                    <span className="text-[10px] font-bold text-theme-muted uppercase">Status:</span>
                    <select
                      value={selectedStaff.status}
                      onChange={e => handleStatusChange(selectedStaff.id, e.target.value as any)}
                      className="bg-transparent border-none text-xs text-theme-body font-bold focus:outline-none cursor-pointer p-0.5"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Suspended">Suspended</option>
                      <option value="Locked">Locked</option>
                      <option value="Resigned">Resigned</option>
                    </select>
                  </div>

                  <div className="flex gap-1">
                    <button 
                      onClick={() => handleOpenEditModal(selectedStaff)}
                      className="p-2 border border-theme-divider rounded-lg hover:bg-theme-surface-2 transition-colors text-theme-muted hover:text-blue-400 cursor-pointer"
                      title="Edit Employee Node"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button 
                      onClick={() => handleDeleteStaff(selectedStaff.id, selectedStaff.fullName)}
                      className="p-2 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Mark as Resigned/Inactive"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sub-tabs */}
              <div className="flex space-x-1 bg-theme-surface-2 p-1 rounded-lg border border-theme-divider">
                {[
                  { id: "info", label: "Information", icon: Users },
                  { id: "salary", label: "Salary Structure", icon: IndianRupee },
                  { id: "notifications", label: "Notifications", icon: Bell },
                  { id: "payment", label: "Payment Details", icon: CreditCard },
                  { id: "performance", label: "Performance", icon: Activity },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubTab(tab.id as any)}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide flex justify-center items-center gap-2 rounded-md transition-all ${
                      activeSubTab === tab.id 
                        ? "bg-theme-surface-1 text-blue-400 shadow-sm border border-theme-divider" 
                        : "text-theme-muted hover:text-theme-body hover:bg-theme-surface-hover"
                    }`}
                  >
                    <tab.icon size={13} /> <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab Content Panels */}
              <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 min-h-[450px]">
                {activeSubTab === "info" && (
                  <div className="space-y-6">
                    <h3 className="text-sm font-bold text-theme-body border-b border-theme-divider pb-2">1. Employee Information</h3>
                    <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                      <div>
                        <div className="text-xs text-theme-muted uppercase font-bold mb-1">Employee ID / Code</div>
                        <div className="text-sm font-mono text-theme-body">{selectedStaff.employeeId}</div>
                      </div>
                      <div>
                        <div className="text-xs text-theme-muted uppercase font-bold mb-1">Full Name</div>
                        <div className="text-sm text-theme-body">{selectedStaff.fullName}</div>
                      </div>
                      <div>
                        <div className="text-xs text-theme-muted uppercase font-bold mb-1">Department</div>
                        <div className="text-sm text-theme-body">{getDepartmentDisplay(selectedStaff)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-theme-muted uppercase font-bold mb-1">Designation</div>
                        <div className="text-sm text-theme-body">{getDesignationDisplay(selectedStaff)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-theme-muted uppercase font-bold mb-1">Assigned Operational Branch</div>
                        <div className="text-sm text-theme-body">{getBranchDisplay(selectedStaff)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-theme-muted uppercase font-bold mb-1">Reporting Officer</div>
                        <div className="text-sm text-theme-body">{selectedStaff.reportingManager || "N/A"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-theme-muted uppercase font-bold mb-1">Date of Joining</div>
                        <div className="text-sm text-theme-body flex items-center gap-2">
                          <Calendar size={13} className="text-theme-muted"/> {selectedStaff.dateOfJoining}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-theme-muted uppercase font-bold mb-1">Employment Type</div>
                        <div className="text-sm text-theme-body inline-block px-2.5 py-0.5 bg-theme-surface-3 border border-theme-divider rounded font-bold text-xs uppercase tracking-wider text-theme-muted">
                          {selectedStaff.employmentType}
                        </div>
                      </div>
                      <div className="col-span-2 border-t border-theme-divider/60 pt-4">
                        <div className="text-xs text-theme-muted uppercase font-bold mb-1.5">Authorized Jurisdiction Scope</div>
                        <div className="flex flex-wrap gap-1">
                          {(selectedStaff.allowedBranches || [selectedStaff.branchId || selectedStaff.branch]).map(br => (
                            <span key={br} className="text-[10px] font-mono font-bold uppercase bg-theme-surface-2 border border-theme-divider text-theme-body px-2 py-0.5 rounded">
                              {getBranchName(br)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSubTab === "salary" && (
                  <div className="space-y-8">
                    <h3 className="text-sm font-bold text-theme-body border-b border-theme-divider pb-2">2. Salary Structure</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Left Block */}
                      <div className="space-y-6">
                        <div>
                          <div className="text-xs text-theme-muted uppercase font-bold mb-1">Fixed Salary (Monthly)</div>
                          <div className="text-xl font-mono font-bold text-emerald-400">
                            ₹{(selectedStaff.salary?.fixedMonthly || 25000).toLocaleString("en-IN")}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-theme-muted uppercase font-bold mb-2">Commission Structure</div>
                          <div className="bg-theme-surface-2 p-3.5 rounded-lg border border-theme-divider space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-theme-muted">Type</span>
                              <span className="text-theme-body font-bold uppercase">
                                {selectedStaff.salary?.commission?.type || "None"}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-theme-muted">Value</span>
                              <span className="text-theme-body font-mono font-bold">
                                {selectedStaff.salary?.commission?.type === "Percentage" 
                                  ? `${selectedStaff.salary?.commission?.value}%` 
                                  : `₹${(selectedStaff.salary?.commission?.value || 0).toLocaleString("en-IN")}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-theme-muted uppercase font-bold mb-2">Travelling Allowance (TA)</div>
                          <div className="bg-theme-surface-2 p-3.5 rounded-lg border border-theme-divider space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-theme-muted">Type</span>
                              <span className="text-theme-body font-bold uppercase">
                                {selectedStaff.salary?.travelAllowance?.type || "None"}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-theme-muted">Value</span>
                              <span className="text-theme-body font-mono font-bold">
                                {selectedStaff.salary?.travelAllowance?.type === "Actual Reimbursement" 
                                  ? "As per actuals" 
                                  : `₹${(selectedStaff.salary?.travelAllowance?.value || 0).toLocaleString("en-IN")}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Block */}
                      <div>
                        <div className="text-xs text-theme-muted uppercase font-bold mb-2">Other Allowances</div>
                        <div className="bg-theme-surface-2 rounded-lg border border-theme-divider divide-y divide-theme-divider">
                          <div className="p-3 flex justify-between text-xs">
                            <span className="text-theme-muted">Daily Allowance (DA)</span>
                            <span className="text-theme-body font-mono font-bold">
                              ₹{(selectedStaff.salary?.otherAllowances?.da || 0).toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="p-3 flex justify-between text-xs">
                            <span className="text-theme-muted">Mobile Allowance</span>
                            <span className="text-theme-body font-mono font-bold">
                              ₹{(selectedStaff.salary?.otherAllowances?.mobile || 0).toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="p-3 flex justify-between text-xs">
                            <span className="text-theme-muted">Internet Allowance</span>
                            <span className="text-theme-body font-mono font-bold">
                              ₹{(selectedStaff.salary?.otherAllowances?.internet || 0).toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div className="p-3 flex justify-between text-xs">
                            <span className="text-theme-muted">Fuel Allowance</span>
                            <span className="text-theme-body font-mono font-bold">
                              ₹{(selectedStaff.salary?.otherAllowances?.fuel || 0).toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSubTab === "notifications" && (
                  <div className="space-y-6">
                    <h3 className="text-sm font-bold text-theme-body border-b border-theme-divider pb-2">3. Notifications Preferences</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedStaff.notificationSettings ? Object.entries(selectedStaff.notificationSettings).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between p-3.5 bg-theme-surface-2 border border-theme-divider rounded-lg">
                          <span className="text-xs font-bold text-theme-body capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            value 
                              ? "bg-blue-500/10 border border-blue-500/20 text-blue-400" 
                              : "bg-theme-surface-3 border border-theme-divider text-theme-muted"
                          }`}>
                            {value ? "Delivery Active" : "Muted"}
                          </span>
                        </div>
                      )) : (
                        <div className="text-xs text-theme-muted p-4">No notification configurations assigned to this profile.</div>
                      )}
                    </div>
                  </div>
                )}

                {activeSubTab === "payment" && (
                  <div className="space-y-6">
                    <h3 className="text-sm font-bold text-theme-body border-b border-theme-divider pb-2">4. Payment Details</h3>
                    <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                      <div>
                        <div className="text-xs text-theme-muted uppercase font-bold mb-1">Payment Frequency</div>
                        <div className="text-sm text-theme-body">{selectedStaff.payment?.frequency || "Monthly"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-theme-muted uppercase font-bold mb-1">Bank Details</div>
                        <div className="text-sm text-theme-body font-mono">{selectedStaff.payment?.bankDetails || "Not Defined"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-theme-muted uppercase font-bold mb-1">UPI ID</div>
                        <div className="text-sm text-theme-body font-mono">{selectedStaff.payment?.upi || "Not Defined"}</div>
                      </div>
                      <div></div>
                      <div>
                        <div className="text-xs text-theme-muted uppercase font-bold mb-1">Salary Effective From</div>
                        <div className="text-sm text-theme-body font-mono">{selectedStaff.payment?.salaryEffectiveFrom || "Immediate"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-theme-muted uppercase font-bold mb-1">Commission Effective From</div>
                        <div className="text-sm text-theme-body font-mono">{selectedStaff.payment?.commissionEffectiveFrom || "Immediate"}</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSubTab === "performance" && (
                  <div className="space-y-6">
                    <h3 className="text-sm font-bold text-theme-body border-b border-theme-divider pb-2">5. Attendance & Performance</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-theme-surface-2 p-5 rounded-xl border border-theme-divider flex flex-col justify-center">
                        <div className="text-xs text-theme-muted uppercase font-bold mb-1">Attendance Rate</div>
                        <div className="text-2xl font-display font-bold text-theme-body">
                          {selectedStaff.performance?.attendancePercentage || 100}%
                        </div>
                        <div className="w-full bg-theme-surface-3 h-2 rounded-full mt-3 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full transition-all" 
                            style={{ width: `${selectedStaff.performance?.attendancePercentage || 100}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="bg-theme-surface-2 p-5 rounded-xl border border-theme-divider flex flex-col justify-center">
                        <div className="text-xs text-theme-muted uppercase font-bold mb-1">Travel Claim Status</div>
                        <div className={`text-sm font-bold inline-block px-3 py-1 rounded-lg mt-2 w-max ${
                          selectedStaff.performance?.travelClaimStatus === "Approved" ? "bg-emerald-500/20 text-emerald-400" :
                          selectedStaff.performance?.travelClaimStatus === "Pending" ? "bg-amber-500/20 text-amber-400" :
                          "bg-theme-surface-3 text-theme-muted"
                        }`}>
                          {selectedStaff.performance?.travelClaimStatus || "None"}
                        </div>
                      </div>
                    </div>

                    <div className="bg-theme-surface-2 p-5 rounded-xl border border-theme-divider">
                      <h4 className="text-xs font-bold text-theme-muted uppercase mb-4">Sales & Targets (Current Month)</h4>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-[10px] text-theme-muted uppercase mb-1">Assigned</div>
                          <div className="font-mono text-sm font-bold">
                            ₹{(selectedStaff.performance?.targetsAssigned || 0).toLocaleString("en-IN")}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-theme-muted uppercase mb-1">Achieved</div>
                          <div className="font-mono text-sm font-bold text-blue-400">
                            ₹{(selectedStaff.performance?.targetsAchieved || 0).toLocaleString("en-IN")}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-theme-muted uppercase mb-1">Commission Earned</div>
                          <div className="font-mono text-sm font-bold text-emerald-400">
                            ₹{(selectedStaff.performance?.commissionEarned || 0).toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>
                      {selectedStaff.performance?.targetsAssigned ? (
                        <div className="mt-4 pt-4 border-t border-theme-divider">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-theme-muted">Target Completion</span>
                            <span className="font-bold text-theme-body">
                              {Math.round((selectedStaff.performance.targetsAchieved / selectedStaff.performance.targetsAssigned) * 100)}%
                            </span>
                          </div>
                          <div className="w-full bg-theme-surface-3 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-blue-500 h-full transition-all" 
                              style={{ width: `${Math.min(100, (selectedStaff.performance.targetsAchieved / selectedStaff.performance.targetsAssigned) * 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-theme-muted border border-theme-divider border-dashed rounded-xl p-12 bg-theme-surface-1/50 min-h-[500px]">
               <Users size={48} className="mb-4 opacity-20" />
               <p className="text-sm font-semibold">Select a Staff Member</p>
               <p className="text-xs text-center mt-2 max-w-xs">Select an employee from the directory on the left to view their complete information and structure.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-theme-surface-1 border border-theme-divider rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-theme-divider bg-theme-surface-2 flex justify-between items-center">
              <h3 className="font-bold text-theme-body font-display flex items-center gap-2">
                <Users size={18} className="text-blue-500" />
                {modalMode === "add" ? "Register New Employee Profile" : "Edit Employee Profile Ledger"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-theme-muted hover:text-theme-body p-1.5 hover:bg-theme-surface-hover rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Personal details section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wide border-b border-theme-divider pb-1">1. Personal & Auth Identifiers</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-theme-muted uppercase font-bold">Full Name</label>
                    <input 
                      type="text" 
                      required
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="e.g. Rajesh Kumar"
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded text-sm text-theme-body focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-theme-muted uppercase font-bold">Username login ID</label>
                    <input 
                      type="text" 
                      required
                      disabled={modalMode === "edit"}
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                      placeholder="e.g. rajesh"
                      className="w-full px-3 py-2 bg-theme-surface-2 disabled:bg-theme-surface-3 border border-theme-divider rounded text-sm text-theme-body disabled:text-theme-muted focus:outline-none focus:border-blue-500 font-mono font-medium"
                    />
                  </div>

                  {modalMode === "add" && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-theme-muted uppercase font-bold">Password setup</label>
                      <input 
                        type="text" 
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Default setup password"
                        className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded text-sm text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-theme-muted uppercase font-bold">System Role Name</label>
                    <select
                      value={role}
                      onChange={e => setRole(e.target.value)}
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded text-sm text-theme-body focus:outline-none focus:border-blue-500 font-medium"
                    >
                      <option value="Cashier">Cashier (POS Operator)</option>
                      <option value="Store Manager">Store Manager (Admin privilege)</option>
                      <option value="Warehouse Executive">Warehouse Executive</option>
                      <option value="Sales Consultant">Sales Consultant</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Assignment details section */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wide border-b border-theme-divider pb-1">2. Corporate Allocation</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-theme-muted uppercase font-bold">Corporate Designation</label>
                    <select 
                      required
                      value={designation}
                      onChange={e => setDesignation(e.target.value)}
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded text-sm text-theme-body focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {designations.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                      {!designations.find(d => d.id === designation) && designation && (
                        <option value={designation}>{getDesignationName(designation)}</option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-theme-muted uppercase font-bold">Department</label>
                    <select 
                      required
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded text-sm text-theme-body focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                      {!departments.find(d => d.id === department) && department && (
                        <option value={department}>{getDepartmentName(department)}</option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-theme-muted uppercase font-bold">Primary Active Branch</label>
                    <select 
                      required
                      value={branch}
                      onChange={e => setBranch(e.target.value)}
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded text-sm text-theme-body focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                      {!branches.find(b => b.id === branch) && branch && (
                        <option value={branch}>{getBranchName(branch)}</option>
                      )}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-theme-muted uppercase font-bold">Allowed Branches (Comma separated)</label>
                    <input 
                      type="text" 
                      required
                      value={allowedBranches}
                      onChange={e => setAllowedBranches(e.target.value)}
                      placeholder="e.g. Andheri West, Mumbai, Connaught Place, Delhi"
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded text-sm text-theme-body focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Salary setup */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wide border-b border-theme-divider pb-1">3. Compensation Structure</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-theme-muted uppercase font-bold">Fixed Monthly Salary (INR)</label>
                    <input 
                      type="number" 
                      required
                      value={fixedMonthly}
                      onChange={e => setFixedMonthly(Number(e.target.value))}
                      placeholder="30000"
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded text-sm text-theme-body focus:outline-none focus:border-blue-500 font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-theme-muted uppercase font-bold">Initial status</label>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded text-sm text-theme-body focus:outline-none focus:border-blue-500 font-medium font-bold"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Suspended">Suspended</option>
                      <option value="Locked">Locked</option>
                      <option value="Resigned">Resigned</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-theme-divider flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-theme-divider text-theme-muted hover:text-theme-body hover:bg-theme-surface-2 rounded-lg text-sm font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Check size={16} /> Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
