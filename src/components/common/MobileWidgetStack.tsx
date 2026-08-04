/**
 * SMRITI Retail OS
 * Component  : MobileWidgetStack
 * Purpose    : Render dashboard widgets as a stacked mobile-first card list.
 */
import React from "react";
import WorkspaceCard from "../workspace/WorkspaceCard";
import type { WorkspaceCard as WorkspaceCardType } from "../../layout_engine/WorkspaceEngine";
import WorkspaceCardRegistry from "../../layout_engine/WorkspaceCardRegistry";
import { useResponsiveLayout } from "../../layout_engine/responsive_manager.js";
import { WidgetLayoutConfig } from "../../layout_engine/WorkspacePersonalizationEngine.js";

interface MobileWidgetStackProps {
  widgets: WorkspaceCardType[];
  layout: WidgetLayoutConfig[];
  renderWidget: (widget: WorkspaceCardType, layout: WidgetLayoutConfig) => React.ReactNode;
}

export const MobileWidgetStack: React.FC<MobileWidgetStackProps> = ({
  widgets,
  layout,
  renderWidget,
}) => {
  const { device } = useResponsiveLayout("bottom");

  if (device !== "phone") {
    return null;
  }

  const widgetsById = new Map(widgets.map((widget) => [widget.id, widget]));

  return (
    <div
      className="mobile-widget-stack"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sxp-widget-gap, 16px)",
        width: "100%",
      }}
    >
      {layout.map((config) => {
        const widget = widgetsById.get(config.widgetId);
        if (!widget) return null;

        const inner = renderWidget
          ? renderWidget(widget as any, config)
          : (() => {
              const { content, cardProps } = WorkspaceCardRegistry.render(widget as any);
              const cp: any = cardProps as any;
              return (
                <WorkspaceCard id={widget.id} title={cp?.title} subtitle={cp?.subtitle} actions={cp?.actions} footer={cp?.footer}>
                  {content}
                </WorkspaceCard>
              );
            })();

        return (
          <div key={widget.id} style={{ width: "100%" }}>
            {inner}
          </div>
        );
      })}
    </div>
  );
};
