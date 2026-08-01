export interface ISerializer<T> {
  serialize(value: T): string;
  deserialize(raw: string): T;
}
