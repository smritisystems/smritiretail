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

export interface SEDSLoadingProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  className?: string;
}

export const SEDSLoading: React.FC<SEDSLoadingProps> = ({
  label = 'Loading SMRITI Business OS…',
  size = 'md',
  fullScreen = false,
  className = '',
}) => {
  const iconSize = { sm: 16, md: 24, lg: 36 }[size];

  const content = (
    <div className={`flex flex-col items-center justify-center gap-3 p-6 text-center font-mono select-none ${className}`}>
      <Loader2 size={iconSize} className="animate-spin text-indigo-500" />
      {label && <p className="text-xs text-theme-muted font-medium">{label}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-theme-base/80 backdrop-blur-md flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
};
