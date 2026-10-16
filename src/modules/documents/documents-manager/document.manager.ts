import type { DocumentRepository } from "../document-repository/document.repository";
import { deleteDocumentAction, renameDocumentAction } from "../server/actions";

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

const CACHE_TTL_MS = 3 * 60_000;

export class DocumentManager {
  private _metaData: DocMeta[];
  private _activeRepository: DocumentRepository | null = null;
  private snapshot: DocumentManagerSnapshot;
  private listeners = new Set<() => void>();
  private deletedDocuments = new Set<string>();
  private pendingDeletes = new Map<
    string,
    ReturnType<typeof deleteDocumentAction>
  >();
  private _repositories = new Map<
    string,
    { repository: DocumentRepository; stopListening: () => void }
  >();
  constructor(recentDocuments: DocMeta[]) {
    this._metaData = [...recentDocuments];
    this.snapshot = {
      recentDocuments: this._metaData.slice(0, 50),
      activeDocumentId: this.activeDocumentId,
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
    return this._activeRepository?.documentId ?? null;
  }

  get activeRepository(): DocumentRepository | null {
    return this._activeRepository;
  }

  activateRepository(repository: DocumentRepository) {
    if (
      repository.documentId &&
      this.isDocumentUnavailable(repository.documentId)
    )
      return;
    if (this._activeRepository === repository) return;
    if (this._activeRepository) this._activeRepository.lastUsedAt = Date.now();
    this._activeRepository = repository;
    if (repository.documentId) {
      this.rememberDocument({
        id: repository.documentId,
        title: repository.title,
        updatedAt: repository.updatedAt,
      });
    }
    this.emit();
  }

  openDocument(document: DocMeta) {
    if (this.isDocumentUnavailable(document.id)) return;
    this.rememberDocument(document);
    this.emit();
  }

  private rememberDocument(document: DocMeta) {
    const existing = this._metaData.find((doc) => doc.id === document.id);
    this._metaData = [
      existing ?? document,
      ...this._metaData.filter((doc) => doc.id !== document.id),
    ];
  }

  async renameDocument(title: string, documentId: string) {
    try {
      const result = await renameDocumentAction(title, documentId);
      if (!result.ok) return result;
      this._metaData = this._metaData.map((doc) =>
        doc.id === documentId ? { ...doc, ...result.data } : doc
      );
      this.emit();
      return result;
    } catch {
      return {
        ok: false as const,
        error: {
          code: "internal",
          message: "Could not rename document. Try again.",
        },
      };
    }
  }

  deleteDocument(documentId: string) {
    if (this.isDocumentUnavailable(documentId)) {
      return Promise.resolve({ ok: true as const, data: { id: documentId } });
    }
    const pending = this.pendingDeletes.get(documentId);
    if (pending) return pending;

    this.getRepositoryByDocumentId(documentId)?.pauseSaving();
    const operation = this.performDelete(documentId).finally(() => {
      this.pendingDeletes.delete(documentId);
      if (!this.isDocumentUnavailable(documentId)) {
        void this.getRepositoryByDocumentId(documentId)
          ?.resumeSaving()
          .catch(console.error);
      }
    });
    this.pendingDeletes.set(documentId, operation);
    return operation;
  }

  private async performDelete(documentId: string) {
    try {
      const result = await deleteDocumentAction(documentId);
      if (!result.ok) return result;
      const repository = this.getRepositoryByDocumentId(documentId);
      repository?.markDeleted();
      this.deletedDocuments.add(documentId);
      this._metaData = this._metaData.filter((doc) => doc.id !== documentId);
      if (repository) this.unregisterRepository(repository.localKey);
      else this.emit();
      return result;
    } catch {
      return {
        ok: false as const,
        error: {
          code: "internal",
          message: "Could not delete document. Try again.",
        },
      };
    }
  }

  isDocumentUnavailable(documentId: string) {
    return this.deletedDocuments.has(documentId);
  }

  registerRepository(repository: DocumentRepository) {
    if (this._repositories.has(repository.localKey)) return;

    if (
      repository.documentId &&
      this.isDocumentUnavailable(repository.documentId)
    ) {
      repository.markDeleted();
      return;
    }
    if (
      repository.documentId &&
      this.pendingDeletes.has(repository.documentId)
    ) {
      repository.pauseSaving();
    }

    let knownId = repository.documentId;
    const stopListening = repository.subscribe(() => {
      if (repository.documentId && repository.documentId !== knownId) {
        knownId = repository.documentId;
        this.rememberDocument({
          id: knownId,
          title: repository.title,
          updatedAt: repository.updatedAt,
        });
      }
      this.emit();
    });

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
    }
    this.emit();
  }

  getRepository(localKey: string) {
    return this._repositories.get(localKey) ?? null;
  }

  getRepositoryByDocumentId(documentId: string) {
    if (this.isDocumentUnavailable(documentId)) return null;
    for (const { repository } of this._repositories.values()) {
      if (repository.documentId === documentId) return repository;
    }
    return null;
  }

  getCachedRepository(documentId: string) {
    const repository = this.getRepositoryByDocumentId(documentId);
    if (!repository || repository === this._activeRepository) return repository;
    const expired = Date.now() - repository.lastUsedAt > CACHE_TTL_MS;
    if (expired && repository.isClean()) {
      this.unregisterRepository(repository.localKey);
      return null;
    }
    return repository;
  }

  private emit() {
    this.snapshot = {
      recentDocuments: this._metaData.slice(0, 50),
      activeDocumentId: this.activeDocumentId,
      activeRepository: this._activeRepository,
      repositories: Array.from(this._repositories.values()).map(
        (repo) => repo.repository
      ),
    };
    this.listeners.forEach((listener) => listener());
  }
}
