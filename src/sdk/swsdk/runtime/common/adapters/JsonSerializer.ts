import type { ISerializer } from "../api/ISerializer.js";

export class JsonSerializer<T> implements ISerializer<T> {
  public serialize(value: T): string {
    return JSON.stringify(value, null, 2);
  }

  public deserialize(raw: string): T {
    return JSON.parse(raw) as T;
  }
}
