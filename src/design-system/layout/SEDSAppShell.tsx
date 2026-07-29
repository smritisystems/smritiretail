/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * License      : Proprietary Commercial Software
 * Classification: Internal SEDS Layout Primitive (Status: Stable)
 */

import React from 'react';

export interface SEDSAppShellProps {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SEDSAppShell: React.FC<SEDSAppShellProps> = ({
  header,
  sidebar,
  children,
  className = '',
}) => {
  return (
    <div className={`min-h-screen flex flex-col bg-theme-base text-theme-body font-sans antialiased select-none ${className}`}>
      {header && <header className="sticky top-0 z-40 shrink-0">{header}</header>}
      <div className="flex-1 flex overflow-hidden">
        {sidebar && <aside className="shrink-0 z-30">{sidebar}</aside>}
        <main className="flex-1 flex flex-col overflow-y-auto bg-theme-base p-4 sm:p-6 transition-all">
          {children}
        </main>
      </div>
    </div>
  );
};
