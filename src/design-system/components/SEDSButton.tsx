/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS UI Component (Status: Stable)
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface SEDSButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'subtle' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const SEDSButton: React.FC<SEDSButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  disabled,
  children,
  className = '',
  ...props
}) => {
  const variantCls = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/50 shadow-md focus:ring-2 focus:ring-indigo-500/40',
    secondary: 'bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-heading border border-theme-divider focus:ring-2 focus:ring-indigo-500/20',
    subtle: 'bg-transparent hover:bg-theme-surface-2 text-theme-body hover:text-theme-heading focus:ring-2 focus:ring-indigo-500/20',
    destructive: 'bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/30 focus:ring-2 focus:ring-rose-500/30',
  }[variant];

  const sizeCls = {
    sm: 'px-2.5 py-1 text-xs gap-1.5 min-h-[32px]',
    md: 'px-4 py-2 text-xs font-semibold gap-2 min-h-[38px]',
    lg: 'px-5 py-2.5 text-sm font-semibold gap-2.5 min-h-[44px]',
  }[size];

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg font-mono transition-all outline-none select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variantCls} ${sizeCls} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 12 : 14} className="animate-spin text-current" />
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
          {children && <span>{children}</span>}
          {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
        </>
      )}
    </button>
  );
};
