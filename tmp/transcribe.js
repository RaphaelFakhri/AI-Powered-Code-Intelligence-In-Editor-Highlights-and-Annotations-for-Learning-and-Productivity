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

// Deepgram API key priority: env -> tmp/config.yaml -> fallback
const DEEPGRAM_API_KEY =
  process.env.DEEPGRAM_API_KEY ||
  readApiKeyFromConfig() ||
  "96c97d0bae96a64df53f9e53e03343370a095d44";

// Deepgram endpoint - nova-2 is fast and accurate for general English
const DEEPGRAM_URL =
  "wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate=16000&channels=1&punctuate=true&interim_results=true";

// Microphone device name - change if you need a different device
const MICROPHONE_DEVICE = "Microphone (USB Condenser Microphone)";

console.log("=".repeat(50));
console.log("Deepgram Real-Time Speech-to-Text");
console.log("Speak into your microphone...");
console.log("Press Ctrl+C to stop");
console.log("=".repeat(50));
console.log(`Using microphone: ${MICROPHONE_DEVICE}`);
console.log();

// Connect to Deepgram
const ws = new WebSocketImpl(DEEPGRAM_URL, ["token", DEEPGRAM_API_KEY]);

ws.on("open", () => {
  console.log("Connected to Deepgram!");

  // Start ffmpeg to capture microphone audio
  const ffmpeg = spawn("ffmpeg", [
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
  ]);

  ffmpeg.stdout.on("data", (chunk) => {
    if (ws.readyState === WebSocketImpl.OPEN) {
      ws.send(chunk);
    }
  });

  ffmpeg.stderr.on("data", (data) => {
    // Suppress ffmpeg error output
  });

  ffmpeg.on("close", (code) => {
    console.log("ffmpeg exited with code", code);
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
      if (isFinal) {
        console.log("DG_FINAL:" + transcript);
      } else {
        process.stdout.write("\r" + transcript + "   ");
      }
    }
  }
});

ws.on("error", (err) => {
  console.error("WebSocket error:", err.message);
});

ws.on("close", () => {
  console.log("\nDisconnected from Deepgram");
});

// Handle Ctrl+C gracefully
process.on("SIGINT", () => {
  console.log("\n\nStopping...");
  ws.close();
  process.exit(0);
});
