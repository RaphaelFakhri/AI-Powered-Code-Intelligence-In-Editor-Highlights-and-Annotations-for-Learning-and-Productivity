import { ToIdeFromWebviewOrCoreProtocol } from "./ide";
import { ToWebviewFromIdeOrCoreProtocol } from "./webview";

import {
  AcceptOrRejectDiffPayload,
  AddToChatPayload,
  ApplyState,
  ApplyToFilePayload,
  ContextItemWithId,
  HighlightedCodePayload,
  MessageContent,
  RangeInFile,
  RangeInFileWithContents,
  SetCodeToEditPayload,
  ShowFilePayload,
} from "../";

export type ToIdeFromWebviewProtocol = ToIdeFromWebviewOrCoreProtocol & {
  openUrl: [string, void];
  applyToFile: [ApplyToFilePayload, void];
  overwriteFile: [{ filepath: string; prevFileContent: string | null }, void];
  showTutorial: [undefined, void];
  showFile: [ShowFilePayload, void];
  toggleDevTools: [undefined, void];
  reloadWindow: [undefined, void];
  focusEditor: [undefined, void];
  toggleFullScreen: [{ newWindow?: boolean } | undefined, void];
  insertAtCursor: [{ text: string }, void];
  insertCommentAbove: [
    { filepath: string; line: number; comment: string },
    void,
  ];
  copyText: [{ text: string }, void];
  "jetbrains/isOSREnabled": [undefined, boolean];
  "jetbrains/onLoad": [
    undefined,
    {
      windowId: string;
      serverUrl: string;
      workspacePaths: string[];
      vscMachineId: string;
      vscMediaUrl: string;
    },
  ];
  "jetbrains/getColors": [undefined, Record<string, string | null | undefined>];
  "vscode/openMoveRightMarkdown": [undefined, void];
  acceptDiff: [AcceptOrRejectDiffPayload, void];
  rejectDiff: [AcceptOrRejectDiffPayload, void];
  "edit/sendPrompt": [
    {
      prompt: MessageContent;
      range: RangeInFileWithContents;
    },
    string | undefined,
  ];
  "edit/addCurrentSelection": [undefined, void];
  "edit/clearDecorations": [undefined, void];
  "session/share": [{ sessionId: string }, void];
  createBackgroundAgent: [
    {
      content: MessageContent;
      contextItems: ContextItemWithId[];
      selectedCode: RangeInFile[];
      organizationId?: string;
      agent?: string;
    },
    void,
  ];
  listBackgroundAgents: [
    { organizationId?: string; limit?: number },
    {
      agents: Array<{
        id: string;
        name: string | null;
        status: string;
        repoUrl: string;
        createdAt: string;
        metadata?: {
          github_repo?: string;
        };
      }>;
      totalCount: number;
    },
  ];
  openAgentLocally: [
    {
      agentSessionId: string;
    },
    void,
  ];
  voiceSelectionStart: [undefined, void];
  voiceSelectionStop: [undefined, void];
  voiceTtsSpeak: [{ text: string }, void];
  voiceTtsStop: [undefined, void];
  gazeStart: [undefined, void];
  gazeStop: [undefined, void];
};

export type ToWebviewFromIdeProtocol = ToWebviewFromIdeOrCoreProtocol & {
  setInactive: [undefined, void];
  newSessionWithPrompt: [{ prompt: string }, void];
  userInput: [{ input: string }, void];
  focusContinueInput: [undefined, void];
  focusContinueInputWithoutClear: [undefined, void];
  focusContinueInputWithNewSession: [undefined, void];
  highlightedCode: [HighlightedCodePayload, void];
  setCodeToEdit: [SetCodeToEditPayload, void];
  navigateTo: [{ path: string; toggle?: boolean }, void];
  addModel: [undefined, void];
  selectionChange: [
    {
      filepath: string | null;
      range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      } | null;
      content: string | null;
    },
    void,
  ];

  focusContinueSessionId: [{ sessionId: string | undefined }, void];
  newSession: [undefined, void];
  loadAgentSession: [{ session: any }, void];
  setTheme: [{ theme: any }, void];
  setColors: [{ [key: string]: string }, void];
  "jetbrains/editorInsetRefresh": [undefined, void];
  "jetbrains/isOSREnabled": [boolean, void];
  setupApiKey: [undefined, void];
  setupLocalConfig: [undefined, void];
  incrementFtc: [undefined, void];
  openOnboardingCard: [undefined, void];
  applyCodeFromChat: [undefined, void];
  updateApplyState: [ApplyState, void];
  exitEditMode: [undefined, void];
  focusEdit: [undefined, void];
  generateRule: [undefined, void];
  addToChat: [AddToChatPayload, void];
  voiceSelectionTranscript: [{ transcript: string; isFinal: boolean }, void];
  voiceSelectionStatus: [
    { state: "idle" | "listening" | "error"; message?: string },
    void,
  ];
  voiceTtsAudio: [{ audioBase64: string; mimeType: string }, void];
  voiceIntent: [
    {
      action:
        | "select_lines"
        | "select_all"
        | "select_function"
        | "overview"
        | "explain_api"
        | "explain_concept"
        | "explain_usage"
        | "inline_comment"
        | "custom_prompt"
        | "unknown";
      startLine?: number;
      endLine?: number;
      functionName?: string;
      customPrompt?: string;
      transcript: string;
    },
    void,
  ];
  gazeUpdate: [{ x: number; y: number; valid: boolean }, void];
};
