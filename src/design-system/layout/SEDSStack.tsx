/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS Layout Primitive (Status: Stable)
 */

import React from 'react';

export interface SEDSStackProps {
  direction?: 'row' | 'col';
  gap?: '1' | '2' | '3' | '4' | '6' | '8';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  wrap?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const SEDSStack: React.FC<SEDSStackProps> = ({
  direction = 'col',
  gap = '3',
  align = 'stretch',
  justify = 'start',
  wrap = false,
  className = '',
  children,
}) => {
  const dirCls = direction === 'row' ? 'flex-row' : 'flex-col';
  const gapCls = {
    '1': 'gap-1',
    '2': 'gap-2',
    '3': 'gap-3',
    '4': 'gap-4',
    '6': 'gap-6',
    '8': 'gap-8',
  }[gap];

  const alignCls = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  }[align];

  const justifyCls = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
  }[justify];

  return (
    <div className={`flex ${dirCls} ${gapCls} ${alignCls} ${justifyCls} ${wrap ? 'flex-wrap' : ''} ${className}`}>
      {children}
    </div>
  );
};
