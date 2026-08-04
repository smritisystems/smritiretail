"use strict";
/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Generic Document Header
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentHeader = void 0;
var react_1 = require("react");
var lucide_react_1 = require("lucide-react");
var WorkspaceFormActions_tsx_1 = require("../../../components/workspace/WorkspaceFormActions.tsx");
var DocumentHeader = function (_a) {
    var title = _a.title, documentNo = _a.documentNo, status = _a.status, mode = _a.mode, onModeChange = _a.onModeChange, profileName = _a.profileName, onBack = _a.onBack, onSaveDraft = _a.onSaveDraft, onSave = _a.onSave, onPost = _a.onPost, onPrint = _a.onPrint, onOpenCommandPalette = _a.onOpenCommandPalette;
    return (<div className="bg-theme-surface-1 border-b border-theme-divider px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
      {/* Left: Back & Title */}
      <div className="flex items-center space-x-4 min-w-0">
        <button type="button" onClick={onBack} className="p-2 rounded-xl bg-theme-surface-2 hover:bg-theme-surface-hover text-theme-body hover:text-theme-heading transition flex items-center space-x-1.5 text-xs font-bold cursor-pointer min-h-[44px]" aria-label="Back to registry">
          <lucide_react_1.ArrowLeft size={16}/>
          <span>Back to Registry</span>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 min-w-0">
            <h2 className="text-base font-bold font-display text-theme-heading tracking-wide truncate">{title}</h2>
            <span className={"px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ".concat(status === "Draft"
            ? "bg-blue-950/80 text-[var(--c-seef-accent)] border border-blue-500/40"
            : status === "Submitted"
                ? "bg-amber-950/80 text-amber-400 border border-amber-500/40"
                : "bg-emerald-950/80 text-emerald-400 border border-emerald-500/40")}>
              {status}
            </span>
          </div>
          {documentNo && <span className="text-xs font-mono text-indigo-400 font-semibold block truncate">{documentNo}</span>}
        </div>
      </div>

      {/* Center/Right: Progressive Experience Mode Switcher & Controls */}
      <div className="flex flex-wrap items-center space-x-3 text-xs min-w-0">
        {/* Mode Selector */}
        <div className="flex items-center bg-theme-surface-2 border border-theme-divider rounded-xl p-1">
          <span className="px-2 text-[10px] font-mono text-theme-muted uppercase hidden sm:inline">Mode:</span>
          {["simple", "standard", "enterprise"].map(function (m) { return (<button key={m} type="button" onClick={function () { return onModeChange(m); }} className={"px-3 py-1 rounded-lg text-xs font-bold transition capitalize cursor-pointer ".concat(mode === m
                ? "bg-indigo-600 text-white shadow-md"
                : "text-theme-muted hover:text-theme-primary")}>
              {m}
            </button>); })}
        </div>

        {/* Command Palette Trigger */}
        {onOpenCommandPalette && (<button type="button" onClick={onOpenCommandPalette} className="px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider text-theme-body rounded-xl text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer min-h-[44px] focus:outline-none focus-visible:ring focus-visible:ring-indigo-500/30" title="Command Palette (Ctrl+K)" aria-label="Open command palette">
            <lucide_react_1.Command size={14} className="text-indigo-400"/>
            <span className="hidden sm:inline">Commands</span>
            <span className="font-mono text-[9px] bg-theme-surface-2 px-1 rounded text-theme-muted">Ctrl+K</span>
          </button>)}

        <WorkspaceFormActions_tsx_1.WorkspaceFormActions primaryActions={<>
              {onSaveDraft && (<button type="button" onClick={onSaveDraft} className="px-3 py-1.5 bg-theme-surface-2 hover:bg-theme-surface-hover border border-theme-divider text-theme-body rounded-xl font-semibold transition cursor-pointer min-h-[44px]">
                  Save Draft
                </button>)}

              {onSave && (<button type="button" onClick={onSave} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition flex items-center space-x-1.5 cursor-pointer min-h-[44px]">
                  <lucide_react_1.Save size={14}/>
                  <span>Save</span>
                </button>)}

              {onPost && (<button type="button" onClick={onPost} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition flex items-center space-x-1.5 cursor-pointer min-h-[44px]">
                  <lucide_react_1.CheckCircle2 size={14}/>
                  <span>Post Invoice</span>
                </button>)}
            </>} extraMeta={documentNo ? <div className="text-right text-xs font-mono text-theme-muted truncate">{documentNo}</div> : undefined}/>
      </div>
    </div>);
};
exports.DocumentHeader = DocumentHeader;
