import React from 'react';

export type WorkspaceEmptyStateProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
};

export const WorkspaceEmptyState: React.FC<WorkspaceEmptyStateProps> = ({ title = 'No items', description, actions, className = '' }) => {
  return (
    <div className={`smriti-workspace-empty ${className}`} style={{textAlign:'center', padding:'var(--smriti-space-lg,24px)'}}>
      <div className="smriti-workspace-empty__title" style={{fontSize:'var(--smriti-heading-lg,16px)', fontWeight:'var(--smriti-font-weight-medium)'}}>{title}</div>
      {description && <div className="smriti-workspace-empty__desc" style={{color:'var(--c-theme-muted)', marginTop:'var(--smriti-space-sm,8px)'}}>{description}</div>}
      {actions && <div className="smriti-workspace-empty__actions" style={{marginTop:'var(--smriti-space-md,12px)'}}>{actions}</div>}
    </div>
  );
};

export default WorkspaceEmptyState;
