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
  variant?: 'primary' | 'secondary' | 'subtle' | 'destructive' | 'tertiary' | 'negative';
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
  const normalizedVariant = variant === 'tertiary' ? 'subtle' : variant === 'negative' ? 'destructive' : variant;

  const variantCls = {
    primary: 'bg-[var(--c-seef-accent)] text-white hover:bg-[var(--c-seef-accent)]/90 active:bg-[var(--c-seef-accent)]/80 focus:ring-2 focus:ring-[var(--c-seef-accent)]/40',
    secondary: 'bg-theme-surface-2 text-theme-primary border border-slate-700/60 hover:bg-theme-surface-hover active:bg-theme-surface-hover focus:ring-2 focus:ring-slate-500/40',
    subtle: 'bg-transparent text-theme-body hover:bg-theme-surface-hover hover:text-theme-heading active:bg-theme-surface-hover focus:ring-2 focus:ring-slate-500/40',
    destructive: 'bg-[#DC2626] text-white hover:bg-[#B91C1C] active:bg-[#991B1B] focus:ring-2 focus:ring-[#DC2626]/40',
  }[normalizedVariant];

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
