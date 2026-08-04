import React from 'react';

export type WorkspaceCardVariant = 'summary' | 'chart' | 'list' | 'timeline' | 'default';

export type WorkspaceCardStatus = 'healthy' | 'warning' | 'critical' | 'offline' | 'unknown';

export interface WorkspaceCardProps {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  status?: WorkspaceCardStatus;
  variant?: WorkspaceCardVariant;
  loading?: boolean;
  empty?: boolean;
  error?: Error | string | null;
  collapsible?: boolean;
  collapsed?: boolean;
  pinnable?: boolean;
  pinned?: boolean;
  favorite?: boolean;
  draggable?: boolean;
  resizable?: boolean;
  toolbar?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const WorkspaceCard: React.FC<WorkspaceCardProps> = ({
  id,
  title,
  subtitle,
  icon,
  badge,
  status = 'unknown',
  variant = 'default',
  loading = false,
  empty = false,
  error = null,
  collapsed = false,
  toolbar,
  actions,
  footer,
  children,
  className = '',
}) => {
  const statusColor = {
    healthy: 'var(--smriti-widget-status-healthy-fg, var(--c-seef-success))',
    warning: 'var(--smriti-widget-status-warning-fg, var(--c-seef-warning))',
    critical: 'var(--smriti-widget-status-danger-fg, var(--c-seef-error))',
    offline: 'var(--smriti-widget-status-offline-fg, var(--c-theme-muted))',
    unknown: 'var(--c-theme-body)',
  }[status];

  return (
    <section
      id={id}
      className={`smriti-workspace-card smriti-workspace-card--${variant} ${className}`}
      role="region"
      aria-labelledby={`${id}-title`}
      style={{
        background: 'var(--smriti-card-bg, var(--c-theme-surface-2))',
        color: 'var(--smriti-card-foreground, var(--c-theme-body))',
        padding: 'var(--smriti-widget-padding, 16px)',
        borderRadius: 'var(--smriti-radius-md, 8px)',
        boxShadow: 'var(--smriti-shadow-sm, none)',
        border: '1px solid var(--smriti-card-border, var(--c-theme-divider))'
      }}
    >
      {/* Header: icon, title, actions */}
      <header className="smriti-workspace-card__header" style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:'var(--smriti-space-sm,8px)'}}>
        <div style={{display:'flex', alignItems:'center', gap:'var(--smriti-space-sm,8px)'}}>
          {icon && <div className="smriti-workspace-card__icon" aria-hidden style={{display:'inline-flex', alignItems:'center'}}>{icon}</div>}
          <div className="smriti-workspace-card__titles">
            <div id={`${id}-title`} className="smriti-workspace-card__title" style={{fontSize:'var(--smriti-heading-lg,16px)', fontWeight:'var(--smriti-font-weight-medium)'}}>{title}</div>
            {subtitle && <div className="smriti-workspace-card__subtitle" style={{fontSize:'var(--smriti-body-sm,13px)', color:'var(--c-theme-muted)'}}>{subtitle}</div>}
          </div>
        </div>

        <div style={{display:'flex', alignItems:'center', gap:8}}>
          {badge && <div className="smriti-workspace-card__badge">{badge}</div>}
          {actions && <div className="smriti-workspace-card__actions">{actions}</div>}
        </div>
      </header>

      {/* Toolbar slot */}
      {toolbar && <div className="smriti-workspace-card__toolbar" style={{marginTop:'var(--smriti-space-sm,8px)'}}>{toolbar}</div>}

      {/* Content / lifecycle handling */}
      <div className="smriti-workspace-card__content" style={{marginTop:'var(--smriti-space-sm,8px)'}}>
        {loading ? (
          <div className="smriti-workspace-card__loading" aria-busy style={{textAlign:'center', color:'var(--c-theme-muted)'}}>
            Loading…
          </div>
        ) : error ? (
          <div className="smriti-workspace-card__error" role="alert" style={{color:'var(--c-theme-error, var(--c-seef-error))'}}>
            {typeof error === 'string' ? error : error?.message ?? 'An error occurred'}
          </div>
        ) : empty ? (
          <div className="smriti-workspace-card__empty" style={{textAlign:'center', color:'var(--c-theme-muted)'}}>
            No data
          </div>
        ) : (
          <div className="smriti-workspace-card__body">{children}</div>
        )}
      </div>

      {/* Footer slot */}
      {footer && <footer className="smriti-workspace-card__footer" style={{marginTop:'var(--smriti-space-sm,8px)'}}>{footer}</footer>}
    </section>
  );
};

export default WorkspaceCard;
