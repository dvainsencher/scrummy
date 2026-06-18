import { describe, expect, it } from "vitest";
import type { Item, Sprint } from "./types.js";
import { assertItemExists, assertSprintExists, assertSprintNameAvailable } from "./validation.js";

function sprint(name: string): Sprint {
  return { name, position: 10, status: "planned", goal: "", notes: "" };
}

function item(id: number): Item {
  return {
    id,
    title: "x",
    status: "idea",
    sprint: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("assertSprintExists", () => {
  it("does not throw when the sprint exists", () => {
    expect(() => assertSprintExists([sprint("foundation")], "foundation")).not.toThrow();
  });

  it("throws when the sprint does not exist", () => {
    expect(() => assertSprintExists([sprint("foundation")], "missing")).toThrow(/missing/);
  });
});

describe("assertSprintNameAvailable", () => {
  it("does not throw for a new name", () => {
    expect(() => assertSprintNameAvailable([sprint("foundation")], "the-reader")).not.toThrow();
  });

  it("throws when the name is already taken", () => {
    expect(() => assertSprintNameAvailable([sprint("foundation")], "foundation")).toThrow(
      /foundation/,
    );
  });
});

describe("assertItemExists", () => {
  it("does not throw when the item exists", () => {
    expect(() => assertItemExists([item(1)], 1)).not.toThrow();
  });

  it("throws when the item does not exist", () => {
    expect(() => assertItemExists([item(1)], 999)).toThrow(/999/);
  });
});
