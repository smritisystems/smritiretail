/**
 * Project      : SMRITI Retail OS
 * Module       : UCIF v1.0 — Universal Inspector Renderer
 * Standard     : UCIF-002, UCIF-004 (FROZEN)
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 *
 * UCIF-002: No hardcoded entity fields — all structure from InspectorRegistry.
 * UCIF-004: No custom inspection UI outside this renderer or a registered override.
 *
 * Features:
 *   - Progressive loading: each section renders independently as data arrives
 *   - Capability gating: sections only shown when config.capabilities[cap] === true
 *   - Context Graph: drillable field values wrapped in DrillableLink
 *   - AI Insight: rendered when capabilities.ai === true and aiSkillId set
 *   - Metadata-declared actions: rendered from config.actions[]
 *   - Plugin sections: merged from InspectorRegistry.getPluginSections()
 */

import React, { useEffect, useState, useCallback } from "react";
import type {
  InspectorConfig,
  InspectorFieldDef,
  InspectorSectionDef,
} from "../../kernel/upr/context/InspectorSchema.js";
import { InspectorRegistry } from "../../kernel/upr/context/InspectorRegistry.js";
import { InspectorDataService } from "../../kernel/upr/context/InspectorDataProvider.js";
import { InspectorLifecycleManager } from "../../kernel/upr/context/InspectorLifecycleManager.js";
import { InspectorTelemetryService } from "../../kernel/upr/context/InspectorTelemetryService.js";
import { WorkspaceActionRegistry } from "../../layout_engine/WorkspaceActionRegistry.js";
import { useDrillDown } from "./drilldown_store.js";
import { InspectorTrigger } from "./InspectorTrigger.js";

// ── Value Formatter & Field Masking (UCIF v1.1) ──────────────────────────────

const applyMasking = (value: any, strategy?: string): string => {
  if (value === null || value === undefined) return "—";
  const str = String(value);
  if (strategy === "partial") {
    if (str.length <= 4) return "****";
    return str.slice(0, 3) + "*".repeat(Math.max(0, str.length - 6)) + str.slice(-3);
  }
  if (strategy === "hidden") {
    return "••••••••";
  }
  return str;
};

const fmt = (value: any, format?: string, maskStrategy?: string): string => {
  if (value === null || value === undefined) return "—";
  if (maskStrategy && maskStrategy !== "none") {
    return applyMasking(value, maskStrategy);
  }
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value));
    case "date":
      return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    case "phone":
      return String(value);
    case "badge":
    case "text":
    default:
      return String(value);
  }
};

// ── Skeleton Loader ───────────────────────────────────────────────────────────

const SectionSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="space-y-2 px-4 py-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex justify-between">
        <div className="h-3 w-24 bg-theme-surface-2 rounded animate-pulse" />
        <div className="h-3 w-20 bg-theme-surface-2 rounded animate-pulse" />
      </div>
    ))}
  </div>
);

// ── Field Row ─────────────────────────────────────────────────────────────────

interface FieldRowProps {
  field: InspectorFieldDef;
  data: Record<string, any>;
}

const FieldRow: React.FC<FieldRowProps> = ({ field, data }) => {
  const raw = data[field.key];
  const formatted = fmt(raw, field.format, field.maskStrategy);
  const drillId = field.drillEntityIdField ? data[field.drillEntityIdField] : raw;

  const valueNode = field.drillable && field.drillEntityType && drillId ? (
    <InspectorTrigger
      entityType={field.drillEntityType}
      entityId={String(drillId)}
      title={formatted}
      className="text-theme-accent hover:underline cursor-pointer"
    >
      {formatted}
    </InspectorTrigger>
  ) : (
    <span className={field.highlight ? "font-semibold text-theme-primary" : "text-theme-text"}>
      {formatted}
    </span>
  );

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        {field.icon && (
          <span className="material-symbols-outlined text-theme-muted text-sm flex-shrink-0">{field.icon}</span>
        )}
        <span className="text-xs text-theme-muted truncate">{field.label}</span>
      </div>
      <div className="text-xs text-right truncate max-w-[55%]">
        {valueNode}
      </div>
    </div>
  );
};

// ── Section ───────────────────────────────────────────────────────────────────

interface InspectorSectionProps {
  section: InspectorSectionDef;
  data: Record<string, any>;
  loading: boolean;
  collapsed?: boolean;
}

