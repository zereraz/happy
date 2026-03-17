/**
 * Session restore module
 *
 * Restores Claude Code JSONL session files from encrypted Happy server data.
 * Used both by the CLI command and by auto-restore when a session file is missing.
 *
 * Flow:
 * 1. Read master secret from Tauri localStorage SQLite
 * 2. Derive content private key → decrypt per-session AES key
 * 3. Fetch + decrypt all messages from the Happy server
 * 4. Convert server records back to Claude Code JSONL format
 * 5. Write .jsonl to ~/.claude/projects/<path>/<session-id>.jsonl
 */

import { createHash, createHmac, createDecipheriv, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';
import tweetnacl from 'tweetnacl';
import axios from 'axios';
import { getProjectPath } from '@/claude/utils/path';
import { configuration } from '@/configuration';
import { logger } from '@/ui/logger';

// ── Tauri localStorage paths ────────────────────────────────────────────────

const TAURI_SQLITE_PATHS = [
    join(homedir(), 'Library/WebKit/com.slopus.happy.dev/WebsiteData/Default/PhBo1L4Uh--lAZCdXk4MJRcInwcruJei9Z2QccPw8Nc/PhBo1L4Uh--lAZCdXk4MJRcInwcruJei9Z2QccPw8Nc/LocalStorage/localstorage.sqlite3'),
    join(homedir(), 'Library/WebKit/com.slopus.happy/WebsiteData/Default/PhBo1L4Uh--lAZCdXk4MJRcInwcruJei9Z2QccPw8Nc/PhBo1L4Uh--lAZCdXk4MJRcInwcruJei9Z2QccPw8Nc/LocalStorage/localstorage.sqlite3'),
];

// ── Encryption ──────────────────────────────────────────────────────────────

function decodeBase64(b64: string, variant: 'base64' | 'base64url' = 'base64'): Uint8Array {
    if (variant === 'base64url') {
        const standard = b64.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - b64.length % 4) % 4);
        return new Uint8Array(Buffer.from(standard, 'base64'));
    }
    return new Uint8Array(Buffer.from(b64, 'base64'));
}

async function hmac_sha512(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(createHmac('sha512', key).update(data).digest());
}

async function deriveKey(master: Uint8Array, usage: string, path: string[]): Promise<Uint8Array> {
    const rootI = await hmac_sha512(new TextEncoder().encode(usage + ' Master Seed'), master);
    let key = new Uint8Array(rootI.buffer, rootI.byteOffset, 32);
    let chainCode = new Uint8Array(rootI.buffer, rootI.byteOffset + 32);
    for (const index of path) {
        const I = await hmac_sha512(chainCode, new Uint8Array([0x0, ...new TextEncoder().encode(index)]));
        key = new Uint8Array(I.buffer, I.byteOffset, 32);
        chainCode = new Uint8Array(I.buffer, I.byteOffset + 32);
    }
    return key;
}

function deriveContentKeyPair(contentDataKey: Uint8Array): { publicKey: Uint8Array; secretKey: Uint8Array } {
    const hashedSeed = new Uint8Array(createHash('sha512').update(contentDataKey).digest());
    return tweetnacl.box.keyPair.fromSecretKey(hashedSeed.slice(0, 32));
}

function decryptNaClBox(encryptedBundle: Uint8Array, secretKey: Uint8Array): Uint8Array | null {
    return tweetnacl.box.open(
        encryptedBundle.slice(56),
        encryptedBundle.slice(32, 56),
        encryptedBundle.slice(0, 32),
        secretKey
    ) as Uint8Array | null;
}

function decryptWithDataKey(bundle: Uint8Array, dataKey: Uint8Array): any | null {
    if (bundle.length < 29 || bundle[0] !== 0) return null;
    try {
        const decipher = createDecipheriv('aes-256-gcm', dataKey, bundle.slice(1, 13));
        decipher.setAuthTag(bundle.slice(bundle.length - 16));
        const decrypted = Buffer.concat([decipher.update(bundle.slice(13, bundle.length - 16)), decipher.final()]);
        return JSON.parse(new TextDecoder().decode(decrypted));
    } catch { return null; }
}

function decryptLegacy(data: Uint8Array, secret: Uint8Array): any | null {
    const decrypted = tweetnacl.secretbox.open(data.slice(tweetnacl.secretbox.nonceLength), data.slice(0, tweetnacl.secretbox.nonceLength), secret);
    if (!decrypted) return null;
    return JSON.parse(new TextDecoder().decode(decrypted));
}

function decrypt(key: Uint8Array, variant: 'legacy' | 'dataKey', data: Uint8Array): any | null {
    return variant === 'legacy' ? decryptLegacy(data, key) : decryptWithDataKey(data, key);
}

