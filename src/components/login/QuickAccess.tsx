/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.45.2
 * Created      : 2026-09-27
 * Modified     : 2026-09-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { LucideIcon, Shield, Users, CreditCard } from "lucide-react";

export interface DemoPersona {
  role: string;
  u: string;
  pw: string;
  icon: LucideIcon;
}

export const DEMO_PERSONAS: DemoPersona[] = [
  { role: "Admin",   u: "admin",   pw: "Admin@123",   icon: Shield },
  { role: "Manager", u: "manager", pw: "Manager@123", icon: Users },
  { role: "Cashier", u: "cashier", pw: "Cashier@123", icon: CreditCard },
];

interface QuickAccessProps {
  activePersona: string | null;
  onSelectPersona: (role: string, username: string, pw: string) => void;
  className?: string;
}

export const QuickAccess: React.FC<QuickAccessProps> = ({
  activePersona,
  onSelectPersona,
  className = "",
}) => {
  return (
    <div className={`pt-1 ${className}`}>
      <div className="relative flex items-center justify-center mb-3">
        <div className="border-t border-slate-200/80 absolute inset-x-0" aria-hidden="true" />
        <span className="relative bg-white/95 px-3 text-[10px] font-mono text-slate-400 uppercase tracking-widest font-semibold select-none">
          OR QUICK ACCESS
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Demo persona quick access buttons">
        {DEMO_PERSONAS.map(({ role, u, pw, icon: Icon }) => {
          const isActive = activePersona === role;
          return (
            <button
              key={role}
              type="button"
              aria-pressed={isActive}
              aria-label={`Login as ${role}`}
              onClick={() => onSelectPersona(role, u, pw)}
              className={`py-2 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isActive
                  ? "border-2 border-blue-400 bg-blue-50/90 text-blue-700 shadow-sm shadow-blue-100 font-bold"
                  : "border border-slate-200 bg-[#f8fafc] text-slate-700 hover:bg-slate-100 hover:border-slate-300"
              }`}
            >
              <Icon size={13} className={isActive ? "text-blue-600" : "text-slate-500"} aria-hidden="true" />
              <span>{role}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
