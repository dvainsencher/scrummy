import { describe, expect, it } from "vitest";
import { parseArgs, requireIntPositional, requirePositional } from "./parse.js";

describe("parseArgs", () => {
  it("collects positionals", () => {
    expect(parseArgs(["a", "b"]).positionals).toEqual(["a", "b"]);
  });

  it("parses a --flag value pair", () => {
    expect(parseArgs(["--status", "ready"]).flags).toEqual({ status: "ready" });
  });

  it("parses a boolean --flag with no value", () => {
    expect(parseArgs(["--backlog"]).flags).toEqual({ backlog: true });
  });

  it("parses a boolean --flag followed by another flag", () => {
    expect(parseArgs(["--backlog", "--force"]).flags).toEqual({ backlog: true, force: true });
  });

  it("mixes positionals and flags", () => {
    const parsed = parseArgs(["42", "--status", "doing"]);
    expect(parsed.positionals).toEqual(["42"]);
    expect(parsed.flags).toEqual({ status: "doing" });
  });
});

describe("requirePositional", () => {
  it("returns the value when present", () => {
    expect(requirePositional(parseArgs(["x"]), 0, "title")).toBe("x");
  });

  it("throws a labeled error when missing", () => {
    expect(() => requirePositional(parseArgs([]), 0, "title")).toThrow(/title/);
  });
});

describe("requireIntPositional", () => {
  it("parses an integer", () => {
    expect(requireIntPositional(parseArgs(["42"]), 0, "id")).toBe(42);
  });

  it("throws for a non-integer", () => {
    expect(() => requireIntPositional(parseArgs(["abc"]), 0, "id")).toThrow(/id/);
  });
});