const InspectorSection: React.FC<InspectorSectionProps> = ({ section, data, loading, collapsed: initCollapsed = false }) => {
  const [collapsed, setCollapsed] = useState(initCollapsed);

  return (
    <div className="border-b border-theme-divider last:border-0">
      {/* Section header */}
      <button
        onClick={() => section.collapsible && setCollapsed((c) => !c)}
        className={`
          w-full flex items-center justify-between px-4 py-2 text-left
          ${section.collapsible ? "cursor-pointer hover:bg-theme-surface-2/50" : "cursor-default"}
        `}
      >
        <div className="flex items-center gap-2">
          {section.icon && (
            <span className="material-symbols-outlined text-theme-muted text-sm">{section.icon}</span>
          )}
          <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">
            {section.title}
          </span>
          {section.pluginId && (
            <span className="text-xs px-1 bg-theme-accent/10 text-theme-accent rounded">plugin</span>
          )}
        </div>
        {section.collapsible && (
          <span className="material-symbols-outlined text-theme-muted text-sm">
            {collapsed ? "expand_more" : "expand_less"}
          </span>
        )}
      </button>

      {/* Section body */}
      {!collapsed && (
        <div className="px-4 pb-3">
          {loading ? <SectionSkeleton rows={section.fields.length || 3} /> : (
            <div className="divide-y divide-theme-divider/40">
              {section.fields.map((field) => (
                <FieldRow key={field.key} field={field} data={data} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Universal Inspector Renderer ──────────────────────────────────────────────

interface UniversalInspectorRendererProps {
  entityType: string;
  entityId: string;
  variant?: string;
}

export const UniversalInspectorRenderer: React.FC<UniversalInspectorRendererProps> = ({
  entityType,
  entityId,
  variant = "compact",
}) => {
  const { openPanel } = useDrillDown();
  const [sectionData, setSectionData] = useState<Record<string, any>>({});
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set(["core"]));
  const config = InspectorRegistry.resolveConfig(entityType, variant);
  const pluginSections = InspectorRegistry.getPluginSections(entityType);

  const handleSectionLoaded = useCallback((sectionKey: string, data: Record<string, any>) => {
    setSectionData((prev) => ({ ...prev, ...data, [sectionKey]: data }));
    setLoadingKeys((prev) => { const s = new Set(prev); s.delete(sectionKey); return s; });
  }, []);

  useEffect(() => {
    if (!entityId || !config) return;
    const initialKeys = new Set(config.sections.filter((s) => s.dataKey).map((s) => s.dataKey!));
    initialKeys.add("core");
    setLoadingKeys(initialKeys);

    InspectorDataService.fetch(entityType, entityId, handleSectionLoaded, config.dataProviderId);
    InspectorLifecycleManager.emit("Loaded", { entityType, entityId, variant });
    InspectorTelemetryService.trackOpen(entityType, variant);
  }, [entityType, entityId, variant]);

  useEffect(() => {
    InspectorLifecycleManager.emit("BeforeRender", { entityType, entityId, variant });
  }, []);

  useEffect(() => {
    if (loadingKeys.size === 0) {
      InspectorLifecycleManager.emit("Rendered", { entityType, entityId, variant });
    }
  }, [loadingKeys.size]);

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-3 text-theme-muted">
        <span className="material-symbols-outlined text-4xl">search_off</span>
        <div className="text-center">
          <p className="text-sm font-medium">No inspector configured</p>
          <p className="text-xs">Entity type: {entityType}</p>
        </div>
      </div>
    );
  }

  const titleValue = sectionData[config.titleField] ?? entityId;
  const subtitleValue = config.subtitleField ? sectionData[config.subtitleField] : undefined;
  const badgeValue = config.badgeField ? sectionData[config.badgeField] : undefined;
  const allSections = [...config.sections, ...pluginSections];

  const executeAction = (workspaceActionId: string) => {
    InspectorTelemetryService.trackAction(entityType, workspaceActionId);
    WorkspaceActionRegistry.execute(workspaceActionId, {
      tenantId: "TENANT-001", userId: "USER-101",
      workspaceId: entityType, mode: "ADVANCED",
      payload: { entityType, entityId },
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-theme-divider bg-theme-surface-2 flex items-start gap-3 flex-shrink-0">
        {config.showImage && sectionData[config.imageField ?? "image_url"] && (
          <img
            src={sectionData[config.imageField ?? "image_url"]}
            alt={titleValue}
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-theme-divider"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-theme-text truncate">{titleValue}</h3>
            {badgeValue && (
              <span className="px-2 py-0.5 text-xs bg-theme-accent/15 text-theme-accent rounded-full flex-shrink-0">
                {badgeValue}
              </span>
            )}
          </div>
          {subtitleValue && (
            <p className="text-xs text-theme-muted truncate mt-0.5">{subtitleValue}</p>
          )}
          <p className="text-xs text-theme-muted/60 mt-0.5 capitalize">{entityType}</p>
        </div>
      </div>

      {/* Sections (scrollable) */}
      <div className="flex-1 overflow-y-auto">
        {allSections
          .filter((s) => !s.requiresCapability || config.capabilities[s.requiresCapability])
          .map((section) => (
            <InspectorSection
              key={section.id}
              section={section}
              data={sectionData}
              loading={loadingKeys.has(section.dataKey ?? "core")}
              collapsed={section.collapsible}
            />
          ))
        }

        {/* AI Insight section */}
        {config.capabilities.ai && config.aiSkillId && (
          <div className="border-t border-theme-divider px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-sm text-theme-accent">auto_awesome</span>
              <span className="text-xs font-semibold text-theme-muted uppercase tracking-wider">AI Insight</span>
            </div>
            <div className="bg-theme-accent/5 border border-theme-accent/20 rounded-lg p-3">
              <p className="text-xs text-theme-text">
                AI recommendations are loading for this {entityType}…
              </p>
              <p className="text-xs text-theme-muted mt-1.5 italic">
                Advisory only — does not auto-execute transactions (AOP-001)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions bar */}
      {config.actions.length > 0 && (
        <div className="flex-shrink-0 border-t border-theme-divider px-3 py-2 flex flex-wrap gap-1.5 bg-theme-surface-2">
          {config.actions
            .filter((a) => !a.requiresCapability || config.capabilities[a.requiresCapability])
            .filter((a) => !a.variant || a.variant === variant || (Array.isArray(a.variant) && a.variant.includes(variant)))
            .map((action) => (
              <button
                key={action.id}
                onClick={() => executeAction(action.workspaceActionId)}
                className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg bg-theme-surface-1 border border-theme-divider text-theme-text hover:bg-theme-accent/10 hover:border-theme-accent/30 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">{action.icon}</span>
                {action.label}
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
};
