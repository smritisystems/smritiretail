/**
 * Project      : SMRITI Retail OS
 * Architecture : ADR-AUTH-001 — SAP Fiori Inspired Auth Shell Layout
 * Feature      : src/features/auth/components/AuthLayout.tsx
 */

import React from "react";
import { Shield, CheckCircle2 } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  version?: string;
  environment?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  version = "v5.2.0",
  environment = "Production",
}) => {
  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col justify-between select-none relative overflow-hidden font-sans">
      {/* Background Subtle Workspace Geometry Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* SAP Fiori Inspired Slim Header */}
      <header className="w-full px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold">
            <Shield size={18} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-sm tracking-wider text-slate-100 uppercase">SMRITI</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Retail OS
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {environment}
          </span>
          <span className="text-slate-400">{version}</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center p-4 z-10">
        {children}
      </main>

      {/* SAP Fiori Clean Footer */}
      <footer className="w-full px-6 py-3 border-t border-slate-800/80 bg-slate-900/40 text-[11px] text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 z-10 font-mono">
        <div>
          © 2026 SMRITIBooks.com. All Rights Reserved. | <span className="text-slate-300 font-semibold">Chief Systems Architect: Jawahar Ramkripal Mallah</span>
        </div>
        <div className="flex items-center space-x-4">
          <a href="#privacy" className="hover:text-slate-200 transition">Privacy Policy</a>
          <span>•</span>
          <a href="#terms" className="hover:text-slate-200 transition">Terms of Service</a>
          <span>•</span>
          <span className="text-slate-500">Build 5.2.0-Fiori</span>
        </div>
      </footer>
    </div>
  );
};
