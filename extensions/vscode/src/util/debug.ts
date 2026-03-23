import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

const LOG_FILE_PATH = path.join(os.tmpdir(), "continue-debug.log");
let debugChannel: vscode.OutputChannel | undefined;
let hasRevealedDebugLogs = false;

function getDebugChannel(): vscode.OutputChannel {
  if (!debugChannel) {
    debugChannel = vscode.window.createOutputChannel("Continue Debug");
  }
  return debugChannel;
}

export function getDebugLogFilePath(): string {
  return LOG_FILE_PATH;
}

export function revealDebugLogs(): void {
  try {
    const channel = getDebugChannel();
    channel.show(true);
  } catch {
    // Best effort only
  }

  if (!hasRevealedDebugLogs) {
    hasRevealedDebugLogs = true;
    void vscode.window.showInformationMessage(
      `Continue debug logs are visible in Output > Continue Debug and saved at ${LOG_FILE_PATH}`,
    );
  }
}

export function debugLog(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}`;

  try {
    fs.appendFileSync(LOG_FILE_PATH, `${line}\n`);
  } catch {
    // Best effort logging only
  }

  try {
    getDebugChannel().appendLine(line);
  } catch {
    // Best effort logging only
  }

  console.log(line);
}

debugLog("Continue debug logger initialized");
