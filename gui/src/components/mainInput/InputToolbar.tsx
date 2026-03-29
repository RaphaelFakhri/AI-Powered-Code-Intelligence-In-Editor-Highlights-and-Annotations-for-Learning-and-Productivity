import {
  AtSymbolIcon,
  LightBulbIcon as LightBulbIconOutline,
  MicrophoneIcon,
  PhotoIcon,
  StopIcon,
} from "@heroicons/react/24/outline";
import { LightBulbIcon as LightBulbIconSolid } from "@heroicons/react/24/solid";
import { InputModifiers } from "core";
import {
  modelSupportsImages,
  modelSupportsReasoning,
} from "core/llm/autodetect";
import { Message } from "core/protocol/messenger";
import { ToWebviewProtocol } from "core/protocol/index.js";
import { memo, useContext, useEffect, useRef, useState } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { selectUseActiveFile } from "../../redux/selectors";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import { setHasReasoningEnabled } from "../../redux/slices/sessionSlice";
import { setReasoningSetting } from "../../redux/slices/uiSlice";
import { exitEdit } from "../../redux/thunks/edit";
// Voice parser inlined to avoid stale Vite cache
const _WORD_TO_NUM: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};
function _parseNum(value: string): number | null {
  const t = value.trim().toLowerCase().replace(/-/g, " ");
  if (/^\d+$/.test(t)) {
    const n = parseInt(t, 10);
    return n >= 0 ? n : null;
  }
  const tokens = t.split(/\s+/);
  let current = 0;
  let matched = false;
  for (const tok of tokens) {
    if (tok === "and" || tok === "a") continue;
    const v = _WORD_TO_NUM[tok];
    if (v === undefined) {
      if (matched) break;
      return null;
    }
    matched = true;
    if (v === 100) {
      current = (current === 0 ? 1 : current) * 100;
    } else {
      current += v;
    }
  }
  return matched && current > 0 ? current : null;
}
function parseSelectLinesIntent(
  transcript: string,
): { startLine: number; endLine: number } | null {
  const text = transcript
    .trim()
    .toLowerCase()
    .replace(/[.,!?]+/g, "");
  console.log(
    "[Voice:Parser] input:",
    JSON.stringify(transcript),
    "normalized:",
    JSON.stringify(text),
  );
  if (!text) return null;
  const NUM = `(\\d+(?:\\s+\\d+)*|[a-z]+(?:[\\s-]+[a-z]+)*)`;
  const patterns: [RegExp, boolean][] = [
    [
      new RegExp(
        `(?:select|highlight)\\s+lines?\\s+${NUM}\\s*(?:to|through|-)\\s*${NUM}`,
      ),
      true,
    ],
    [new RegExp(`lines?\\s+${NUM}\\s*(?:to|through|-)\\s*${NUM}`), true],
    [new RegExp(`${NUM}\\s+(?:to|through)\\s+${NUM}`), true],
    [new RegExp(`(?:select|highlight)\\s+lines?\\s+${NUM}`), false],
    [new RegExp(`lines?\\s+${NUM}`), false],
  ];
  for (const [pat, isRange] of patterns) {
    const m = text.match(pat);
    console.log(
      "[Voice:Parser] pattern:",
      pat.source,
      "match:",
      JSON.stringify(m),
    );
    if (!m) continue;
    if (isRange && m[1] !== undefined && m[2] !== undefined) {
      const s = _parseNum(m[1]),
        e = _parseNum(m[2]);
      console.log(
        "[Voice:Parser] range:",
        s,
        "-",
        e,
        "from",
        JSON.stringify(m[1]),
        JSON.stringify(m[2]),
      );
      if (s && e && s >= 1 && e >= 1) {
        const result = { startLine: Math.min(s, e), endLine: Math.max(s, e) };
        console.log("[Voice:Parser] returning:", JSON.stringify(result));
        return result;
      }
    }
    if (!isRange && m[1] !== undefined) {
      const n = _parseNum(m[1]);
      console.log("[Voice:Parser] single:", n, "from", JSON.stringify(m[1]));
      if (n && n >= 1) {
        const result = { startLine: n, endLine: n };
        console.log("[Voice:Parser] returning:", JSON.stringify(result));
        return result;
      }
    }
  }
  console.log("[Voice:Parser] no pattern matched");
  return null;
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
  const defaultModel = useAppSelector(selectSelectedChatModel);
  const useActiveFile = useAppSelector(selectUseActiveFile);
  const isInEdit = useAppSelector((store) => store.session.isInEdit);
  const codeToEdit = useAppSelector((store) => store.editModeState.codeToEdit);
  const hasReasoningEnabled = useAppSelector(
    (store) => store.session.hasReasoningEnabled,
  );
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

  const supportsReasoning = modelSupportsReasoning(defaultModel);

  const smallFont = useFontSize(-2);
  const tinyFont = useFontSize(-3);

  const cleanupVoiceSession = () => {
    console.log("[Voice:GUI] cleanupVoiceSession called");
    void ideMessenger.post("voiceSelectionStop", undefined);
    setIsVoiceListening(false);
  };

  useEffect(() => {
    console.log("[Voice:GUI] useEffect: registering window message listener");
    const listener = async (event: {
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
            "Voice listening started. Say: select lines 7 to 11.",
          );
        } else if (payload.state === "idle") {
          setIsVoiceListening(false);
        } else if (payload.state === "error") {
          setIsVoiceListening(false);
          console.log("[Voice:GUI] voice error:", payload.message);
          if (payload.message) {
            void ideMessenger.ide.showToast("error", payload.message);
          }
        }
      }

      if (event.data.messageType === "voiceSelectionTranscript") {
        const payload = event.data
          .data as ToWebviewProtocol["voiceSelectionTranscript"][0];
        console.log(
          "[Voice:GUI] received voiceSelectionTranscript:",
          JSON.stringify(payload),
        );
        if (!payload.isFinal || !payload.transcript.trim()) {
          console.log("[Voice:GUI] transcript not final or empty, ignoring");
          return;
        }

        const intent = parseSelectLinesIntent(payload.transcript);
        console.log(
          "[Voice:GUI] parseSelectLinesIntent result:",
          JSON.stringify(intent),
          "from transcript:",
          JSON.stringify(payload.transcript),
        );
        if (!intent) {
          console.log("[Voice:GUI] no intent parsed, ignoring transcript");
          return;
        }

        const currentFile = await ideMessenger.ide.getCurrentFile();
        console.log(
          "[Voice:GUI] currentFile:",
          currentFile?.path ?? "null",
          "contents length:",
          currentFile?.contents?.length ?? 0,
        );
        if (!currentFile?.path) {
          void ideMessenger.ide.showToast(
            "warning",
            "No active file found to apply voice selection.",
          );
          return;
        }

        const lineCount = currentFile.contents
          ? currentFile.contents.split(/\r?\n/).length
          : 1;
        const clampedStart = Math.max(1, Math.min(intent.startLine, lineCount));
        const clampedEnd = Math.max(
          clampedStart,
          Math.min(intent.endLine, lineCount),
        );
        console.log(
          "[Voice:GUI] selecting lines:",
          clampedStart,
          "-",
          clampedEnd,
          "in",
          currentFile.path,
          "(total lines:",
          lineCount,
          ")",
        );

        await ideMessenger.ide.showLines(
          currentFile.path,
          clampedStart - 1,
          clampedEnd - 1,
        );

        void ideMessenger.ide.showToast(
          "info",
          `Selected lines ${clampedStart}-${clampedEnd}`,
        );
        cleanupVoiceSession();
      }
    };

    window.addEventListener("message", listener);

    return () => {
      console.log("[Voice:GUI] useEffect cleanup: removing listener");
      window.removeEventListener("message", listener);
      cleanupVoiceSession();
    };
  }, [ideMessenger]);

  const handleVoiceSelectionClick = async () => {
    console.log(
      "[Voice:GUI] handleVoiceSelectionClick: isVoiceListening =",
      isVoiceListening,
    );
    if (isVoiceListening) {
      cleanupVoiceSession();
      return;
    }
    console.log("[Voice:GUI] posting voiceSelectionStart to IDE");
    await ideMessenger.post("voiceSelectionStart", undefined);
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
            <ToolTip
              place="top"
              content={
                isVoiceListening ? "Stop voice selection" : "Voice select lines"
              }
            >
              <HoverItem onClick={() => void handleVoiceSelectionClick()}>
                {isVoiceListening ? (
                  <StopIcon className="h-3 w-3 text-red-400 hover:brightness-125" />
                ) : (
                  <MicrophoneIcon className="h-3 w-3 hover:brightness-125" />
                )}
              </HoverItem>
            </ToolTip>
            {supportsReasoning && (
              <HoverItem
                onClick={() => {
                  dispatch(setHasReasoningEnabled(!hasReasoningEnabled));
                  if (defaultModel?.title) {
                    dispatch(
                      setReasoningSetting({
                        modelTitle: defaultModel.title,
                        enabled: !hasReasoningEnabled,
                      }),
                    );
                  }
                }}
              >
                <ToolTip
                  place="top"
                  content={
                    hasReasoningEnabled
                      ? "Disable model reasoning"
                      : "Enable model reasoning"
                  }
                >
                  {hasReasoningEnabled ? (
                    <LightBulbIconSolid className="h-3 w-3 brightness-200 hover:brightness-150" />
                  ) : (
                    <LightBulbIconOutline className="h-3 w-3 hover:brightness-150" />
                  )}
                </ToolTip>
              </HoverItem>
            )}
          </div>
        </div>

        <div
          className="text-description flex items-center gap-2 whitespace-nowrap"
          style={{
            fontSize: tinyFont,
          }}
        >
          {!isInEdit && <ContextStatus />}
          {!props.toolbarOptions?.hideUseCodebase && !isInEdit && (
            <div className="hidden transition-colors duration-200 hover:underline md:flex">
              <HoverItem
                className={
                  props.activeKey === "Meta" ||
                  props.activeKey === "Control" ||
                  props.activeKey === "Alt"
                    ? "underline"
                    : ""
                }
                onClick={(e) =>
                  props.onEnter?.({
                    useCodebase: false,
                    noContext: !useActiveFile,
                  })
                }
              >
                <ToolTip
                  place="top-end"
                  content={`${
                    useActiveFile
                      ? "Send Without Active File"
                      : "Send With Active File"
                  } (${getMetaKeyLabel()}⏎)`}
                >
                  <span>
                    {getMetaKeyLabel()}⏎{" "}
                    {useActiveFile ? "No active file" : "Active file"}
                  </span>
                </ToolTip>
              </HoverItem>
            </div>
          )}
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
