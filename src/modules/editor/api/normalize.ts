import type { Node } from "@tiptap/pm/model";
import type { Block } from "./types";

export function normalize(doc: Node): Block[] {
  const blocks: Block[] = [];
  doc.descendants((node) => {
    const id = node.attrs.id as string | undefined;
    if (node.type.name === "reactive" && id) {
      const { format, prompt, output, dependencies } = node.attrs;
      blocks.push({ id, kind: "reactive", type: "reactive", format, prompt, output, dependencies, text: output });
      return false;
    }
    if (node.isTextblock && id) {
      blocks.push({ id, kind: "text", type: node.type.name, text: node.textContent });
      return false;
    }
    return true;
  });
  return blocks;
}
