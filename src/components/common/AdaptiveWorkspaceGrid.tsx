/**
 * SMRITI Retail OS
 * Component  : AdaptiveWorkspaceGrid
 * Purpose    : Render dashboard widgets as an adaptive grid with saved layout support.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { DashboardWidget } from "../../kernel/upr/dashboard/DashboardRegistry.js";
import { useResponsiveLayout } from "../../layout_engine/responsive_manager.js";
import { WorkspaceEngine } from "../../layout_engine/WorkspaceEngine.js";
import WorkspaceCard from "../workspace/WorkspaceCard";
import type { WorkspaceCard as WorkspaceCardType } from "../../layout_engine/WorkspaceEngine";
import WorkspaceCardRegistry from "../../layout_engine/WorkspaceCardRegistry";
import {
  WorkspacePersonalizationEngine,
  WidgetLayoutConfig,
} from "../../layout_engine/WorkspacePersonalizationEngine.js";
import { MobileWidgetStack } from "./MobileWidgetStack.tsx";

interface AdaptiveWorkspaceGridProps {
  workspaceId: string;
  widgets: DashboardWidget[];
  renderWidget: (widget: WorkspaceCardType, layout: WidgetLayoutConfig) => React.ReactNode;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const buildLayout = (
  widgets: DashboardWidget[],
  savedLayout: WidgetLayoutConfig[]
): WidgetLayoutConfig[] => {
  const defaultLayout = widgets.map((widget, index) => ({
    widgetId: widget.id,
    colSpan: widget.gridSpan?.colSpan ?? 4,
    rowSpan: widget.gridSpan?.rowSpan ?? 1,
    order: index,
    hidden: false,
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
          ...defaultLayout[index],
          ...saved,
          order: typeof saved.order === "number" ? saved.order : index,
          hidden: Boolean(saved.hidden),
        };
      }
      return defaultLayout[index];
    })
    .sort((a, b) => a.order - b.order);
};

const normalizeLayout = (layout: WidgetLayoutConfig[], columns: number): WidgetLayoutConfig[] => {
  const visibleItems = layout.filter((item) => !item.hidden);
  const hiddenItems = layout.filter((item) => item.hidden);
  const packed: WidgetLayoutConfig[] = [];
  let rowSpans = 0;
  let row: WidgetLayoutConfig[] = [];

  const flushRow = () => {
    const rowSpanTotal = row.reduce((sum, item) => sum + item.colSpan, 0);
    const leftover = columns - rowSpanTotal;
    if (leftover > 0 && row.length > 0) {
      row[row.length - 1] = {
        ...row[row.length - 1],
        colSpan: clamp(row[row.length - 1].colSpan + leftover, 1, columns),
      };
    }
    packed.push(...row.map((item, idx) => ({ ...item, order: packed.length + idx })));
    row = [];
  };

  visibleItems.forEach((item) => {
    const nextSpan = clamp(item.colSpan, 1, columns);
    const candidate = { ...item, colSpan: nextSpan };
    if (rowSpans + candidate.colSpan > columns) {
      flushRow();
      rowSpans = 0;
    }
    row.push(candidate);
    rowSpans += candidate.colSpan;
  });

  if (row.length > 0) {
    flushRow();
  }

  const orderedVisible = packed.map((item, index) => ({ ...item, order: index }));
  const orderedHidden = hiddenItems.map((item, index) => ({
    ...item,
    order: orderedVisible.length + index,
  }));

  return [...orderedVisible, ...orderedHidden];
};

const saveLayout = (workspaceId: string, layout: WidgetLayoutConfig[]) => {
  WorkspaceEngine.saveWorkspaceLayout(workspaceId, layout);
};

export const AdaptiveWorkspaceGrid: React.FC<AdaptiveWorkspaceGridProps> = ({
  workspaceId,
  widgets,
  renderWidget,
}) => {
  const { device } = useResponsiveLayout("bottom");
  const savedLayout = useMemo(
    () => WorkspacePersonalizationEngine.getDashboardLayout(workspaceId),
    [workspaceId]
  );
  const layoutColumns = device === "tablet" ? 6 : 12;
  const [layout, setLayout] = useState<WidgetLayoutConfig[]>(() => buildLayout(widgets, savedLayout));
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [resizingCardId, setResizingCardId] = useState<string | null>(null);
  const resizeOriginRef = useRef<{ cardId: string; startX: number; startY: number; startColSpan: number; startRowSpan: number } | null>(null);

  useEffect(() => {
    const nextLayout = buildLayout(widgets, savedLayout);
    setLayout((previous) => {
      const previousById = new Map(previous.map((entry) => [entry.widgetId, entry]));
      const next = nextLayout.map((item) => ({
        ...item,
        order: typeof previousById.get(item.widgetId)?.order === "number"
          ? previousById.get(item.widgetId)!.order
          : item.order,
      }));
      const normalized = normalizeLayout(next, layoutColumns);

      const isSame =
        normalized.length === previous.length &&
        normalized.every((entry, index) => {
          const previousEntry = previous[index];
          return (
            entry.widgetId === previousEntry.widgetId &&
            entry.colSpan === previousEntry.colSpan &&
            entry.rowSpan === previousEntry.rowSpan &&
            entry.order === previousEntry.order &&
            entry.hidden === previousEntry.hidden
          );
        });

      return isSame ? previous : normalized;
    });
  }, [widgets, savedLayout, workspaceId, layoutColumns]);

  useEffect(() => {
    saveLayout(workspaceId, normalizeLayout(layout, layoutColumns));
  }, [layout, workspaceId, layoutColumns]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePointerMove = (event: PointerEvent) => {
      if (!resizeOriginRef.current) return;
      const nextLayout = layout.map((item) => {
        if (item.widgetId !== resizeOriginRef.current?.cardId) return item;
        const deltaColumn = Math.round((event.clientX - resizeOriginRef.current.startX) / 140);
        const deltaRow = Math.round((event.clientY - resizeOriginRef.current.startY) / 120);
        return {
          ...item,
          colSpan: clamp(resizeOriginRef.current.startColSpan + deltaColumn, 1, layoutColumns),
          rowSpan: clamp(resizeOriginRef.current.startRowSpan + deltaRow, 1, 4),
        };
      });
      setLayout(normalizeLayout(nextLayout, layoutColumns));
    };

    const handlePointerUp = () => {
      resizeOriginRef.current = null;
      setResizingCardId(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [layout, device]);

  const persistNextLayout = (nextLayout: WidgetLayoutConfig[]) => {
    const normalized = normalizeLayout(nextLayout, layoutColumns);
    setLayout(normalized);
  };

  const toggleCardVisibility = (widgetId: string) => {
    const nextLayout = layout.map((item) =>
      item.widgetId === widgetId ? { ...item, hidden: !item.hidden } : item
    );
    persistNextLayout(nextLayout);
  };

  const reorderCards = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const nextLayout = [...layout];
    const sourceIndex = nextLayout.findIndex((item) => item.widgetId === sourceId);
    const targetIndex = nextLayout.findIndex((item) => item.widgetId === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const [source] = nextLayout.splice(sourceIndex, 1);
    nextLayout.splice(targetIndex, 0, source);
    persistNextLayout(nextLayout);
  };

  const startResize = (cardId: string, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const target = layout.find((item) => item.widgetId === cardId);
    if (!target) return;
    resizeOriginRef.current = {
      cardId,
      startX: event.clientX,
      startY: event.clientY,
      startColSpan: target.colSpan,
      startRowSpan: target.rowSpan,
    };
    setResizingCardId(cardId);
  };

  const widgetsById = new Map(widgets.map((widget) => [widget.id, widget]));

  const visibleCards = layout.filter((item) => !item.hidden);

  if (widgets.length === 0) {
    return (
      <div style={{ padding: 24, color: "var(--c-theme-muted)", textAlign: "center" }}>
        No dashboard widgets are configured for this workspace.
      </div>
    );
  }

  if (device === "phone") {
    const mobileCards = visibleCards
      .map((config) => {
        const widget = widgetsById.get(config.widgetId);
        return widget ? ({ ...widget, state: "visible", dock: "center" } as any) : undefined;
      })
      .filter((item): item is any => Boolean(item));

    if (renderWidget) {
      return <MobileWidgetStack widgets={mobileCards as any} layout={layout} renderWidget={renderWidget as any} />;
    }

    return (
      <MobileWidgetStack
        widgets={mobileCards}
        layout={layout}
        renderWidget={(widget, cfg) => {
          const { content, cardProps } = WorkspaceCardRegistry.render(widget as any);
          const cp: any = cardProps as any;
          return (
            <WorkspaceCard id={widget.id} title={cp?.title} subtitle={cp?.subtitle} actions={cp?.actions} footer={cp?.footer}>
              {content}
            </WorkspaceCard>
          );
        }}
      />
    );
  }

  return (
    <div
      className="adaptive-workspace-grid"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${layoutColumns}, minmax(0, 1fr))`,
        gap: "var(--sxp-widget-gap, 16px)",
        alignItems: "start",
        width: "100%",
        gridAutoFlow: "row dense",
      }}
    >
      {layout.map((config) => {
        const widget = widgetsById.get(config.widgetId);
        if (!widget || config.hidden) return null;

        const columnSpan = clamp(Math.round(config.colSpan), 1, layoutColumns);
        const rowSpan = clamp(Math.round(config.rowSpan), 1, 4);

        return (
          <div
            key={widget.id}
            draggable
            onDragStart={() => setDraggedCardId(widget.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedCardId) {
                reorderCards(draggedCardId, widget.id);
                setDraggedCardId(null);
              }
            }}
            onDragEnd={() => setDraggedCardId(null)}
            style={{
              gridColumn: `span ${columnSpan}`,
              gridRow: `span ${rowSpan}`,
              minHeight: rowSpan * 120,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
                zIndex: 2,
              }}
            >
              <button
                type="button"
                onClick={() => toggleCardVisibility(widget.id)}
                style={{
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "1px solid var(--smriti-color-border)",
                  background: "var(--smriti-color-surface-muted)",
                  cursor: "pointer",
                  fontSize: 11,
                }}
              >
                Hide
              </button>
              <button
                type="button"
                title="Drag card"
                style={{
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "1px solid var(--smriti-color-border)",
                  background: "var(--smriti-color-surface-muted)",
                  cursor: "grab",
                  fontSize: 11,
                }}
              >
                Drag
              </button>
              <button
                type="button"
                onPointerDown={(event) => startResize(widget.id, event)}
                title="Resize card"
                style={{
                  padding: "4px 8px",
                  borderRadius: 8,
                  border: "1px solid var(--smriti-color-border)",
                  background: "var(--smriti-color-surface-muted)",
                  cursor: "nwse-resize",
                  fontSize: 11,
                }}
              >
                Resize
              </button>
            </div>
            <div style={{ paddingTop: 36 }}>
              {renderWidget ? (
                renderWidget(widget as any, config)
              ) : (
                (() => {
                  const { content, cardProps } = WorkspaceCardRegistry.render(widget as any);
                  const cp: any = cardProps as any;
                  return (
                    <WorkspaceCard id={widget.id} title={cp?.title} subtitle={cp?.subtitle} actions={cp?.actions} footer={cp?.footer}>
                      {content}
                    </WorkspaceCard>
                  );
                })()
              )}
            </div>
            {resizingCardId === widget.id && (
              <div style={{ position: "absolute", inset: 0, border: "1px dashed var(--smriti-color-border)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
};
