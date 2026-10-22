"use client";

import { createContext, useContext } from "react";
import type { EditorApi } from "./editor-api";

const EditorApiContext = createContext<EditorApi | null>(null);

export const EditorApiProvider = EditorApiContext.Provider;

export function useEditorApiContext(): EditorApi {
  const api = useContext(EditorApiContext);
  if (!api) throw new Error("useEditorApiContext requires EditorApiProvider");
  return api;
}
