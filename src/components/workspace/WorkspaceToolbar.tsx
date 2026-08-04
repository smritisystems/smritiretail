import React from 'react';

export type WorkspaceToolbarProps = {
  left?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
};

export const WorkspaceToolbar: React.FC<WorkspaceToolbarProps> = ({ left, right, className = '' }) => {
  return (
    <div
      className={`smriti-workspace-toolbar ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--smriti-space-md,16px)',
        padding: 'var(--smriti-space-sm,8px) 0',
        background: 'var(--smriti-workspace-toolbar-bg, var(--c-theme-surface-2))',
        color: 'var(--c-theme-body)',
        borderBottom: '1px solid var(--smriti-workspace-toolbar-border, var(--c-theme-divider))',
      }}
    >
      <div className="smriti-workspace-toolbar__left">{left}</div>
      <div className="smriti-workspace-toolbar__right">{right}</div>
    </div>
  );
};

export default WorkspaceToolbar;
