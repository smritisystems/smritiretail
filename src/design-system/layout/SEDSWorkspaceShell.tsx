/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Universal SEDS Enterprise Page Shell (Status: Stable)
 */

import React, { useState } from 'react';
import {
  Search,
  RefreshCw,
  Plus,
  Save,
  Trash2,
  Printer,
  Download,
  Upload,
  MoreVertical,
  Star,
  Pin,
  HelpCircle,
  Sparkles,
  ChevronRight,
  Filter,
  SlidersHorizontal,
  X,
  FileText,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';

export interface SEDSWorkspaceShellProps {
  // Page Identity
  breadcrumbs?: { label: string; href?: string }[];
  title: string;
  subtitle?: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;

  // Primary Actions
  onNew?: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  onPrint?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onRefresh?: () => void;
  primaryActions?: React.ReactNode;
  secondaryActions?: React.ReactNode;

  // Search & Filter
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  searchPlaceholder?: string;
  filterPanel?: React.ReactNode;

  // Utility Panels
  rightPanel?: React.ReactNode;
  aiPanel?: React.ReactNode;

  // Status Bar Metrics
  recordsCount?: number;
  syncStatus?: 'Online' | 'Offline' | 'Syncing';
  currentUserRole?: string;
  version?: string;

  className?: string;
  children: React.ReactNode;
}

export const SEDSWorkspaceShell: React.FC<SEDSWorkspaceShellProps> = ({
  breadcrumbs = [],
  title,
  subtitle,
  isFavorite = false,
  onToggleFavorite,
  isPinned = false,
  onTogglePin,

  onNew,
  onSave,
  onDelete,
  onPrint,
  onExport,
  onImport,
  onRefresh,
  primaryActions,
  secondaryActions,

  searchQuery = '',
  onSearchChange,
  searchPlaceholder = 'Search records… (Ctrl+F)',
  filterPanel,

  rightPanel,
  aiPanel,

  recordsCount,
  syncStatus = 'Online',
  currentUserRole = 'Administrator',
  version = '3.32.1',

  className = '',
  children,
}) => {
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);

  return (
    <div className={`flex flex-col min-h-[calc(100vh-3.5rem)] bg-theme-base text-theme-body font-mono text-xs select-none ${className}`}>
      
      {/* ── 1. Breadcrumbs Bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-theme-divider/50 text-[11px] text-theme-muted bg-theme-surface-1">
        <span>Workspace</span>
        {breadcrumbs.map((b, i) => (
          <React.Fragment key={i}>
            <ChevronRight size={12} className="text-theme-muted/60 shrink-0" />
            <span className={i === breadcrumbs.length - 1 ? 'text-theme-heading font-semibold' : ''}>
              {b.label}
            </span>
          </React.Fragment>
        ))}
      </div>

      {/* ── 2. Page Header & Quick Controls ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-theme-surface-1 border-b border-theme-divider">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-theme-heading tracking-tight">{title}</h1>
            {onToggleFavorite && (
              <button
                onClick={onToggleFavorite}
                className="text-theme-muted hover:text-amber-400 transition-colors p-1 rounded"
                title={isFavorite ? 'Remove Favorite' : 'Mark as Favorite'}
              >
                <Star size={14} className={isFavorite ? 'fill-amber-400 text-amber-400' : ''} />
              </button>
            )}
            {onTogglePin && (
              <button
                onClick={onTogglePin}
                className="text-theme-muted hover:text-indigo-400 transition-colors p-1 rounded"
                title={isPinned ? 'Unpin' : 'Pin to Quick Access'}
              >
                <Pin size={14} className={isPinned ? 'fill-indigo-400 text-indigo-400' : ''} />
              </button>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-theme-muted mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg bg-theme-surface-2 text-theme-muted hover:text-theme-heading border border-theme-divider transition-all"
              title="Refresh Data (F5)"
            >
              <RefreshCw size={14} />
            </button>
          )}
          <button
            onClick={() => setShowAIPanel(!showAIPanel)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              showAIPanel
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40'
                : 'bg-theme-surface-2 text-theme-body border-theme-divider hover:text-theme-heading'
            }`}
            title="Toggle SMRITI AI Advisory Panel"
          >
            <Sparkles size={13} className="text-indigo-400" />
            <span>AI Advisor</span>
          </button>
          {rightPanel && (
            <button
              onClick={() => setShowRightPanel(!showRightPanel)}
              className="p-1.5 rounded-lg bg-theme-surface-2 text-theme-muted hover:text-theme-heading border border-theme-divider transition-all"
              title="Toggle Utility Panel"
            >
              <SlidersHorizontal size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── 3. Primary & Secondary Action Toolbars ────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-theme-surface-2 border-b border-theme-divider shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          {onNew && (
            <button
              onClick={onNew}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-sm transition-all cursor-pointer"
              title="Create Record (Ctrl+N)"
            >
              <Plus size={13} />
              <span>New</span>
            </button>
          )}
          {onSave && (
            <button
              onClick={onSave}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-heading font-semibold rounded-lg border border-theme-divider transition-all cursor-pointer"
              title="Save Record (Ctrl+S)"
            >
              <Save size={13} className="text-emerald-400" />
              <span>Save</span>
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 font-semibold rounded-lg border border-rose-500/30 transition-all cursor-pointer"
              title="Delete Record"
            >
              <Trash2 size={13} />
            </button>
          )}
          {onPrint && (
            <button
              onClick={onPrint}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-body hover:text-theme-heading rounded-lg border border-theme-divider transition-all cursor-pointer"
              title="Print Document (Ctrl+P)"
            >
              <Printer size={13} />
            </button>
          )}
          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-body hover:text-theme-heading rounded-lg border border-theme-divider transition-all cursor-pointer"
              title="Export (Ctrl+E)"
            >
              <Download size={13} />
            </button>
          )}
          {onImport && (
            <button
              onClick={onImport}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-body hover:text-theme-heading rounded-lg border border-theme-divider transition-all cursor-pointer"
              title="Import Data (Ctrl+I)"
            >
              <Upload size={13} />
            </button>
          )}
          {primaryActions}
        </div>

        {secondaryActions && (
          <div className="flex items-center gap-1.5">{secondaryActions}</div>
        )}
      </div>

      {/* ── 4. Search & Filter Bar ────────────────────────────────────────── */}
      {(onSearchChange || filterPanel) && (
        <div className="flex items-center gap-3 px-4 py-2 bg-theme-surface-1 border-b border-theme-divider">
          {onSearchChange && (
            <div className="relative flex-1 max-w-md flex items-center">
              <Search size={13} className="absolute left-3 text-theme-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-theme-surface-2 border border-theme-divider rounded-lg pl-9 pr-3 py-1.5 text-xs text-theme-heading placeholder-theme-muted outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 text-theme-muted hover:text-theme-heading"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {filterPanel && (
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
                showFilterPanel
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 font-bold'
                  : 'bg-theme-surface-2 text-theme-body border-theme-divider hover:text-theme-heading'
              }`}
            >
              <Filter size={13} />
              <span>Filter Bar</span>
            </button>
          )}
        </div>
      )}

      {/* ── 5. Collapsible Filter Drawer ──────────────────────────────────── */}
      {showFilterPanel && filterPanel && (
        <div className="p-4 bg-theme-surface-2 border-b border-theme-divider animate-in fade-in slide-in-from-top-2 duration-200">
          {filterPanel}
        </div>
      )}

      {/* ── 6. Main Body Viewport & Optional Utility Drawers ────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-theme-base">
          {children}
        </main>

        {showRightPanel && rightPanel && (
          <aside className="w-80 border-l border-theme-divider bg-theme-surface-1 overflow-y-auto p-4 shrink-0 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-theme-divider">
              <h3 className="font-bold text-theme-heading text-xs">Utility Drawer</h3>
              <button onClick={() => setShowRightPanel(false)} className="text-theme-muted hover:text-theme-heading">
                <X size={14} />
              </button>
            </div>
            {rightPanel}
          </aside>
        )}

        {showAIPanel && (
          <aside className="w-80 border-l border-indigo-500/30 bg-theme-surface-1 overflow-y-auto p-4 shrink-0 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-indigo-500/30">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                <Sparkles size={15} />
                <span>SMRITI AI Advisor</span>
              </div>
              <button onClick={() => setShowAIPanel(false)} className="text-theme-muted hover:text-theme-heading">
                <X size={14} />
              </button>
            </div>
            {aiPanel || (
              <div className="space-y-3 text-[11px] text-theme-muted leading-relaxed">
                <div className="p-3 bg-indigo-950/40 border border-indigo-500/20 rounded-xl text-indigo-200 space-y-1">
                  <p className="font-bold">Contextual AI Insights</p>
                  <p className="opacity-80">SMRITI Advisory engine is actively monitoring this workspace. No anomalies detected in current batch transaction ledger.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-theme-heading">Quick Advisory Commands:</p>
                  <button className="w-full text-left p-2 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider transition-all">
                    💡 Explain active document rules
                  </button>
                  <button className="w-full text-left p-2 rounded-lg bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider transition-all">
                    📊 Generate metric anomaly report
                  </button>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ── 7. Universal Enterprise Status Bar ────────────────────────────── */}
      <footer className="flex items-center justify-between px-4 py-1.5 bg-theme-surface-1 border-t border-theme-divider text-[10px] text-theme-muted shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {syncStatus}
          </span>
          {recordsCount !== undefined && (
            <span>{recordsCount} Record{recordsCount !== 1 ? 's' : ''}</span>
          )}
        </div>

        <div className="flex items-center gap-4 font-mono">
          <span>Role: <strong className="text-theme-heading">{currentUserRole}</strong></span>
          <span>SMRITI Business OS <strong className="text-indigo-400">v{version}</strong></span>
        </div>
      </footer>

    </div>
  );
};
