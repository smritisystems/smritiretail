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
import { LucideIcon, Store, Cloud, Smartphone, ShieldCheck, Sliders, Users } from "lucide-react";

export interface DockPillar {
  icon: LucideIcon;
  label: string;
  sub: string;
}

export const DOCK_PILLARS: DockPillar[] = [
  { icon: Store,       label: "Multi-Store",         sub: "Support" },
  { icon: Cloud,       label: "Cloud Ready",         sub: "Access Anywhere" },
  { icon: Smartphone,  label: "Web | Mobile | POS",  sub: "Multi-Device Access" },
  { icon: ShieldCheck, label: "Secure & Reliable",   sub: "Enterprise Grade" },
  { icon: Sliders,     label: "Flexible & Scalable", sub: "For Growing Business" },
];

interface EnterpriseDockProps {
  className?: string;
}

export const EnterpriseDock: React.FC<EnterpriseDockProps> = ({ className = "" }) => {
  return (
    <footer
      className={`relative z-20 w-full px-4 sm:px-6 lg:px-10 pb-4 pt-1 ${className}`}
      role="contentinfo"
      aria-label="Enterprise platform highlights"
    >
      <div className="max-w-[1550px] mx-auto bg-[#061229]/95 backdrop-blur-2xl border border-blue-900/40 rounded-2xl px-5 py-3 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3">

        {/* Left: 5 Enterprise Pillars */}
        <div className="flex items-center gap-4 sm:gap-6 lg:gap-8 overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-nowrap w-full md:w-auto">
          {DOCK_PILLARS.map(({ icon: Icon, label, sub }, i) => (
            <React.Fragment key={label}>
              {i > 0 && <div className="hidden lg:block w-px h-7 bg-blue-800/40 shrink-0" aria-hidden="true" />}
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-blue-950/80 border border-blue-800/40 flex-shrink-0 flex items-center justify-center text-blue-400" aria-hidden="true">
                  <Icon size={14} />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-white leading-tight text-xs whitespace-nowrap">{label}</div>
                  <div className="text-[10px] text-slate-400 leading-tight whitespace-nowrap mt-0.5">{sub}</div>
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Right: PEOPLE | PRODUCTS | PROCESS | PROFIT Capsule with Tab Indicator */}
        <div className="shrink-0 bg-[#0b1b38] border border-blue-800/50 rounded-xl px-4 py-2 flex flex-col items-center justify-center">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-white shrink-0" aria-hidden="true" />
            <span className="text-[10px] font-mono font-bold tracking-widest text-slate-200 whitespace-nowrap">
              PEOPLE <span className="text-slate-500 font-normal">|</span> PRODUCTS <span className="text-slate-500 font-normal">|</span> PROCESS <span className="text-slate-500 font-normal">|</span> PROFIT
            </span>
          </div>
          <div className="w-10 h-0.5 bg-blue-500 rounded-full mt-1.5" aria-hidden="true" />
        </div>

      </div>
    </footer>
  );
};
