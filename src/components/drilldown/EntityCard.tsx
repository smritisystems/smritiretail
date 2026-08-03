/**
 * Project      : SMRITI Retail OS v6.5 â€” Platform Architecture Constitution
 * Module       : EntityCard (Metadata-Driven Generic Entity Card Component)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : Â© SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.1.0
 */

import React from "react";
import { SUNEFKernel } from "../../navigation/SUNEFKernel.ts";
import { Package, Users, Building, Warehouse, ChevronRight, ExternalLink } from "lucide-react";

interface EntityCardProps {
  entity: string;
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  kpis?: { label: string; value: string }[];
  onClose?: () => void;
}

export const EntityCard: React.FC<EntityCardProps> = ({
  entity,
  id,
  title,
  subtitle,
  badge,
  kpis,
  onClose
}) => {
  const manifest = SUNEFKernel.resolveManifest(entity);

  const getIcon = () => {
    switch (manifest?.icon) {
      case "users": return <Users className="w-5 h-5 text-blue-400" />;
      case "building": return <Building className="w-5 h-5 text-purple-400" />;
      case "package": return <Package className="w-5 h-5 text-emerald-400" />;
      case "warehouse": return <Warehouse className="w-5 h-5 text-amber-400" />;
      default: return <Package className="w-5 h-5 text-[var(--c-seef-accent)]" />;
    }
  };

  const handleOpenWorkspace = () => {
    SUNEFKernel.open({ type: entity, id });
    if (onClose) onClose();
  };

  return (
    <div className="p-4 bg-theme-surface-2 border border-theme-divider rounded-xl space-y-3 font-sans select-none shadow-md">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-theme-surface-3 border border-theme-divider">
            {getIcon()}
          </div>
          <div>
            <h4 className="text-sm font-bold text-theme-heading truncate max-w-[200px]">{title}</h4>
            <p className="text-[10px] text-theme-muted font-mono">{subtitle || `${manifest?.entity || entity} ID: ${id}`}</p>
          </div>
        </div>
        {badge && (
          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-bold">
            {badge}
          </span>
        )}
      </div>

      {kpis && kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-theme-divider/50 font-mono text-xs">
          {kpis.map((k) => (
            <div key={k.label} className="p-2 bg-theme-surface-1 rounded border border-theme-divider">
              <span className="text-[9px] text-theme-muted uppercase block font-bold">{k.label}</span>
              <strong className="text-xs font-bold text-theme-heading">{k.value}</strong>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleOpenWorkspace}
        className="w-full py-2 bg-[var(--c-seef-accent)] hover:bg-[var(--c-seef-accent)]/90 text-white rounded-lg text-xs font-bold font-mono flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
      >
        <span>Open {manifest?.entity || entity} Workspace</span>
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
