import {
  ArrowLeftIcon,
  ChatBubbleOvalLeftIcon,
} from "@heroicons/react/24/outline";
import { Editor, JSONContent } from "@tiptap/react";
import { ChatHistoryItem, InputModifiers } from "core";
import { renderChatMessage } from "core/util/messageContent";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ErrorBoundary } from "react-error-boundary";
import styled from "styled-components";
import { Button, lightGray, vscBackground } from "../../components";
import SelectionContextDisplay from "../../components/SelectionContextDisplay";
import AIOverviewStyle1 from "../../components/AIOverviewStyle1";
import { useSelection } from "../../context/SelectionContext";
import { formatComment } from "../../utils/commentUtils";
import { useFindWidget } from "../../components/find/FindWidget";
import TimelineItem from "../../components/gui/TimelineItem";
import { NewSessionButton } from "../../components/mainInput/belowMainInput/NewSessionButton";
import ThinkingBlockPeek from "../../components/mainInput/belowMainInput/ThinkingBlockPeek";
import ContinueInputBox from "../../components/mainInput/ContinueInputBox";
import { voiceAudioContext } from "../../components/mainInput/InputToolbar";
import { useOnboardingCard } from "../../components/OnboardingCard";
import StepContainer from "../../components/StepContainer";
import { TabBar } from "../../components/TabBar/TabBar";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useWebviewListener } from "../../hooks/useWebviewListener";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import {
  selectDoneApplyStates,
  selectPendingToolCalls,
} from "../../redux/selectors/selectToolCalls";
import { selectCurrentOrg } from "../../redux/slices/profilesSlice";
import {
  cancelToolCall,
  ChatHistoryItemWithMessageId,
  newSession,
  updateToolCallOutput,
} from "../../redux/slices/sessionSlice";
import { streamEditThunk } from "../../redux/thunks/edit";
import { generateAIOverviewThunk } from "../../redux/thunks/generateAIOverview";
import { loadLastSession } from "../../redux/thunks/session";
import { streamResponseThunk } from "../../redux/thunks/streamResponse";
import { isJetBrains, isMetaEquivalentKeyPressed } from "../../util";
import { ToolCallDiv } from "./ToolCallDiv";

import { useStore } from "react-redux";
import { BackgroundModeView } from "../../components/BackgroundMode/BackgroundModeView";
import { CliInstallBanner } from "../../components/CliInstallBanner";
import FeedbackDialog from "../../components/dialogs/FeedbackDialog";

import { FatalErrorIndicator } from "../../components/config/FatalErrorNotice";
import InlineErrorMessage from "../../components/mainInput/InlineErrorMessage";
import { resolveEditorContent } from "../../components/mainInput/TipTapEditor/utils/resolveEditorContent";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { RootState } from "../../redux/store";
import { cancelStream } from "../../redux/thunks/cancelStream";
import { getLocalStorage, setLocalStorage } from "../../util/localStorage";
import { EmptyChatBody } from "./EmptyChatBody";
import { ExploreDialogWatcher } from "./ExploreDialogWatcher";
import { useAutoScroll } from "./useAutoScroll";

// Helper function to find the index of the latest conversation summary
function findLatestSummaryIndex(history: ChatHistoryItem[]): number {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].conversationSummary) {
      return i;
    }
  }
  return -1; // No summary found
}

const EXPLAIN_SOURCE_LABELS: Record<string, string> = {
  "explain-api": "API >",
  "explain-concept": "Concept >",
  "explain-usage": "Usage >",
};

const StepsDiv = styled.div`
  position: relative;
  background-color: transparent;

  & > * {
    position: relative;
  }

  .thread-message {
    margin: 0 0 0 1px;
  }
`;

export const MAIN_EDITOR_INPUT_ID = "main-editor-input";

function fallbackRender({ error, resetErrorBoundary }: any) {
  // Call resetErrorBoundary() to reset the error boundary and retry the render.

  return (
    <div
      role="alert"
      className="px-2"
      style={{ backgroundColor: vscBackground }}
    >
      <p>Something went wrong:</p>
      <pre style={{ color: "red" }}>{error.message}</pre>
      <pre style={{ color: lightGray }}>{error.stack}</pre>

      <div className="text-center">
        <Button onClick={resetErrorBoundary}>Restart</Button>
      </div>
    </div>
  );
}

