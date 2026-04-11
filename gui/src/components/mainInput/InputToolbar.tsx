import {
  AtSymbolIcon,
  EyeIcon,
  EyeSlashIcon,
  MicrophoneIcon,
  PhotoIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import { AssistantAndOrgListbox } from "../AssistantAndOrgListbox";
import { InputModifiers } from "core";
import { modelSupportsImages } from "core/llm/autodetect";
import { Message } from "core/protocol/messenger";
import { ToWebviewProtocol } from "core/protocol/index.js";
import { memo, useContext, useEffect, useRef, useState } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectUseActiveFile } from "../../redux/selectors";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { exitEdit } from "../../redux/thunks/edit";
// Voice intents are now classified by LLM on the backend and handled in Chat.tsx

// Global AudioContext for TTS playback — must be created/resumed during user gesture
export let voiceAudioContext: AudioContext | null = null;
function ensureVoiceAudioContext() {
  if (!voiceAudioContext) {
    voiceAudioContext = new AudioContext();
    console.log("[Voice:TTS] AudioContext created from user gesture");
  }
  if (voiceAudioContext.state === "suspended") {
    void voiceAudioContext.resume();
    console.log("[Voice:TTS] AudioContext resumed from user gesture");
  }
}
import { getMetaKeyLabel, isMetaEquivalentKeyPressed } from "../../util";
import { ToolTip } from "../gui/Tooltip";
import ModelSelect from "../modelSelection/ModelSelect";
import { ModeSelect } from "../ModeSelect";
import { Button } from "../ui";
import { useFontSize } from "../ui/font";
import ContextStatus from "./ContextStatus";
import HoverItem from "./InputToolbar/HoverItem";

export interface ToolbarOptions {
  hideUseCodebase?: boolean;
  hideImageUpload?: boolean;
  hideAddContext?: boolean;
  enterText?: string;
  hideSelectModel?: boolean;
}

interface InputToolbarProps {
  onEnter?: (modifiers: InputModifiers) => void;
  onAddContextItem?: () => void;
  onClick?: () => void;
  onImageFileSelected?: (file: File) => void;
  hidden?: boolean;
  activeKey: string | null;
  toolbarOptions?: ToolbarOptions;
  disabled?: boolean;
  isMainInput?: boolean;
}

