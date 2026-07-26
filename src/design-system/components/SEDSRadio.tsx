/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS UI Component (Status: Stable)
 */

import React from 'react';

export interface SEDSRadioOption {
  label: React.ReactNode;
  value: string | number;
  description?: string;
  disabled?: boolean;
}

export interface SEDSRadioGroupProps {
  name: string;
  options: SEDSRadioOption[];
  value: string | number;
  onChange: (val: string | number) => void;
  direction?: 'row' | 'col';
  className?: string;
}

export const SEDSRadioGroup: React.FC<SEDSRadioGroupProps> = ({
  name,
  options,
  value,
  onChange,
  direction = 'col',
  className = '',
}) => {
  return (
    <div className={`flex ${direction === 'row' ? 'flex-row flex-wrap gap-4' : 'flex-col gap-2.5'} font-mono text-xs select-none ${className}`}>
      {options.map((opt) => {
        const isChecked = opt.value === value;
        return (
          <label
            key={String(opt.value)}
            className={`inline-flex items-start gap-2.5 cursor-pointer ${
              opt.disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <button
              type="button"
              role="radio"
              aria-checked={isChecked}
              disabled={opt.disabled}
              onClick={() => !opt.disabled && onChange(opt.value)}
              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all outline-none focus:ring-2 focus:ring-indigo-500/30 shrink-0 mt-0.5 ${
                isChecked
                  ? 'border-indigo-500 bg-indigo-600'
                  : 'border-theme-divider bg-theme-surface-2 hover:border-theme-muted'
              }`}
            >
              {isChecked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </button>
            <div>
              <span className={`text-xs font-medium ${isChecked ? 'text-theme-heading font-bold' : 'text-theme-body'}`}>
                {opt.label}
              </span>
              {opt.description && (
                <p className="text-[10px] text-theme-muted mt-0.5 leading-normal">{opt.description}</p>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
};
