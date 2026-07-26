/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS UI Component (Status: Stable)
 */

import React from 'react';
import { Check, Minus } from 'lucide-react';

export interface SEDSCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  indeterminate?: boolean;
  className?: string;
}

export const SEDSCheckbox: React.FC<SEDSCheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  indeterminate = false,
  className = '',
}) => {
  return (
    <label className={`inline-flex items-center gap-2 cursor-pointer font-mono text-xs select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={indeterminate ? 'mixed' : checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`w-4 h-4 rounded border flex items-center justify-center transition-all outline-none focus:ring-2 focus:ring-indigo-500/30 shrink-0 ${
          checked || indeterminate
            ? 'bg-indigo-600 border-indigo-500 text-white'
            : 'bg-theme-surface-2 border-theme-divider text-transparent hover:border-theme-muted'
        }`}
      >
        {indeterminate ? (
          <Minus size={11} className="stroke-[3]" />
        ) : (
          checked && <Check size={11} className="stroke-[3]" />
        )}
      </button>
      {label && <span className="text-theme-body">{label}</span>}
    </label>
  );
};
