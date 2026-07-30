/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Layout Engine Component
 */

import React from "react";

interface LayoutEngineProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  sidebarOpen?: boolean;
}

export const LayoutEngine: React.FC<LayoutEngineProps> = ({
  children,
  sidebar,
  sidebarOpen = true,
}) => {
  return (
    <div className="w-full flex flex-col lg:flex-row gap-4">
      {/* Main Workspace Area */}
      <div className={`transition-all duration-200 ${sidebar && sidebarOpen ? "lg:w-3/4" : "w-full"}`}>
        {children}
      </div>

      {/* Side Drawer / Panel */}
      {sidebar && sidebarOpen && (
        <div className="lg:w-1/4 shrink-0 space-y-4 animate-in fade-in duration-200">
          {sidebar}
        </div>
      )}
    </div>
  );
};
