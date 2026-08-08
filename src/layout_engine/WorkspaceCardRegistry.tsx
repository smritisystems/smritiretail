import React from 'react';
import { SummaryCard } from '../components/shared/widgets/SummaryCard';
import { TrendCard } from '../components/shared/widgets/TrendCard';
import { AlertCard } from '../components/shared/widgets/AlertCard';
import { TimelineCard } from '../components/shared/widgets/TimelineCard';

type WidgetRenderer = (widget: any) => {
  content: React.ReactNode;
  cardProps?: Record<string, any>;
};

type RegistryEntry = {
  type: string;
  component?: React.ComponentType<any>;
  renderer?: WidgetRenderer;
  defaultSize?: 'small' | 'medium' | 'large';
  category?: string;
  permissions?: string[];
};

const registry = new Map<string, RegistryEntry>();

// New registration API: metadata-driven
export const registerWorkspaceWidget = (entry: RegistryEntry | string, renderer?: WidgetRenderer) => {
  if (typeof entry === 'string') {
    // backward compatible: registerWorkspaceWidget(type, renderer)
    registry.set(entry, { type: entry, renderer });
    return;
  }
  registry.set(entry.type, entry);
};

export const renderWorkspaceWidget = (widget: any) => {
  const entry = registry.get(widget.type);
  const props = widget.props ?? widget.data ?? {};

  if (entry?.renderer) {
    return entry.renderer(widget);
  }

  if (entry?.component) {
    const Cmp = entry.component;
    return { content: <Cmp {...props} />, cardProps: { title: widget.title ?? props.title } };
  }

  // fallback UI
  return {
    content: (
      <div style={{ padding: 16, color: 'var(--c-theme-muted)' }}>
        Widget of type "{widget.type}" is not registered.
      </div>
    ),
    cardProps: { title: widget.title ?? props.title ?? widget.type },
  };
};

// Default registrations for common widgets (metadata style)
registerWorkspaceWidget({ type: 'summary_card', component: SummaryCard, defaultSize: 'medium', category: 'analytics' });
registerWorkspaceWidget({ type: 'trend_card', component: TrendCard, defaultSize: 'medium', category: 'analytics' });
registerWorkspaceWidget({ type: 'alert_card', component: AlertCard, defaultSize: 'medium', category: 'notifications' });
registerWorkspaceWidget({ type: 'timeline_card', component: TimelineCard, defaultSize: 'large', category: 'activity' });

export default {
  register: registerWorkspaceWidget,
  render: renderWorkspaceWidget,
};