export function Chat() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const reduxStore = useStore<RootState>();
  const onboardingCard = useOnboardingCard();
  const {
    launchStarted,
    frozenSelection,
    resetLaunch,
    startLaunch,
    selection,
    setSelection,
  } = useSelection();
  const showSessionTabs = useAppSelector(
    (store) => store.config.config.ui?.showSessionTabs,
  );
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const [stepsOpen] = useState<(boolean | undefined)[]>([]);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [commentInserted, setCommentInserted] = useState(false);
  const hasTriggeredOverviewRef = useRef(false);
  const mainTextInputRef = useRef<HTMLInputElement>(null);
  const stepsDivRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const history = useAppSelector((state) => state.session.history);
  const showChatScrollbar = useAppSelector(
    (state) => state.config.config.ui?.showChatScrollbar,
  );
  const codeToEdit = useAppSelector((state) => state.editModeState.codeToEdit);
  const isInEdit = useAppSelector((store) => store.session.isInEdit);

  const lastSessionId = useAppSelector((state) => state.session.lastSessionId);
  const allSessionMetadata = useAppSelector(
    (state) => state.session.allSessionMetadata,
  );
  const hasDismissedExploreDialog = useAppSelector(
    (state) => state.ui.hasDismissedExploreDialog,
  );
  const mode = useAppSelector((state) => state.session.mode);
  const isGeneratingAIOverview = useAppSelector(
    (state) => state.session.isGeneratingAIOverview,
  );
  const currentOrg = useAppSelector(selectCurrentOrg);
  const jetbrains = useMemo(() => {
    return isJetBrains();
  }, []);

  useAutoScroll(stepsDivRef, history);

  const overviewContent = useMemo(() => {
    let overviewUserIndex = -1;

    for (let i = history.length - 1; i >= 0; i--) {
      const current = history[i].message;
      const metadata = current.metadata as { source?: string } | undefined;
      if (current.role === "user" && metadata?.source === "overview") {
        overviewUserIndex = i;
        break;
      }
    }

    if (overviewUserIndex === -1) {
      return undefined;
    }

    let latestAssistantContent: string | undefined;

    for (let i = overviewUserIndex + 1; i < history.length; i++) {
      const message = history[i].message;

      if (message.role === "user") {
        break;
      }

      if (message.role === "assistant") {
        const text = renderChatMessage(message).trim();
        if (text.length > 0) {
          latestAssistantContent = text;
        }
      }
    }

    return latestAssistantContent;
  }, [history]);

  useEffect(() => {
    if (!launchStarted) {
      hasTriggeredOverviewRef.current = false;
      setCommentInserted(false);
    }
  }, [launchStarted]);

  useEffect(() => {
    if (
      launchStarted &&
      frozenSelection &&
      history.length === 0 &&
      !hasTriggeredOverviewRef.current
    ) {
      hasTriggeredOverviewRef.current = true;
      void dispatch(generateAIOverviewThunk(frozenSelection));
    }
  }, [dispatch, launchStarted, frozenSelection, history.length]);

  useEffect(() => {
    // Cmd + Backspace to delete current step
    const listener = (e: KeyboardEvent) => {
      if (
        e.key === "Backspace" &&
        (jetbrains ? e.altKey : isMetaEquivalentKeyPressed(e)) &&
        !e.shiftKey
      ) {
        void dispatch(cancelStream());
      }
    };
    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [isStreaming, jetbrains, isInEdit]);

  const { widget, highlights } = useFindWidget(
    stepsDivRef,
    tabsRef,
    isStreaming,
  );

  const sendInput = useCallback(
    (
      editorState: JSONContent,
      modifiers: InputModifiers,
      index?: number,
      editorToClearOnSend?: Editor,
    ) => {
      const stateSnapshot = reduxStore.getState();
      const latestPendingToolCalls = selectPendingToolCalls(stateSnapshot);
      const latestPendingApplyStates = selectDoneApplyStates(stateSnapshot);
      const isCurrentlyInEdit = stateSnapshot.session.isInEdit;
      const codeToEditSnapshot = stateSnapshot.editModeState.codeToEdit;
      const selectedModelByRole =
        stateSnapshot.config.config.selectedModelByRole;
      const currentMode = stateSnapshot.session.mode;

      // Handle background mode specially
      if (currentMode === "background" && !isCurrentlyInEdit) {
        // Background mode triggers agent creation instead of chat
        const currentOrg = selectCurrentOrg(stateSnapshot);
        const organizationId =
          currentOrg?.id !== "personal" ? currentOrg?.id : undefined;

        setIsCreatingAgent(true);

        // Create agent and track loading state
        void (async () => {
          try {
            // Resolve context items from editor content (same as normal chat)
            const defaultContextProviders =
              stateSnapshot.config.config.experimental?.defaultContext ?? [];

            const { selectedContextItems, selectedCode, content } =
              await resolveEditorContent({
                editorState,
                modifiers,
                ideMessenger,
                defaultContextProviders,
                availableSlashCommands:
                  stateSnapshot.config.config.slashCommands,
                dispatch,
                getState: () => reduxStore.getState(),
              });

            await ideMessenger.request("createBackgroundAgent", {
              content,
              contextItems: selectedContextItems,
              selectedCode,
              organizationId,
            });

            // Clear input only after successful API call
            if (editorToClearOnSend) {
              editorToClearOnSend.commands.clearContent();
            }

            setIsCreatingAgent(false);
          } catch (error) {
            console.error("Failed to create background agent:", error);
            setIsCreatingAgent(false);
          }
        })();

        return;
      }

      // Cancel all pending tool calls
      latestPendingToolCalls.forEach((toolCallState) => {
        dispatch(
          cancelToolCall({
            toolCallId: toolCallState.toolCallId,
          }),
        );
      });

      // Reject all pending apply states
      latestPendingApplyStates.forEach((applyState) => {
        if (applyState.status !== "closed") {
          ideMessenger.post("rejectDiff", applyState);
        }
      });
      const model = isCurrentlyInEdit
        ? (selectedModelByRole.edit ?? selectedModelByRole.chat)
        : selectedModelByRole.chat;

      if (!model) {
        return;
      }

      if (isCurrentlyInEdit && codeToEditSnapshot.length === 0) {
        return;
      }

      if (isCurrentlyInEdit) {
        void dispatch(
          streamEditThunk({
            editorState,
            codeToEdit: codeToEditSnapshot,
          }),
        );
      } else {
        void dispatch(streamResponseThunk({ editorState, modifiers, index }));

        if (editorToClearOnSend) {
          editorToClearOnSend.commands.clearContent();
        }
      }

      // Increment localstorage counter for popup
      const currentCount = getLocalStorage("mainTextEntryCounter");
      if (currentCount) {
        setLocalStorage("mainTextEntryCounter", currentCount + 1);
        if (currentCount === 300) {
          dispatch(setDialogMessage(<FeedbackDialog />));
          dispatch(setShowDialog(true));
        }
      } else {
        setLocalStorage("mainTextEntryCounter", 1);
      }
    },
    [dispatch, ideMessenger, reduxStore, setIsCreatingAgent],
  );

  useWebviewListener(
    "newSession",
    async () => {
      // unwrapResult(response) // errors if session creation failed
      mainTextInputRef.current?.focus?.();
    },
    [mainTextInputRef],
  );

  useWebviewListener(
    "newSession",
    async () => {
      resetLaunch();
    },
    [resetLaunch],
  );

  // Handle partial tool call output for streaming updates
  useWebviewListener(
    "toolCallPartialOutput",
    async (data) => {
      // Update tool call output in Redux store
      dispatch(
        updateToolCallOutput({
          toolCallId: data.toolCallId,
          contextItems: data.contextItems,
        }),
      );
    },
    [dispatch],
  );

  const isLastUserInput = useCallback(
    (index: number): boolean => {
      return !history
        .slice(index + 1)
        .some((entry) => entry.message.role === "user");
    },
    [history],
  );

  const isInHiddenOverviewThread = useCallback(
    (index: number): boolean => {
      for (let i = index; i >= 0; i--) {
        const message = history[i].message;
        if (message.role === "user") {
          const metadata = message.metadata as
            | { source?: string; hiddenInChat?: boolean }
            | undefined;
          return (
            metadata?.source === "overview" && metadata?.hiddenInChat === true
          );
        }
      }
      return false;
    },
    [history],
  );

  const getNearestUserSource = useCallback(
    (index: number): string | undefined => {
      for (let i = index; i >= 0; i--) {
        const message = history[i].message;
        if (message.role === "user") {
          const metadata = message.metadata as { source?: string } | undefined;
          return metadata?.source;
        }
      }
      return undefined;
    },
    [history],
  );

  const insertCommentAboveSelection = useCallback(
    (text: string) => {
      const filepath = frozenSelection?.filepath;
      if (!filepath) return;

      const trimmed = text.trim();
      if (!trimmed) return;

      const line = frozenSelection.range?.start?.line ?? 1;
      const comment = formatComment(trimmed, filepath);
      ideMessenger.post("insertCommentAbove", {
        filepath,
        line,
        comment,
      });
    },
    [frozenSelection, ideMessenger],
  );

  const triggerExplain = useCallback(
    (kind: "api" | "concept" | "usage") => {
      if (!frozenSelection?.content) return;

      const prompts: Record<typeof kind, string> = {
        api: `Briefly describe the public interface of this code — what methods or functions are available, what they accept, and what they return. Keep it short and spoken-style, 3 to 5 sentences. No code snippets, no markdown.\n\n${frozenSelection.content}`,
        concept: `In plain language, explain the key idea or pattern behind this code. Help me understand the "why", not the "how". 2 to 4 sentences, spoken-style. No code snippets, no markdown.\n\n${frozenSelection.content}`,
        usage: `Show me briefly how to use this code in practice. Give one simple example in plain words, then one short code snippet. Keep the explanation to 2 to 3 sentences.\n\n${frozenSelection.content}`,
      };

      const sources: Record<typeof kind, string> = {
        api: "explain-api",
        concept: "explain-concept",
        usage: "explain-usage",
      };

      const editorState: JSONContent = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: prompts[kind],
              },
            ],
          },
        ],
      };

      const modifiers: InputModifiers = {
        useCodebase: false,
        noContext: true,
      };

      void dispatch(
        streamResponseThunk({
          editorState,
          modifiers,
          source: sources[kind],
        }),
      );
    },
    [dispatch, frozenSelection],
  );

  // Voice intent handler — listens for classified voice commands from the backend
  useEffect(() => {
    const handleVoiceIntent = async (event: MessageEvent) => {
      if (event.data?.messageType !== "voiceIntent") return;
      const intent = event.data.data as {
        action: string;
        startLine?: number;
        endLine?: number;
        functionName?: string;
        customPrompt?: string;
        transcript: string;
      };
      console.log("[Voice:Chat] received voiceIntent:", JSON.stringify(intent));

      const currentFile = await ideMessenger.ide.getCurrentFile();

      switch (intent.action) {
        case "select_lines": {
          if (!currentFile?.path || !intent.startLine || !intent.endLine) {
            void ideMessenger.ide.showToast(
              "warning",
              "No file open or invalid lines.",
            );
            break;
          }
          const lineCount = currentFile.contents?.split(/\r?\n/).length ?? 1;
          const s = Math.max(1, Math.min(intent.startLine, lineCount));
          const e = Math.max(s, Math.min(intent.endLine, lineCount));
          console.log("[Voice:Chat] selecting lines", s, "-", e);
          await ideMessenger.ide.showLines(currentFile.path, s - 1, e - 1);
          void ideMessenger.ide.showToast("info", `Selected lines ${s}-${e}`);
          break;
        }

        case "select_all": {
          if (!currentFile?.path || !currentFile.contents) {
            void ideMessenger.ide.showToast("warning", "No file open.");
            break;
          }
          const totalLines = currentFile.contents.split(/\r?\n/).length;
          console.log(
            "[Voice:Chat] selecting entire file, lines 1 -",
            totalLines,
          );
          await ideMessenger.ide.showLines(currentFile.path, 0, totalLines - 1);
          void ideMessenger.ide.showToast(
            "info",
            `Selected entire file (${totalLines} lines)`,
          );
          break;
        }

        case "select_function": {
          if (!currentFile?.path || !intent.functionName) {
            void ideMessenger.ide.showToast(
              "warning",
              "No file open or no function name.",
            );
            break;
          }
          console.log(
            "[Voice:Chat] looking for function:",
            intent.functionName,
          );
          // Use simple text search to find function boundaries
          const lines = (currentFile.contents ?? "").split(/\r?\n/);
          let funcStart = -1;
          let funcEnd = -1;
          let braceDepth = 0;
          const namePattern = new RegExp(
            `\\b${intent.functionName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          );
          for (let i = 0; i < lines.length; i++) {
            if (funcStart === -1 && namePattern.test(lines[i])) {
              funcStart = i;
            }
            if (funcStart !== -1) {
              for (const ch of lines[i]) {
                if (ch === "{") braceDepth++;
                if (ch === "}") braceDepth--;
              }
              if (braceDepth <= 0 && lines[i].includes("}")) {
                funcEnd = i;
                break;
              }
            }
          }
          if (funcStart !== -1) {
            if (funcEnd === -1)
              funcEnd = Math.min(funcStart + 20, lines.length - 1);
            console.log(
              "[Voice:Chat] found function at lines",
              funcStart + 1,
              "-",
              funcEnd + 1,
            );
            await ideMessenger.ide.showLines(
              currentFile.path,
              funcStart,
              funcEnd,
            );
            void ideMessenger.ide.showToast(
              "info",
              `Selected ${intent.functionName} (lines ${funcStart + 1}-${funcEnd + 1})`,
            );
          } else {
            void ideMessenger.ide.showToast(
              "warning",
              `Function "${intent.functionName}" not found.`,
            );
          }
          break;
        }

        case "overview": {
          if (!frozenSelection && !launchStarted) {
            // If no selection frozen yet, trigger startLaunch which freezes current selection
            console.log("[Voice:Chat] triggering startLaunch for overview");
            startLaunch();
          } else if (frozenSelection && !launchStarted) {
            console.log(
              "[Voice:Chat] triggering startLaunch with existing frozen selection",
            );
            startLaunch();
          } else {
            console.log("[Voice:Chat] overview already started");
            void ideMessenger.ide.showToast(
              "info",
              "Overview already in progress.",
            );
          }
          break;
        }

        case "explain_api": {
          if (!frozenSelection?.content || !overviewContent) {
            void ideMessenger.ide.showToast(
              "warning",
              "Please get an overview first before asking for API details.",
            );
            break;
          }
          console.log("[Voice:Chat] triggering explain API");
          triggerExplain("api");
          break;
        }

        case "explain_concept": {
          if (!frozenSelection?.content || !overviewContent) {
            void ideMessenger.ide.showToast(
              "warning",
              "Please get an overview first before asking for concept details.",
            );
            break;
          }
          console.log("[Voice:Chat] triggering explain concept");
          triggerExplain("concept");
          break;
        }

        case "explain_usage": {
          if (!frozenSelection?.content || !overviewContent) {
            void ideMessenger.ide.showToast(
              "warning",
              "Please get an overview first before asking for usage details.",
            );
            break;
          }
          console.log("[Voice:Chat] triggering explain usage");
          triggerExplain("usage");
          break;
        }

        case "inline_comment": {
          // Find the latest assistant message text and insert as inline comment
          let latestAssistant = "";
          for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].message.role === "assistant") {
              latestAssistant = renderChatMessage(history[i].message).trim();
              if (latestAssistant) break;
            }
          }
          if (!latestAssistant) {
            void ideMessenger.ide.showToast(
              "warning",
              "No AI response to insert as comment.",
            );
            break;
          }
          console.log(
            "[Voice:Chat] inserting inline comment, length:",
            latestAssistant.length,
          );
          insertCommentAboveSelection(latestAssistant);
          void ideMessenger.ide.showToast("info", "Inline comment inserted.");
          break;
        }

        case "custom_prompt": {
          if (!frozenSelection?.content || !overviewContent) {
            void ideMessenger.ide.showToast(
              "warning",
              "Please get an overview first before asking custom questions.",
            );
            break;
          }
          if (!intent.customPrompt) break;
          console.log(
            "[Voice:Chat] sending custom prompt:",
            intent.customPrompt,
          );
          const editorState: JSONContent = {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: `${intent.customPrompt}\n\nCode:\n${frozenSelection.content}`,
                  },
                ],
              },
            ],
          };
          void dispatch(
            streamResponseThunk({
              editorState,
              modifiers: { useCodebase: false, noContext: true },
            }),
          );
          break;
        }

        case "unknown":
        default:
          console.log(
            "[Voice:Chat] unknown intent, transcript:",
            intent.transcript,
          );
          void ideMessenger.ide.showToast(
            "info",
            `Didn't understand: "${intent.transcript}"`,
          );
          break;
      }
    };

    window.addEventListener("message", handleVoiceIntent);
    return () => window.removeEventListener("message", handleVoiceIntent);
  }, [
    ideMessenger,
    dispatch,
    frozenSelection,
    launchStarted,
    overviewContent,
    triggerExplain,
    startLaunch,
    insertCommentAboveSelection,
    history,
  ]);

  // Voice TTS: uses global AudioContext unlocked by mic button click in InputToolbar
  const voiceTriggeredRef = useRef(false);
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const wasStreamingRef = useRef(false);

  // Mark voice-triggered actions
  useEffect(() => {
    const markVoice = (event: MessageEvent) => {
      if (event.data?.messageType === "voiceIntent") {
        const action = event.data.data?.action;
        if (
          [
            "overview",
            "explain_api",
            "explain_concept",
            "explain_usage",
            "custom_prompt",
          ].includes(action)
        ) {
          voiceTriggeredRef.current = true;
          console.log("[Voice:TTS] Marked next response as voice-triggered");
        }
      }
    };
    window.addEventListener("message", markVoice);
    return () => window.removeEventListener("message", markVoice);
  }, []);

  // When streaming/overview finishes and it was voice-triggered, speak the response
  const wasGeneratingOverviewRef = useRef(false);
  useEffect(() => {
    const justFinishedStreaming = wasStreamingRef.current && !isStreaming;
    const justFinishedOverview =
      wasGeneratingOverviewRef.current && !isGeneratingAIOverview;
    wasStreamingRef.current = isStreaming;
    wasGeneratingOverviewRef.current = isGeneratingAIOverview;

    if (
      (justFinishedStreaming || justFinishedOverview) &&
      voiceTriggeredRef.current
    ) {
      voiceTriggeredRef.current = false;
      let latestText = "";
      if (justFinishedOverview && overviewContent) {
        latestText = overviewContent;
      } else {
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].message.role === "assistant") {
            latestText = renderChatMessage(history[i].message).trim();
            if (latestText) break;
          }
        }
      }
      if (latestText) {
        console.log(
          "[Voice:TTS] Response finished, requesting TTS for",
          latestText.length,
          "chars",
        );
        void ideMessenger.post("voiceTtsSpeak", { text: latestText });
      }
    }
  }, [
    isStreaming,
    isGeneratingAIOverview,
    history,
    ideMessenger,
    overviewContent,
  ]);

  // Stop any current TTS playback
  const stopTtsPlayback = useCallback(() => {
    if (ttsSourceRef.current) {
      try {
        ttsSourceRef.current.stop();
      } catch {}
      ttsSourceRef.current = null;
      console.log("[Voice:TTS] Playback stopped");
    }
  }, []);

  // Play TTS audio via AudioContext when received, handle user interrupt
  useEffect(() => {
    const handleTtsAudio = async (event: MessageEvent) => {
      if (event.data?.messageType === "voiceTtsAudio") {
        const { audioBase64 } = event.data.data as {
          audioBase64: string;
          mimeType: string;
        };
        console.log("[Voice:TTS] Received audio, decoding...");

        if (!voiceAudioContext || voiceAudioContext.state === "closed") {
          console.log(
            "[Voice:TTS] No AudioContext available (mic not clicked yet?)",
          );
          return;
        }
        if (voiceAudioContext.state === "suspended") {
          void voiceAudioContext.resume();
        }
        const ctx = voiceAudioContext;
        stopTtsPlayback();

        try {
          const binaryStr = atob(audioBase64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          ttsSourceRef.current = source;
          source.onended = () => {
            console.log("[Voice:TTS] Playback finished");
            ttsSourceRef.current = null;
          };
          source.start();
          console.log(
            "[Voice:TTS] Playing audio, duration:",
            audioBuffer.duration.toFixed(1),
            "s",
          );
        } catch (err: any) {
          console.log("[Voice:TTS] Decode/play error:", err.message);
        }
      }

      // User started speaking — interrupt TTS playback
      if (
        event.data?.messageType === "voiceSelectionTranscript" ||
        event.data?.messageType === "voiceIntent"
      ) {
        stopTtsPlayback();
      }
    };

    window.addEventListener("message", handleTtsAudio);
    return () => window.removeEventListener("message", handleTtsAudio);
  }, [stopTtsPlayback]);

  const renderChatHistoryItem = useCallback(
    (item: ChatHistoryItemWithMessageId, index: number) => {
      if (isInHiddenOverviewThread(index)) {
        return null;
      }

      const {
        message,
        editorState,
        contextItems,
        appliedRules,
        toolCallStates,
      } = item;

      // Calculate once for the entire function
      const latestSummaryIndex = findLatestSummaryIndex(history);
      const isBeforeLatestSummary =
        latestSummaryIndex !== -1 && index < latestSummaryIndex;

      if (message.role === "user") {
        const metadata = message.metadata as { source?: string } | undefined;
        if (metadata?.source?.startsWith("explain-")) {
          return null;
        }

        return (
          <ContinueInputBox
            onEnter={(editorState, modifiers) =>
              sendInput(editorState, modifiers, index)
            }
            isLastUserInput={isLastUserInput(index)}
            isMainInput={false}
            editorState={editorState ?? item.message.content}
            contextItems={contextItems}
            appliedRules={appliedRules}
            inputId={message.id}
          />
        );
      }

      if (message.role === "tool") {
        return null;
      }

      if (message.role === "assistant") {
        const explainSource = getNearestUserSource(index);
        const explainLabel = explainSource
          ? EXPLAIN_SOURCE_LABELS[explainSource]
          : undefined;
        const assistantText = renderChatMessage(message).trim();

        if (explainLabel && assistantText.length === 0) {
          return null;
        }

        return (
          <>
            {explainLabel && (
              <div className="mb-1 flex items-center justify-between px-4 pt-2 text-sm font-semibold text-white/85">
                <span>{explainLabel}</span>
                <button
                  onClick={() => {
                    insertCommentAboveSelection(assistantText);
                  }}
                  className="group flex items-center gap-2 rounded-full border border-[rgb(62,106,225)] bg-[rgb(62,106,225)] px-3 py-1 text-xs font-bold text-white transition-all hover:bg-[rgb(62,106,225,0.85)]"
                >
                  <span className="text-base font-bold">+</span>
                  <span>Inline Comment</span>
                </button>
              </div>
            )}
            {/* Always render assistant content through normal path */}
            <div className="thread-message">
              <TimelineItem
                item={item}
                iconElement={
                  <ChatBubbleOvalLeftIcon width="16px" height="16px" />
                }
                open={
                  typeof stepsOpen[index] === "undefined"
                    ? true
                    : stepsOpen[index]!
                }
                onToggle={() => {}}
              >
                <StepContainer
                  index={index}
                  isLast={index === history.length - 1}
                  item={item}
                  latestSummaryIndex={latestSummaryIndex}
                />
              </TimelineItem>
            </div>

            {explainLabel && (
              <div className="mb-2 mt-1 flex items-center justify-between px-4">
                <span className="text-sm font-medium text-white/80">
                  Explain more about
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => triggerExplain("api")}
                    className="rounded-full border border-[rgb(62,106,225)] bg-[rgb(62,106,225)] px-3 py-1 text-xs font-bold text-white transition-all hover:bg-[rgb(62,106,225,0.85)]"
                  >
                    API
                  </button>
                  <button
                    onClick={() => triggerExplain("concept")}
                    className="rounded-full border border-[rgb(62,106,225)] bg-[rgb(62,106,225)] px-3 py-1 text-xs font-bold text-white transition-all hover:bg-[rgb(62,106,225,0.85)]"
                  >
                    Concept
                  </button>
                  <button
                    onClick={() => triggerExplain("usage")}
                    className="rounded-full border border-[rgb(62,106,225)] bg-[rgb(62,106,225)] px-3 py-1 text-xs font-bold text-white transition-all hover:bg-[rgb(62,106,225,0.85)]"
                  >
                    Usage
                  </button>
                </div>
              </div>
            )}

            {toolCallStates && (
              <ToolCallDiv
                toolCallStates={toolCallStates}
                historyIndex={index}
              />
            )}
          </>
        );
      }

      if (message.role === "thinking") {
        return (
          <div className={isBeforeLatestSummary ? "opacity-50" : ""}>
            <ThinkingBlockPeek
              content={renderChatMessage(message)}
              redactedThinking={message.redactedThinking}
              index={index}
              prevItem={index > 0 ? history[index - 1] : null}
              inProgress={index === history.length - 1 && isStreaming}
              signature={message.signature}
            />
          </div>
        );
      }

      // Default case - regular assistant message
      return (
        <div className="thread-message">
          <TimelineItem
            item={item}
            iconElement={<ChatBubbleOvalLeftIcon width="16px" height="16px" />}
            open={
              typeof stepsOpen[index] === "undefined" ? true : stepsOpen[index]!
            }
            onToggle={() => {}}
          >
            <StepContainer
              index={index}
              isLast={index === history.length - 1}
              item={item}
              latestSummaryIndex={latestSummaryIndex}
            />
          </TimelineItem>
        </div>
      );
    },
    [
      sendInput,
      isLastUserInput,
      history,
      stepsOpen,
      isStreaming,
      isInHiddenOverviewThread,
      getNearestUserSource,
      insertCommentAboveSelection,
      triggerExplain,
    ],
  );

  const showScrollbar = showChatScrollbar ?? window.innerHeight > 5000;

  return (
    <>
      {!!showSessionTabs && !isInEdit && <TabBar ref={tabsRef} />}
      {widget}

      <StepsDiv
        ref={stepsDivRef}
        className={`overflow-y-scroll pt-[8px] ${showScrollbar ? "thin-scrollbar" : "no-scrollbar"} ${history.length > 0 || launchStarted ? "flex-1" : ""}`}
      >
        {launchStarted && frozenSelection && (
          <>
            <div className="px-2 pb-2">
              <SelectionContextDisplay selection={frozenSelection} />
            </div>
            <div className="px-2 pb-2">
              <AIOverviewStyle1
                content={overviewContent}
                isGenerating={isGeneratingAIOverview}
                onInsertComment={() => {
                  if (!overviewContent) return;
                  insertCommentAboveSelection(
                    typeof overviewContent === "string" ? overviewContent : "",
                  );
                  setCommentInserted(true);
                }}
                commentInserted={commentInserted}
                onExplainAPI={() => triggerExplain("api")}
                onExplainConcept={() => triggerExplain("concept")}
                onExplainUsage={() => triggerExplain("usage")}
              />
            </div>
          </>
        )}
        {highlights}
        {history
          .filter((item) => item.message.role !== "system")
          .map((item, index: number) => (
            <div
              key={item.message.id}
              style={{
                minHeight: index === history.length - 1 ? "200px" : 0,
              }}
            >
              <ErrorBoundary
                FallbackComponent={fallbackRender}
                onReset={() => {
                  dispatch(newSession());
                }}
              >
                {renderChatHistoryItem(item, index)}
              </ErrorBoundary>
              {index === history.length - 1 && <InlineErrorMessage />}
            </div>
          ))}
      </StepsDiv>
      <div className={"relative"}>
        <ContinueInputBox
          isMainInput
          isLastUserInput={false}
          onEnter={(editorState, modifiers, editor) =>
            sendInput(editorState, modifiers, undefined, editor)
          }
          inputId={MAIN_EDITOR_INPUT_ID}
        />

        <CliInstallBanner
          sessionCount={allSessionMetadata.length}
          sessionThreshold={3}
          permanentDismissal={true}
        />

        <div
          style={{
            pointerEvents: isStreaming ? "none" : "auto",
          }}
        >
          <div className="flex flex-row items-center justify-between pb-1 pl-0.5 pr-2">
            <div className="xs:inline hidden">
              {history.length === 0 && lastSessionId && !isInEdit && (
                <NewSessionButton
                  onClick={async () => {
                    await dispatch(loadLastSession());
                  }}
                  className="flex items-center gap-2"
                >
                  <ArrowLeftIcon className="h-3 w-3" />
                  <span className="text-xs">Last Session</span>
                </NewSessionButton>
              )}
            </div>
          </div>
          <FatalErrorIndicator />
          {!hasDismissedExploreDialog && <ExploreDialogWatcher />}
          {mode === "background" ? (
            <BackgroundModeView isCreatingAgent={isCreatingAgent} />
          ) : (
            history.length === 0 &&
            !launchStarted && (
              <EmptyChatBody showOnboardingCard={onboardingCard.show} />
            )
          )}
        </div>
      </div>
    </>
  );
}
