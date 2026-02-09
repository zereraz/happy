/**
 * Daemon-specific types (not related to API/server communication)
 */

import { Metadata } from '@/api/types';
import { ChildProcess } from 'child_process';

/**
 * Session tracking for daemon
 */
export interface TrackedSession {
  startedBy: 'daemon' | string;
  happySessionId?: string;
  happySessionMetadataFromLocalWebhook?: Metadata;
  pid: number;
  childProcess?: ChildProcess;
  error?: string;
  directoryCreated?: boolean;
  message?: string;
  /** tmux session identifier (format: session:window) */
  tmuxSessionId?: string;
  /** Per-session encryption key (base64), captured from webhook */
  encryptionKeyBase64?: string;
  /** Encryption variant used by this session */
  encryptionVariant?: 'legacy' | 'dataKey';
}

/**
 * Metadata for sessions that have died and can be resumed.
 * Cached in-memory by daemon for up to 24 hours after death.
 */
export interface DeadSession {
  happySessionId: string;
  claudeSessionId: string | null;
  directory: string;
  /** Per-session encryption key (base64) for decrypting session data */
  encryptionKeyBase64: string;
  encryptionVariant: 'legacy' | 'dataKey';
  /** Agent type that was running */
  flavor: string;
  /** Timestamp when the session process died */
  diedAt: number;
  /** Full metadata from the session's last webhook */
  metadata: Metadata;
  /** Whether this session was stopped intentionally (stop-session RPC or user action) */
  intentionallyStopped?: boolean;
}
