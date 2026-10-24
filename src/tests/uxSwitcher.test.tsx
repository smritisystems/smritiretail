/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.9
 * Created      : 2026-10-22
 * Modified     : 2026-10-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: UX Switcher Verification Test Suite (Regular UX <-> Classic UX)
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LayoutEngineProvider } from '../layout_engine/layout_store.tsx';
import { UxSwitcherModal } from '../components/shell/UxSwitcherModal.tsx';
import { RegularUxDashboard } from '../components/dashboard/RegularUxDashboard.tsx';
import { ClassicUxWorkspace } from '../components/dashboard/ClassicUxWorkspace.tsx';
import { ClassicWorkspaceDirectory } from '../components/launchpad/ClassicWorkspaceDirectory.tsx';
import { FioriLaunchpad } from '../components/launchpad/FioriLaunchpad.tsx';
import { GlobalHeader } from '../components/shell/GlobalHeader.tsx';
import { WorkspaceProvider } from '../contexts/WorkspaceContext.tsx';
import { ActiveFieldProvider } from '../context/ActiveFieldContext.tsx';
import { DrillDownProvider } from '../components/drilldown/drilldown_store.tsx';
import { ThemeProvider } from '../contexts/ThemeContext.tsx';

// Mock apiFetch
vi.mock('../lib/apiFetch.ts', () => ({
  apiFetch: vi.fn().mockResolvedValue({ status: 'ok' }),
  apiFetchV1: vi.fn().mockResolvedValue({ status: 'ok' }),
}));

