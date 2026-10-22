import StarterKit from "@tiptap/starter-kit";
import UniqueID from "@tiptap/extension-unique-id";
import { getSchema, type JSONContent } from "@tiptap/core";

export const BLOCK_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "codeBlock",
  "horizontalRule",
  "reactive",
];

export const editorExtensions = [
  StarterKit,
  UniqueID.configure({ types: BLOCK_TYPES }),
];

export const editorSchema = getSchema(editorExtensions);

export const parseDocument = (json: JSONContent) => editorSchema.nodeFromJSON(json);
