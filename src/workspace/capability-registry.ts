/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Module       : Universal Capability Ownership Registry (ADR-UX-004 Compliant)
 * Standard     : SCA-001 & SCA-002 Governance
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 5.3.0
 */

export interface CapabilityEntry {
  id: string;
  name: string;
  ownerComponent: string;
  sourceLocation: string;
  adrReference: string;
  isAuthoritative: boolean;
}

export const CAPABILITY_OWNERSHIP_MANIFEST: CapabilityEntry[] = [
  {
    id: "header",
    name: "Adaptive Header Surface",
    ownerComponent: "AdaptiveWorkspaceHeader",
    sourceLocation: "src/components/common/AdaptiveWorkspaceHeader.tsx",
    adrReference: "ADR-UX-003",
    isAuthoritative: true
  },
  {
    id: "navigation",
    name: "Contextual Navigation Authority",
    ownerComponent: "NavigationRegistry",
    sourceLocation: "src/workspace/registries/NavigationRegistry.ts",
    adrReference: "ADR-UX-002",
    isAuthoritative: true
  },
  {
    id: "command-palette",
    name: "Universal Search",
    ownerComponent: "UniversalCommandPalette",
    sourceLocation: "src/workspace/components/UniversalCommandPalette.tsx",
    adrReference: "ADR-UX-004",
    isAuthoritative: true
  },
  {
    id: "notifications",
    name: "Platform Event Notification Engine",
    ownerComponent: "NotificationService",
    sourceLocation: "src/workspace/services/NotificationService.ts",
    adrReference: "ADR-UX-004",
    isAuthoritative: true
  },
  {
    id: "overlays",
    name: "Central Modal & Overlay Manager Host",
    ownerComponent: "OverlayManager",
    sourceLocation: "src/workspace/components/OverlayManager.tsx",
    adrReference: "ADR-UX-003",
    isAuthoritative: true
  },
  {
    id: "taskbar",
    name: "Workspace Dock & Taskbar Registry",
    ownerComponent: "TaskbarRegistry",
    sourceLocation: "src/workspace/registries/TaskbarRegistry.ts",
    adrReference: "ADR-UX-003",
    isAuthoritative: true
  },
  {
    id: "theme",
    name: "Hierarchical Theme Token Resolver",
    ownerComponent: "ThemeManager",
    sourceLocation: "src/workspace/services/ThemeManager.ts",
    adrReference: "ADR-UX-001",
    isAuthoritative: true
  }
];
