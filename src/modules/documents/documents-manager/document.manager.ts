import type { DocumentRepository } from "../document-repository/document.repository";

export interface DocMeta {
  id: string;
  title: string;
  updatedAt: Date;
}

export interface DocumentManagerSnapshot {
  recentDocuments: readonly Readonly<DocMeta>[];
  activeDocumentId: string | null;
  activeRepository: DocumentRepository | null;
  repositories: readonly DocumentRepository[];
}

export class DocumentManager {
  private _metaData: DocMeta[];
  private _activeDocument: string | null;
  private _activeRepository: DocumentRepository | null = null;
  private snapshot: DocumentManagerSnapshot;
  private listeners = new Set<() => void>();
  private _repositories = new Map<
    string,
    { repository: DocumentRepository; stopListening: () => void }
  >();
  constructor(recentDocuments: DocMeta[]) {
    this._metaData = recentDocuments.slice(0, 5);
    this._activeDocument = this._metaData[0]?.id ?? null;
    this.snapshot = {
      recentDocuments: this._metaData,
      activeDocumentId: this._activeDocument,
      activeRepository: this._activeRepository,
      repositories: [],
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

  get activeRepository(): DocumentRepository | null {
    return this._activeRepository;
  }

  activateRepository(repository: DocumentRepository) {
    if (this._activeRepository === repository) return;
    this._activeRepository = repository;
    this.emit();
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

  registerRepository(repository: DocumentRepository) {
    if (this._repositories.has(repository.localKey)) return;

    const stopListening = repository.subscribe(() => this.emit());

    this._repositories.set(repository.localKey, {
      repository,
      stopListening,
    });

    this.emit();
  }

  unregisterRepository(localKey: string) {
    const { stopListening } = this._repositories.get(localKey) ?? {};
    if (stopListening) {
      stopListening();
    }
    this._repositories.delete(localKey);
    if (this._activeRepository?.localKey === localKey) {
      this._activeRepository = null;
      this._activeDocument = null;
    }
    this.emit();
  }

  getRepository(localKey: string) {
    return this._repositories.get(localKey) ?? null;
  }

  getRepositoryByDocumentId(documentId: string) {
    for (const { repository } of this._repositories.values()) {
      if (repository.documentId === documentId) return repository;
    }
    return null;
  }

  private emit() {
    if (this._activeRepository) {
      this._activeDocument = this._activeRepository.documentId;
    }
    this.snapshot = {
      recentDocuments: this._metaData,
      activeDocumentId: this._activeDocument,
      activeRepository: this._activeRepository,
      repositories: Array.from(this._repositories.values()).map(
        (repo) => repo.repository
      ),
    };
    this.listeners.forEach((listener) => listener());
  }
}
