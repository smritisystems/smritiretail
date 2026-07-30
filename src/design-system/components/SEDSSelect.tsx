/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS UI Component (Status: Stable)
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface SEDSSelectOption {
  label: string;
  value: string | number;
  disabled?: boolean;
}

export interface SEDSSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  helperText?: string;
  error?: string;
  options: (SEDSSelectOption | string)[];
  size?: 'sm' | 'md' | 'lg';
}

export const SEDSSelect: React.FC<SEDSSelectProps> = ({
  label,
  helperText,
  error,
  options,
  size = 'md',
  className = '',
  disabled,
  id,
  ...props
}) => {
  const normalizedOptions: SEDSSelectOption[] = options.map((opt) =>
    typeof opt === "string" ? { label: opt, value: opt } : opt
  );
  const sizeCls = {
    sm: 'py-1 text-xs pl-3 pr-8 min-h-[32px]',
    md: 'py-2 text-xs pl-3 pr-9 min-h-[38px]',
    lg: 'py-2.5 text-sm pl-4 pr-10 min-h-[44px]',
  }[size];

  return (
    <div className="w-full space-y-1.5 font-mono">
      {label && (
        <label className="block text-xs font-semibold text-theme-muted uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <select
          disabled={disabled}
          className={`w-full appearance-none rounded-xl bg-theme-surface-2 border border-theme-divider text-theme-heading px-3 transition-all outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${sizeCls} ${
            error ? 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20' : ''
          } ${className}`}
          {...props}
        >
          {normalizedOptions.map((opt) => (
            <option key={String(opt.value)} value={opt.value} disabled={opt.disabled} className="bg-theme-surface-1 text-theme-heading">
              {opt.label}
            </option>
          ))}
        </select>
        <span className="absolute right-3 text-theme-muted pointer-events-none shrink-0">
          <ChevronDown size={size === 'sm' ? 12 : 14} />
        </span>
      </div>
      {error ? (
        <p className="text-[10px] text-rose-400 font-semibold">{error}</p>
      ) : (
        helperText && <p className="text-[10px] text-theme-muted">{helperText}</p>
      )}
    </div>
  );
};
