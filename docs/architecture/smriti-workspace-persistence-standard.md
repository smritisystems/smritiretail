# SMRITI Workspace Persistence Standard

## Purpose

This standard defines the platform requirement for preserving user context and unsaved business data across refresh, navigation changes, tab reopen, and temporary connectivity loss.

## Mandatory Rules

- All workspace persistence must be implemented through the shared Workspace Persistence Framework.
- Modules must not access browser storage directly for workspace state.
- Persistence must be classified as session state, draft state, or preference state.
- Recovery must preserve workflow-aware document state, not only raw form values.
- Workspace state must be versioned and migrated on upgrade.
- Multi-window coordination must prevent conflicting writes.
- Health monitoring must track restore success, storage health, and sync health.
- Sensitive data must not be stored in clear text in browser storage.

## Lifecycle

1. Open Module
2. Restore State
3. User Works
4. Auto Save
5. Refresh / Route Change / Tab Close
6. Restore State
7. Save / Clear Draft

## Governance

No module may implement its own workspace persistence logic unless it is built on top of the shared framework.
