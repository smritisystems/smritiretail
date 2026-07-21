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
 * Classification: Official Product Website Master UI Component
 */

import React, { useState } from 'react';
import { Shield, BookOpen, Grid, UserCheck, Code, Briefcase, MessageSquare, Award, ExternalLink } from 'lucide-react';
import { HeroSection } from './HeroSection';
import { IndustrySolutionsGrid } from './IndustrySolutionsGrid';
import { PricingEditionsMatrix } from './PricingEditionsMatrix';
import { DemoBookingModal } from './DemoBookingModal';

export const SmritiOfficialWebsite: React.FC = () => {
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  const topNavLinks = [
    { label: 'Documentation', route: '/docs', icon: BookOpen },
    { label: 'Marketplace', route: '/marketplace', icon: Grid },
    { label: 'Academy', route: '/academy', icon: Award },
    { label: 'Customer Portal', route: '/customer', icon: UserCheck },
    { label: 'Developer Portal', route: '/developer', icon: Code },
    { label: 'Partners', route: '/partners', icon: Briefcase },
    { label: 'Community', route: '/community', icon: MessageSquare }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Ecosystem Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-lg text-white tracking-tight">SMRITI</span>
            <span className="text-xs text-indigo-400 font-semibold ml-1.5 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
              v28.0.0
            </span>
          </div>
        </div>

        {/* Navigation Links for Ecosystem Portals */}
        <nav className="hidden lg:flex items-center gap-6">
          {topNavLinks.map((link, idx) => {
            const IconComponent = link.icon;
            return (
              <a
                key={idx}
                href={link.route}
                className="text-xs font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <IconComponent className="w-3.5 h-3.5 text-indigo-400" />
                <span>{link.label}</span>
              </a>
            );
          })}
        </nav>

        {/* Header Action Button */}
        <button
          onClick={() => setIsDemoOpen(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-indigo-600/20 transition-all"
        >
          Request Demo
        </button>
      </header>

      {/* Hero Showcase Section */}
      <HeroSection onOpenDemo={() => setIsDemoOpen(true)} />

      {/* Industry Solutions Section */}
      <IndustrySolutionsGrid />

      {/* Pricing Editions Calculator Matrix */}
      <PricingEditionsMatrix onOpenDemo={() => setIsDemoOpen(true)} />

      {/* Demo Request Modal */}
      <DemoBookingModal isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />

      {/* Master Ecosystem Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <Shield className="w-5 h-5 text-indigo-400" />
              <span className="font-bold text-white text-base">SMRITI Retail OS & Digital Platform</span>
            </div>
            <p className="text-xs text-slate-500">
              © SMRITIBooks.com. All Rights Reserved. Proprietary Commercial Software.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <a href="/docs" className="hover:text-white transition-colors">Documentation</a>
            <span>•</span>
            <a href="/customer" className="hover:text-white transition-colors">Customer Portal</a>
            <span>•</span>
            <a href="/academy" className="hover:text-white transition-colors">SMRITI Academy</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default SmritiOfficialWebsite;
