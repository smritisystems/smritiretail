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
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React, { useState, useEffect } from "react";
import { Server, Layout, Book, Copy, Shield, Database, LayoutDashboard } from "lucide-react";
import { apiFetchV1 } from "../lib/apiFetchV1.ts";

export const AboutSmritiWidget: React.FC = () => {
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetchV1("/metadata")
      .then(data => {
        setMetadata(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load metadata:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="bg-theme-surface-1 rounded-xl p-6 border border-theme-divider animate-pulse flex items-center justify-center min-h-[200px]">
        <div className="text-theme-muted font-mono text-xs">Loading OS Configuration...</div>
      </div>
    );
  }

  return (
    <div className="bg-theme-surface-1 rounded-xl p-5 border border-theme-divider flex flex-col justify-between">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-2">
          <Server size={18} className="text-[#2563EB]" />
          <h3 className="font-display font-semibold text-lg text-theme-body">
            About {metadata?.app?.productName || 'SMRITI'}
          </h3>
        </div>
        <span className="text-[10px] bg-blue-500 bg-opacity-20 text-blue-400 border border-blue-500 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
          {metadata?.app?.environment || 'ENV'}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-theme-muted">Edition</span>
          <span className="font-semibold text-theme-body">{metadata?.app?.edition}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-theme-muted">Version</span>
          <span className="font-mono bg-theme-surface-2 px-1.5 py-0.5 rounded text-theme-body border border-theme-divider">{metadata?.app?.version}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-theme-muted">Build Number</span>
          <span className="font-mono text-theme-body">{metadata?.app?.buildNumber}</span>
        </div>
        <div className="flex justify-between items-center text-xs pt-2 border-t border-theme-divider">
          <span className="text-theme-muted flex items-center gap-1.5"><Shield size={12}/> License Status</span>
          <span className="text-emerald-400 font-semibold">{metadata?.author?.license}</span>
        </div>
      </div>
    </div>
  );
};
