/**
 * Real-time Speech-to-Text using Deepgram WebSocket
 *
 * Usage:
 *   node transcribe.js
 *
 * Requires:
 *   - ffmpeg in PATH (or update MICROPHONE_DEVICE to your ffmpeg device name)
 *   - npm install ws
 *
 * Install ws:
 *   npm install ws
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const WebSocketImpl = globalThis.WebSocket || require("ws");

function readApiKeyFromConfig() {
  try {
    const configPath = path.join(__dirname, "config.yaml");
    const content = fs.readFileSync(configPath, "utf8");
    const match = content.match(
      /^\s*deepgramApiKey\s*:\s*['"]?([^'"\n]+)['"]?\s*$/m,
    );
    return match?.[1]?.trim() || "";
  } catch {
    return "";
  }
}

// Deepgram API key priority: env -> tmp/config.yaml
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || readApiKeyFromConfig();

if (!DEEPGRAM_API_KEY) {
  console.error(
    "No Deepgram API key found. Set DEEPGRAM_API_KEY env var or add deepgramApiKey to config.yaml",
  );
  process.exit(1);
}

// Deepgram endpoint - nova-2 is fast and accurate for general English
const DEEPGRAM_URL =
  "wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate=16000&channels=1&punctuate=true&interim_results=true";

// Microphone device name - change if you need a different device
const MICROPHONE_DEVICE =
  "Microphone Array (Intel® Smart Sound Technology for Digital Microphones)";

// ─── Safety limits ─────────────────────────────────────────────────
const IDLE_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes of silence → auto-close
const MAX_SESSION_MS = 10 * 60 * 1000; // 10 minute hard cap per session

// ─── Module-level refs for cleanup ─────────────────────────────────
let ws = null;
let ffmpegProcess = null;
let cleaningUp = false;
let wsOpenTime = null;
let lastTranscriptTime = null;
let idleTimer = null;
let maxSessionTimer = null;

// ─── Billable event logging ────────────────────────────────────────
function logBillable(event, details = {}) {
  const now = new Date();
  const elapsed = wsOpenTime
    ? ((now - wsOpenTime) / 1000).toFixed(1) + "s"
    : "n/a";
  console.log(
    `[BILLING] ${now.toISOString()} | event=${event} | ws_duration=${elapsed} | ${Object.entries(
      details,
    )
      .map(([k, v]) => `${k}=${v}`)
      .join(" | ")}`,
  );
}

function resetIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  idleTimer = setTimeout(() => {
    console.log(
      `[BILLING] Idle timeout reached (${IDLE_TIMEOUT_MS / 1000}s with no speech). Auto-closing.`,
    );
    logBillable("idle_timeout_close");
    cleanup("idle_timeout");
  }, IDLE_TIMEOUT_MS);
}

// ─── Cleanup: closes WS, kills ffmpeg, exits ──────────────────────
function cleanup(reason = "unknown") {
  if (cleaningUp) {
    return;
  }
  cleaningUp = true;

  const duration = wsOpenTime
    ? ((Date.now() - wsOpenTime) / 1000).toFixed(1)
    : "0";
  logBillable("session_end", { reason, total_duration_sec: duration });

  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (maxSessionTimer) {
    clearTimeout(maxSessionTimer);
    maxSessionTimer = null;
  }

  if (ffmpegProcess) {
    try {
      ffmpegProcess.kill("SIGKILL");
    } catch {}
    ffmpegProcess = null;
  }

  if (ws) {
    try {
      if (
        ws.readyState === WebSocketImpl.OPEN ||
        ws.readyState === WebSocketImpl.CONNECTING
      ) {
        ws.close();
        logBillable("ws_close_sent", { reason });
      }
    } catch {}
    ws = null;
  }

  // Give WebSocket close frame time to send, then exit
  setTimeout(() => process.exit(0), 500);
}

// ─── Handle ALL termination signals ────────────────────────────────
process.on("SIGINT", () => cleanup("SIGINT"));
process.on("SIGTERM", () => cleanup("SIGTERM"));
process.on("SIGHUP", () => cleanup("SIGHUP"));
process.on("uncaughtException", (err) => {
  console.error("[BILLING] Uncaught exception:", err.message);
  cleanup("uncaughtException");
});
process.on("unhandledRejection", (err) => {
  console.error("[BILLING] Unhandled rejection:", err);
  cleanup("unhandledRejection");
});
process.on("beforeExit", () => cleanup("beforeExit"));

// ─── Start ─────────────────────────────────────────────────────────
console.log("=".repeat(50));
console.log("Deepgram Real-Time Speech-to-Text");
console.log("Speak into your microphone...");
console.log("Press Ctrl+C to stop");
console.log(
  `Idle timeout: ${IDLE_TIMEOUT_MS / 1000}s | Max session: ${MAX_SESSION_MS / 1000}s`,
);
console.log("=".repeat(50));
console.log(`Using microphone: ${MICROPHONE_DEVICE}`);
console.log();

// Connect to Deepgram
logBillable("ws_connecting");
ws = new WebSocketImpl(DEEPGRAM_URL, ["token", DEEPGRAM_API_KEY]);

ws.on("open", () => {
  wsOpenTime = new Date();
  logBillable("ws_open", { url: "wss://api.deepgram.com/v1/listen" });
  console.log("Connected to Deepgram!");

  // Start idle timer immediately
  resetIdleTimer();

  // Hard cap on session duration
  maxSessionTimer = setTimeout(() => {
    console.log(
      `[BILLING] Max session duration reached (${MAX_SESSION_MS / 1000}s). Auto-closing.`,
    );
    logBillable("max_session_close");
    cleanup("max_session");
  }, MAX_SESSION_MS);

  // Start ffmpeg to capture microphone audio
  ffmpegProcess = spawn(
    "C:\\Users\\rfakhri\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1-full_build\\bin\\ffmpeg.exe",
    [
      "-loglevel",
      "error",
      "-f",
      "dshow", // Windows DirectShow
      "-i",
      `audio=${MICROPHONE_DEVICE}`,
      "-f",
      "s16le", // Raw 16-bit PCM
      "-ar",
      "16000", // 16kHz sample rate
      "-ac",
      "1", // Mono channel
      "-acodec",
      "pcm_s16le",
      "-",
    ],
  );

  ffmpegProcess.stdout.on("data", (chunk) => {
    if (ws && ws.readyState === WebSocketImpl.OPEN) {
      ws.send(chunk);
    }
  });

  ffmpegProcess.stderr.on("data", (data) => {
    console.error("[ffmpeg stderr]", data.toString("utf8").trim());
  });

  ffmpegProcess.on("close", (code) => {
    console.log("[ffmpeg] exited with code", code);
    logBillable("ffmpeg_exit", { code });
    // ffmpeg died — no audio source, close the WebSocket immediately
    cleanup("ffmpeg_exit");
  });

  ffmpegProcess.on("error", (err) => {
    console.error("[ffmpeg] spawn error:", err.message);
    logBillable("ffmpeg_error", { error: err.message });
    cleanup("ffmpeg_error");
  });

  console.log("Microphone capture started...");
  console.log();
});

ws.on("message", (data) => {
  const result = JSON.parse(data);

  if (result.channel?.alternatives?.[0]?.transcript) {
    const transcript = result.channel.alternatives[0].transcript;
    const isFinal = result.is_final;

    if (transcript.trim()) {
      // Any speech resets the idle timer
      lastTranscriptTime = new Date();
      resetIdleTimer();
    }

    if (transcript.trim() && isFinal) {
      console.log("DG_FINAL:" + transcript);
    }
  }
});

ws.on("error", (err) => {
  console.error("WebSocket error:", err.message);
  logBillable("ws_error", { error: err.message });
  cleanup("ws_error");
});

ws.on("close", (code, reason) => {
  const duration = wsOpenTime
    ? ((Date.now() - wsOpenTime) / 1000).toFixed(1)
    : "0";
  logBillable("ws_closed_by_server", {
    code,
    reason: reason || "none",
    duration_sec: duration,
  });
  console.log("\nDisconnected from Deepgram");
  cleanup("ws_close_event");
});
