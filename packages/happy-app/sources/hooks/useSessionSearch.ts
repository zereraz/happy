/**
 * Fuzzy search hook for filtering sessions in the sidebar.
 * Uses Fuse.js to match against session name, path, host, and summary.
 * Returns the original data unchanged when query is empty (preserving groups/headers).
 * When searching, flattens to a simple list of matching sessions.
 */
import * as React from 'react';
import Fuse from 'fuse.js';
import { SessionListViewItem } from '@/sync/storage';
import { Session } from '@/sync/storageTypes';

function extractSessions(data: SessionListViewItem[]): Session[] {
    const seen = new Set<string>();
    const sessions: Session[] = [];
    for (const item of data) {
        if (item.type === 'session' && !seen.has(item.session.id)) {
            seen.add(item.session.id);
            sessions.push(item.session);
        } else if (item.type === 'active-sessions') {
            for (const s of item.sessions) {
                if (!seen.has(s.id)) {
                    seen.add(s.id);
                    sessions.push(s);
                }
            }
        }
    }
    return sessions;
}

export function useSessionSearch(
    query: string,
    data: SessionListViewItem[] | null,
): SessionListViewItem[] | null {
    const sessions = React.useMemo(() => {
        if (!data) return [];
        return extractSessions(data);
    }, [data]);

    const fuse = React.useMemo(() => {
        return new Fuse(sessions, {
            keys: [
                { name: 'metadata.summary.text', weight: 2 },
                { name: 'metadata.path', weight: 1 },
                { name: 'metadata.host', weight: 0.5 },
                { name: 'metadata.name', weight: 1.5 },
            ],
            threshold: 0.4,
            includeScore: true,
        });
    }, [sessions]);

    return React.useMemo(() => {
        if (!data) return data;
        if (!query.trim()) return data;

        const results = fuse.search(query.trim());
        return results.map(r => ({
            type: 'session' as const,
            session: r.item,
        }));
    }, [data, query, fuse]);
}
