# SMRITI Architecture Audit Report

## Scope
Audit of the current architecture for theme, workspace, navigation, and design-system evolution under the new architecture rule:

Priority order:
1. Audit
2. Reuse
3. Extend
4. Create

## Existing vs Missing Matrix

| Concern | Existing | Status | Recommendation |
| --- | --- | --- | --- |
| Theme engine | src/contexts/ThemeContext.tsx | Existing | Reuse and extend via existing ThemeContext and theme CSS variables |
| Workspace engine | src/layout_engine/WorkspaceEngine.ts | Existing | Reuse as the canonical workspace card and state contract |
| Workspace navigation engine | src/layout_engine/WorkspaceNavigationEngine.ts | Existing | Reuse for back/forward/home/history behavior |
| Workspace shell/layout | src/layout_engine/components/WorkspaceShell.tsx | Existing | Extend rather than replacing |
| Workspace card primitive | src/components/workspace/WorkspaceCard.tsx | Existing | Extend with semantic design integration |
| Workspace action bar | src/components/workspace/WorkspaceActionBar.tsx | Existing | Extend rather than introducing a new abstraction |
| Design token layer | src/styles/smriti-semantic-tokens.css | Existing | Reuse and extend |
| Component token layer | src/styles/smriti-component-tokens.css | Existing | Reuse and extend |
| Theme CSS files | src/styles/smriti-theme-*.css | Existing | Reuse as the runtime theme source |
| Platform kernel | src/kernel/SPK.ts | Existing | Reuse as the single platform runtime backbone |
| Navigation registry | src/kernel/upr/navigation/NavigationRegistry.js | Existing | Reuse |
| Workspace registry | src/layout_engine/WorkspaceRegistry.ts | Existing | Reuse |
| Design SDK scaffolding | src/design/* | Missing/experimental | Do not create a parallel runtime; extend the existing theme/workspace/token stack instead |

## Audit Conclusion
The repository already contains the core architecture required for a robust design-system migration:
- Theme Engine via ThemeContext
- Workspace Engine via WorkspaceEngine
- Workspace Navigation Engine via WorkspaceNavigationEngine
- SPK via src/kernel/SPK.ts
- Existing styles and token layers under src/styles/

## Recommended Approach
Do not introduce a parallel design SDK runtime.

Instead:
1. Reuse ThemeContext as the source of theme mode changes.
2. Reuse WorkspaceEngine and WorkspaceNavigationEngine for workspace/card/navigation behavior.
3. Extend the existing token files and component wrappers rather than creating duplicate architecture.
4. Add semantic design helpers only if they fit the existing token and theme model.

## Architecture Rule
Business UI components must not directly depend on raw Tailwind visual utilities or duplicate theme logic.
They should consume the existing SMRITI workspace/theme/navigation stack and the existing semantic token layer.

## Implementation Guidance
- Extend existing components where they already exist.
- Avoid creating parallel engines, SDKs, or runtime abstractions.
- Preserve SPK, Theme Engine, Workspace Engine, and Navigation Engine as the canonical architecture.