// ── Credentials ─────────────────────────────────────────────────────────────

export function readMasterSecretFromTauri(): { token: string; secret: Uint8Array } | null {
    for (const sqlitePath of TAURI_SQLITE_PATHS) {
        if (!existsSync(sqlitePath)) continue;
        try {
            const hexOutput = execSync(
                `sqlite3 "${sqlitePath}" "SELECT hex(value) FROM ItemTable WHERE key='auth_credentials';"`,
                { encoding: 'utf-8' }
            ).trim();
            if (!hexOutput) continue;
            const creds = JSON.parse(Buffer.from(hexOutput, 'hex').toString('utf16le'));
            if (creds.token && creds.secret) {
                return { token: creds.token, secret: decodeBase64(creds.secret, 'base64url') };
            }
        } catch { }
    }
    return null;
}

export function readTokenFromCLI(): string | null {
    const keyFile = join(configuration.happyHomeDir, 'access.key');
    if (!existsSync(keyFile)) return null;
    try {
        const raw = JSON.parse(readFileSync(keyFile, 'utf-8'));
        return raw.token || null;
    } catch { return null; }
}

export function resolveServerUrl(): string {
    if (process.env.HAPPY_SERVER_URL) return process.env.HAPPY_SERVER_URL;

    for (const sqlitePath of TAURI_SQLITE_PATHS) {
        if (!existsSync(sqlitePath)) continue;
        try {
            const hexOutput = execSync(
                `sqlite3 "${sqlitePath}" "SELECT hex(value) FROM ItemTable WHERE key='server-config\\\\custom-server-url';"`,
                { encoding: 'utf-8' }
            ).trim();
            if (hexOutput) {
                const url = Buffer.from(hexOutput, 'hex').toString('utf16le');
                if (url.startsWith('http')) return url;
            }
        } catch { }
    }

    return configuration.serverUrl;
}

// ── Server API ──────────────────────────────────────────────────────────────