function InputToolbar(props: InputToolbarProps) {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isGazeMode, setIsGazeMode] = useState(false);
  const defaultModel = useAppSelector(selectSelectedChatModel);
  const useActiveFile = useAppSelector(selectUseActiveFile);
  const isInEdit = useAppSelector((store) => store.session.isInEdit);
  const codeToEdit = useAppSelector((store) => store.editModeState.codeToEdit);
  const isEnterDisabled =
    props.disabled || (isInEdit && codeToEdit.length === 0);

  const supportsImages =
    defaultModel &&
    modelSupportsImages(
      defaultModel.provider,
      defaultModel.model,
      defaultModel.title,
      defaultModel.capabilities,
    );

  const smallFont = useFontSize(-2);
  const tinyFont = useFontSize(-3);

  const cleanupVoiceSession = () => {
    console.log("[Voice:GUI] cleanupVoiceSession called");
    void ideMessenger.post("voiceSelectionStop", undefined);
    setIsVoiceListening(false);
  };

  useEffect(() => {
    console.log("[Voice:GUI] useEffect: registering voice status listener");
    const listener = (event: {
      data: Message<ToWebviewProtocol[keyof ToWebviewProtocol][0]>;
    }) => {
      if (event.data.messageType === "voiceSelectionStatus") {
        const payload = event.data
          .data as ToWebviewProtocol["voiceSelectionStatus"][0];
        console.log(
          "[Voice:GUI] received voiceSelectionStatus:",
          JSON.stringify(payload),
        );
        if (payload.state === "listening") {
          setIsVoiceListening(true);
          void ideMessenger.ide.showToast(
            "info",
            "Voice listening... speak a command.",
          );
        } else if (payload.state === "idle") {
          setIsVoiceListening(false);
        } else if (payload.state === "error") {
          setIsVoiceListening(false);
          if (payload.message) {
            void ideMessenger.ide.showToast("error", payload.message);
          }
        }
      }
    };

    // Stop voice process when the webview/window is closing (prevents orphan WebSockets)
    const handleBeforeUnload = () => {
      console.log(
        "[Voice:GUI] beforeunload: stopping voice to prevent orphan WebSockets",
      );
      void ideMessenger.post("voiceSelectionStop", undefined);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    window.addEventListener("message", listener);
    return () => {
      window.removeEventListener("message", listener);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Do NOT call cleanupVoiceSession on React unmount — voice should persist
      // across UI changes (overview, explain, etc.) and only stop
      // when the user explicitly clicks the mic button or the window closes.
    };
  }, [ideMessenger]);

  const handleVoiceSelectionClick = async () => {
    console.log(
      "[Voice:GUI] handleVoiceSelectionClick: isVoiceListening =",
      isVoiceListening,
    );
    void ideMessenger.post("researchLogEvent", {
      category: "ui",
      event: "voice_button_click",
      data: { was_listening: isVoiceListening },
    });
    // Unlock AudioContext on user gesture so TTS can play later
    ensureVoiceAudioContext();
    if (isVoiceListening) {
      cleanupVoiceSession();
      return;
    }
    console.log("[Voice:GUI] posting voiceSelectionStart to IDE");
    await ideMessenger.post("voiceSelectionStart", undefined);
  };

  const handleGazeModeToggle = () => {
    const newState = !isGazeMode;
    setIsGazeMode(newState);
    void ideMessenger.post("researchLogEvent", {
      category: "ui",
      event: "gaze_button_click",
      data: { new_state: newState },
    });
    if (newState) {
      console.log("[Gaze:GUI] Starting gaze tracking");
      void ideMessenger.post("gazeStart", undefined);
    } else {
      console.log("[Gaze:GUI] Stopping gaze tracking");
      void ideMessenger.post("gazeStop", undefined);
    }
  };

  return (
    <>
      <div
        onClick={props.onClick}
        className={`find-widget-skip bg-vsc-input-background flex select-none flex-row items-center justify-between gap-1 pt-1 ${props.hidden ? "pointer-events-none h-0 cursor-default opacity-0" : "pointer-events-auto mt-2 cursor-text opacity-100"}`}
        style={{
          fontSize: smallFont,
        }}
      >
        <div className="xs:gap-1.5 flex flex-row items-center gap-1">
          {!isInEdit && (
            <ToolTip place="top" content="Select Mode">
              <HoverItem className="!p-0">
                <ModeSelect />
              </HoverItem>
            </ToolTip>
          )}
          <ToolTip place="top" content="Select Model">
            <HoverItem className="!p-0">
              <ModelSelect />
            </HoverItem>
          </ToolTip>
          <div className="xs:flex text-description -mb-1 hidden items-center transition-colors duration-200">
            {props.toolbarOptions?.hideImageUpload ||
              (supportsImages && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    accept=".jpg,.jpeg,.png,.gif,.svg,.webp"
                    onChange={(e) => {
                      const files = e.target?.files ?? [];
                      for (const file of files) {
                        props.onImageFileSelected?.(file);
                      }
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  />

                  <ToolTip place="top" content="Attach Image">
                    <HoverItem className="">
                      <PhotoIcon
                        className="h-3 w-3 hover:brightness-125"
                        onClick={(e) => {
                          fileInputRef.current?.click();
                        }}
                      />
                    </HoverItem>
                  </ToolTip>
                </>
              ))}
            {props.toolbarOptions?.hideAddContext || (
              <ToolTip place="top" content="Attach Context">
                <HoverItem onClick={props.onAddContextItem}>
                  <AtSymbolIcon className="h-3 w-3 hover:brightness-125" />
                </HoverItem>
              </ToolTip>
            )}
            <div className="ml-1" />
            <ToolTip place="top" content="Select Config">
              <HoverItem className="!p-0">
                <AssistantAndOrgListbox variant="lump" />
              </HoverItem>
            </ToolTip>
            <div className="ml-5 flex items-center gap-3">
              <button
                onClick={() => void handleVoiceSelectionClick()}
                aria-pressed={isVoiceListening}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-all ${
                  isVoiceListening ? "bg-blue-500/20" : "bg-transparent"
                }`}
              >
                {isVoiceListening ? (
                  <StopIcon className="h-4 w-4 text-blue-400" />
                ) : (
                  <MicrophoneIcon className="text-vsc-foreground h-4 w-4" />
                )}
                <span
                  className={`text-xs font-bold ${isVoiceListening ? "text-blue-400" : "text-vsc-foreground"}`}
                >
                  Voice
                </span>
                <div
                  className={`relative h-5 w-8 items-center rounded-full border transition-all ${
                    isVoiceListening
                      ? "border-blue-500/50 bg-blue-500/30"
                      : "bg-vsc-input-background border-[var(--vscode-editorWidget-border)]"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 h-4 w-4 rounded-full border transition-all ${
                      isVoiceListening
                        ? "left-4 border-blue-500 bg-blue-400"
                        : "bg-vsc-foreground left-0 border-[var(--vscode-editorWidget-border)]"
                    }`}
                  />
                </div>
              </button>
              <button
                onClick={handleGazeModeToggle}
                aria-pressed={isGazeMode}
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-all ${
                  isGazeMode ? "bg-blue-500/20" : "bg-transparent"
                }`}
              >
                {isGazeMode ? (
                  <EyeIcon className="h-4 w-4 text-blue-400" />
                ) : (
                  <EyeSlashIcon className="text-vsc-foreground h-4 w-4" />
                )}
                <span
                  className={`text-xs font-bold ${isGazeMode ? "text-blue-400" : "text-vsc-foreground"}`}
                >
                  Gaze
                </span>
                <div
                  className={`relative h-5 w-8 items-center rounded-full border transition-all ${
                    isGazeMode
                      ? "border-blue-500/50 bg-blue-500/30"
                      : "bg-vsc-input-background border-[var(--vscode-editorWidget-border)]"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 h-4 w-4 rounded-full border transition-all ${
                      isGazeMode
                        ? "left-4 border-blue-500 bg-blue-400"
                        : "bg-vsc-foreground left-0 border-[var(--vscode-editorWidget-border)]"
                    }`}
                  />
                </div>
              </button>
            </div>
          </div>
        </div>

        <div
          className="text-description flex items-center gap-2 whitespace-nowrap"
          style={{
            fontSize: tinyFont,
          }}
        >
          {!isInEdit && <ContextStatus />}

          {isInEdit && (
            <HoverItem
              className="hidden hover:underline sm:flex"
              onClick={async () => {
                void dispatch(exitEdit({}));
                ideMessenger.post("focusEditor", undefined);
              }}
            >
              <span>
                <i>Esc</i> to exit Edit
              </span>
            </HoverItem>
          )}
          <ToolTip place="top" content="Send (⏎)">
            <Button
              variant={props.isMainInput ? "primary" : "secondary"}
              size="sm"
              data-testid="submit-input-button"
              onClick={async (e) => {
                if (props.onEnter) {
                  props.onEnter({
                    useCodebase: false,
                    noContext: useActiveFile
                      ? isMetaEquivalentKeyPressed(e as any) || e.altKey
                      : !(isMetaEquivalentKeyPressed(e as any) || e.altKey),
                  });
                }
              }}
              disabled={isEnterDisabled}
            >
              <span className="hidden md:inline">
                ⏎ {props.toolbarOptions?.enterText ?? "Enter"}
              </span>
              <span className="md:hidden">⏎</span>
            </Button>
          </ToolTip>
        </div>
      </div>
    </>
  );
}

function shallowToolbarOptionsEqual(a?: ToolbarOptions, b?: ToolbarOptions) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.hideAddContext === b.hideAddContext &&
    a.hideImageUpload === b.hideImageUpload &&
    a.hideUseCodebase === b.hideUseCodebase &&
    a.hideSelectModel === b.hideSelectModel &&
    a.enterText === b.enterText
  );
}

export default memo(
  InputToolbar,
  (prev, next) =>
    prev.hidden === next.hidden &&
    prev.disabled === next.disabled &&
    prev.isMainInput === next.isMainInput &&
    prev.activeKey === next.activeKey &&
    shallowToolbarOptionsEqual(prev.toolbarOptions, next.toolbarOptions),
);
