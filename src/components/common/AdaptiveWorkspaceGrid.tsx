/**
 * SMRITI Retail OS
 * Component  : AdaptiveWorkspaceGrid
 * Purpose    : Render dashboard widgets as an adaptive grid with saved layout support.
 */
import React, { useMemo } from "react";
import { DashboardWidget } from "../../kernel/upr/dashboard/DashboardRegistry.js";
import { useResponsiveLayout } from "../../layout_engine/responsive_manager.js";
import { WorkspaceEngine } from "../../layout_engine/WorkspaceEngine.js";
import WorkspaceCard from "../workspace/WorkspaceCard";
import WorkspaceCardRegistry from "../../layout_engine/WorkspaceCardRegistry";
import {
  WorkspacePersonalizationEngine,
  WidgetLayoutConfig,
} from "../../layout_engine/WorkspacePersonalizationEngine.js";
import { MobileWidgetStack } from "./MobileWidgetStack.tsx";

interface AdaptiveWorkspaceGridProps {
  workspaceId: string;
  widgets: DashboardWidget[];
  renderWidget: (widget: WorkspaceCard, layout: WidgetLayoutConfig) => React.ReactNode;
}

const buildLayout = (
  widgets: DashboardWidget[],
  savedLayout: WidgetLayoutConfig[]
): WidgetLayoutConfig[] => {
  const defaultLayout = widgets.map((widget, index) => ({
    widgetId: widget.id,
    colSpan: widget.gridSpan?.colSpan ?? 12,
    rowSpan: widget.gridSpan?.rowSpan ?? 1,
    order: index,
  }));

  if (savedLayout.length === 0) {
    return defaultLayout;
  }

  const savedById = new Map(savedLayout.map((item) => [item.widgetId, item]));

  return widgets
    .map((widget, index) => {
      const saved = savedById.get(widget.id);
      if (saved) {
        return {
          ...saved,
          order: typeof saved.order === "number" ? saved.order : index,
        };
      }
      return defaultLayout[index];
    })
    .sort((a, b) => a.order - b.order);
};

export const AdaptiveWorkspaceGrid: React.FC<AdaptiveWorkspaceGridProps> = ({
  workspaceId,
  widgets,
  renderWidget,
}) => {
  const { device } = useResponsiveLayout("bottom");
  const savedLayout = WorkspacePersonalizationEngine.getDashboardLayout(workspaceId);

  const layout = useMemo(
    () => {
      const saved = buildLayout(widgets, savedLayout);
      saved.forEach((item) => {
        WorkspaceEngine.registerCard(workspaceId, {
          ...widgets.find((widget) => widget.id === item.widgetId)!,
          state: "visible",
          dock: "center",
          visibility: undefined,
        });
      });
      return saved;
    },
    [widgets, savedLayout, workspaceId]
  );

  if (widgets.length === 0) {
    return (
      <div style={{ padding: 24, color: "var(--c-theme-muted)", textAlign: "center" }}>
        No dashboard widgets are configured for this workspace.
      </div>
    );
  }

  if (device === "phone") {
    const mobileCards = layout
      .map((config) => {
        const widget = widgets.find((item) => item.id === config.widgetId);
        return widget
          ? ({
              ...widget,
              state: "visible",
              dock: "center",
            } as any)
          : undefined;
      })
      .filter((item): item is any => Boolean(item));

    // If a custom renderWidget prop is provided, keep using it for mobile fallback.
    if (renderWidget) {
      return <MobileWidgetStack widgets={mobileCards} layout={layout} renderWidget={renderWidget} />;
    }

    return (
      <MobileWidgetStack
        widgets={mobileCards}
        layout={layout}
        renderWidget={(widget, cfg) => {
          const { content, cardProps } = WorkspaceCardRegistry.render(widget);
          return (
            <WorkspaceCard id={widget.id} title={cardProps?.title} subtitle={cardProps?.subtitle} actions={cardProps?.actions} footer={cardProps?.footer}>
              {content}
            </WorkspaceCard>
          );
        }}
      />
    );
  }

  const columns = device === "tablet" ? 6 : 12;
  const widgetsById = new Map(widgets.map((widget) => [widget.id, widget]));

  return (
    <div
      className="adaptive-workspace-grid"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: "var(--sxp-widget-gap, 16px)",
        alignItems: "start",
        width: "100%",
      }}
    >
      {layout.map((config) => {
        const widget = widgetsById.get(config.widgetId);
        if (!widget) return null;

        const columnSpan =
          device === "tablet"
            ? Math.min(6, Math.max(1, Math.ceil(config.colSpan / 2)))
            : Math.min(12, Math.max(1, config.colSpan));
        const rowSpan = Math.max(1, config.rowSpan);

        return (
          <div
            key={widget.id}
            style={{
              gridColumn: `span ${columnSpan}`,
              gridRow: `span ${rowSpan}`,
              minHeight: rowSpan * 120,
            }}
          >
            {renderWidget ? (
              renderWidget(widget as any, config)
            ) : (
              (() => {
                const { content, cardProps } = WorkspaceCardRegistry.render(widget);
                return (
                  <WorkspaceCard id={widget.id} title={cardProps?.title} subtitle={cardProps?.subtitle} actions={cardProps?.actions} footer={cardProps?.footer}>
                    {content}
                  </WorkspaceCard>
                );
              })()
            )}
          </div>
        );
      })}
    </div>
  );
};
