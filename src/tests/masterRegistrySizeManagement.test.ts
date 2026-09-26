import { describe, expect, it } from "vitest";
import { getMasterRegistryTypeConfig } from "../components/masterRegistry/sizeManagement";

describe("Master Registry size management configuration", () => {
  it("provides a dedicated size-group registry config connected to the Master Registry", () => {
    const config = getMasterRegistryTypeConfig("size_group");

    expect(config.title).toBe("Size Management");
    expect(config.apiEndpoint).toBe("/masters/size-groups");
    expect(config.fields).toHaveLength(0);
    expect(config.permissions).toEqual({ createRole: [], editRole: [], deleteRole: [] });
    expect(config.slots?.extraHeaderActions).toBeTypeOf("function");
  });

  it("provides a separate editable Master Registry mode for ordered values", () => {
    const config = getMasterRegistryTypeConfig("size_group_registry", "manage");

    expect(config.title).toBe("Size Group Master Registry");
    expect(config.permissions).toBeUndefined();
    const codeField = config.fields.find((field) => field.name === "code");
    expect(codeField?.type).toBe("select");
    expect(codeField?.optionsEndpoint).toBe("/masters/size-groups");
    expect(config.fields.some((field) => field.name === "values")).toBe(true);
  });
});
