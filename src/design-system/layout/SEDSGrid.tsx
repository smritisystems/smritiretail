/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS Layout Primitive (Status: Stable)
 */

import React from 'react';

export interface SEDSGridProps {
  cols?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: '2' | '3' | '4' | '6' | '8';
  className?: string;
  children: React.ReactNode;
}

export const SEDSGrid: React.FC<SEDSGridProps> = ({
  cols = 3,
  gap = '4',
  className = '',
  children,
}) => {
  const colsCls = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
    12: 'grid-cols-12',
  }[cols];

  const gapCls = {
    '2': 'gap-2',
    '3': 'gap-3',
    '4': 'gap-4',
    '6': 'gap-6',
    '8': 'gap-8',
  }[gap];

  return (
    <div className={`grid ${colsCls} ${gapCls} ${className}`}>
      {children}
    </div>
  );
};
