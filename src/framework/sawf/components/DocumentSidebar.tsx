/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Generic Document Sidebar
 */

import React from "react";
import { WidgetEngine } from "../widgets/WidgetEngine.tsx";
import { AISuggestion } from "../../../plugins/AIStudioExtension.ts";
import { Sparkles, AlertTriangle, Lightbulb } from "lucide-react";

interface DocumentSidebarProps {
  widgetIds: string[];
  data?: any;
  aiSuggestions?: AISuggestion[];
}

export const DocumentSidebar: React.FC<DocumentSidebarProps> = ({
  widgetIds,
  data,
  aiSuggestions = [],
}) => {
  return (
    <div className="space-y-4">
      {/* AI Advisory Panel (if suggestions exist) */}
      {aiSuggestions.length > 0 && (
        <div className="bg-[#161E2E] border border-indigo-900/60 rounded-xl p-4 space-y-3 text-xs shadow-lg">
          <div className="flex items-center space-x-2 text-indigo-400 font-bold font-display uppercase tracking-wider text-[10px]">
            <Sparkles size={14} />
            <span>SMRITI AI Assistant</span>
          </div>

          <div className="space-y-2">
            {aiSuggestions.map((sug) => (
              <div
                key={sug.id}
                className="p-3 bg-indigo-950/40 border border-indigo-800/40 rounded-lg space-y-1"
              >
                <div className="font-bold text-indigo-200 flex items-center space-x-1.5">
                  <Lightbulb size={13} className="text-amber-400" />
                  <span>{sug.title}</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{sug.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Widget Engine rendering dynamic widgets */}
      <WidgetEngine widgetIds={widgetIds} data={data} />
    </div>
  );
};
