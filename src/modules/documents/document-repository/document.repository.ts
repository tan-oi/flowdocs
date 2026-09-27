import type { Document } from "../document.types";
import { saveDocumentAction } from "../server/actions";

type SaveStatus = "saved" | "saving" | "unsaved" | "error";
export class DocumentRepository {
  private _documentData: Document;
  private _isDirty = false;

  readonly documentId: string;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private saveInFlight: Promise<void> | null = null;
  private editVersion = 0;

  private status: SaveStatus = "saved";
  private listeners = new Set<() => void>();

  constructor(data: Document) {
    this._documentData = { ...data };
    this.documentId = data.id;
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

    if (!this.saveInFlight && this._isDirty) {
      this.saveInFlight = this.savePendingChanges();
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
    while (this._isDirty) {
      const content = this._documentData.content;
      const editVersion = this.editVersion;
      this.setStatus("saving");

      let result;
      try {
        result = await saveDocumentAction(
          this.documentId,
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
      this.setStatus("saved");
    }
  }
}
