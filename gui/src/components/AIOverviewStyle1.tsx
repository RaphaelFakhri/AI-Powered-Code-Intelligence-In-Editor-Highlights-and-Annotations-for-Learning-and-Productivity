// Style 1: Section Header - centered title with line
function AIOverviewStyle1() {
  return (
    <div className="px-6 py-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-px flex-1 bg-white/20"></div>
        <span className="text-sm font-medium text-white">AI Overview</span>
        <div className="h-px flex-1 bg-white/20"></div>
      </div>
      <p className="text-base leading-relaxed text-gray-200">
        This section will display an AI-generated overview of your selected
        code, including methodology analysis, key patterns, and implementation
        insights.
      </p>
    </div>
  );
}

export default AIOverviewStyle1;
