import React from 'react';

export type WorkspaceBottomSheetProps = {
  open?: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
};

export const WorkspaceBottomSheet: React.FC<WorkspaceBottomSheetProps> = ({ open = false, onClose, children, className = '' }) => {
  if (!open) return null;
  return (
    <div
      className={`smriti-workspace-bottomsheet ${className}`}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        background: 'var(--smriti-card-bg, var(--c-theme-surface-1))',
        padding: 'var(--smriti-space-md,16px)',
        borderTopLeftRadius: 'var(--smriti-radius-lg,8px)',
        borderTopRightRadius: 'var(--smriti-radius-lg,8px)',
        boxShadow: 'var(--smriti-shadow-floating, var(--smriti-shadow-lg))',
        zIndex: 'var(--smriti-z-modal,1200)'
      }}
    >
      <div className="smriti-workspace-bottomsheet__content">{children}</div>
    </div>
  );
};

export default WorkspaceBottomSheet;
