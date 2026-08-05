/**
 * Project      : SMRITI Retail OS
 * Component    : Workspace Profiles & Personas UX Customization Tab
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import React, { useState } from "react";
import { Layers, Sparkles, Layout, Palette, Zap } from "lucide-react";

interface WorkspaceProfile {
  code: string;
  name: string;
  persona: string;
  defaultWorkspace: string;
  theme: string;
  isDefault: boolean;
}

const SAMPLE_PROFILES: WorkspaceProfile[] = [
  { code: "PROF_RETAIL_CASHIER", name: "Retail Cashier Workspace", persona: "Retail Cashier", defaultWorkspace: "pos", theme: "light", isDefault: true },
  { code: "PROF_RETAIL_MANAGER", name: "Retail Store Manager Workspace", persona: "Retail Manager", defaultWorkspace: "dashboard", theme: "light", isDefault: false },
  { code: "PROF_WAREHOUSE_OPERATOR", name: "Warehouse Operator Workspace", persona: "Warehouse Operator", defaultWorkspace: "inventory", theme: "dark", isDefault: false }
];

export const WorkspaceProfilesTab: React.FC = () => {
  const [profiles, setProfiles] = useState<WorkspaceProfile[]>(SAMPLE_PROFILES);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="bg-theme-surface-1 p-4 rounded-lg border border-theme-divider flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-theme-text flex items-center gap-2">
            Workspace Profiles & Personas (UX Decoupled from Security)
            <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 font-mono">
              Role controls Access — Profile controls UX
            </span>
          </h2>
          <p className="text-xs text-theme-muted">
            Configure landing workspace, dashboard layout, theme, and shortcuts per Persona.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {profiles.map((p) => (
          <div key={p.code} className="bg-theme-surface-1 p-4 rounded-lg border border-theme-divider flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-violet-500/10 text-violet-400 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-mono font-bold text-blue-400">{p.code}</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-theme-text">{p.name}</h3>
              <p className="text-xs text-theme-muted">Persona: <span className="font-semibold text-theme-text">{p.persona}</span></p>
            </div>
            <div className="p-3 bg-theme-surface-2/60 rounded border border-theme-divider font-mono text-xs space-y-1">
              <div><span className="text-theme-muted">Default Workspace:</span> <span className="text-emerald-400 font-bold">{p.defaultWorkspace}</span></div>
              <div><span className="text-theme-muted">Theme:</span> <span className="text-amber-400 font-bold">{p.theme}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
