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
    primary: 'bg-[#2563EB] text-white hover:bg-[#1D4ED8] active:bg-[#1E40AF] focus:ring-2 focus:ring-[#2563EB]/40',
    secondary: 'bg-[#1E293B] text-slate-200 border border-slate-700/60 hover:bg-[#334155] active:bg-[#475569] focus:ring-2 focus:ring-slate-500/40',
    subtle: 'bg-transparent text-slate-300 hover:bg-[#1E293B] hover:text-white active:bg-[#334155] focus:ring-2 focus:ring-slate-500/40',
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
