import { describe, expect, it } from "vitest";
import { commandDescriptions, commands } from "./registry.js";
import { buildUsageText } from "./usage.js";

describe("buildUsageText", () => {
  it("lists each command with its description, sorted alphabetically", () => {
    const commands = { b: () => undefined, a: () => undefined };
    const descriptions = { a: "does a", b: "does b" };
    const text = buildUsageText(commands, descriptions);
    const lines = text.split("\n");
    expect(lines[0]).toBe("Usage: pauta <command> [args]");
    expect(lines.findIndex((l) => l.includes("a"))).toBeLessThan(
      lines.findIndex((l) => l.includes("b")),
    );
    expect(text).toContain("does a");
    expect(text).toContain("does b");
  });

  it("tolerates a command with no description", () => {
    const text = buildUsageText({ x: () => undefined }, {});
    expect(text).toContain("x");
  });
});

describe("commandDescriptions", () => {
  it("covers every command registered in commands (no silent blank descriptions)", () => {
    expect(Object.keys(commandDescriptions).sort()).toEqual(Object.keys(commands).sort());
  });
});
