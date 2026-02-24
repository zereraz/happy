import * as React from 'react';
import { SessionListViewItem, useSessionListViewData, useSetting, useForkFlag } from '@/sync/storage';
import { Session } from '@/sync/storageTypes';

export function useVisibleSessionListViewData(): SessionListViewItem[] | null {
    const data = useSessionListViewData();
    const hideInactiveSessions = useSetting('hideInactiveSessions');
    const customSidebar = useForkFlag('customSidebar');

    return React.useMemo(() => {
        if (!data) {
            return data;
        }

        // Fork: custom sidebar — flat list sorted by recency, no grouping
        if (customSidebar) {
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
            allSessions.sort((a, b) => b.updatedAt - a.updatedAt);
            return allSessions.map(session => ({ type: 'session' as const, session }));
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
    }, [data, hideInactiveSessions, customSidebar]);
}
