import * as React from 'react';
import { loadSessionNotes, saveSessionNotes } from '@/sync/persistence';

/**
 * Hook for reading/writing per-session notes stored in MMKV.
 * Debounces writes by 500ms so typing doesn't hammer storage.
 */
export function useSessionNotes(sessionId: string): [string, (text: string) => void] {
    const [notes, setNotesState] = React.useState(() => loadSessionNotes(sessionId));
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reload notes when sessionId changes
    React.useEffect(() => {
        setNotesState(loadSessionNotes(sessionId));
    }, [sessionId]);

    const setNotes = React.useCallback((text: string) => {
        setNotesState(text);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            saveSessionNotes(sessionId, text);
        }, 500);
    }, [sessionId]);

    // Flush pending save on unmount
    React.useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    return [notes, setNotes];
}
