import React from 'react';

export type WorkspaceActionBarProps = {
  actions?: React.ReactNode;
  className?: string;
};

export const WorkspaceActionBar: React.FC<WorkspaceActionBarProps> = ({ actions, className = '' }) => {
  return (
    <div
      className={`smriti-workspace-actionbar ${className}`}
      style={{
        display: 'flex',
        gap: 'var(--smriti-space-sm,8px)',
        alignItems: 'center',
        paddingTop: 'var(--smriti-space-sm,8px)',
        background: 'var(--smriti-workspace-actionbar-bg, transparent)',
        color: 'var(--c-theme-body)'
      }}
    >
      {actions}
    </div>
  );
};

export default WorkspaceActionBar;
