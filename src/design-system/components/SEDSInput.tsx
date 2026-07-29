/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS UI Component (Status: Stable)
 */

import React from 'react';

export interface SEDSInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const SEDSInput: React.FC<SEDSInputProps> = ({
  label,
  helperText,
  error,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <div className="w-full space-y-1.5 font-mono">
      {label && (
        <label className="block text-xs font-semibold text-theme-muted uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3 text-theme-muted pointer-events-none shrink-0">
            {leftIcon}
          </span>
        )}
        <input
          disabled={disabled}
          className={`w-full text-xs rounded-xl bg-theme-surface-2 border border-theme-divider text-theme-heading placeholder-theme-muted px-3 py-2 transition-all outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${
            leftIcon ? 'pl-9' : ''
          } ${rightIcon ? 'pr-9' : ''} ${error ? 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/20' : ''} ${className}`}
          {...props}
        />
        {rightIcon && (
          <span className="absolute right-3 text-theme-muted shrink-0">
            {rightIcon}
          </span>
        )}
      </div>
      {error ? (
        <p className="text-[10px] text-rose-400 font-semibold">{error}</p>
      ) : (
        helperText && <p className="text-[10px] text-theme-muted">{helperText}</p>
      )}
    </div>
  );
};
