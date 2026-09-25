import type { Document } from "./document.types";

export class DocumentRepository {
  private _documentData: Document;
  private _isDirty = false;

  readonly documentId: string;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(data: Document) {
    this._documentData = { ...data };
    this.documentId = data.id;
  }

  updateState(newContent: Document["content"]) {
    this._documentData.content = newContent;

    this._isDirty = true;
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.saveNow(), 1000);
  }

  saveNow() {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (!this._isDirty) return;

    console.log(this._documentData.content);
    this._isDirty = false;
  }

  close() {
    this.saveNow();
  }
}
