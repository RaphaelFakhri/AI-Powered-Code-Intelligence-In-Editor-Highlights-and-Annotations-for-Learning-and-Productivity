import { MessageContent } from "core";

interface AIOverviewStyle1Props {
  content?: MessageContent;
  isGenerating?: boolean;
}

// Style 1: Section Header - centered title with line
function AIOverviewStyle1({ content, isGenerating }: AIOverviewStyle1Props) {
  const displayText = typeof content === "string" ? content : "";

  return (
    <div className="px-6 py-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-white/20"></div>
        <span className="text-sm font-medium text-white">AI Overview</span>
        <div className="h-px flex-1 bg-white/20"></div>
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
