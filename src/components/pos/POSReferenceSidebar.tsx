import React from "react";

interface SidebarAction {
  id: string;
  label: string;
  icon: string;
  onClick: () => void;
  active?: boolean;
}

interface POSReferenceSidebarProps {
  actions: SidebarAction[];
}

export const POSReferenceSidebar: React.FC<POSReferenceSidebarProps> = ({ actions }) => {
  return (
    <aside className="w-full lg:w-[260px] bg-theme-surface-2 rounded-[18px] border border-theme-divider shadow-sm p-4 space-y-4 pos-reference-card">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-theme-muted font-semibold">POS Sidebar</p>
        <h2 className="text-lg font-bold text-theme-heading">Sales Desk</h2>
        <p className="text-sm text-theme-muted leading-relaxed">Primary workspace navigation and current transaction controls for the retail billing reference screen.</p>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.25em] text-theme-muted font-semibold">Actions</p>
        <div className="grid gap-2">
          {actions.map(action => (
            <button
              key={action.id}
              onClick={action.onClick}
              className={`w-full text-left rounded-2xl px-3 py-3 flex items-center gap-3 transition-all ${action.active ? "bg-blue-600 text-white shadow-[0_12px_30px_-18px_rgba(59,130,246,0.75)]" : "bg-theme-surface-1 hover:bg-theme-surface-3 text-theme-body"}`}
            >
              <span className="material-symbols-outlined text-lg">{action.icon}</span>
              <span className="font-semibold text-sm">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-theme-surface-1 rounded-2xl border border-theme-divider p-4 space-y-2">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-theme-muted font-semibold">
          <span>Status</span>
          <span className="text-emerald-400">Active</span>
        </div>
        <div className="space-y-1 text-sm text-theme-body">
          <p>Cart Items: <strong className="text-theme-heading">{actions.length > 0 ? actions.filter((a) => a.active).length : 0}</strong></p>
          <p>POS Mode: <strong className="text-theme-heading">Reference</strong></p>
        </div>
      </div>
    </aside>
  );
};
