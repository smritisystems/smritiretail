import React from 'react';

export type WorkspaceSectionProps = {
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export const WorkspaceSection: React.FC<WorkspaceSectionProps> = ({ title, children, className = '' }) => {
  return (
    <section className={`smriti-workspace-section ${className}`} style={{marginBottom:'var(--smriti-space-lg,24px)'}}>
      {title && <h3 className="smriti-workspace-section__title" style={{fontSize:'var(--smriti-heading-lg,16px)', marginBottom:'var(--smriti-space-sm,8px)'}}>{title}</h3>}
      <div className="smriti-workspace-section__content">{children}</div>
    </section>
  );
};

export default WorkspaceSection;
