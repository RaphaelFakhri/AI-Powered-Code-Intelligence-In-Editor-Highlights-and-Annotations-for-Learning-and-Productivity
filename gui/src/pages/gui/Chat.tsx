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
      void ideMessenger.post("researchLogEvent", {
        category: "ai",
        event: "overview_requested",
        data: {
          file: frozenSelection.filepath,
          start_line: frozenSelection.range?.start?.line ?? 0,
          end_line: frozenSelection.range?.end?.line ?? 0,
          length: frozenSelection.content?.length ?? 0,
        },
      });
      void dispatch(generateAIOverviewThunk(frozenSelection));
    }
  }, [dispatch, launchStarted, frozenSelection, history.length, ideMessenger]);

  // Log when an AI overview response arrives (assistant message after overview request)
  useEffect(() => {
    if (overviewContent) {
      void ideMessenger.post("researchLogEvent", {
        category: "ai",
        event: "overview_received",
        data: {
          length: overviewContent.length,
          file: frozenSelection?.filepath,
        },
      });
    }
  }, [overviewContent, ideMessenger, frozenSelection]);

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

      // Research telemetry: log prompt with type label and active file
      void (async () => {
        try {
          const hasMentions = (node: any): boolean => {
            if (!node || typeof node !== "object") return false;
            if (node.type === "mention" || node.type === "codeBlock")
              return true;
            if (Array.isArray(node.content)) {
              for (const c of node.content) if (hasMentions(c)) return true;
            }
            return false;
          };
          const extractText = (node: any): string => {
            if (!node || typeof node !== "object") return "";
            let out = "";
            if (typeof node.text === "string") out += node.text;
            if (Array.isArray(node.content)) {
              for (const c of node.content) out += extractText(c);
            }
            return out;
          };
          const historyLen = stateSnapshot.session.history.length;
          const hasCtx = hasMentions(editorState);
          // Mutually exclusive priority: Followup > Context > Prompt
          let promptType: "prompt" | "prompt_context" | "prompt_followup";
          if (historyLen > 0) promptType = "prompt_followup";
          else if (hasCtx) promptType = "prompt_context";
          else promptType = "prompt";

          const text = extractText(editorState);
          const currentFile = await ideMessenger.ide.getCurrentFile();
          void ideMessenger.post("researchLogEvent", {
            category: "ai",
            event: "prompt_sent",
            data: {
              prompt_type: promptType,
              has_context: hasCtx,
              is_followup: historyLen > 0,
              prompt_length: text.length,
              file: currentFile?.path,
              mode: currentMode,
              in_edit: isCurrentlyInEdit,
            },
          });
        } catch {}
      })();

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
      void ideMessenger.post("researchLogEvent", {
        category: "ai",
        event: "inline_comment_inserted",
        data: {
          target_line: line,
          comment_length: trimmed.length,
          file: filepath,
        },
      });
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

      void ideMessenger.post("researchLogEvent", {
        category: "ai",
        event: "explain_clicked",
        data: {
          type: kind,
          selection_length: frozenSelection.content.length,
          file: frozenSelection.filepath,
        },
      });

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
          let e = Math.max(s, Math.min(intent.endLine, lineCount));
          // Single-line selections don't visibly highlight via showLines —
          // extend by one line so the selection is actually visible.
          if (e === s && e < lineCount) {
            e = s + 1;
          }
          console.log("[Voice:Chat] selecting lines", s, "-", e);
          await ideMessenger.ide.showLines(currentFile.path, s - 1, e - 1);
          // Research telemetry: log the resulting selection as method=voice
          void ideMessenger.post("researchLogEvent", {
            category: "selection",
            event: "selection_changed",
            data: {
              method: "voice",
              file: currentFile.path.split(/[\\/]/).pop(),
              start_line: s,
              end_line: e,
              transcript: intent.transcript,
            },
          });
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
          void ideMessenger.post("researchLogEvent", {
            category: "selection",
            event: "selection_changed",
            data: {
              method: "voice",
              file: currentFile.path.split(/[\\/]/).pop(),
              start_line: 1,
              end_line: totalLines,
              transcript: intent.transcript,
            },
          });
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
              "No file open or no name.",
            );
            break;
          }
          console.log("[Voice:Chat] looking for symbol:", intent.functionName);
          const lines = (currentFile.contents ?? "").split(/\r?\n/);

          // ── Generate candidate name variants ──
          // Voice transcripts strip underscores: "scores data" → ["scores_data",
          // "scoresData", "ScoresData", "scoresdata", "scores data"]
          const raw = intent.functionName.trim();
          const words = raw.split(/[\s_-]+/).filter(Boolean);
          const variants = new Set<string>();
          variants.add(raw);
          if (words.length > 1) {
            variants.add(words.join("_"));
            variants.add(words.join(""));
            variants.add(
              words[0].toLowerCase() +
                words
                  .slice(1)
                  .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
                  .join(""),
            );
            variants.add(
              words
                .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
                .join(""),
            );
          }

          const escapeRe = (s: string) =>
            s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

          // ── Try each variant against prioritized declaration patterns ──
          // Priority: class/struct > def/function > Python assignment >
          // const/let/var > function call > any occurrence.
          let funcStart = -1;
          let matchedVariant = raw;
          outer: for (const variant of variants) {
            const escaped = escapeRe(variant);
            const declPatterns: RegExp[] = [
              new RegExp(
                `\\b(?:class|interface|struct|enum|trait|record)\\s+${escaped}\\b`,
                "i",
              ),
              new RegExp(
                `\\b(?:function|func|fn|def|sub)\\s+${escaped}\\b`,
                "i",
              ),
              // Python-style top-level or indented assignment: `name = ...`
              new RegExp(`^\\s*${escaped}\\s*=`, "i"),
              new RegExp(`\\b(?:const|let|var)\\s+${escaped}\\s*[:=]`, "i"),
              new RegExp(`\\b${escaped}\\s*\\(`, "i"),
              new RegExp(`\\b${escaped}\\b`, "i"),
            ];
            for (const pat of declPatterns) {
              for (let i = 0; i < lines.length; i++) {
                if (pat.test(lines[i])) {
                  funcStart = i;
                  matchedVariant = variant;
                  break outer;
                }
              }
            }
          }

          // ── Fuzzy fallback: each word in the query becomes a prefix match.
          // Handles voice transcription dropping trailing 's' or other small
          // word-ending differences. e.g. "for subject in subject" matches
          // "for subject in subjects". Also handles ±1 trailing-char drift.
          if (funcStart === -1 && words.length >= 1) {
            const fuzzyPattern = new RegExp(
              "\\b" +
                words.map((w) => `${escapeRe(w)}\\w{0,3}`).join("\\s+") +
                "\\b",
              "i",
            );
            console.log(
              "[Voice:Chat] fuzzy fallback pattern:",
              fuzzyPattern.source,
            );
            for (let i = 0; i < lines.length; i++) {
              if (fuzzyPattern.test(lines[i])) {
                funcStart = i;
                matchedVariant = raw;
                break;
              }
            }
          }

          let funcEnd = -1;
          if (funcStart !== -1) {
            const startLine = lines[funcStart];
            // Detect any opening bracket: {, [, or (
            const bracketMatch = startLine.match(/[{[(]/);
            const nextLineBracket =
              funcStart + 1 < lines.length &&
              /^\s*[{[(]/.test(lines[funcStart + 1]);
            const hasBrackets = !!bracketMatch || nextLineBracket;

            if (hasBrackets) {
              // Bracket-balanced block: track {}, [], () depth across lines.
              const open = "{[(";
              const close = "}])";
              let depth = 0;
              let started = false;
              let inString: string | null = null;
              for (let i = funcStart; i < lines.length; i++) {
                for (let c = 0; c < lines[i].length; c++) {
                  const ch = lines[i][c];
                  if (inString) {
                    if (ch === inString && lines[i][c - 1] !== "\\") {
                      inString = null;
                    }
                    continue;
                  }
                  if (ch === '"' || ch === "'") {
                    inString = ch;
                    continue;
                  }
                  if (open.includes(ch)) {
                    depth++;
                    started = true;
                  } else if (close.includes(ch)) {
                    depth--;
                  }
                }
                if (started && depth <= 0) {
                  funcEnd = i;
                  break;
                }
              }
            } else {
              // Indent-based (Python def/class without brackets, or single-line
              // assignment).
              const baseIndent = (startLine.match(/^\s*/)?.[0] ?? "").length;
              funcEnd = funcStart;
              for (let i = funcStart + 1; i < lines.length; i++) {
                if (lines[i].trim() === "") continue;
                const indent = (lines[i].match(/^\s*/)?.[0] ?? "").length;
                if (indent <= baseIndent) {
                  funcEnd = i - 1;
                  break;
                }
                funcEnd = i;
              }
              while (funcEnd > funcStart && lines[funcEnd].trim() === "") {
                funcEnd--;
              }
            }
          }
          if (funcStart !== -1) {
            if (funcEnd === -1 || funcEnd < funcStart)
              funcEnd = Math.min(funcStart + 20, lines.length - 1);
            // Single-line matches don't visibly highlight via showLines —
            // extend by one line so the selection is actually visible.
            if (funcEnd === funcStart && funcStart + 1 < lines.length) {
              funcEnd = funcStart + 1;
            }
            console.log(
              "[Voice:Chat] found",
              matchedVariant,
              "at lines",
              funcStart + 1,
              "-",
              funcEnd + 1,
            );
            await ideMessenger.ide.showLines(
              currentFile.path,
              funcStart,
              funcEnd,
            );
            void ideMessenger.post("researchLogEvent", {
              category: "selection",
              event: "selection_changed",
              data: {
                method: "voice",
                file: currentFile.path.split(/[\\/]/).pop(),
                start_line: funcStart + 1,
                end_line: funcEnd + 1,
                matched_name: matchedVariant,
                transcript: intent.transcript,
              },
            });
            void ideMessenger.ide.showToast(
              "info",
              `Selected ${matchedVariant} (lines ${funcStart + 1}-${funcEnd + 1})`,
            );
          } else {
            void ideMessenger.ide.showToast(
              "warning",
              `"${intent.functionName}" not found.`,
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

  // ─── Gaze: dot + button hover in sidebar webview ────────────────
  const gazeHoverRef = useRef<{ action: string; since: number } | null>(null);
  const gazeDotRef = useRef<HTMLDivElement | null>(null);
  const gazeDwellMsRef = useRef(1500);
  const gazeHitRadiusRef = useRef(40);

  // Gaze active tracking
  const [gazeActive, setGazeActive] = useState(false);
  const gazeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for gaze calibration updates from BlockSettingsTopToolbar
  const [gazeCalibDots, setGazeCalibDots] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.dwellMs !== undefined) gazeDwellMsRef.current = detail.dwellMs;
      if (detail.hitRadius !== undefined)
        gazeHitRadiusRef.current = detail.hitRadius;
    };
    const dotsHandler = (e: Event) => {
      setGazeCalibDots((e as CustomEvent).detail.show);
    };
    window.addEventListener("gazeCalibrationUpdate", handler);
    window.addEventListener("gazeCalibrationDots", dotsHandler);
    return () => {
      window.removeEventListener("gazeCalibrationUpdate", handler);
      window.removeEventListener("gazeCalibrationDots", dotsHandler);
    };
  }, []);

  useEffect(() => {
    // Create gaze dot element
    let dot = document.getElementById("gaze-dot") as HTMLDivElement | null;
    if (!dot) {
      dot = document.createElement("div");
      dot.id = "gaze-dot";
      dot.style.cssText =
        "position:fixed;width:16px;height:16px;border-radius:50%;background:rgba(255,60,60,0.7);" +
        "border:2px solid rgba(255,255,255,0.8);pointer-events:none;z-index:99999;display:none;" +
        "box-shadow:0 0 8px rgba(255,60,60,0.5);transition:left 0.05s linear,top 0.05s linear;";
      document.body.appendChild(dot);
    }
    gazeDotRef.current = dot;

    const handleGazeUpdate = (event: MessageEvent) => {
      if (event.data?.messageType !== "gazeUpdate") return;
      const { x, y } = event.data.data as { x: number; y: number };

      // Track gaze active state (hide after 2s of no updates)
      setGazeActive(true);
      if (gazeTimeoutRef.current) clearTimeout(gazeTimeoutRef.current);
      gazeTimeoutRef.current = setTimeout(() => setGazeActive(false), 2000);

      const webviewX = x * window.innerWidth;
      const webviewY = y * window.innerHeight;

      // Update dot position
      if (gazeDotRef.current) {
        gazeDotRef.current.style.display = "block";
        gazeDotRef.current.style.left = `${webviewX - 8}px`;
        gazeDotRef.current.style.top = `${webviewY - 8}px`;
      }

      // Check proximity to gaze-enabled buttons
      const gazeButtons =
        document.querySelectorAll<HTMLElement>("[data-gaze-action]");
      let hoveredAction: string | null = null;

      for (const btn of gazeButtons) {
        const rect = btn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dist = Math.sqrt(
          (webviewX - centerX) ** 2 + (webviewY - centerY) ** 2,
        );
        const hitRadius = Math.max(
          gazeHitRadiusRef.current,
          rect.width / 2,
          rect.height / 2,
        );

        if (dist < hitRadius) {
          hoveredAction = btn.dataset.gazeAction || null;
          btn.style.outline = "2px solid rgba(255, 100, 100, 0.8)";
          btn.style.outlineOffset = "2px";
        } else {
          btn.style.outline = "";
          btn.style.outlineOffset = "";
        }
      }

      const now = Date.now();
      if (hoveredAction) {
        if (gazeHoverRef.current?.action === hoveredAction) {
          if (now - gazeHoverRef.current.since >= gazeDwellMsRef.current) {
            console.log("[Gaze:GUI] Button triggered:", hoveredAction);
            void ideMessenger.post("researchLogEvent", {
              category: "gaze",
              event: "button_dwell_triggered",
              data: { action: hoveredAction },
            });
            gazeHoverRef.current = null;
            switch (hoveredAction) {
              case "overview":
                startLaunch();
                break;
              case "explain_api":
                triggerExplain("api");
                break;
              case "explain_concept":
                triggerExplain("concept");
                break;
              case "explain_usage":
                triggerExplain("usage");
                break;
            }
            gazeButtons.forEach((b) => {
              b.style.outline = "";
              b.style.outlineOffset = "";
            });
          }
        } else {
          gazeHoverRef.current = { action: hoveredAction, since: now };
        }
      } else {
        gazeHoverRef.current = null;
      }
    };

    window.addEventListener("message", handleGazeUpdate);
    return () => {
      window.removeEventListener("message", handleGazeUpdate);
      if (gazeDotRef.current) {
        gazeDotRef.current.style.display = "none";
      }
    };
  }, [startLaunch, triggerExplain]);

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
                    data-gaze-action="explain_api"
                    className="rounded-full border border-[rgb(62,106,225)] bg-[rgb(62,106,225)] px-3 py-1 text-xs font-bold text-white transition-all hover:bg-[rgb(62,106,225,0.85)]"
                  >
                    API
                  </button>
                  <button
                    onClick={() => triggerExplain("concept")}
                    data-gaze-action="explain_concept"
                    className="rounded-full border border-[rgb(62,106,225)] bg-[rgb(62,106,225)] px-3 py-1 text-xs font-bold text-white transition-all hover:bg-[rgb(62,106,225,0.85)]"
                  >
                    Concept
                  </button>
                  <button
                    onClick={() => triggerExplain("usage")}
                    data-gaze-action="explain_usage"
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

      {/* Gaze calibration target dots */}
      {gazeCalibDots && (
        <>
          {[
            { top: "30%", left: "10%" },
            { top: "60%", left: "50%" },
            { bottom: "10%", left: "10%" },
            { bottom: "10%", right: "10%" },
          ].map((pos, i) => (
            <div
              key={i}
              style={{
                position: "fixed",
                ...pos,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "rgba(0, 255, 100, 0.8)",
                border: "2px solid white",
                boxShadow: "0 0 12px rgba(0, 255, 100, 0.6)",
                zIndex: 99997,
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "white",
                }}
              />
            </div>
          ))}
        </>
      )}

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
