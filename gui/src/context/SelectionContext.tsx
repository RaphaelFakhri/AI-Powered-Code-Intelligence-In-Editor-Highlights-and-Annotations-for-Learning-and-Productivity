import { createContext, useContext, useState, ReactNode } from "react";

interface SelectionInfo {
  filepath: string | null;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  } | null;
  content: string | null;
}

interface SelectionContextValue {
  selection: SelectionInfo | null;
  setSelection: (selection: SelectionInfo | null) => void;
  launchStarted: boolean;
  frozenSelection: SelectionInfo | null;
  startLaunch: () => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [launchStarted, setLaunchStarted] = useState(false);
  const [frozenSelection, setFrozenSelection] = useState<SelectionInfo | null>(
    null,
  );

  const startLaunch = () => {
    setFrozenSelection(selection);
    setLaunchStarted(true);
  };

  return (
    <SelectionContext.Provider
      value={{
        selection,
        setSelection,
        launchStarted,
        frozenSelection,
        startLaunch,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error(
      "useSelection must be used within SelectionContextProvider",
    );
  }
  return context;
}
