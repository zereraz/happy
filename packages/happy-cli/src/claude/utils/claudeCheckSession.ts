import { logger } from "@/ui/logger";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getProjectPath } from "./path";
import { autoRestoreSession } from "@/modules/sessionRestore";

/**
 * Check if a Claude Code session file exists and is valid.
 * If the JSONL is missing, attempts to auto-restore from the Happy server.
 *
 * Returns true synchronously if the file exists and is valid.
 * For auto-restore (async), use claudeCheckSessionAsync instead.
 */
export function claudeCheckSession(sessionId: string, path: string) {
    return checkSessionFile(sessionId, path);
}

/**
 * Check session file + auto-restore from server if missing.
 * This is the async version that should be used when network access is acceptable.
 */
export async function claudeCheckSessionAsync(sessionId: string, path: string): Promise<boolean> {
    if (checkSessionFile(sessionId, path)) {
        return true;
    }

    // JSONL missing — try auto-restoring from the Happy server
    logger.debug(`[claudeCheckSession] Session ${sessionId} missing locally, attempting server restore...`);
    try {
        const restored = await autoRestoreSession(sessionId, path);
        if (restored) {
            logger.debug(`[claudeCheckSession] Session ${sessionId} restored from server`);
            return checkSessionFile(sessionId, path);
        }
    } catch (e) {
        logger.debug(`[claudeCheckSession] Auto-restore failed:`, e);
    }

    return false;
}

function checkSessionFile(sessionId: string, path: string): boolean {
    const projectDir = getProjectPath(path);

    // Check if session id is in the project dir
    const sessionFile = join(projectDir, `${sessionId}.jsonl`);
    const sessionExists = existsSync(sessionFile);
    if (!sessionExists) {
        logger.debug(`[claudeCheckSession] Path ${sessionFile} does not exist`);
        return false;
    }

    // Check if session contains any messages with valid ID fields
    const sessionData = readFileSync(sessionFile, 'utf-8').split('\n');

    const hasGoodMessage = !!sessionData.find((v, index) => {
        if (!v.trim()) return false;  // Skip empty lines silently (not errors)

        try {
            const parsed = JSON.parse(v);
            // Accept sessions with any of these ID fields (different Claude Code versions)
            // Check for non-empty strings to handle edge cases robustly
            return (typeof parsed.uuid === 'string' && parsed.uuid.length > 0) ||        // Claude Code 2.1.x
                   (typeof parsed.messageId === 'string' && parsed.messageId.length > 0) ||   // Older Claude Code
                   (typeof parsed.leafUuid === 'string' && parsed.leafUuid.length > 0);      // Summary lines
        } catch (e) {
            // Log parse errors for debugging (following project convention)
            logger.debug(`[claudeCheckSession] Malformed JSON at line ${index + 1}:`, e);
            return false;
        }
    });

    // Log final validation result for observability
    logger.debug(`[claudeCheckSession] Session ${sessionId}: ${hasGoodMessage ? 'valid' : 'invalid'}`);

    return hasGoodMessage;
}