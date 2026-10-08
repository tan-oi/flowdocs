import type { Document } from "../document.types";
import { createDocumentAction, saveDocumentAction } from "../server/actions";

type SaveStatus = "saved" | "saving" | "creating" | "unsaved" | "error";
export class DocumentRepository {
  private _documentData: Pick<Document, "content" | "revision">;
  private _isDirty = false;

  readonly title: string;
  readonly isNew: boolean;

  readonly localKey: string = crypto.randomUUID();
  documentId: string | null;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private saveInFlight: Promise<void> | null = null;
  private editVersion = 0;

  private status: SaveStatus = "saved";
  private listeners = new Set<() => void>();

  constructor(data?: Document) {
    this.documentId = data?.id ?? null;
    this.isNew = !data;
    this.title = data?.title ?? "Untitled";
    this._documentData = {
      content: data?.content ?? { type: "doc", content: [] },
      revision: data?.revision ?? 0,
    };
    this.status = data ? "saved" : "unsaved";
  }

  get content(): Document["content"] {
    return this._documentData.content;
  }

  updateState(newContent: Document["content"]) {
    this._documentData.content = newContent;

    this._isDirty = true;

    if (!this.saveInFlight) {
      this.setStatus("unsaved");
    }
    this.editVersion++;
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      void this.saveNow().catch(console.error);
    }, 1000);
  }

  async saveNow() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (!this.saveInFlight && (this.documentId === null || this._isDirty)) {
      this.saveInFlight = Promise.resolve().then(() =>
        this.savePendingChanges()
      );
    }

    if (this.saveInFlight) {
      const save = this.saveInFlight;
      try {
        await save;
      } finally {
        if (this.saveInFlight === save) this.saveInFlight = null;
      }
    }
  }

  getSnapshot = () => this.status;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setStatus(next: SaveStatus) {
    if (this.status === next) return;
    this.status = next;
    this.listeners.forEach((listener) => listener());
  }

  close() {
    void this.saveNow().catch(console.error);
  }

  private async savePendingChanges() {
    if (this.documentId === null) {
      this.setStatus("creating");
      try {
        const document = await createDocumentAction();
        this.documentId = document.id;
        this._documentData.revision = document.revision;
      } catch (error) {
        this.setStatus("error");
        throw error;
      }
    }
    const documentId = this.documentId;
    while (this._isDirty) {
      const content = this._documentData.content;
      const editVersion = this.editVersion;
      this.setStatus("saving");

      let result;
      try {
        result = await saveDocumentAction(
          documentId,
          content,
          this._documentData.revision
        );
      } catch (error) {
        this.setStatus("error");
        throw error;
      }

      if (!result.ok) {
        this.setStatus("error");
        throw new Error(result.error.message || result.error.code);
      }

      this._documentData.revision = result.data.revision;
      this._isDirty = this.editVersion !== editVersion;
    }
    this.setStatus("saved");
  }
}
