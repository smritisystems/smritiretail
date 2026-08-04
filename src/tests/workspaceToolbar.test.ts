/** @vitest-environment jsdom */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("../contexts/WorkspaceContext.tsx", () => ({
  useWorkspace: () => ({
    focusMode: false,
    globalZoom: 1,
    floatingWindows: [],
    toggleFocusMode: vi.fn(),
    adjustGlobalZoom: vi.fn(),
    resetGlobalZoom: vi.fn(),
    popOutTab: vi.fn(),
    closeWindow: vi.fn(),
    updateWindowZoom: vi.fn(),
    resetWindowZoom: vi.fn(),
    tileWorkspaces: vi.fn(),
    arrangeSideBySide: vi.fn(),
    snapWindow: vi.fn(),
  }),
}));

vi.mock("../layout_engine/layout_store.tsx", () => ({
  useLayoutEngine: () => ({
    registeredWorkspaces: [],
    preferences: {
      position: "left",
      hideNavbar: false,
      hideSidebar: false,
      hideBottombar: false,
    },
    setLayout: vi.fn(),
    toggleNavbar: vi.fn(),
    toggleSidebarVisibility: vi.fn(),
    toggleBottombar: vi.fn(),
  }),
}));

vi.mock("../contexts/ShortcutContext.tsx", () => ({
  useShortcuts: () => ({
    setPaletteOpen: vi.fn(),
  }),
}));

vi.mock("../layout_engine/SEEFAdminConfigurator.tsx", () => ({
  SEEFAdminConfigurator: () => null,
}));

import { WorkspaceToolbar } from "../components/WorkspaceToolbar.tsx";

describe("WorkspaceToolbar", () => {
  it("does not render the global workspace header", () => {
    const html = renderToStaticMarkup(React.createElement(WorkspaceToolbar, { currentTabId: "sales" }));
    expect(html).not.toContain("Adaptive Workspace Header");
  });
});
