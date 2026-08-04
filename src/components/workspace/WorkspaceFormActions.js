"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkspaceFormActions = void 0;
var react_1 = require("react");
var WorkspaceFormActions = function (_a) {
    var secondaryActions = _a.secondaryActions, primaryActions = _a.primaryActions, extraMeta = _a.extraMeta, _b = _a.className, className = _b === void 0 ? '' : _b;
    return (<div className={"smriti-workspace-form-actions ".concat(className)} role="toolbar" aria-label="Workspace form actions" style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--smriti-space-sm, 12px)',
            padding: 'var(--smriti-space-sm, 12px)',
            background: 'var(--c-theme-surface-2)',
            border: '1px solid var(--c-theme-divider)',
            borderRadius: 'var(--smriti-radius-lg, 18px)',
            width: '100%',
            overflowX: 'auto',
        }}>
      <div style={{ display: 'flex', gap: 'var(--smriti-space-sm, 8px)', flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
        {secondaryActions}
      </div>
      <div style={{ display: 'flex', gap: 'var(--smriti-space-sm, 8px)', flexWrap: 'wrap', alignItems: 'center', minWidth: 0 }}>
        {primaryActions}
      </div>
      {extraMeta ? (<div style={{ flex: '1 1 auto', minWidth: 0, maxWidth: '220px', textAlign: 'right', color: 'var(--c-theme-muted)', fontSize: 'var(--smriti-body-sm, 13px)' }}>
          {extraMeta}
        </div>) : null}
    </div>);
};
exports.WorkspaceFormActions = WorkspaceFormActions;
exports.default = exports.WorkspaceFormActions;
