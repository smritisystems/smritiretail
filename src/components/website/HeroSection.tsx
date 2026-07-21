/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 28.0.0
 * Created      : 2026-07-22
 * Modified     : 2026-07-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Hero Section UI Component
 */

import React from 'react';
import { ArrowRight, ShieldCheck, Zap, Sparkles } from 'lucide-react';

interface HeroProps {
  onOpenDemo: () => void;
}

export const HeroSection: React.FC<HeroProps> = ({ onOpenDemo }) => {
  return (
    <div className="relative overflow-hidden pt-12 pb-20 px-6 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 border-b border-slate-800">
      <div className="max-w-6xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-8">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>v28.0.0 Digital Platform Release</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-tight mb-6">
          The Sovereign Operating System for <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400">Modern Commerce</span>
        </h1>

        {/* Subtitle */}
        <p className="text-slate-400 text-base md:text-xl max-w-3xl mx-auto leading-relaxed mb-10">
          Unifying Point-of-Sale billing, WMS, double-entry accounting, NIC GST auto-filing, and AI advisory into an enterprise 3-tier digital platform.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-16">
          <button
            onClick={onOpenDemo}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
          >
            Book Live Product Demo <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="/docs"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            Explore Platform Architecture <Zap className="w-4 h-4 text-amber-400" />
          </a>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-8 border-t border-slate-800/80">
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
            <div className="text-2xl md:text-3xl font-bold text-emerald-400 mb-1">99.99%</div>
            <div className="text-xs text-slate-400">POS Uptime Reliability</div>
          </div>
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
            <div className="text-2xl md:text-3xl font-bold text-sky-400 mb-1">&lt;10ms</div>
            <div className="text-xs text-slate-400">Barcode Scan Latency</div>
          </div>
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
            <div className="text-2xl md:text-3xl font-bold text-indigo-400 mb-1">100%</div>
            <div className="text-xs text-slate-400">NIC GST Compliance</div>
          </div>
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
            <div className="text-2xl md:text-3xl font-bold text-amber-400 mb-1">66 / 66</div>
            <div className="text-xs text-slate-400">Quality Tests Passed</div>
          </div>
        </div>
      </div>
    </div>
  );
};
