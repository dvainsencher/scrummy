import { describe, expect, it } from "vitest";
import type { Item } from "./types.js";
import { nextId } from "./ids.js";

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

describe("nextId", () => {
  it("returns 1 for an empty list", () => {
    expect(nextId([])).toBe(1);
  });

  it("returns max + 1", () => {
    expect(nextId([item(1), item(5)])).toBe(6);
  });

  it("is unaffected by item order", () => {
    expect(nextId([item(5), item(1), item(3)])).toBe(6);
  });
});
