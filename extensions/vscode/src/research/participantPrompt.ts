import * as vscode from "vscode";

import { SessionLogger } from "./SessionLogger";

let promptInFlight: Promise<string> | null = null;
let lastPromptTime = 0;

export async function promptForResearchParticipant(
  context: vscode.ExtensionContext,
): Promise<string> {
  // Debounce: don't show again if a prompt was answered or shown in the last 2s
  const now = Date.now();
  if (now - lastPromptTime < 2000) {
    console.log(
      `[Research] Prompt skipped (debounced, last shown ${now - lastPromptTime}ms ago)`,
    );
    return context.globalState.get<string>("researchParticipantId") ?? "";
  }
  // Coalesce concurrent calls
  if (promptInFlight) {
    console.log("[Research] Prompt already in flight, awaiting existing");
    return promptInFlight;
  }

  lastPromptTime = now;
  console.log("[Research] Prompting for participant ID...");

  promptInFlight = (async () => {
    const previous = context.globalState.get<string>("researchParticipantId");

    // Don't pre-fill anonymous IDs — only re-use real participant IDs
    const prefill =
      previous && !previous.startsWith("anonymous-") ? previous : "";

    const id = await vscode.window.showInputBox({
      title: "Thesis Study — Participant Identification",
      prompt:
        "Please enter your AUB tag or full name to associate this session with your study record.",
      placeHolder: "AUB tag or full name",
      value: prefill,
      ignoreFocusOut: true,
      validateInput: (value) => {
        const v = value.trim();
        if (!v) return "A participant identifier is required to continue.";
        if (v.length > 64)
          return "Identifier exceeds the maximum length of 64 characters.";
        if (!/^[A-Za-z0-9 _-]+$/.test(v))
          return "Only letters, digits, spaces, hyphens, and underscores are permitted.";
        return null;
      },
    });

    if (!id) {
      const anonId = `anonymous-${Math.random().toString(36).slice(2, 10)}`;
      await context.globalState.update("researchParticipantId", anonId);
      void vscode.window.showWarningMessage(
        `No participant identifier was provided. This session will be recorded as "${anonId}". You may update it via the participant button in the editor toolbar at any time.`,
      );
      console.log(`[Research] Participant ID dismissed, using ${anonId}`);
      SessionLogger.initialize(anonId);
      return anonId;
    }

    const trimmed = id.trim();
    await context.globalState.update("researchParticipantId", trimmed);
    void vscode.window.showInformationMessage(
      `Thank you, ${trimmed}. Your session is now being recorded for the thesis study.`,
    );
    console.log(`[Research] Participant ID set: ${trimmed}`);
    SessionLogger.initialize(trimmed);
    return trimmed;
  })();

  try {
    return await promptInFlight;
  } finally {
    promptInFlight = null;
  }
}
