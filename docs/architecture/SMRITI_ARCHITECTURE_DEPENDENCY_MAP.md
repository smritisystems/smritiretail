# SMRITI Architecture Dependency Map

Version: v1.0
Status: ARCHITECTURE FROZEN
Owner: SMRITI Architecture Council
Runtime: SPK
Review: Only through ADR

## Runtime Dependencies

SPK
  → WorkspaceShell
  → WidgetEngine
  → WorkspaceNavigationEngine
  → AdaptiveWorkspaceStore
  → WorkspacePersonalizationEngine
  → DashboardRegistry

## UX Dependencies

Design Studio
  → UX Governance
  → SDEF
  → SDS
  → Responsive Rulebook
  → Design Language

## Implementation Dependencies

Business Modules
  → SPK Runtime
  → WorkspaceShell
  → WorkspaceNavigationEngine
  → WidgetEngine
  → DashboardRegistry
  → AdaptiveWorkspaceStore
  → WorkspacePersonalizationEngine
  → NavigationRegistry

## Design Dependencies

Design Studio
  → UX Governance
  → Accessibility
  → Theme Review
  → Responsive Review
  → AI Design Critic

## Related Documents

→ `SMRITI_EXPERIENCE_PLATFORM_ARCHITECTURE_v1.0.md`

→ `SPK_Experience_Runtime_Mapping.md`

→ `SMRITI_ARCHITECTURE_DEPENDENCY_MAP.md`

→ `SMRITI_DESIGN_STUDIO_SPECIFICATION.md`

→ `SMRITI_UX_GOVERNANCE.md`
