/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS UI Component (Status: Stable)
 */

import React from 'react';

export interface SEDSSkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  circle?: boolean;
}

export const SEDSSkeleton: React.FC<SEDSSkeletonProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
  circle = false,
}) => {
  return (
    <div
      className={`animate-pulse bg-theme-surface-2/80 rounded ${circle ? 'rounded-full' : ''} ${className}`}
      style={{ width, height }}
    />
  );
};
