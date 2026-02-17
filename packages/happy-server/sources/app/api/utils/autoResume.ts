import { ClientConnection, eventRouter, UpdatePayload } from "@/app/events/eventRouter";
import { log } from "@/utils/log";

/** Resume hints sent alongside the resume signal to the daemon. */
interface DaemonResumeHints {
    claudeSessionId: string | null;
    directory: string;
    flavor: string;
    encryptedSessionKey?: string;
}

export interface ResumeHints {
    machineId: string;
    claudeSessionId?: string | null;
    directory?: string;
    flavor?: string;
    encryptedSessionKey?: string;
}

/**
 * Attempt to auto-resume a dead session by finding the daemon's machine-scoped
 * connection via eventRouter and emitting a direct `server:resume-session` event.
 *
 * This bypasses the encrypted RPC channel since the server doesn't have encryption
 * keys. The daemon listens for this event separately on its websocket connection.
 *
 * When pendingUpdate is provided, waits for the session-scoped connection to appear
 * after resume and re-delivers the message that triggered the resume.
 */
export async function tryAutoResumeSession(userId: string, sessionId: string, resume: ResumeHints, pendingUpdate?: UpdatePayload): Promise<void> {
    try {
        const { machineId } = resume;

        // Find the daemon's machine-scoped connection via eventRouter
        const connections = eventRouter.getConnections(userId);
        if (!connections) {
            log({ module: 'auto-resume' }, `[AUTO-RESUME] No connections for user, cannot auto-resume session ${sessionId}`);
            return;
        }

        let daemonConn: ClientConnection | null = null;
        for (const conn of connections) {
            if (conn.connectionType === 'machine-scoped' && conn.machineId === machineId) {
                daemonConn = conn;
                break;
            }
        }

        if (!daemonConn || !daemonConn.socket.connected) {
            log({ module: 'auto-resume' }, `[AUTO-RESUME] Daemon not connected for machine ${machineId}, cannot auto-resume session ${sessionId}`);
            return;
        }

        log({ module: 'auto-resume' }, `[AUTO-RESUME] Triggering resume for session ${sessionId} on machine ${machineId}`);

        // Build daemon-facing resume hints (only if we have meaningful data).
        // When called from v3 HTTP route, only machineId is available — the daemon
        // will rely on its dead session cache (tier 1). When called from WebSocket,
        // the app provides full hints for tier 2/3 fallback.
        const daemonResume: DaemonResumeHints | undefined =
            resume.claudeSessionId != null && resume.directory
                ? { claudeSessionId: resume.claudeSessionId, directory: resume.directory, flavor: resume.flavor ?? 'claude', encryptedSessionKey: resume.encryptedSessionKey }
                : undefined;

        daemonConn.socket.emit('server:resume-session', { sessionId, ...(daemonResume && { resume: daemonResume }) });

        // Wait for session-scoped connection to appear, then re-deliver the triggering message
        if (pendingUpdate) {
            const POLL_INTERVAL = 500;
            const TIMEOUT = 30_000;
            const start = Date.now();

            while (Date.now() - start < TIMEOUT) {
                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));

                if (eventRouter.hasSessionScopedConnection(userId, sessionId)) {
                    // Find the session-scoped connection and emit directly to it
                    const currentConnections = eventRouter.getConnections(userId);
                    if (currentConnections) {
                        for (const conn of currentConnections) {
                            if (conn.connectionType === 'session-scoped' && conn.sessionId === sessionId) {
                                conn.socket.emit('update', pendingUpdate);
                                log({ module: 'auto-resume' }, `[AUTO-RESUME] Re-delivered pending message to resumed session ${sessionId} (waited ${Date.now() - start}ms)`);
                                return;
                            }
                        }
                    }
                }
            }

            log({ module: 'auto-resume' }, `[AUTO-RESUME] Timeout waiting for session-scoped connection for ${sessionId} (${TIMEOUT}ms)`);
        }
    } catch (error) {
        log({ module: 'auto-resume', level: 'error' }, `[AUTO-RESUME] Error auto-resuming session ${sessionId}: ${error}`);
    }
}
