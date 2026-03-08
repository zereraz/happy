# Fork Changes (sahebjot/dev)

Changes on top of upstream `main`. Designed to minimize merge conflicts.

**IMPORTANT**: Update this doc whenever fork-specific code is added or changed.

## Fork Settings System

**Single schema field**: `forkFlags: z.record(z.string(), z.boolean())` in `SettingsSchema` — one line in schema, one in defaults. New flags added in UI only.

### Files
- `sync/settings.ts` — `forkFlags` field (+2 lines)
- `sync/storage.ts` — `useForkFlag(key)` hook, `useGroups()` hook
- `sync/ops.ts` — `groupCreate`, `groupUpdate`, `groupDelete` operations
- `app/(app)/settings/fork.tsx` — Fork settings page with toggle switches + group CRUD
- `components/SettingsView.tsx` — Nav item (git-branch icon)
- `app/(app)/_layout.tsx` — Route registration
- `text/_default.ts`, `text/translations/*.ts` — Translation keys

## Custom Sidebar (fork flag: `customSidebar`)

Replaces path-grouped sidebar with flat recency-sorted list, with optional group headers.

### Sort order
1. **Streaming** (`thinking=true`) → top
2. **Active** above inactive/archived
3. **Online** (`presence === 'online'`) above offline
4. **By `lastMessageAt`** (last user message timestamp) → most recent first
5. **Fallback** `activeAt` (last CLI heartbeat — frozen for stopped sessions, best proxy for "last used")

### Groups
- User-defined groups stored server-side (`Group` type in `storageTypes.ts`)
- Sessions have optional `groupId` field
- Grouped sessions render under group headers, sorted within each group
- Ungrouped sessions appear after all groups
- Group CRUD in fork settings page (create, rename via tap, delete via long-press)

### `lastMessageAt` — client-side computed, MMKV-persisted
- Set in `applyMessages()` when user-role messages arrive via sync
- Reverse-scans batch for last `role === 'user'` message
- Only updates if newer than existing value
- **Persisted to MMKV** (`last-message-at` key) so it survives app restarts
- Restored during initial `applySessions` load (same pattern as drafts/permissionModes)
- Falls back to `activeAt` for sessions that have never been opened

### Files
- `hooks/useVisibleSessionListViewData.ts` — Sort logic + group partitioning
- `sync/storage.ts` — `lastMessageAt` tracking in `applyMessages`, restore in `applySessions`, `useGroups()`
- `sync/persistence.ts` — `loadLastMessageAtMap()`, `saveLastMessageAt()` (MMKV)
- `sync/storageTypes.ts` — `lastMessageAt?: number` on Session, `Group` interface, `groupId` on Session
- `components/SessionsList.tsx` — Standalone card rendering per session, group headers, search bar

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

## Design Decisions

| Decision | Why |
|----------|-----|
| Single `forkFlags` record vs individual fields | One schema line = minimal merge conflicts with upstream |
| `lastMessageAt` client-side vs server-side | No server schema change needed; works for active sessions immediately |
| `createdAt` as fallback (not `activeAt`) | `activeAt` is a live heartbeat that causes sidebar flicker |
| Override sort in `useVisibleSessionListViewData` not `buildSessionListViewData` | Upstream function called from multiple places; our hook is the clean interception point |
| `sidebarCollapsed` in localSettings (not synced) | Screen size varies per device; collapse state shouldn't sync |

## Commit History

| Commit | Description |
|--------|-------------|
| `dc7910f5` | Fork flags system with custom sidebar |
| `bfb9e56e` | Collapsible sidebar, improved session sort, fork settings fixes |
| `c351cdcd` | Fork changes doc |
