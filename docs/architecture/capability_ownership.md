# Platform Capability Ownership Manifest

**Governance Baseline:** ADR-UX-001, ADR-UX-002, ADR-UX-003, ADR-UX-004  
**Status:** FROZEN & CONSTITUTIONALLY APPROVED (v1.0)  

| Capability Domain | Single Authoritative Owner | Source Location | ADR Reference | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Workspace Shell Host** | `SMRITIWorkspaceShell` | `src/workspace/components/SMRITIWorkspaceShell.tsx` | ADR-UX-003 | 🟢 Active |
| **Adaptive Header** | `AdaptiveWorkspaceHeader` | `src/components/common/AdaptiveWorkspaceHeader.tsx` | ADR-UX-003 | 🟢 Active |
| **Contextual Navigation** | `NavigationRegistry` & `ContextualSidebar` | `src/workspace/registries/NavigationRegistry.ts` | ADR-UX-002 | 🟢 Active |
| **Command Palette (`Ctrl+K`)** | `UniversalCommandPalette` | `src/workspace/components/UniversalCommandPalette.tsx` | ADR-UX-004 | 🟢 Active |
| **Notification Engine** | `NotificationService` & `NotificationCenter` | `src/workspace/services/NotificationService.ts` | ADR-UX-004 | 🟢 Active |
| **Central Overlay Host** | `OverlayManager` & `OverlayService` | `src/workspace/components/OverlayManager.tsx` | ADR-UX-003 | 🟢 Active |
| **Taskbar Dock** | `TaskbarRegistry` & `WorkspaceTaskbar` | `src/workspace/registries/TaskbarRegistry.ts` | ADR-UX-003 | 🟢 Active |
| **Hierarchical Theme Engine**| `ThemeManager` | `src/workspace/services/ThemeManager.ts` | ADR-UX-001 | 🟢 Active |

---

## Decommission & Retirement Registry (SMRITI v5.3.0)

| Legacy Component | Source Path | Canonical SWS Replacement | Retirement Stage |
| :--- | :--- | :--- | :--- |
| **Launchpad Header** | `src/launchpad/components/Header.tsx` | `AdaptiveWorkspaceHeader` | 🟡 Retired (Unmounted from LaunchpadShell) |
| **Launchpad SearchModal** | `src/launchpad/components/SearchModal.tsx` | `UniversalCommandPalette` | 🟡 Retired (Unmounted from LaunchpadShell) |
| **Launchpad StatusBar** | `src/launchpad/components/StatusBar.tsx` | `WorkspaceTaskbar` | 🟡 Retired (Unmounted from LaunchpadShell) |
| **SEEFCommandPalette** | `src/layout_engine/SEEFCommandPalette.tsx` | `UniversalCommandPalette` | 🟡 Retired (Unwired from App.tsx) |
| **CommandPaletteModal** | `src/components/common/CommandPaletteModal.tsx` | `UniversalCommandPalette` | 🟡 Retired (Deprecated Wrapper) |
| **SAWF CommandPalette** | `src/framework/sawf/keyboard/CommandPalette.tsx` | `UniversalCommandPalette` | 🟡 Retired (Unwired from DocumentStudio) |
| **Legacy NotificationCenter**| `src/notifications/NotificationCenter.tsx` | `NotificationCenter` (SWS) | 🟡 Retired (Replaced by SWS NotificationCenter) |

---

## Constitutional Governance Rules

- **SCA-001 (Single Capability Authority):** Every platform capability must have exactly one registered owner.
- **SCA-002 (Business Module Isolation):** Business modules may only consume Workspace Shell contracts.
- **SCA-003 (Capability Registration Rule):** New platform capabilities must be registered in `capability-registry.ts` and `capability_ownership.md` with an approved ADR.
- **SCA-004 (No Parallel Runtime Rule):** No platform capability may have more than one active runtime instance, regardless of hidden/off-screen state.
