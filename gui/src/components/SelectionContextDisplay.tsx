import { getMarkdownLanguageTagForFile } from "core/util";
import { getUriPathBasename } from "core/util/uri";
import { useContext } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { useSelection } from "../context/SelectionContext";
import FileIcon from "./FileIcon";
import StyledMarkdownPreview from "./StyledMarkdownPreview";
import { ExpandableToolbarPreview } from "./mainInput/TipTapEditor/components/ExpandableToolbarPreview";

interface SelectionContextDisplayProps {
  selection?: {
    filepath: string | null;
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    } | null;
    content: string | null;
  } | null;
}

function SelectionContextDisplay({
  selection: selectionProp,
}: SelectionContextDisplayProps) {
  const { selection: contextSelection, setSelection } = useSelection();
  const ideMessenger = useContext(IdeMessengerContext);
  const selection = selectionProp ?? contextSelection;

  if (!selection?.range || !selection?.content) {
    return null;
  }

  const filepath = selection.filepath;
  const basename = filepath ? getUriPathBasename(filepath) : "unknown";
  const lineInfo = `${selection.range.start.line + 1}-${selection.range.end.line + 1}`;
  const title = `${basename} (${lineInfo})`;
  const source = `\`\`\`${getMarkdownLanguageTagForFile(basename)} ${title}\n${selection.content}\n\`\`\``;

  const handleClick = () => {
    if (filepath && selection.range) {
      ideMessenger.ide.showLines(
        filepath,
        selection.range.start.line,
        selection.range.end.line,
      );
    }
  };

  return (
    <ExpandableToolbarPreview
      title={title}
      icon={<FileIcon height="16px" width="16px" filename={basename} />}
      initiallyHidden={false}
      onTitleClick={handleClick}
      onDelete={selectionProp ? undefined : () => setSelection(null)}
    >
      <StyledMarkdownPreview source={source} />
    </ExpandableToolbarPreview>
  );
}

export default SelectionContextDisplay;
