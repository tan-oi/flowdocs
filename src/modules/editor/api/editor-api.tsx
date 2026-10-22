import type { Editor } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import type { Node } from "@tiptap/pm/model";
import { NodeSelection, type Transaction } from "@tiptap/pm/state";
import { normalize } from "./normalize";
import type { Block, Dependency, NewBlock, Origin, ReactiveFormat, Source } from "./types";

export const ORIGIN_META = "flowdocs:origin";

export class EditorApi {
  #editor: Editor;

  constructor(editor: Editor) {
    this.#editor = editor;
  }

  Content = () => <EditorContent editor={this.#editor} />;

  getSnapshot(): Block[] {
    return normalize(this.#editor.state.doc);
  }

  getBlock(id: string): Block | null {
    return this.getSnapshot().find((block) => block.id === id) ?? null;
  }

  getCurrentBlockId(): string | null {
    const { selection } = this.#editor.state;
    if (selection instanceof NodeSelection) return selection.node.attrs.id ?? null;
    const { $from } = selection;
    for (let depth = $from.depth; depth > 0; depth--) {
      const id = $from.node(depth).attrs.id;
      if (id) return id;
    }
    return null;
  }

  insertBlock(afterId: string | null, block: NewBlock, origin: Origin): string | null {
    const id = crypto.randomUUID();
    let node: Node;
    try {
      node = this.#editor.schema.nodeFromJSON({
        type: block.type,
        attrs: { ...block.attrs, id },
        content: block.text ? [{ type: "text", text: block.text }] : undefined,
      });
      node.check();
    } catch {
      return null;
    }
    const tr = this.#editor.state.tr.insert(this.#insertPosition(afterId), node);
    this.#dispatch(tr, origin);
    return id;
  }

  insertReactiveBlock(
    afterId: string | null,
    { format, prompt }: { format: ReactiveFormat; prompt: string },
    origin: Origin
  ): string | null {
    return this.insertBlock(
      afterId,
      { type: "reactive", attrs: { format, prompt, output: "", dependencies: [] } },
      origin
    );
  }

  setReactiveSources(id: string, sources: Source[], origin: Origin): Dependency[] | null {
    const found = this.#findReactive(id);
    if (!found) return null;
    const existing = new Set(this.getSnapshot().map((block) => block.id));
    const dependencies = sources
      .filter((source) => source.external || (source.sourceId !== id && existing.has(source.sourceId)))
      .map((source) => ({ ...source, lastUsedText: "", lastUsedHash: "" }));
    const tr = this.#editor.state.tr.setNodeMarkup(found.pos, undefined, {
      ...found.node.attrs,
      dependencies,
    });
    this.#dispatch(tr, origin);
    return dependencies;
  }

  applyGeneration(id: string, { output, dependencies }: { output: string; dependencies: Dependency[] }): boolean {
    const found = this.#findReactive(id);
    if (!found) return false;
    const tr = this.#editor.state.tr
      .setNodeMarkup(found.pos, undefined, { ...found.node.attrs, output, dependencies })
      .setMeta("addToHistory", false);
    this.#dispatch(tr, "engine");
    return true;
  }

  #dispatch(tr: Transaction, origin: Origin) {
    this.#editor.view.dispatch(tr.setMeta(ORIGIN_META, origin));
  }

  #findReactive(id: string): { node: Node; pos: number } | null {
    let found: { node: Node; pos: number } | null = null;
    this.#editor.state.doc.descendants((node, pos) => {
      if (found) return false;
      if (node.type.name === "reactive" && node.attrs.id === id) found = { node, pos };
    });
    return found;
  }

  // Inserts land after the top-level block that contains afterId, so a new block never ends up inside a list or table.
  #insertPosition(afterId: string | null): number {
    const { doc } = this.#editor.state;
    let position = doc.content.size;
    if (!afterId) return position;
    doc.forEach((node, offset) => {
      if (position !== doc.content.size) return;
      if (node.attrs.id === afterId || containsId(node, afterId)) position = offset + node.nodeSize;
    });
    return position;
  }
}

function containsId(node: Node, id: string): boolean {
  let found = false;
  node.descendants((child) => {
    if (found) return false;
    if (child.attrs.id === id) found = true;
  });
  return found;
}
