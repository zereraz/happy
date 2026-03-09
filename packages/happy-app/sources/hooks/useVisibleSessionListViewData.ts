import * as React from 'react';
import { SessionListViewItem, useSessionListViewData, useSetting, useForkFlag, useGroups } from '@/sync/storage';
import { Session } from '@/sync/storageTypes';

function sortSessions(sessions: Session[]): Session[] {
    return sessions.sort((a, b) => {
        // 1. Online above offline (matches what user sees: green dot vs "last seen")
        const aOnline = a.presence === 'online';
        const bOnline = b.presence === 'online';
        if (aOnline !== bOnline) return aOnline ? -1 : 1;
        // 2. By recency (don't use activeAt — it updates with heartbeats and causes jumping)
        const aTime = a.lastMessageAt ?? a.updatedAt;
        const bTime = b.lastMessageAt ?? b.updatedAt;
        return bTime - aTime;
    });
}

export function useVisibleSessionListViewData(): SessionListViewItem[] | null {
    const data = useSessionListViewData();
    const hideInactiveSessions = useSetting('hideInactiveSessions');
    const customSidebar = useForkFlag('customSidebar');
    const groups = useGroups();

    return React.useMemo(() => {
        if (!data) {
            return data;
        }

        // Fork: custom sidebar — groups first, then ungrouped sessions
        if (customSidebar) {
            // Collect all sessions from the list view data
            const allSessions: Session[] = [];
            for (const item of data) {
                if (item.type === 'active-sessions') {
                    allSessions.push(...item.sessions);
                } else if (item.type === 'session') {
                    if (!hideInactiveSessions || item.session.active) {
                        allSessions.push(item.session);
                    }
                }
            }

            // Dedupe by id (active-sessions may overlap with session items)
            const seen = new Set<string>();
            const uniqueSessions: Session[] = [];
            for (const s of allSessions) {
                if (!seen.has(s.id)) {
                    seen.add(s.id);
                    uniqueSessions.push(s);
                }
            }

            // Partition sessions by group
            const grouped = new Map<string, Session[]>();
            const ungrouped: Session[] = [];

            for (const session of uniqueSessions) {
                if (session.groupId && groups.some(g => g.id === session.groupId)) {
                    const list = grouped.get(session.groupId) || [];
                    list.push(session);
                    grouped.set(session.groupId, list);
                } else {
                    ungrouped.push(session);
                }
            }

            const result: SessionListViewItem[] = [];

            // Groups first, sorted by sortOrder
            for (const group of groups) {
                const sessions = grouped.get(group.id);
                if (!sessions || sessions.length === 0) continue;
                result.push({ type: 'group-header', group });
                for (const session of sortSessions(sessions)) {
                    result.push({ type: 'session', session, variant: 'no-path' });
                }
            }

            // Ungrouped sessions after
            for (const session of sortSessions(ungrouped)) {
                result.push({ type: 'session', session });
            }

            return result;
        }

        if (!hideInactiveSessions) {
            return data;
        }

        const filtered: SessionListViewItem[] = [];
        let pendingProjectGroup: SessionListViewItem | null = null;

        for (const item of data) {
            if (item.type === 'project-group') {
                pendingProjectGroup = item;
                continue;
            }

            if (item.type === 'session') {
                if (item.session.active) {
                    if (pendingProjectGroup) {
                        filtered.push(pendingProjectGroup);
                        pendingProjectGroup = null;
                    }
                    filtered.push(item);
                }
                continue;
            }

            pendingProjectGroup = null;

            if (item.type === 'active-sessions') {
                filtered.push(item);
            }
        }

        return filtered;
    }, [data, hideInactiveSessions, customSidebar, groups]);
}
