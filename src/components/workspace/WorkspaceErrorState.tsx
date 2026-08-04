import React from 'react';

export type WorkspaceErrorStateProps = {
  title?: React.ReactNode;
  message?: React.ReactNode;
  retry?: () => void;
  className?: string;
};

export const WorkspaceErrorState: React.FC<WorkspaceErrorStateProps> = ({ title = 'Something went wrong', message, retry, className = '' }) => {
  return (
    <div className={`smriti-workspace-error ${className}`} role="alert" style={{padding:'var(--smriti-space-md,16px)', textAlign:'center'}}>
      <div className="smriti-workspace-error__title" style={{fontWeight:'var(--smriti-font-weight-semibold)'}}>{title}</div>
      {message && <div className="smriti-workspace-error__message" style={{marginTop:'var(--smriti-space-sm,8px)', color:'var(--c-theme-muted)'}}>{message}</div>}
      {retry && <div style={{marginTop:'var(--smriti-space-md,12px)'}}><button onClick={retry} style={{padding:'var(--smriti-space-sm,8px) var(--smriti-space-md,12px)'}}>Retry</button></div>}
    </div>
  );
};

export default WorkspaceErrorState;