async function fetchSessionRaw(serverUrl: string, token: string, sessionId: string): Promise<any> {
    const response = await axios.get(`${serverUrl}/v1/sessions/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 30000
    });
    return response.data.session;
}

async function fetchMessages(serverUrl: string, token: string, sessionId: string): Promise<any[]> {
    const allMessages: any[] = [];
    let afterSeq = 0;
    while (true) {
        const response = await axios.get(`${serverUrl}/v3/sessions/${encodeURIComponent(sessionId)}/messages`, {
            params: { after_seq: afterSeq, limit: 100 },
            headers: { 'Authorization': `Bearer ${token}` },
            timeout: 60000
        });
        const messages = Array.isArray(response.data.messages) ? response.data.messages : [];
        let maxSeq = afterSeq;
        for (const msg of messages) {
            if (msg.seq > maxSeq) maxSeq = msg.seq;
            allMessages.push(msg);
        }
        if (!response.data.hasMore || maxSeq === afterSeq) break;
        afterSeq = maxSeq;
    }
    return allMessages;
}

// ── JSONL conversion ────────────────────────────────────────────────────────

function convertToJSONL(records: any[], claudeSessionId: string, workingDir: string): any[] {
    const lines: any[] = [];
    let lastUuid: string | null = null;
    let currentAssistantContent: any[] = [];

    function flushAssistant() {
        if (currentAssistantContent.length === 0) return;
        const uuid = randomUUID();
        lines.push({
            type: 'assistant', uuid, parentUuid: lastUuid, sessionId: claudeSessionId,
            message: { role: 'assistant', content: [...currentAssistantContent] }
        });
        lastUuid = uuid;
        currentAssistantContent = [];
    }

    for (const record of records) {
        if (!record || typeof record !== 'object') continue;

        // Old format: role=agent, type=output — data IS the JSONL line
        if (record.role === 'agent' && record.content?.type === 'output') {
            flushAssistant();
            const data = record.content.data;
            if (data?.type) {
                const line = { ...data, sessionId: claudeSessionId };
                if (!line.uuid) line.uuid = randomUUID();
                if (lastUuid && !line.parentUuid) line.parentUuid = lastUuid;
                lines.push(line);
                lastUuid = line.uuid;
            }
            continue;
        }

        // Direct user message (role=user)
        if (record.role === 'user' && record.content?.type === 'text') {
            flushAssistant();
            const uuid = randomUUID();
            lines.push({
                type: 'user', uuid, parentUuid: lastUuid, sessionId: claudeSessionId,
                isSidechain: false, userType: 'external', cwd: workingDir,
                message: { role: 'user', content: record.content.text }
            });
            lastUuid = uuid;
            continue;
        }

        // Session protocol messages
        if (record.role === 'session') {
            const envelope = record.content;
            if (!envelope?.ev) continue;
            const ev = envelope.ev;

            if (envelope.role === 'user' && ev.t === 'text') {
                flushAssistant();
                const uuid = randomUUID();
                lines.push({
                    type: 'user', uuid, parentUuid: lastUuid, sessionId: claudeSessionId,
                    isSidechain: false, userType: 'external', cwd: workingDir,
                    message: { role: 'user', content: ev.text }
                });
                lastUuid = uuid;
                continue;
            }

            if (envelope.role === 'agent') {
                if (ev.t === 'turn-start' || ev.t === 'turn-end') {
                    flushAssistant();
                    continue;
                }
                if (ev.t === 'text') {
                    currentAssistantContent.push(ev.thinking
                        ? { type: 'thinking', thinking: ev.text }
                        : { type: 'text', text: ev.text });
                    continue;
                }
                if (ev.t === 'tool-call-start') {
                    currentAssistantContent.push({
                        type: 'tool_use', id: ev.call || randomUUID(),
                        name: ev.name || 'unknown', input: ev.args || {}
                    });
                    continue;
                }
                if (ev.t === 'tool-call-end') {
                    flushAssistant();
                    const uuid = randomUUID();
                    lines.push({
                        type: 'user', uuid, parentUuid: lastUuid, sessionId: claudeSessionId,
                        isSidechain: false,
                        message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: ev.call, content: '' }] }
                    });
                    lastUuid = uuid;
                    continue;
                }
            }
        }
    }

    flushAssistant();
    return lines;
}

// ── Public API ──────────────────────────────────────────────────────────────

export type RestoreResult = {
    success: true;
    claudeSessionId: string;
    jsonlPath: string;
    lineCount: number;
    workingDir: string;
    summary: string | null;
} | {
    success: false;
    error: string;
};

/**
 * Restore a session from the Happy server into a local Claude Code JSONL file.
 *
 * @param happySessionId - The Happy server session ID
 * @param opts.serverUrl - Server URL (auto-resolved if not provided)
 * @param opts.token - Auth token (auto-resolved if not provided)
 * @param opts.masterSecret - Master secret (auto-resolved from Tauri if not provided)
 * @param opts.dryRun - If true, don't write the file
 */
export async function restoreSession(
    happySessionId: string,
    opts?: {
        serverUrl?: string;
        token?: string;
        masterSecret?: Uint8Array;
        dryRun?: boolean;
    }
): Promise<RestoreResult> {
    // Resolve credentials
    let serverUrl = opts?.serverUrl || resolveServerUrl();
    let token = opts?.token || readTokenFromCLI();
    let masterSecret = opts?.masterSecret;

    if (!masterSecret) {
        const tauri = readMasterSecretFromTauri();
        if (tauri) {
            masterSecret = tauri.secret;
            if (!token) token = tauri.token;
        }
    }

    if (!token) return { success: false, error: 'No auth token available' };
    if (!masterSecret) return { success: false, error: 'No master secret available (Tauri app not authenticated?)' };

    // Derive content key pair
    const contentDataKey = await deriveKey(masterSecret, 'Happy EnCoder', ['content']);
    const contentKeyPair = deriveContentKeyPair(contentDataKey);

    // Fetch session
    let rawSession: any;
    try {
        rawSession = await fetchSessionRaw(serverUrl, token, happySessionId);
    } catch (e: any) {
        return { success: false, error: `Failed to fetch session: ${e.response?.status || e.message}` };
    }

    // Decrypt session key
    let sessionKey: Uint8Array;
    let encryptionVariant: 'legacy' | 'dataKey';

    if (rawSession.dataEncryptionKey) {
        encryptionVariant = 'dataKey';
        const encKeyBundle = decodeBase64(rawSession.dataEncryptionKey);
        if (encKeyBundle[0] !== 0) return { success: false, error: 'Unknown dataEncryptionKey version' };
        const decryptedKey = decryptNaClBox(encKeyBundle.slice(1), contentKeyPair.secretKey);
        if (!decryptedKey) return { success: false, error: 'Failed to decrypt session data key' };
        sessionKey = decryptedKey;
    } else {
        encryptionVariant = 'legacy';
        sessionKey = masterSecret;
    }

    // Decrypt metadata
    const metadata = decrypt(sessionKey, encryptionVariant, decodeBase64(rawSession.metadata));
    if (!metadata) return { success: false, error: 'Failed to decrypt session metadata' };

    const claudeSessionId = metadata.claudeSessionId || randomUUID();
    const workingDir = metadata.path;
    const summary = metadata.summary?.text || null;

    if (!workingDir) return { success: false, error: 'No working directory in session metadata' };

    // Fetch and decrypt messages
    const rawMessages = await fetchMessages(serverUrl, token, happySessionId);
    const decryptedRecords: any[] = [];

    for (const msg of rawMessages) {
        if (msg.content?.t !== 'encrypted') continue;
        try {
            const body = decrypt(sessionKey, encryptionVariant, decodeBase64(msg.content.c));
            if (body) decryptedRecords.push(body);
        } catch { }
    }

    if (decryptedRecords.length === 0) {
        return { success: false, error: 'No messages could be decrypted' };
    }

    // Convert to JSONL
    const jsonlLines = convertToJSONL(decryptedRecords, claudeSessionId, workingDir);
    const finalLines: any[] = [];
    if (summary) {
        finalLines.push({
            type: 'summary', summary,
            leafUuid: jsonlLines.length > 0 ? jsonlLines[jsonlLines.length - 1].uuid : randomUUID()
        });
    }
    finalLines.push(...jsonlLines);

    const jsonlContent = finalLines.map(l => JSON.stringify(l)).join('\n') + '\n';
    const projectDir = getProjectPath(workingDir);
    const jsonlPath = join(projectDir, `${claudeSessionId}.jsonl`);

    if (!opts?.dryRun) {
        if (!existsSync(projectDir)) mkdirSync(projectDir, { recursive: true });

        if (existsSync(jsonlPath)) {
            writeFileSync(jsonlPath + '.backup.' + Date.now(), readFileSync(jsonlPath));
        }

        writeFileSync(jsonlPath, jsonlContent);
    }

    return {
        success: true,
        claudeSessionId,
        jsonlPath,
        lineCount: finalLines.length,
        workingDir,
        summary,
    };
}

/**
 * Attempt to auto-restore a Claude session from the Happy server.
 * Scans all sessions on the server to find one matching the given Claude session ID,
 * then restores the JSONL file locally.
 *
 * Returns true if the session was restored, false otherwise.
 * Designed to be called from claudeCheckSession as a fallback.
 */
export async function autoRestoreSession(claudeSessionId: string, workingDir: string): Promise<boolean> {
    logger.debug(`[autoRestore] Attempting to restore session ${claudeSessionId}`);

    let serverUrl: string;
    let token: string | null;
    let masterSecret: Uint8Array | undefined;

    try {
        serverUrl = resolveServerUrl();
        token = readTokenFromCLI();
        const tauri = readMasterSecretFromTauri();
        if (tauri) {
            masterSecret = tauri.secret;
            if (!token) token = tauri.token;
        }
    } catch (e) {
        logger.debug('[autoRestore] Failed to read credentials:', e);
        return false;
    }

    if (!token || !masterSecret) {
        logger.debug('[autoRestore] Missing credentials, skipping restore');
        return false;
    }

    // Derive content key pair for scanning sessions
    let contentSecretKey: Uint8Array;
    try {
        const contentDataKey = await deriveKey(masterSecret, 'Happy EnCoder', ['content']);
        const keyPair = deriveContentKeyPair(contentDataKey);
        contentSecretKey = keyPair.secretKey;
    } catch (e) {
        logger.debug('[autoRestore] Failed to derive key pair:', e);
        return false;
    }

    // Fetch all sessions and find the one matching this Claude session ID
    let sessions: any[];
    try {
        const resp = await axios.get(`${serverUrl}/v1/sessions`, {
            headers: { 'Authorization': `Bearer ${token}` },
            timeout: 15000
        });
        sessions = resp.data.sessions || resp.data || [];
    } catch (e) {
        logger.debug('[autoRestore] Failed to fetch sessions:', e);
        return false;
    }

    // Scan sessions to find matching Claude session ID
    let matchedHappySessionId: string | null = null;

    for (const session of sessions) {
        if (!session.dataEncryptionKey || !session.metadata) continue;
        try {
            const encKeyBundle = decodeBase64(session.dataEncryptionKey);
            if (encKeyBundle[0] !== 0) continue;
            const sessionKey = decryptNaClBox(encKeyBundle.slice(1), contentSecretKey);
            if (!sessionKey) continue;
            const meta = decryptWithDataKey(decodeBase64(session.metadata), sessionKey);
            if (meta?.claudeSessionId === claudeSessionId) {
                matchedHappySessionId = session.id;
                logger.debug(`[autoRestore] Found matching session: ${session.id}`);
                break;
            }
        } catch { }
    }

    if (!matchedHappySessionId) {
        logger.debug(`[autoRestore] No server session found for Claude session ${claudeSessionId}`);
        return false;
    }

    // Restore it
    const result = await restoreSession(matchedHappySessionId, { serverUrl, token, masterSecret });
    if (result.success) {
        logger.debug(`[autoRestore] Restored ${result.lineCount} lines to ${result.jsonlPath}`);
        return true;
    }

    logger.debug(`[autoRestore] Restore failed: ${result.error}`);
    return false;
}
