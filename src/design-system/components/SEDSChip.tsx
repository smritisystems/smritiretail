/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS UI Component (Status: Stable)
 */

import React from 'react';
import { X } from 'lucide-react';

export interface SEDSChipProps {
  label: string;
  onRemove?: () => void;
  onClick?: () => void;
  variant?: 'primary' | 'neutral' | 'active';
  size?: 'sm' | 'md';
  className?: string;
}

export const SEDSChip: React.FC<SEDSChipProps> = ({
  label,
  onRemove,
  onClick,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  const variantCls = {
    primary: 'bg-indigo-600/10 text-indigo-300 border-indigo-500/30 hover:bg-indigo-600/20',
    neutral: 'bg-theme-surface-2 text-theme-muted border-theme-divider hover:bg-theme-surface-hover hover:text-theme-heading',
    active: 'bg-indigo-600 text-white font-bold border-indigo-500 shadow-sm',
  }[variant];

  const sizeCls = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  }[size];

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center font-mono rounded-lg border transition-all select-none ${onClick ? 'cursor-pointer' : ''} ${variantCls} ${sizeCls} ${className}`}
    >
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-100 opacity-70 p-0.5 rounded transition-opacity"
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
};
