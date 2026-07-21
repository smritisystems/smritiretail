/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 29.0.0
 * Created      : 2026-07-22
 * Modified     : 2026-07-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Version Changelog Timeline UI Component
 */

import React from 'react';
import { GitCommit, Calendar, CheckCircle2, ShieldAlert } from 'lucide-react';

export const ReleaseNotesTimeline: React.FC = () => {
  const releases = [
    {
      version: 'v29.0.0',
      date: '2026-07-22',
      title: 'Live Documentation Portal & Knowledge Engine',
      highlights: [
        'Categorized technical documentation reader (User/Admin/Dev/Gov)',
        'Interactive OpenAPI reference sandbox with SDK code snippets',
        'Chronological version changelog timeline',
        'Global Unified Search integration'
      ],
      migration: 'Seamless upgrade from v28.0.0.'
    },
    {
      version: 'v28.0.0',
      date: '2026-07-22',
      title: 'Official Product Website & Public Marketing Portal',
      highlights: [
        'Master public web front door connecting all 8 Ecosystem Portals',
        'Pharma, Apparel 3D Matrix, NIC GST, and Franchise industry showcases',
        'Interactive pricing calculator (Community, Pro, Enterprise)',
        'Demo booking lead capture pipeline & analytics'
      ],
      migration: 'Seamless upgrade from v27.0.0.'
    },
    {
      version: 'v27.0.0',
      date: '2026-07-21',
      title: 'SMRITI Digital Platform Ecosystem Hub',
      highlights: [
        'DPF-001 3-Tier Digital Platform Architecture',
        'SIP-001 Identity Platform Standard & Unified SSO',
        'Portal Metadata Registry with dynamic feature flags',
        'Customer Workspace Engine & SMRITI Academy LMS'
      ],
      migration: 'Baseline platform migration.'
    }
  ];

  return (
    <div className="space-y-8">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-1">Version Changelog & Release Timeline</h2>
        <p className="text-slate-400 text-xs">Chronological release history across SMRITI Digital Platform releases.</p>
      </div>

      <div className="space-y-6 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-slate-800">
        {releases.map((rel, idx) => (
          <div key={idx} className="relative pl-10">
            <div className="absolute left-1.5 top-1.5 p-1 bg-indigo-600 rounded-full text-white ring-4 ring-slate-950">
              <GitCommit className="w-3.5 h-3.5" />
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <span className="px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-xs mr-3">
                    {rel.version}
                  </span>
                  <h3 className="font-bold text-lg text-white inline-block">{rel.title}</h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{rel.date}</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-300">Release Highlights:</span>
                <ul className="space-y-2">
                  {rel.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-800/60 text-xs text-slate-500 font-mono">
                Notes: {rel.migration}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
