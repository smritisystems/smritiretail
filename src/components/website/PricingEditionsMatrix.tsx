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
 * Classification: Pricing Matrix UI Component
 */

import React from 'react';
import { Check, Star } from 'lucide-react';

interface PricingProps {
  onOpenDemo: () => void;
}

export const PricingEditionsMatrix: React.FC<PricingProps> = ({ onOpenDemo }) => {
  const editions = [
    {
      id: 'community',
      name: 'Community Edition',
      price: 'Free Forever',
      target: 'Single Store Retailers & Startups',
      features: [
        'Single POS Terminal',
        'Basic Stock & Barcode Billing',
        'GST Invoice Printing',
        'Community Forum Support'
      ],
      cta: 'Get Started Free',
      highlight: false
    },
    {
      id: 'professional',
      name: 'Professional Edition',
      price: '₹1,499',
      unit: '/ store / mo',
      target: 'Growing Multi-Counter Retailers',
      features: [
        'Multi-Counter POS & Offline Sync',
        'Pharma FEFO & Batch Expiry Control',
        'Apparel 3D Matrix Allocator',
        'Live E-Way Bill & E-Invoice Filing',
        'SMRITI Academy Certification Access'
      ],
      cta: 'Start 14-Day Trial',
      highlight: true,
      badge: 'Most Popular'
    },
    {
      id: 'enterprise',
      name: 'Enterprise Edition',
      price: 'Custom',
      unit: 'Plan',
      target: 'Multi-Store Chains & Franchises',
      features: [
        'Unlimited Multi-Store Franchise & Royalty Engine',
        'Hierarchical Multi-Bin WMS & In-Transit Transfers',
        'AI Advisory Demand Forecasting & Markdowns',
        'Dedicated SSO / SIP-001 Security Gateway',
        '24/7 SLA & Custom SDK Extensions'
      ],
      cta: 'Contact Sales',
      highlight: false
    }
  ];

  return (
    <div className="py-20 px-6 bg-slate-950 border-b border-slate-800">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">Transparent Edition Pricing</h2>
          <p className="text-slate-400 text-sm max-w-2xl mx-auto">
            Choose the edition that fits your retail scale. Upgrade seamlessly as your store network expands.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {editions.map((ed) => (
            <div
              key={ed.id}
              className={`rounded-2xl p-8 flex flex-col justify-between relative transition-all ${
                ed.highlight
                  ? 'bg-slate-800 border-2 border-indigo-500 shadow-xl shadow-indigo-500/10'
                  : 'bg-slate-900 border border-slate-800'
              }`}
            >
              {ed.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-600 text-white text-[10px] uppercase font-bold tracking-wider rounded-full shadow flex items-center gap-1">
                  <Star className="w-3 h-3 fill-current" /> {ed.badge}
                </div>
              )}

              <div>
                <h3 className="font-bold text-xl text-white mb-2">{ed.name}</h3>
                <p className="text-slate-400 text-xs mb-6">{ed.target}</p>

                <div className="mb-6 pb-6 border-b border-slate-700/50">
                  <span className="text-3xl md:text-4xl font-extrabold text-white">{ed.price}</span>
                  {ed.unit && <span className="text-xs text-slate-400 ml-1">{ed.unit}</span>}
                </div>

                <ul className="space-y-3 mb-8">
                  {ed.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={onOpenDemo}
                className={`w-full py-3 rounded-xl font-semibold text-xs transition-all ${
                  ed.highlight
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {ed.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
