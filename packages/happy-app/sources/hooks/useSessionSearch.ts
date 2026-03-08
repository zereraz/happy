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

const FUSE_OPTIONS = {
    keys: [
        { name: 'metadata.summary.text', weight: 2 },
        { name: 'metadata.path', weight: 1 },
        { name: 'metadata.host', weight: 0.5 },
        { name: 'metadata.name', weight: 1.5 },
    ],
    threshold: 0.4,
    includeScore: true,
};

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

/**
 * Stable fingerprint of searchable session fields only.
 * Prevents Fuse.js index rebuilds during streaming token updates
 * where non-search fields (like thinking, presence) change frequently.
 */
function sessionFingerprint(sessions: Session[]): string {
    let fp = '';
    for (const s of sessions) {
        fp += s.id + '\0';
        fp += (s.metadata?.name ?? '') + '\0';
        fp += (s.metadata?.path ?? '') + '\0';
        fp += (s.metadata?.host ?? '') + '\0';
        fp += (s.metadata?.summary?.text ?? '') + '\0';
        fp += '|';
    }
    return fp;
}

export function useSessionSearch(
    query: string,
    data: SessionListViewItem[] | null,
): SessionListViewItem[] | null {
    const sessions = React.useMemo(() => {
        if (!data) return [];
        return extractSessions(data);
    }, [data]);

    const fingerprint = React.useMemo(() => sessionFingerprint(sessions), [sessions]);

    const fuse = React.useMemo(() => {
        return new Fuse(sessions, FUSE_OPTIONS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fingerprint]);

    // Build a lookup from latest sessions so search results use fresh data
    // (Fuse holds refs to sessions from construction time — may have stale
    // non-search fields like thinking/presence/active)
    const sessionMap = React.useMemo(() => {
        const map = new Map<string, Session>();
        for (const s of sessions) map.set(s.id, s);
        return map;
    }, [sessions]);

    return React.useMemo(() => {
        if (!data) return data;
        if (!query.trim()) return data;

        const results = fuse.search(query.trim());
        return results.flatMap(r => {
            const fresh = sessionMap.get(r.item.id);
            if (!fresh) return [];
            return [{ type: 'session' as const, session: fresh }];
        });
    }, [data, query, fuse, sessionMap]);
}
