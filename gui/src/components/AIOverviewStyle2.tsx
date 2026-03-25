// Style 2: Left-aligned header with underline
function AIOverviewStyle2() {
  return (
    <div className="px-2 py-4">
      <div className="mb-3 border-b border-white/20 pb-2">
        <span className="text-sm font-medium text-white">AI Overview</span>
      </div>
      <p className="text-base leading-relaxed text-gray-200">
        This section will display an AI-generated overview of your selected
        code, including methodology analysis, key patterns, and implementation
        insights.
      </p>
    </div>
  );
}

export default AIOverviewStyle2;
