import type { IStorage } from "../api/IStorage.js";

export class MemoryStorage<T> implements IStorage<T> {
  private readonly values: T[] = [];

  public write(value: T): void {
    this.values.push(value);
  }

  public readAll(): T[] {
    return [...this.values];
  }

  public clear(): void {
    this.values.length = 0;
  }
}
