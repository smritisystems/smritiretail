export interface IPlatformObject {
  id: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  metadata?: Record<string, unknown>;
}
