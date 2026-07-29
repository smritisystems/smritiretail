/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS UI Component (Status: Stable)
 */

import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export interface SEDSToastProps {
  type?: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
  onClose?: () => void;
  className?: string;
}

export const SEDSToast: React.FC<SEDSToastProps> = ({
  type = 'info',
  title,
  message,
  onClose,
  className = '',
}) => {
  const typeCls = {
    success: 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300',
    warning: 'bg-amber-950/90 border-amber-500/50 text-amber-300',
    error: 'bg-rose-950/90 border-rose-500/50 text-rose-300',
    info: 'bg-theme-surface-1 border-indigo-500/50 text-theme-heading',
  }[type];

  const IconComponent = {
    success: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle,
    info: Info,
  }[type];

  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-md font-mono text-xs max-w-sm w-full select-none ${typeCls} ${className}`}>
      <IconComponent size={18} className="shrink-0 mt-0.5" />
      <div className="flex-1 space-y-0.5">
        <h4 className="font-bold tracking-tight">{title}</h4>
        {message && <p className="text-[11px] opacity-80 leading-relaxed">{message}</p>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-theme-muted hover:text-theme-heading p-0.5 rounded transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
