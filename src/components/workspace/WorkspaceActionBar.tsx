import React from 'react';
import { createSurfaceStyle } from '../../design/visualGovernance';

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
        ...createSurfaceStyle('workspace'),
        background: 'var(--smriti-workspace-actionbar-bg, transparent)',
        border: 'none',
        boxShadow: 'none',
        borderRadius: 0,
      }}
    >
      {actions}
    </div>
  );
};

export default WorkspaceActionBar;
