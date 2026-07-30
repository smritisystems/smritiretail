export type PersistenceScope = 'session' | 'draft' | 'preference';

export interface WorkspacePersistenceEntry {
  key: string;
  scope: PersistenceScope;
  value: unknown;
  version: number;
  updatedAt: string;
}

export interface WorkspaceManagerApi {
  save(key: string, value: unknown, scope: PersistenceScope): Promise<void>;
  restore<T>(key: string, scope: PersistenceScope, fallback?: T): Promise<T | undefined>;
  clear(key: string, scope: PersistenceScope): Promise<void>;
}

export class WorkspaceManager implements WorkspaceManagerApi {
  private readonly storage = new Map<string, WorkspacePersistenceEntry>();

  async save(key: string, value: unknown, scope: PersistenceScope): Promise<void> {
    this.storage.set(key, {
      key,
      scope,
      value,
      version: 1,
      updatedAt: new Date().toISOString(),
    });
  }

  async restore<T>(key: string, scope: PersistenceScope, fallback?: T): Promise<T | undefined> {
    const entry = this.storage.get(`${scope}:${key}`);
    return (entry?.value as T | undefined) ?? fallback;
  }

  async clear(key: string, scope: PersistenceScope): Promise<void> {
    this.storage.delete(`${scope}:${key}`);
  }
}

export const workspaceManager = new WorkspaceManager();
