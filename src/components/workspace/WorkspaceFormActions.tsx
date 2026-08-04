import React from 'react';

export type WorkspaceFormActionsProps = {
  secondaryActions?: React.ReactNode;
  primaryActions?: React.ReactNode;
  extraMeta?: React.ReactNode;
  className?: string;
};

export const WorkspaceFormActions: React.FC<WorkspaceFormActionsProps> = ({
  secondaryActions,
  primaryActions,
  extraMeta,
  className = '',
}) => {
  return (
    <div
      className={`smriti-workspace-form-actions ${className}`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 'var(--smriti-space-sm, 8px)',
        padding: 'var(--smriti-space-sm, 12px)',
        background: 'var(--c-theme-surface-2)',
        border: '1px solid var(--c-theme-divider)',
        borderRadius: 'var(--smriti-radius-lg, 18px)',
      }}
    >
      <div style={{ display: 'flex', gap: 'var(--smriti-space-sm, 8px)', flexWrap: 'wrap', alignItems: 'center' }}>
        {secondaryActions}
      </div>
      <div style={{ display: 'flex', gap: 'var(--smriti-space-sm, 8px)', flexWrap: 'wrap', alignItems: 'center' }}>
        {primaryActions}
      </div>
      {extraMeta ? (
        <div style={{ minWidth: '160px', textAlign: 'right', color: 'var(--c-theme-muted)', fontSize: 'var(--smriti-body-sm, 13px)' }}>
          {extraMeta}
        </div>
      ) : null}
    </div>
  );
};

export default WorkspaceFormActions;
