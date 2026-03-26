import { MessageContent } from "core";

interface AIOverviewStyle1Props {
  content?: MessageContent;
  isGenerating?: boolean;
  onInsertComment?: () => void;
  commentInserted?: boolean;
  onExplainAPI?: () => void;
  onExplainConcept?: () => void;
  onExplainUsage?: () => void;
}

function AIOverviewStyle1({
  content,
  isGenerating,
  onInsertComment,
  commentInserted,
  onExplainAPI,
  onExplainConcept,
  onExplainUsage,
}: AIOverviewStyle1Props) {
  const displayText = typeof content === "string" ? content : "";
  const showButton = !isGenerating && !!content;

  return (
    <div className="px-6 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="h-px flex-1 bg-white/20"></div>
        <span className="text-sm font-medium text-white">AI Overview</span>
        <div className="h-px flex-1 bg-white/20"></div>
        {showButton && (
          <button
            onClick={onInsertComment}
            className={`group flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold text-white transition-all ${
              commentInserted
                ? "border-[rgba(62,106,225,0.6)] bg-[rgba(62,106,225,0.6)] hover:bg-[rgba(62,106,225,0.8)]"
                : "border-[rgb(62,106,225)] bg-[rgb(62,106,225)] hover:bg-[rgb(62,106,225,0.85)]"
            }`}
          >
            <span className="text-base font-bold">+</span>
            <span>Inline Comment</span>
          </button>
        )}
      </div>
      {displayText ? (
        <p className="text-base leading-relaxed text-gray-200">{displayText}</p>
      ) : isGenerating ? (
        <div className="space-y-2">
          <div className="animate-shimmer animate-shimmer-active h-4 w-full rounded bg-gradient-to-r from-white/10 via-white/20 to-white/10 bg-[length:200%_100%]" />
          <div className="animate-shimmer animate-shimmer-active h-4 w-3/4 rounded bg-gradient-to-r from-white/10 via-white/20 to-white/10 bg-[length:200%_100%]" />
          <div className="animate-shimmer animate-shimmer-active h-4 w-5/6 rounded bg-gradient-to-r from-white/10 via-white/20 to-white/10 bg-[length:200%_100%]" />
        </div>
      ) : (
        <p className="text-base leading-relaxed text-gray-200">
          This section will display an AI-generated overview of your selected
          code, including methodology analysis, key patterns, and implementation
          insights.
        </p>
      )}

      {showButton && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm font-medium text-white/80">
            Explain more about
          </span>
          <div className="flex items-center gap-2">
            {onExplainAPI && (
              <button
                onClick={onExplainAPI}
                className="rounded-full border border-[rgb(62,106,225)] bg-[rgb(62,106,225)] px-3 py-1 text-xs font-bold text-white transition-all hover:bg-[rgb(62,106,225,0.85)]"
              >
                API
              </button>
            )}
            {onExplainConcept && (
              <button
                onClick={onExplainConcept}
                className="rounded-full border border-[rgb(62,106,225)] bg-[rgb(62,106,225)] px-3 py-1 text-xs font-bold text-white transition-all hover:bg-[rgb(62,106,225,0.85)]"
              >
                Concept
              </button>
            )}
            {onExplainUsage && (
              <button
                onClick={onExplainUsage}
                className="rounded-full border border-[rgb(62,106,225)] bg-[rgb(62,106,225)] px-3 py-1 text-xs font-bold text-white transition-all hover:bg-[rgb(62,106,225,0.85)]"
              >
                Usage
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AIOverviewStyle1;
