import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { ListboxButton } from "../ui";

interface SelectedAssistantButtonProps {
  variant?: "lump" | "sidebar";
}

export function SelectedAssistantButton({
  variant,
}: SelectedAssistantButtonProps) {
  const isSidebar = variant === "sidebar";
  const buttonPadding = isSidebar ? "px-2 py-1.5" : "px-0 py-0.5";

  return (
    <ListboxButton
      data-testid="assistant-select-button"
      className={`text-description overflow-hidden border-none bg-transparent hover:brightness-110 ${isSidebar ? "w-full justify-start" : "gap-1.5"} ${buttonPadding}`}
    >
      <ChevronDownIcon
        className="text-description h-3 w-3 flex-shrink-0 select-none"
        aria-hidden="true"
      />
    </ListboxButton>
  );
}
