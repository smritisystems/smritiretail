/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS UI Component (Status: Stable)
 */

import React from 'react';

export interface SEDSBadgeProps {
  status?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  className?: string;
  children: React.ReactNode;
}

export const SEDSBadge: React.FC<SEDSBadgeProps> = ({
  status = 'neutral',
  size = 'md',
  className = '',
  children,
}) => {
  const statusCls = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    neutral: 'bg-theme-surface-2 text-theme-muted border-theme-divider',
  }[status];

  const sizeCls = {
    sm: 'px-1.5 py-0.5 text-[9px]',
    md: 'px-2 py-0.5 text-[10px]',
  }[size];

  return (
    <span className={`inline-flex items-center font-mono font-bold tracking-wider rounded-md border select-none ${statusCls} ${sizeCls} ${className}`}>
      {children}
    </span>
  );
};
