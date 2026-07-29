/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS UI Component (Status: Stable)
 */

import React from 'react';
import { X } from 'lucide-react';

export interface SEDSDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  children: React.ReactNode;
}

export const SEDSDialog: React.FC<SEDSDialogProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  footer,
  maxWidth = 'md',
  className = '',
  children,
}) => {
  if (!isOpen) return null;

  const widthCls = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 font-mono text-xs select-none animate-in fade-in duration-200">
      <div className={`bg-theme-surface-1 border border-theme-divider rounded-2xl w-full p-6 space-y-4 shadow-2xl ${widthCls} ${className}`}>
        <div className="flex items-center justify-between border-b border-theme-divider pb-3">
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-sm font-bold text-theme-heading tracking-tight">{title}</h3>
            ) : (
              title
            )}
            {subtitle && (
              <p className="text-[11px] text-theme-muted mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-theme-muted hover:text-theme-heading p-1 rounded-lg hover:bg-theme-surface-2 transition-colors"
            title="Close (Esc)"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto max-h-[70vh] py-1">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-theme-divider">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
