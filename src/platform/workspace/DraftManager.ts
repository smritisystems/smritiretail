export interface DraftRecord {
  id: string;
  entityType: string;
  payload: Record<string, unknown>;
  updatedAt: string;
  status: 'draft' | 'saved';
}

export class DraftManager {
  private drafts = new Map<string, DraftRecord>();

  saveDraft(id: string, entityType: string, payload: Record<string, unknown>): void {
    this.drafts.set(id, {
      id,
      entityType,
      payload,
      updatedAt: new Date().toISOString(),
      status: 'draft',
    });
  }

  restoreDraft(id: string): DraftRecord | undefined {
    return this.drafts.get(id);
  }

  clearDraft(id: string): void {
    this.drafts.delete(id);
  }
}