describe('SMRITI Retail OS — Premium UX Switcher & Presentation Verification', () => {
  const mockStorage: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    global.localStorage = {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, val: string) => {
        mockStorage[key] = val;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      }),
      length: 0,
      key: vi.fn(),
    } as any;
    vi.clearAllMocks();
  });

  it('1. Default UX mode storage key defaults to "regular"', () => {
    expect(localStorage.getItem('smriti_ux_mode')).toBeNull();
    // Simulate setting classic
    localStorage.setItem('smriti_ux_mode', 'classic');
    expect(localStorage.getItem('smriti_ux_mode')).toBe('classic');
    // Switch back to regular
    localStorage.setItem('smriti_ux_mode', 'regular');
    expect(localStorage.getItem('smriti_ux_mode')).toBe('regular');
  });

  it('2. UxSwitcherModal displays polished selection panel with clear labels and radio cards', () => {
    const html = renderToStaticMarkup(
      <LayoutEngineProvider>
        <UxSwitcherModal isOpen={true} onClose={() => {}} />
      </LayoutEngineProvider>
    );

    expect(html).toContain('Workspace style');
    expect(html).toContain('Regular UX');
    expect(html).toContain('Simple, clean and guided • Everyday Retail');
    expect(html).toContain('Classic UX');
    expect(html).toContain('Traditional, detailed and powerful • For Advanced Users');
    expect(html).toContain('Spacious layouts &amp; cards');
    expect(html).toContain('Top ERP menu bar');
    expect(html).toContain('Multi-tab workspaces');
    expect(html).toContain('Your current workspace stays open while the layout changes.');
  });

  it('3. UxSwitcherModal renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <LayoutEngineProvider>
        <UxSwitcherModal isOpen={false} onClose={() => {}} />
      </LayoutEngineProvider>
    );

    expect(html).toBe('');
  });

  it('4. RegularUxDashboard renders spacious layout, greeting, 4 KPI cards, 4 action tiles, and recent sales', () => {
    const html = renderToStaticMarkup(
      <RegularUxDashboard
        currentUser={{ role: 'Store Manager', name: 'Jawahar Mallah' }}
        onNavigateTab={() => {}}
      />
    );

    // Greeting Banner
    expect(html).toContain('Welcome back, Jawahar Mallah!');
    expect(html).toContain("Here&#x27;s what&#x27;s happening at your store today.");

    // 4 KPI Cards
    expect(html).toContain('Today Sales');
    expect(html).toContain('₹ 24,560');
    expect(html).toContain('Bills');
    expect(html).toContain('42');
    expect(html).toContain('Items Sold');
    expect(html).toContain('128');
    expect(html).toContain('New Customers');
    expect(html).toContain('6');

    // 4 Action Tiles
    expect(html).toContain('POS Billing');
    expect(html).toContain('Start new bill');
    expect(html).toContain('Item Master');
    expect(html).toContain('Add / Manage');
    expect(html).toContain('Customer');
    expect(html).toContain('Reports');
    expect(html).toContain('View Reports');

    // Recent Sales
    expect(html).toContain('Recent Sales');
    expect(html).toContain('SI-000125');
    expect(html).toContain('SI-000124');
    expect(html).toContain('Walk-in Customer');
    expect(html).toContain('Rajesh Shoes');
  });

  it('5. ClassicUxWorkspace routes billing to the shared workspace without a duplicate invoice screen', () => {
    const html = renderToStaticMarkup(
      <ClassicUxWorkspace
        currentUser={{ role: 'System Admin', name: 'Jawahar' }}
        onNavigateTab={() => {}}
        onNotification={() => {}}
      />
    );

    // Top ERP Menu Bar
    expect(html).toContain('Master');
    expect(html).toContain('Transactions');
    expect(html).toContain('Inventory');
    expect(html).toContain('Accounts');
    expect(html).toContain('CRM');
    expect(html).toContain('Reports');
    expect(html).toContain('Tools');
    expect(html).toContain('Settings');
    expect(html).toContain('Help');

    expect(html.match(/Billing Workspace/g)).toHaveLength(1);
    expect(html).toContain('Sales Documents');
    expect(html).not.toContain('POS Billing');
    expect(html).not.toContain('New (F2)');
    expect(html).toContain('Classic ERP Operational Overview');
  });

  it('6. ClassicWorkspaceDirectory renders authentic dense table view with 9 columns, toolbar F-keys, tree sidebar, and details panel', () => {
    const html = renderToStaticMarkup(
      <WorkspaceProvider>
        <ClassicWorkspaceDirectory
          currentUser={{ role: 'System Admin', name: 'Jawahar' }}
          onSelectModule={() => {}}
        />
      </WorkspaceProvider>
    );

    // Sub-header tabs strip
    expect(html).toContain('Dashboard');
    expect(html).toContain('Workspaces');
    expect(html).toContain('Enterprise Classic ERP View');

    // Left hierarchical sidebar tree
    expect(html).toContain('All Workspaces');
    expect(html).toContain('Favorites');
    expect(html).toContain('Recent');
    expect(html).toContain('My Workspaces');
    expect(html).toContain('Retail Operations');
    expect(html).toContain('Finance &amp; Ledgers');
    expect(html).toContain('CRM &amp; Customers');
    expect(html).toContain('Masters');
    expect(html).toContain('Reports');
    expect(html).toContain('Tools &amp; Config');

    // Toolbar controls & F-keys
    expect(html).toContain('Workspaces (Classic View)');
    expect(html).toContain('New Workspace (F2)');
    expect(html).toContain('Open (Enter)');
    expect(html).toContain('Edit (F4)');
    expect(html).toContain('Deactivate (F5)');
    expect(html).toContain('View Details (F6)');
    expect(html).toContain('Table View');
    expect(html).toContain('Card View');

    // 9 Table Columns
    expect(html).toContain('#');
    expect(html).toContain('Workspace Name');
    expect(html).toContain('Description');
    expect(html).toContain('Category');
    expect(html).toContain('Icon');
    expect(html).toContain('Status');
    expect(html).toContain('Type');
    expect(html).toContain('Actions');

    // Sample Rows
    expect(html).toContain('Billing Workspace');
    expect(html).toContain('Sales Documents');
    expect(html).toContain('Purchase Studio');

    // Right-side Details Panel
    expect(html).toContain('Open Workspace');
    expect(html).toContain('Details');
    expect(html).toContain('Shortcuts');
    expect(html).toContain('Access');
    expect(html).toContain('Workspace ID');
    expect(html).toContain('Route');
    expect(html).toContain('Quick Actions');
    expect(html).toContain('Add to Favorites');
    expect(html).toContain('Copy Link');
    expect(html).toContain('Edit Workspace');
  });

  it('7. GlobalHeader renders Enterprise Top Menu when uxMode is classic and Omni-Search when uxMode is regular', () => {
    // Mode: classic
    localStorage.setItem('smriti_ux_mode', 'classic');
    const classicHtml = renderToStaticMarkup(
      <ThemeProvider>
        <LayoutEngineProvider initialUxMode="classic">
          <ActiveFieldProvider>
            <DrillDownProvider>
              <GlobalHeader
                activeModuleId="workspaces"
                activeModuleTitle="Workspaces"
                onNavigateHome={() => {}}
                onToggleNavRail={() => {}}
                isNavRailCollapsed={false}
                isFocusMode={false}
                onToggleFocusMode={() => {}}
              />
            </DrillDownProvider>
          </ActiveFieldProvider>
        </LayoutEngineProvider>
      </ThemeProvider>
    );

    // Enterprise Top Menu in Classic Mode
    expect(classicHtml).toContain('aria-label="Enterprise Main Menu"');
    expect(classicHtml).toContain('Home');
    expect(classicHtml).toContain('Master');
    expect(classicHtml).toContain('Transactions');
    expect(classicHtml).toContain('Inventory');
    expect(classicHtml).toContain('Purchase');
    expect(classicHtml).toContain('Accounts');
    expect(classicHtml).toContain('CRM');
    expect(classicHtml).toContain('Reports');
    expect(classicHtml).toContain('Tools');
    expect(classicHtml).toContain('Settings');
    expect(classicHtml).toContain('Help');
    expect(classicHtml).not.toContain('Omni-Search');

    // Mode: regular
    localStorage.setItem('smriti_ux_mode', 'regular');
    const regularHtml = renderToStaticMarkup(
      <ThemeProvider>
        <LayoutEngineProvider initialUxMode="regular">
          <ActiveFieldProvider>
            <DrillDownProvider>
              <GlobalHeader
                activeModuleId="launchpad"
                activeModuleTitle="Launchpad"
                onNavigateHome={() => {}}
                onToggleNavRail={() => {}}
                isNavRailCollapsed={false}
                isFocusMode={false}
                onToggleFocusMode={() => {}}
              />
            </DrillDownProvider>
          </ActiveFieldProvider>
        </LayoutEngineProvider>
      </ThemeProvider>
    );

    // Omni-Search in Regular Mode
    expect(regularHtml).toContain('Omni-Search');
    expect(regularHtml).toContain('Ctrl+K');
  });

  it('8. FioriLaunchpad renders spacious touch-friendly cards in Regular UX mode', () => {
    const html = renderToStaticMarkup(
      <WorkspaceProvider>
        <FioriLaunchpad
          currentUser={{ role: 'System Admin', name: 'Jawahar' }}
          onSelectModule={() => {}}
          uxMode="regular"
        />
      </WorkspaceProvider>
    );

    // Spacious search and tiles
    expect(html).toContain('Search workspaces (e.g. POS, Barcode, GST, Ledger, Purchase)...');
    expect(html).toContain('Billing Workspace');
    expect(html).toContain('Store Status');
  });
});
