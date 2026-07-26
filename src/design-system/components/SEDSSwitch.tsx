/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS UI Component (Status: Stable)
 */

import React from 'react';

export interface SEDSSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export const SEDSSwitch: React.FC<SEDSSwitchProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md',
  className = '',
}) => {
  const switchSizeCls = size === 'sm' ? 'w-8 h-4' : 'w-10 h-5';
  const dotSizeCls = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const translateCls = checked ? (size === 'sm' ? 'translate-x-4' : 'translate-x-5') : 'translate-x-0.5';

  return (
    <label className={`inline-flex items-center gap-2.5 cursor-pointer font-mono select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 outline-none focus:ring-2 focus:ring-indigo-500/30 ${switchSizeCls} ${
          checked ? 'bg-indigo-600' : 'bg-theme-surface-3'
        }`}
      >
        <span
          className={`inline-block rounded-full bg-white shadow-md transform transition-transform duration-200 ${dotSizeCls} ${translateCls}`}
        />
      </button>
      {label && <span className="text-xs font-semibold text-theme-body">{label}</span>}
    </label>
  );
};
