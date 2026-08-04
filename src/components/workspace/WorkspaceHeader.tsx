import React from 'react';

export type WorkspaceHeaderProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({ title, subtitle, children, className = '' }) => {
  return (
    <div
      className={`smriti-workspace-header ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--smriti-space-md,16px)',
        padding: 'var(--smriti-space-sm,8px) 0',
        background: 'var(--smriti-workspace-header-bg, var(--c-theme-surface-1))',
        color: 'var(--c-theme-body)',
        borderBottom: '1px solid var(--smriti-workspace-header-border, var(--c-theme-divider))',
      }}
    >
      <div className="smriti-workspace-header__titles">
        {title && <div className="smriti-workspace-header__title" style={{fontSize:'var(--smriti-heading-xl,18px)', fontWeight:'var(--smriti-font-weight-semibold)'}}>{title}</div>}
        {subtitle && <div className="smriti-workspace-header__subtitle" style={{fontSize:'var(--smriti-body-sm,13px)', color:'var(--c-theme-muted)'}}>{subtitle}</div>}
      </div>
      <div className="smriti-workspace-header__controls">{children}</div>
    </div>
  );
};

export default WorkspaceHeader;
