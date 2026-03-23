import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ChatBubbleOvalLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  XMarkIcon,
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
import { useFindWidget } from "../../components/find/FindWidget";
import TimelineItem from "../../components/gui/TimelineItem";
import { NewSessionButton } from "../../components/mainInput/belowMainInput/NewSessionButton";
import ThinkingBlockPeek from "../../components/mainInput/belowMainInput/ThinkingBlockPeek";
import ContinueInputBox from "../../components/mainInput/ContinueInputBox";
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
import { loadLastSession } from "../../redux/thunks/session";
import { streamResponseThunk } from "../../redux/thunks/streamResponse";
import { isJetBrains, isMetaEquivalentKeyPressed } from "../../util";
import { ToolCallDiv } from "./ToolCallDiv";

import { useStore } from "react-redux";
import { BackgroundModeView } from "../../components/BackgroundMode/BackgroundModeView";
import FeedbackDialog from "../../components/dialogs/FeedbackDialog";

import { selectSelectedChatModel } from "../../redux/slices/configSlice";
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

const quickActions = [
  {
    label: "Overview",
    codebasePrompt:
      "In 4 concise bullets, summarize this codebase: purpose, key folders, main execution flow, and where to start. Keep it under 90 words.",
    selectedCodePrompt:
      "In 4 concise bullets, summarize this selected code: purpose, inputs/outputs, core logic, and important dependencies. Keep it under 70 words.",
  },
  {
    label: "API",
    codebasePrompt:
      "Find and explain the main API endpoints in this codebase - what are they and how do they work?",
    selectedCodePrompt:
      "Find and explain the API endpoints in this selected code - what are they and how do they work?",
  },
  {
    label: "Concept",
    codebasePrompt:
      "Explain the key concepts and architecture patterns used in this codebase.",
    selectedCodePrompt:
      "Explain the key concepts and patterns demonstrated in this selected code.",
  },
  {
    label: "Usage",
    codebasePrompt:
      "Find and explain how this codebase is typically used - show example usage patterns and common workflows.",
    selectedCodePrompt:
      "Find and explain how this selected code is typically used - show example usage patterns.",
  },
];

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
  const showSessionTabs = useAppSelector(
    (store) => store.config.config.ui?.showSessionTabs,
  );
  const isStreaming = useAppSelector((state) => state.session.isStreaming);
  const [stepsOpen] = useState<(boolean | undefined)[]>([]);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [overviewText, setOverviewText] = useState("");
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [overviewDismissed, setOverviewDismissed] = useState(false);
  const hasAutoTriggeredOverview = useRef(false);
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
  const currentOrg = useAppSelector(selectCurrentOrg);
  const jetbrains = useMemo(() => {
    return isJetBrains();
  }, []);

  useAutoScroll(stepsDivRef, history);

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

  const renderChatHistoryItem = useCallback(
    (item: ChatHistoryItemWithMessageId, index: number) => {
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
        return (
          <>
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
    [sendInput, isLastUserInput, history, stepsOpen, isStreaming],
  );

  const showScrollbar = showChatScrollbar ?? window.innerHeight > 5000;
  const overviewAction = quickActions.find((a) => a.label === "Overview");
  const detailQuickActions = quickActions.filter((a) => a.label !== "Overview");

  const selectedModel = useAppSelector(selectSelectedChatModel);

  const requestOverview = useCallback(async () => {
    if (!overviewAction || isOverviewLoading) {
      return;
    }

    setIsOverviewLoading(true);

    try {
      const contextResult = await ideMessenger.request("overview/query", {
        codebasePrompt: overviewAction.codebasePrompt,
        selectedCodePrompt: overviewAction.selectedCodePrompt,
      });

      if (contextResult.status !== "success") {
        setOverviewText("Failed to get context.");
        return;
      }

      const { prompt, context } = contextResult.content;
      let fullPrompt = prompt;
      if (context) {
        fullPrompt += `\n\nFile: ${context.filepath}\n\`\`\`\n${context.contents}\n\`\`\``;
      }

      const llmResult = await ideMessenger.request("llm/complete", {
        prompt: fullPrompt,
        completionOptions: { maxTokens: 500 },
        title: selectedModel?.title ?? "",
      });

      if (llmResult.status === "success") {
        setOverviewText(llmResult.content);
      } else {
        setOverviewText("Failed to generate overview.");
      }
    } catch {
      setOverviewText("Failed to generate overview.");
    } finally {
      setIsOverviewLoading(false);
    }
  }, [overviewAction, isOverviewLoading, ideMessenger, selectedModel]);

  useEffect(() => {
    if (hasAutoTriggeredOverview.current || isInEdit || !overviewAction) {
      return;
    }

    hasAutoTriggeredOverview.current = true;
    void requestOverview();
  }, [isInEdit, overviewAction, requestOverview]);

  return (
    <>
      {!!showSessionTabs && !isInEdit && <TabBar ref={tabsRef} />}
      {widget}

      {!isInEdit && overviewAction && !overviewDismissed && (
        <div className="sticky top-0 z-20 border-b border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editorWidget-background)]">
          {/* Compact header bar */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <button
              onClick={() => setOverviewExpanded(!overviewExpanded)}
              className="flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[var(--vscode-foreground)] opacity-70 transition-opacity duration-150 hover:opacity-100"
            >
              {overviewExpanded ? (
                <ChevronDownIcon className="h-3 w-3" />
              ) : (
                <ChevronRightIcon className="h-3 w-3" />
              )}
              <span className="text-xs font-medium">Overview</span>
            </button>

            {/* One-liner preview when collapsed */}
            {!overviewExpanded && overviewText.length > 0 && (
              <span className="truncate px-1 text-[11px] leading-5 text-[var(--vscode-foreground)] opacity-50">
                {overviewText.split("\n")[0]}
              </span>
            )}

            {!overviewExpanded && isOverviewLoading && (
              <span className="animate-pulse px-1 text-[11px] leading-5 text-[var(--vscode-foreground)] opacity-40">
                Generating...
              </span>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Action buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={requestOverview}
                title="Refresh Overview"
                className="flex cursor-pointer items-center rounded border-none bg-transparent p-1 text-[var(--vscode-foreground)] opacity-40 transition-opacity duration-150 hover:opacity-70"
              >
                <ArrowPathIcon className="h-3 w-3" />
              </button>
              <button
                onClick={() => setOverviewDismissed(true)}
                title="Dismiss"
                className="flex cursor-pointer items-center rounded border-none bg-transparent p-1 text-[var(--vscode-foreground)] opacity-40 transition-opacity duration-150 hover:opacity-70"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Expanded full content */}
          {overviewExpanded && (
            <div className="max-h-40 overflow-y-auto border-t border-[var(--vscode-editorWidget-border)] bg-[var(--vscode-editor-background)] px-3 py-2 text-[11px] leading-[18px] text-[var(--vscode-foreground)] opacity-85">
              {isOverviewLoading && (
                <span className="animate-pulse opacity-50">
                  Generating overview...
                </span>
              )}
              {!isOverviewLoading && overviewText.length === 0 && (
                <span className="opacity-40">
                  Overview appears here. Refresh to generate.
                </span>
              )}
              {!isOverviewLoading && overviewText.length > 0 && (
                <span className="whitespace-pre-wrap">{overviewText}</span>
              )}
            </div>
          )}
        </div>
      )}

      <StepsDiv
        ref={stepsDivRef}
        className={`overflow-y-scroll pt-[8px] ${showScrollbar ? "thin-scrollbar" : "no-scrollbar"} ${history.length > 0 ? "flex-1" : ""}`}
      >
        {highlights}
        {history.map((item, index: number) => {
          if (item.message.role === "system") {
            return null;
          }

          return (
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
          );
        })}
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
            history.length === 0 && (
              <EmptyChatBody showOnboardingCard={onboardingCard.show} />
            )
          )}
        </div>

        {!isInEdit && detailQuickActions.length > 0 && (
          <div className="flex flex-row items-center justify-center gap-2 px-1 pb-1 pt-2">
            <span className="text-[11px] text-[var(--vscode-descriptionForeground)]">
              Quick Actions:
            </span>
            {detailQuickActions.map(
              ({ label, codebasePrompt, selectedCodePrompt }) => (
                <button
                  key={label}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-md border border-[var(--vscode-focusBorder)] bg-transparent px-2.5 py-1 text-[11px] font-medium text-[var(--vscode-foreground)] opacity-60 transition-all duration-150 hover:opacity-100`}
                  onClick={() => {
                    void ideMessenger.request(
                      "quickAction" as any,
                      {
                        codebasePrompt,
                        selectedCodePrompt,
                      } as any,
                    );
                  }}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </>
  );
}
