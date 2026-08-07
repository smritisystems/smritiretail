/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — SAP Fiori Inspired Logical Profile Menu
 * Feature      : src/features/auth/components/UserProfileMenu.tsx
 */

import React from "react";
import {
  User as UserIcon,
  Building2,
  Sliders,
  Bell,
  Keyboard,
  HelpCircle,
  Info,
  Layers,
  Lock,
  LogOut,
  Check,
} from "lucide-react";
import { useAuthStore, authStore } from "../store/authStore";
import { LockService } from "../services/LockService";
import { useSEEF } from "../../../layout_engine/SEEFContext.tsx";
import { SEEFTheme } from "../../../layout_engine/SEEFTypes.ts";

interface UserProfileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLogoutModal: () => void;
  onSelectWorkspace?: (tab: string) => void;
}

export const UserProfileMenu: React.FC<UserProfileMenuProps> = ({
  isOpen,
  onClose,
  onOpenLogoutModal,
  onSelectWorkspace,
}) => {
  const { currentUser, selectedOrganization } = useAuthStore();
  const { config, updateSEEF } = useSEEF();
  const activeTheme = config.theme;

  if (!isOpen) return null;

  const themes: { id: SEEFTheme; label: string }[] = [
    { id: "fiori-light", label: "Horizon Light (Fiori)" },
    { id: "dark", label: "Quartz Dark" },
    { id: "corporate", label: "Corporate Navy" },
    { id: "high-contrast", label: "High Contrast" },
  ];

  const handleThemeChange = (themeId: typeof themes[number]["id"]) => {
    updateSEEF({ theme: themeId });
  };

  const handleLockWorkspace = () => {
    onClose();
    LockService.lockWorkspace();
  };

  return (
    <div className="absolute top-12 right-4 w-72 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl z-50 overflow-hidden text-xs text-slate-200 select-none font-sans">
      {/* Header User Context */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 flex items-center justify-center font-bold text-sm">
          {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "S"}
        </div>
        <div className="overflow-hidden">
          <div className="font-bold text-slate-100 truncate">{currentUser?.name || "Super Admin"}</div>
          <div className="text-[10px] font-mono text-indigo-400">{currentUser?.role || "SYSADMIN"}</div>
          <div className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
            <Building2 size={10} />
            <span className="truncate">{selectedOrganization?.name}</span>
          </div>
        </div>
      </div>

      {/* Logical Action Groups */}
      <div className="p-2 space-y-2 max-h-[70vh] overflow-y-auto">
        {/* User & Preferences */}
        <div className="space-y-0.5">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-slate-500 font-mono">
            User Settings
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onSelectWorkspace) onSelectWorkspace("user-profile");
            }}
            className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-slate-800 flex items-center gap-2 text-slate-300 transition"
          >
            <UserIcon size={14} className="text-slate-400" />
            <span>My Profile</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onSelectWorkspace) onSelectWorkspace("live-docs");
            }}
            className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-slate-800 flex items-center gap-2 text-slate-300 transition"
          >
            <HelpCircle size={14} className="text-slate-400" />
            <span>Help & Documentation</span>
          </button>
        </div>

        {/* Theme Switcher */}
        <div className="space-y-0.5 pt-1 border-t border-slate-800">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-slate-500 font-mono">
            Theme Settings
          </div>
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleThemeChange(t.id)}
              className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between transition ${
                activeTheme === t.id ? "bg-indigo-600/20 text-indigo-300 font-semibold" : "hover:bg-slate-800 text-slate-300"
              }`}
            >
              <span>{t.label}</span>
              {activeTheme === t.id && <Check size={14} className="text-indigo-400" />}
            </button>
          ))}
        </div>

        {/* Workspace Controls */}
        <div className="space-y-0.5 pt-1 border-t border-slate-800">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-slate-500 font-mono">
            Workspace Controls
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onSelectWorkspace) onSelectWorkspace("launchpad");
            }}
            className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-slate-800 flex items-center gap-2 text-slate-300 transition"
          >
            <Layers size={14} className="text-slate-400" />
            <span>Switch Workspace / Launchpad</span>
          </button>
          <button
            type="button"
            onClick={handleLockWorkspace}
            className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-slate-800 flex items-center gap-2 text-slate-300 transition"
          >
            <Lock size={14} className="text-amber-400" />
            <span>Lock Workspace</span>
          </button>
        </div>

        {/* Sign Out Trigger */}
        <div className="pt-1 border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLogoutModal();
            }}
            className="w-full px-2.5 py-1.5 rounded-lg text-left hover:bg-rose-500/10 text-rose-400 flex items-center gap-2 font-semibold transition"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
