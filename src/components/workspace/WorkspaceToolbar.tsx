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
      }}
    >
      <div className="smriti-workspace-toolbar__left">{left}</div>
      <div className="smriti-workspace-toolbar__right">{right}</div>
    </div>
  );
};

export default WorkspaceToolbar;
