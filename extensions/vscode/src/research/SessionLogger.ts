import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import * as vscode from "vscode";

export type LogCategory =
  | "session"
  | "voice"
  | "gaze"
  | "selection"
  | "ai"
  | "editor"
  | "run"
  | "ui"
  | "command"
  | "error";

export interface LogEvent {
  ts: string;
  session_id: string;
  participant_id: string;
  category: LogCategory;
  event: string;
  data?: Record<string, unknown>;
}

/**
 * Per-session JSONL telemetry logger for the thesis study.
 *
 * One file per session, written to ~/.continue-research-logs/. Every call to
 * `log()` is wrapped in try/catch so logging failures NEVER break the
 * extension. All file writes are buffered and flushed periodically (or on
 * dispose) to keep them off the hot path.
 */
export class SessionLogger {
  private static instance: SessionLogger | null = null;

  static get(): SessionLogger | null {
    return SessionLogger.instance;
  }

  static initialize(participantId: string): SessionLogger {
    if (SessionLogger.instance) {
      // Re-initialize: close old session, start new one
      SessionLogger.instance.endSession("reinitialize");
    }
    SessionLogger.instance = new SessionLogger(participantId);
    return SessionLogger.instance;
  }

  private readonly sessionId: string;
  private readonly participantId: string;
  private readonly logFilePath: string;
  private buffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private disposed = false;

  private constructor(participantId: string) {
    this.participantId = participantId;
    this.sessionId = crypto.randomUUID();

    const logsDir = path.join(os.homedir(), ".continue-research-logs");
    try {
      fs.mkdirSync(logsDir, { recursive: true });
    } catch (e) {
      console.error("[SessionLogger] failed to create logs dir:", e);
    }

    const safeParticipant = this.sanitizeForFilename(participantId);
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);
    this.logFilePath = path.join(
      logsDir,
      `${safeParticipant}_${timestamp}_${this.sessionId.slice(0, 8)}.jsonl`,
    );

    console.log(`[SessionLogger] writing to ${this.logFilePath}`);

    // Periodic flush every 2 seconds
    this.flushTimer = setInterval(() => this.flush(), 2000);

    // Log session start as the very first line
    this.log("session", "session_started", {
      participant_id: participantId,
      session_id: this.sessionId,
      log_file: this.logFilePath,
      vscode_version: vscode.version,
      platform: process.platform,
      arch: process.arch,
      workspace: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "(none)",
    });
  }

  /**
   * Log an event. Always non-throwing.
   */
  log(
    category: LogCategory,
    event: string,
    data?: Record<string, unknown>,
  ): void {
    if (this.disposed) return;
    try {
      const entry: LogEvent = {
        ts: new Date().toISOString(),
        session_id: this.sessionId,
        participant_id: this.participantId,
        category,
        event,
        data,
      };
      this.buffer.push(JSON.stringify(entry));

      // Flush immediately if buffer is large
      if (this.buffer.length >= 50) {
        this.flush();
      }
    } catch (e) {
      console.error("[SessionLogger] log() failed:", e);
    }
  }

  /**
   * Compute a SHA-256 hash of arbitrary text. Use for hashing code content
   * without storing the raw source.
   */
  hash(text: string): string {
    try {
      return crypto
        .createHash("sha256")
        .update(text)
        .digest("hex")
        .slice(0, 16); // truncated for compactness
    } catch {
      return "hash-error";
    }
  }

  /**
   * Persist buffered events to disk.
   */
  flush(): void {
    if (this.buffer.length === 0) return;
    try {
      const text = this.buffer.join("\n") + "\n";
      this.buffer = [];
      fs.appendFileSync(this.logFilePath, text, "utf8");
    } catch (e) {
      console.error("[SessionLogger] flush failed:", e);
    }
  }

  /**
   * End the session and flush any remaining events.
   */
  endSession(reason: string): void {
    if (this.disposed) return;
    try {
      this.log("session", "session_ended", { reason });
      this.flush();
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
        this.flushTimer = null;
      }
      this.disposed = true;
    } catch (e) {
      console.error("[SessionLogger] endSession failed:", e);
    }
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getParticipantId(): string {
    return this.participantId;
  }

  private sanitizeForFilename(s: string): string {
    return (
      s
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^A-Za-z0-9_-]/g, "")
        .slice(0, 32) || "anonymous"
    );
  }
}

/** Convenience top-level function — only logs if logger is initialized. */
export function logEvent(
  category: LogCategory,
  event: string,
  data?: Record<string, unknown>,
): void {
  SessionLogger.get()?.log(category, event, data);
}
