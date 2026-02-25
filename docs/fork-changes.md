# Fork Changes (sahebjot/dev)

Changes on top of upstream `main`. Designed to minimize merge conflicts.

## Fork Settings System

**Single schema field**: `forkFlags: z.record(z.string(), z.boolean())` in `SettingsSchema` — one line in schema, one in defaults. New flags added in UI only.

### Files
- `sync/settings.ts` — `forkFlags` field (+2 lines)
- `sync/storage.ts` — `useForkFlag(key)` hook
- `app/(app)/settings/fork.tsx` — Fork settings page with toggle switches
- `components/SettingsView.tsx` — Nav item (git-branch icon)
- `app/(app)/_layout.tsx` — Route registration
- `text/_default.ts`, `text/translations/*.ts` — Translation keys

## Custom Sidebar (fork flag: `customSidebar`)

Replaces path-grouped sidebar with flat recency-sorted list.

### Sort order
1. **Streaming** (`thinking=true`) → top
2. **By `lastMessageAt`** (last user message timestamp) → most recent first
3. **Fallback** `createdAt` (stable, no flicker)

### `lastMessageAt` — client-side computed
- Set in `applyMessages()` when user-role messages arrive via sync
- Reverse-scans batch for last `role === 'user'` message
- Only updates if newer than existing value
- Falls back to `createdAt` for sessions without loaded messages

### Files
- `hooks/useVisibleSessionListViewData.ts` — Sort logic
- `sync/storage.ts` — `lastMessageAt` tracking in `applyMessages`
- `sync/storageTypes.ts` — `lastMessageAt?: number` on Session
- `components/SessionsList.tsx` — Standalone card rendering per session

### Why not `updatedAt` or `activeAt`?
- `updatedAt` — Prisma `@updatedAt`, bumped by ANY row change (metadata sync, summary regen)
- `activeAt` — CLI heartbeat, updates every few seconds while session runs, causes flicker
- `lastMessageAt` — only changes when user sends a message. Stable.

## Collapsible Sidebar (web/desktop only)

Collapse/expand the sidebar drawer on web/desktop.

### Behavior
- Collapse: chevron button in sidebar header
- Expand: floating menu icon (top-left corner)
- State stored in `localSettings.sidebarCollapsed` (device-local, not synced)
- Only available when `Platform.OS === 'web'` and on tablet/desktop

### Files
- `sync/localSettings.ts` — `sidebarCollapsed` field
- `components/SidebarNavigator.tsx` — Drawer hide/show + expand button
- `components/SidebarView.tsx` — `onCollapse` prop + collapse chevron

## Commit History

| Commit | Description |
|--------|-------------|
| `dc7910f5` | Fork flags system with custom sidebar |
| `bfb9e56e` | Collapsible sidebar, improved session sort, fork settings fixes |
