import React from 'react';

export type WorkspaceLoadingStateProps = {
  message?: React.ReactNode;
  className?: string;
};

export const WorkspaceLoadingState: React.FC<WorkspaceLoadingStateProps> = ({ message = 'Loading…', className = '' }) => {
  return (
    <div className={`smriti-workspace-loading ${className}`} style={{padding:'var(--smriti-space-md,16px)', textAlign:'center'}}>
      <div className="smriti-workspace-loading__spinner" aria-hidden style={{height:'24px', width:'24px', margin:'0 auto', borderRadius:'9999px', background:'var(--c-theme-surface-hover)'}} />
      <div className="smriti-workspace-loading__message" style={{marginTop:'var(--smriti-space-sm,8px)', color:'var(--c-theme-muted)'}}>{message}</div>
    </div>
  );
};

export default WorkspaceLoadingState;
