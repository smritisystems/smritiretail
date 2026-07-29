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
 * Classification: Industry Solutions Grid UI Component
 */

import React from 'react';
import { Activity, Layers, ShieldCheck, GitPullRequest, Check } from 'lucide-react';

export const IndustrySolutionsGrid: React.FC = () => {
  const solutions = [
    {
      id: 'pharma',
      name: 'Pharma & Healthcare Retail Engine (v24.0.0)',
      icon: Activity,
      tagline: 'Schedule H/H1 Compliance & FEFO Batch Control',
      description: 'Doctor registration validation, active generic salt composition substitute search, and automated near-expiry locks preventing sale of medicines expiring in < 30 days.',
      features: ['Schedule H/H1 Prescription Validator', 'Generic Salt Substitute Finder', 'FEFO Batch Expiry Lock', 'UDMS Medical Records Link']
    },
    {
      id: 'apparel',
      name: 'Apparel & Fashion 3D Matrix Engine (v25.0.0)',
      icon: Layers,
      tagline: 'Color-Size-Style Matrix & Seasonal Markdowns',
      description: 'Multi-dimensional Variant Allocation Grid, age-based automated seasonal discount markdowns, and thermal ZPL printer hangtag rendering.',
      features: ['3D Variant Matrix Allocator', 'Automated Age-Based Markdowns', 'ZPL Thermal Hangtag Renderer', 'EAN-13 Barcode Printing']
    },
    {
      id: 'nic_gst',
      name: 'NIC GSTN E-Way Bill & E-Invoice Gateway (v26.0.0)',
      icon: ShieldCheck,
      tagline: 'Auto-Filing Compliance Gateway for Indian GST',
      description: 'SHA-256 IRN hash computation, signed B2B QR code generation, automated E-Way bill dispatch (> ₹50k), and GSTR-1/3B return reconciliation.',
      features: ['SHA-256 IRN Hash Computation', 'B2B Signed QR Code Generator', 'E-Way Bill Dispatch Engine', 'GSTR-1 & 3B Reconciliation']
    },
    {
      id: 'franchise',
      name: 'Multi-Store Franchise & Royalty Engine (v21.0.0)',
      icon: GitPullRequest,
      tagline: 'Enterprise Multi-Store & Franchise Settlement',
      description: 'Central store registry, automated tiered royalty fee calculations, automated debit note billing, and consolidated store P&L analytics.',
      features: ['Franchise Store Hierarchy Registry', 'Tiered Royalty Fee Calculator', 'Debit Note Settlement Engine', 'Consolidated Store Analytics']
    }
  ];

  return (
    <div className="py-20 px-6 bg-slate-900 border-b border-slate-800">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">Tailored Industry Solutions</h2>
          <p className="text-slate-400 text-sm max-w-2xl mx-auto">
            Engineered with deep vertical domain capabilities out-of-the-box for specialty retail sectors.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {solutions.map((sol) => {
            const IconComp = sol.icon;
            return (
              <div key={sol.id} className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 hover:border-indigo-500/50 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                      <IconComp className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-white">{sol.name}</h3>
                      <span className="text-xs text-indigo-400 font-medium">{sol.tagline}</span>
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed mb-6">{sol.description}</p>
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-700/50">
                  {sol.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
