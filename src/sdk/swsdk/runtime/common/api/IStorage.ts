export interface IStorage<T> {
  write(value: T): void;
  readAll(): T[];
  clear(): void;
}
