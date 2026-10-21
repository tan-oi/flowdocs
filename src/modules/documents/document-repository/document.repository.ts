import type { Document } from "@/src/modules/documents/document.types";
import { createDocumentAction, saveDocumentAction } from "@/src/modules/documents/server/actions";

type SaveStatus =
  | "saved"
  | "saving"
  | "creating"
  | "unsaved"
  | "error"
  | "retrying"
  | "conflict"
  | "paused";
export class DocumentRepository {
  private _documentData: Pick<Document, "content" | "revision">;
  private _isDirty = false;
  private isDeleted = false;
  private savingPaused = false;

  readonly title: string;
  // Last edit. Browser time on the first edit so the sidebar re-sorts at once,
  // replaced by the database time when the save lands.
  updatedAt: Date;
  readonly isNew: boolean;

  readonly localKey: string = crypto.randomUUID();
  documentId: string | null;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCounter = 0;
  private saveInFlight: Promise<void> | null = null;
  private editVersion = 0;

  private status: SaveStatus = "saved";
  lastUsedAt = Date.now();
  private listeners = new Set<() => void>();

  constructor(data?: Document) {
    this.documentId = data?.id ?? null;
    this.isNew = !data;
    this.title = data?.title ?? "Untitled";
    this.updatedAt = data?.updatedAt ?? new Date();
    this._documentData = {
      content: data?.content ?? { type: "doc", content: [] },
      revision: data?.revision ?? 0,
    };
    this.status = data ? "saved" : "unsaved";
  }

  isClean() {
    return this.status === "saved" && !this._isDirty && !this.saveInFlight;
  }

  get content(): Document["content"] {
    return this._documentData.content;
  }

  updateState(newContent: Document["content"]) {
    if (this.isDeleted) return;
    this._documentData.content = newContent;

    // The first edit since the last save makes this the latest document right away;
    // the server's time replaces it once the save lands.
    if (!this._isDirty) this.updatedAt = new Date();
    this._isDirty = true;

    if (!this.saveInFlight && !this.savingPaused) {
      this.setStatus("unsaved");
    }
    this.editVersion++;
    if (this.savingPaused) return;
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      void this.saveNow().catch(console.error);
    }, 1000);
  }

  async saveNow() {
    if (this.isDeleted || this.savingPaused) return;
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.clearRetryTimer();

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

  markDeleted() {
    this.isDeleted = true;
    this.pauseSaving();
  }

  pauseSaving() {
    this.savingPaused = true;
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.clearRetryTimer();
    if (!this.isDeleted) this.setStatus("paused");
  }

  async resumeSaving() {
    if (this.isDeleted) return;
    this.savingPaused = false;
    try {
      await this.saveInFlight;
    } catch {
      // Retry the retained content after the previous request settles.
    }
    if (this.isDeleted || this.savingPaused) return;
    this.setStatus(this._isDirty ? "unsaved" : "saved");
    await this.saveNow();
  }

  private scheduleRetry(): boolean {
    if (this.retryCounter >= 3) return false;

    const wait = 1000 * 2 ** this.retryCounter;
    this.retryCounter++;

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.saveNow().catch(console.error);
    }, wait);
    this.setStatus("retrying");
    return true;
  }

  private clearRetryTimer() {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private async savePendingChanges() {
    if (this.isDeleted || this.savingPaused) return;
    if (this.documentId === null) {
      this.setStatus("creating");
      try {
        const document = await createDocumentAction();
        this.documentId = document.id;
        this._documentData.revision = document.revision;
        this.updatedAt = document.updatedAt;
        this.retryCounter = 0;
      } catch (error) {
        if (this.isDeleted || this.savingPaused) return;
        if (this.scheduleRetry()) return;
        this.setStatus("error");
        throw error;
      }
    }
    const documentId = this.documentId;
    while (this._isDirty && !this.isDeleted && !this.savingPaused) {
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
        if (this.isDeleted || this.savingPaused) return;
        if (this.scheduleRetry()) return;
        this.setStatus("error");
        throw error;
      }

      if (!result.ok) {
        if (this.isDeleted || this.savingPaused) return;
        if (result.error.code !== "conflict" && this.scheduleRetry()) return;
        this.setStatus(result.error.code === "conflict" ? "conflict" : "error");
        throw new Error(result.error.message || result.error.code);
      }

      this.retryCounter = 0;
      this._documentData.revision = result.data.revision;
      this.updatedAt = result.data.updatedAt;
      this._isDirty = this.editVersion !== editVersion;
      // Retain the acknowledged revision in case deletion fails and saving resumes.
      if (this.isDeleted || this.savingPaused) return;
    }
    if (!this.isDeleted && !this.savingPaused) this.setStatus("saved");
  }
}
