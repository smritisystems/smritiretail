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
 * * Version    : 3.21.0
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-16
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { 
  User as UserIcon, 
  Shield, 
  Key, 
  Bell, 
  Laptop, 
  Smartphone, 
  Tablet, 
  Power, 
  Globe, 
  Clock, 
  Briefcase, 
  MapPin, 
  Mail, 
  Phone, 
  ExternalLink,
  Save,
  CheckCircle,
  AlertCircle,
  Activity
} from "lucide-react";
import { User, UserPreferences, AuditLogEntry } from "../types.js";
import { useNotifications } from "../notifications/notification_store.tsx";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";

interface SessionInfo {
  token: string;
  username: string;
  userId: string;
  name: string;
  role: string;
  userAgent: string;
  deviceType: "desktop" | "mobile" | "tablet";
  ipAddress: string;
  loginAt: string;
  expiresAt: string;
}

export const UserProfileTab: React.FC = () => {
  const { addNotification } = useNotifications();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentSessionToken, setCurrentSessionToken] = useState<string>("");
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<"summary" | "sessions" | "notifications" | "preferences">("summary");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [userActivities, setUserActivities] = useState<AuditLogEntry[]>([]);

  // Form States
  const [displayName, setDisplayName] = useState<string>("");
  const [mobile, setMobile] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [language, setLanguage] = useState<string>("English");
  const [timeZone, setTimeZone] = useState<string>("Asia/Kolkata");
  const [notificationSettings, setNotificationSettings] = useState<User["notificationSettings"]>({
    salaryCredit: true,
    commissionEarned: true,
    targetAchievement: true,
    travelClaimApproval: true,
    leaveApproval: true,
    attendanceAlerts: true,
    holidayWeeklyOff: true,
    birthdayAnniversary: true,
    policyAnnouncements: true,
  });

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      // Migrated: GET /api/auth/me (Express) → GET /api/v1/auth/me (FastAPI JWT)
      // FastAPI returns UserResponse directly (not wrapped in { user, sessionInfo })
      const userObj = await apiFetchV1("/auth/me") as User;
      setCurrentUser(userObj);
      setCurrentSessionToken(""); // JWT is stateless — no session token concept

      // Sync form fields
      setDisplayName(userObj.display_name || userObj.full_name?.split(" ")[0] || userObj.username || "");
      setMobile(userObj.mobile || "");
      setEmail(userObj.email || "");

      if (userObj.preferences) {
        setTheme(userObj.preferences.theme || "dark");
        setLanguage(userObj.preferences.language || "English");
        setTimeZone(userObj.preferences.timeZone || "Asia/Kolkata");
      }

      if (userObj.notificationSettings) {
        setNotificationSettings(userObj.notificationSettings);
      }

      // Sessions list removed — JWT is stateless; no in-memory sessions exist in FastAPI.
      // The Sessions sub-tab renders a "Managed by SMRITI Security Gateway" placeholder.
      setSessions([]);

      // Fetch recent audit log activity for this user (system route — not yet migrated)
      try {
        const auditData = await apiFetchV1("/audit-logs");
        const logsData = Array.isArray(auditData) ? auditData : auditData?.logs || [];
        const filtered = logsData
          .filter((log: any) => log.userId === userObj.id || log.userName === userObj.full_name || log.userName === userObj.username)
          .slice(0, 5);
        setUserActivities(filtered);
      } catch {
        // Audit log is best-effort; non-fatal
      }
    } catch (err) {
      console.error(err);
      addNotification({
        title: "Profile Error",
        message: "Failed to pull fresh user profile configurations.",
        type: "alert",
        priority: "high"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const handleUpdatePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    try {
      // Migrated: PUT /api/users/{id} (Express) → PATCH /api/v1/users/{id} (FastAPI)
      await apiFetchV1(`/users/${currentUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({ display_name: displayName, mobile, email }),
      });

      addNotification({
        title: "Profile Updated",
        message: "Your personal details have been synchronized successfully.",
        type: "activity",
        priority: "low"
      });
      fetchProfileData();
    } catch (err: any) {
      addNotification({
        title: "Update Failed",
        message: err.message || "Failed to update profile details.",
        type: "alert",
        priority: "high"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    try {
      // Migrated: PUT /api/users/{id}/preferences (Express) → PUT /api/v1/users/{id}/preferences (FastAPI)
      await apiFetchV1(`/users/${currentUser.id}/preferences`, {
        method: "PUT",
        body: JSON.stringify({ preferences: { theme, language, timeZone } }),
      });

      addNotification({
        title: "Preferences Saved",
        message: "Language, Theme and Time Zone preferences saved.",
        type: "activity",
        priority: "low"
      });
      fetchProfileData();
    } catch (err: any) {
      addNotification({
        title: "Update Failed",
        message: err.message || "Failed to update regional preferences.",
        type: "alert",
        priority: "high"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNotification = async (key: keyof User["notificationSettings"]) => {
    if (!currentUser) return;
    const updated = { ...notificationSettings, [key]: !notificationSettings[key] };
    setNotificationSettings(updated);

    try {
      // Migrated: PUT /api/users/{id}/notifications (Express) → PUT /api/v1/users/{id}/notifications (FastAPI)
      await apiFetchV1(`/users/${currentUser.id}/notifications`, {
        method: "PUT",
        body: JSON.stringify({ notificationSettings: updated }),
      });

      addNotification({
        title: "Notification Updated",
        message: `Notification category '${key}' updated successfully.`,
        type: "activity",
        priority: "low"
      });
    } catch (err: any) {
      addNotification({
        title: "Sync Error",
        message: err.message || "Failed to update notification settings on server.",
        type: "alert",
        priority: "high"
      });
      setNotificationSettings(notificationSettings); // revert
    }
  };

  const handleRevokeSession = async (token: string) => {
    if (!currentUser) return;
    try {
      // Express sessions are retired. Revoke = POST /api/v1/auth/logout (blacklists refresh token).
      // For now, clear local JWT and reload to force re-login.
      await apiFetchV1("/auth/logout", { method: "POST", body: JSON.stringify({ token }) });

      addNotification({
        title: "Session Terminated",
        message: "Your active session has been invalidated.",
        type: "activity",
        priority: "low"
      });

      localStorage.removeItem("smriti_jwt_token");
      localStorage.removeItem("smriti_session_token");
      window.location.reload();
    } catch (err: any) {
      addNotification({
        title: "Revocation Failed",
        message: err.message,
        type: "alert",
        priority: "high"
      });
    }
  };

  if (loading && !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[500px] text-theme-muted">
        <Clock className="animate-spin mb-4 text-blue-500" size={32} />
        <p className="text-xs font-mono tracking-widest uppercase">Initializing Secure Profile Ledger...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-red-400">
        <AlertCircle className="mx-auto mb-2 text-red-400" size={32} />
        <p className="text-sm font-bold">Unauthenticated Session</p>
        <p className="text-xs text-theme-muted mt-1">Please log in to manage your user profile ledger.</p>
      </div>
    );
  }

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case "mobile":
        return <Smartphone size={16} className="text-amber-400" />;
      case "tablet":
        return <Tablet size={16} className="text-purple-400" />;
      default:
        return <Laptop size={16} className="text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-theme-divider pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-theme-body flex items-center gap-2">
            <UserIcon className="text-blue-500" />
            My Operator Profile
          </h2>
          <p className="text-xs text-theme-muted mt-1 font-mono uppercase tracking-wide">
            Corporate Ledger Node ID: {currentUser.id} • Assigned Staff ID: {currentUser.employeeId}
          </p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-full font-bold uppercase tracking-wide">
            ● Session Active
          </span>
          <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs rounded-full font-bold uppercase tracking-wide">
            {currentUser.role}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Hand: Profile Summary Card */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-6 text-center space-y-4">
            <div className="mx-auto w-24 h-24 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-display font-bold text-4xl border-2 border-blue-500/30">
              {currentUser.fullName.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-lg text-theme-body">{currentUser.fullName}</h3>
              <p className="text-xs text-theme-muted font-mono">{currentUser.designation}</p>
            </div>

            <div className="pt-4 border-t border-theme-divider text-left space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Briefcase size={14} className="text-theme-muted shrink-0" />
                <span className="text-theme-muted">Dept:</span>
                <span className="text-theme-body font-medium ml-auto truncate">{currentUser.department}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin size={14} className="text-theme-muted shrink-0" />
                <span className="text-theme-muted">Branch:</span>
                <span className="text-theme-body font-medium ml-auto truncate">{currentUser.branch}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail size={14} className="text-theme-muted shrink-0" />
                <span className="text-theme-muted">Email:</span>
                <span className="text-theme-body font-medium ml-auto truncate">{currentUser.email || "N/A"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone size={14} className="text-theme-muted shrink-0" />
                <span className="text-theme-muted">Phone:</span>
                <span className="text-theme-body font-medium ml-auto truncate">{currentUser.mobile || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Location Jurisdictions Panel */}
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-theme-muted flex items-center gap-2">
              <MapPin size={14} className="text-blue-500" />
              Allowed Branch Jurisdictions
            </h4>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(currentUser.allowedBranches || [currentUser.branch]).map(branch => (
                <span 
                  key={branch} 
                  className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                    branch === currentUser.branch
                      ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                      : "bg-theme-surface-3 border-theme-divider text-theme-muted"
                  }`}
                  title={branch === currentUser.branch ? "Primary Active Branch" : "Secondary Branch Jurisdiction"}
                >
                  {branch} {branch === currentUser.branch && "★"}
                </span>
              ))}
            </div>
          </div>

          {/* Recent Activity Widget */}
          <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 space-y-3 shadow-sm hover:shadow-md hover:border-[#2563EB] transition-all">
            <h4 className="text-xs font-bold uppercase tracking-wide text-theme-muted flex items-center gap-2">
              <Activity size={14} className="text-blue-500" />
              Recent Activity Ledger
            </h4>
            {userActivities.length === 0 ? (
              <p className="text-xs text-theme-muted italic pt-1">No recent activities found.</p>
            ) : (
              <div className="space-y-3 pt-1">
                {userActivities.map(log => (
                  <div key={log.id} className="text-xs border-b border-theme-divider/40 pb-2 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-bold text-theme-body">{log.action}</span>
                      <span className="text-[10px] text-theme-muted font-mono shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-theme-muted text-[11px] mt-0.5">
                      <span className="text-blue-400 font-mono text-[10px] uppercase">{log.module}</span>
                      {log.targetName ? ` • ${log.targetName}` : log.targetId ? ` • ID: ${log.targetId}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Hand: Interactive Workspaces */}
        <div className="lg:col-span-2 space-y-4">
          {/* Sub-Tabs */}
          <div className="flex space-x-1 bg-theme-surface-2 p-1 rounded-lg border border-theme-divider">
            {[
              { id: "summary", label: "My Information", icon: UserIcon },
              { id: "sessions", label: "Active Sessions", icon: Shield },
              { id: "notifications", label: "Mutes & Alerts", icon: Bell },
              { id: "preferences", label: "Regional Prefs", icon: Globe }
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
                <tab.icon size={13} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Sub-Tab Content Panel */}
          <div className="bg-theme-surface-1 border border-theme-divider rounded-xl p-6 min-h-[400px]">
            {activeSubTab === "summary" && (
              <form onSubmit={handleUpdatePersonal} className="space-y-6">
                <div className="flex items-center justify-between border-b border-theme-divider pb-3">
                  <h3 className="text-sm font-bold text-theme-body">Operator Profile Ledger</h3>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Save size={13} /> {saving ? "Saving..." : "Save Details"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-theme-muted uppercase font-bold">Display Name / Alias</label>
                    <input 
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded text-sm text-theme-body focus:outline-none focus:border-blue-500 font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-theme-muted uppercase font-bold">Username ID</label>
                    <input 
                      type="text"
                      value={currentUser.username}
                      disabled
                      className="w-full px-3 py-2 bg-theme-surface-3 border border-theme-divider rounded text-sm text-theme-muted cursor-not-allowed font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-theme-muted uppercase font-bold">Primary Mobile</label>
                    <input 
                      type="tel"
                      value={mobile}
                      onChange={e => setMobile(e.target.value)}
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded text-sm text-theme-body focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-theme-muted uppercase font-bold">Primary Corporate Email</label>
                    <input 
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded text-sm text-theme-body focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-theme-divider grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-xs text-theme-muted">
                  <div>
                    <span className="block font-bold uppercase tracking-wider text-[9px] mb-0.5">Joining Date</span>
                    <span className="font-medium text-theme-body font-mono">{currentUser.dateOfJoining}</span>
                  </div>
                  <div>
                    <span className="block font-bold uppercase tracking-wider text-[9px] mb-0.5">Employment Type</span>
                    <span className="font-medium text-theme-body">{currentUser.employmentType}</span>
                  </div>
                  <div>
                    <span className="block font-bold uppercase tracking-wider text-[9px] mb-0.5">Reporting Officer</span>
                    <span className="font-medium text-theme-body">{currentUser.reportingManager || "None Assigned"}</span>
                  </div>
                  <div>
                    <span className="block font-bold uppercase tracking-wider text-[9px] mb-0.5">Gender ID</span>
                    <span className="font-medium text-theme-body">{currentUser.gender}</span>
                  </div>
                  <div>
                    <span className="block font-bold uppercase tracking-wider text-[9px] mb-0.5">Birth Date Ledger</span>
                    <span className="font-medium text-theme-body font-mono">{currentUser.dateOfBirth}</span>
                  </div>
                  <div>
                    <span className="block font-bold uppercase tracking-wider text-[9px] mb-0.5">Emergency Contact</span>
                    <span className="font-medium text-theme-body font-mono">{currentUser.emergencyContact || "N/A"}</span>
                  </div>
                </div>
              </form>
            )}

            {activeSubTab === "sessions" && (
              <div className="space-y-6">
                <div className="border-b border-theme-divider pb-3">
                  <h3 className="text-sm font-bold text-theme-body">Active Operator Sessions</h3>
                  <p className="text-xs text-theme-muted mt-1">
                    Session management is handled by the SMRITI Security Gateway.
                  </p>
                </div>

                {/* JWT migration placeholder — sessions UI retired in v3.21.0 */}
                <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <Shield size={28} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-theme-body mb-1">Managed by SMRITI Security Gateway</p>
                    <p className="text-xs text-theme-muted max-w-xs mx-auto">
                      Your authentication is now secured by JWT tokens issued by the SMRITI FastAPI backend.
                      Per-session management will be available in v3.22.0 when the secure session audit table is provisioned.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      localStorage.removeItem("smriti_jwt_token");
                      localStorage.removeItem("smriti_session_token");
                      window.location.reload();
                    }}
                    className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2 transition-colors"
                  >
                    <Power size={13} /> Sign Out All Devices
                  </button>
                </div>
              </div>
            )}

            {activeSubTab === "notifications" && (
              <div className="space-y-6">
                <div className="border-b border-theme-divider pb-3">
                  <h3 className="text-sm font-bold text-theme-body">Alert Categories & Mutes</h3>
                  <p className="text-xs text-theme-muted mt-1">
                    Toggle channels to prevent system noise. Blocked categories will not register on your local workspace.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(notificationSettings).map(([key, value]) => (
                    <div 
                      key={key} 
                      onClick={() => handleToggleNotification(key as keyof User["notificationSettings"])}
                      className="flex items-center justify-between p-3.5 bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider rounded-lg cursor-pointer shadow-sm hover:shadow-md hover:border-[#2563EB] transition-all"
                    >
                      <div>
                        <span className="text-xs font-bold text-theme-body capitalize block">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                        <span className="text-[10px] text-theme-muted">
                          {value ? "Delivery channel active" : "Muted from this workspace"}
                        </span>
                      </div>
                      <div className={`w-10 h-5 rounded-full relative transition-colors ${value ? "bg-blue-600" : "bg-theme-surface-3"}`}>
                        <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-all ${value ? "left-5.5" : "left-1"}`}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSubTab === "preferences" && (
              <form onSubmit={handleUpdatePreferences} className="space-y-6">
                <div className="flex items-center justify-between border-b border-theme-divider pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-theme-body">Operator Regional Preferences</h3>
                    <p className="text-xs text-theme-muted mt-1">Set localized workspace characteristics.</p>
                  </div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Save size={13} /> {saving ? "Saving..." : "Save Preferences"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] text-theme-muted uppercase font-bold flex items-center gap-1">
                      <Clock size={12} className="text-blue-500" />
                      Active Time Zone
                    </label>
                    <select
                      value={timeZone}
                      onChange={e => setTimeZone(e.target.value)}
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded text-sm text-theme-body focus:outline-none focus:border-blue-500 font-medium"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+5:30)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST - UTC+4:00)</option>
                      <option value="Europe/London">Europe/London (GMT - UTC+0:00)</option>
                      <option value="America/New_York">America/New_York (EST - UTC-5:00)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-theme-muted uppercase font-bold flex items-center gap-1">
                      <Globe size={12} className="text-blue-500" />
                      Ledger Display Language
                    </label>
                    <select
                      value={language}
                      onChange={e => setLanguage(e.target.value)}
                      className="w-full px-3 py-2 bg-theme-surface-2 border border-theme-divider rounded text-sm text-theme-body focus:outline-none focus:border-blue-500 font-medium"
                    >
                      <option value="English">English (International)</option>
                      <option value="Hindi">Hindi (हिन्दी)</option>
                      <option value="Marathi">Marathi (मराठी)</option>
                      <option value="Gujarati">Gujarati (ગુજરાતી)</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-theme-muted uppercase font-bold flex items-center gap-1">
                      <Clock size={12} className="text-blue-500" />
                      Workspace Color Profile
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTheme("light")}
                        className={`px-4 py-2 border rounded font-bold text-xs transition-all ${
                          theme === "light"
                            ? "bg-blue-500/10 border-blue-500 text-blue-400"
                            : "bg-theme-surface-2 border-theme-divider text-theme-muted"
                        }`}
                      >
                        Light Theme Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme("dark")}
                        className={`px-4 py-2 border rounded font-bold text-xs transition-all ${
                          theme === "dark"
                            ? "bg-blue-500/10 border-blue-500 text-blue-400"
                            : "bg-theme-surface-2 border-theme-divider text-theme-muted"
                        }`}
                      >
                        Dark Theme Profile
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
