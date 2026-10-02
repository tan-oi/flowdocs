export interface DocMeta {
  id: string;
  title: string;
  updatedAt: Date;
}

export interface DocumentManagerSnapshot {
  recentDocuments: readonly Readonly<DocMeta>[];
  activeDocumentId: string | null;
}

export class DocumentManager {
  private _metaData: DocMeta[];
  private _activeDocument: string | null;
  private snapshot: DocumentManagerSnapshot;
  private listeners = new Set<() => void>();

  constructor(recentDocuments: DocMeta[]) {
    this._metaData = recentDocuments.slice(0, 5);
    this._activeDocument = this._metaData[0]?.id ?? null;
    this.snapshot = {
      recentDocuments: this._metaData,
      activeDocumentId: this._activeDocument,
    };
  }

  getSnapshot = (): DocumentManagerSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get activeDocumentId(): string | null {
    return this._activeDocument;
  }

  set activeDocumentId(documentId: string | null) {
    if (this._activeDocument === documentId) return;
    this._activeDocument = documentId;
    this.emit();
  }

  openDocument(document: DocMeta) {
    this._metaData = [
      document,
      ...this._metaData.filter((doc) => doc.id !== document.id),
    ].slice(0, 5);
    this._activeDocument = document.id;
    this.emit();
  }

  renameDocument(newDocumentTitle: string, documentId: string) {
    if (!this._metaData.some((doc) => doc.id === documentId)) return;
    this._metaData = this._metaData.map((doc) =>
      doc.id === documentId ? { ...doc, title: newDocumentTitle } : doc
    );
    this.emit();
  }

  deleteDocument(documentId: string) {
    this._metaData = this._metaData.filter((doc) => doc.id !== documentId);
    if (this._activeDocument === documentId) {
      this._activeDocument = this._metaData[0]?.id ?? null;
    }
    this.emit();
  }

  private emit() {
    this.snapshot = {
      recentDocuments: this._metaData,
      activeDocumentId: this._activeDocument,
    };
    this.listeners.forEach((listener) => listener());
  }
}
