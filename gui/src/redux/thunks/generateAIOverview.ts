import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { JSONContent } from "@tiptap/core";
import { InputModifiers } from "core";
import { setIsGeneratingAIOverview } from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { streamResponseThunk } from "./streamResponse";

interface SelectionInfo {
  filepath: string | null;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  } | null;
  content: string | null;
}

export const generateAIOverviewThunk = createAsyncThunk<
  void,
  SelectionInfo,
  ThunkApiType
>("chat/generateAIOverview", async (selection, { dispatch }) => {
  if (!selection.content) {
    return;
  }

  const editorState: JSONContent = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: `Give a brief, spoken-style overview of what this code does. Be concise — 2 to 4 short sentences max. Focus on purpose and structure, not implementation details. No code snippets, no bullet points, no markdown.\n\n${selection.content}`,
          },
        ],
      },
    ],
  };

  const modifiers: InputModifiers = {
    useCodebase: false,
    noContext: true,
  };

  dispatch(setIsGeneratingAIOverview(true));
  try {
    unwrapResult(
      await dispatch(
        streamResponseThunk({
          editorState,
          modifiers,
          hiddenUserMessage: true,
        }),
      ),
    );
  } finally {
    dispatch(setIsGeneratingAIOverview(false));
  }
});
