import { MessageContent } from "core";

interface AIOverviewStyle1Props {
  content?: MessageContent;
  isGenerating?: boolean;
  onInsertComment?: () => void;
  commentInserted?: boolean;
}

function AIOverviewStyle1({
  content,
  isGenerating,
  onInsertComment,
  commentInserted,
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
            className={`shrink-0 rounded border px-2 py-0.5 text-xs font-medium transition-all duration-200 ${
              commentInserted
                ? "cursor-pointer border-white/20 bg-transparent text-white/40 hover:bg-white/5"
                : "cursor-pointer border-teal-400/60 bg-teal-600/80 text-white shadow-[0_0_12px_rgba(20,184,166,0.5)] hover:border-teal-400 hover:bg-teal-600"
            }`}
          >
            {commentInserted ? "○ Inline Comments" : "● Inline Comments"}
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
    </div>
  );
}

export default AIOverviewStyle1;
