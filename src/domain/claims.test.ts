import { describe, expect, it } from "vitest";
import type { Issue } from "./types.js";
import { claimState, DEFAULT_LEASE_MS, parseLease, resolveAgent, withoutClaim } from "./claims.js";

describe("parseLease", () => {
  it("parses seconds, minutes, hours and days", () => {
    expect(parseLease("90s")).toBe(90_000);
    expect(parseLease("30m")).toBe(1_800_000);
    expect(parseLease("2h")).toBe(7_200_000);
    expect(parseLease("1d")).toBe(86_400_000);
  });

  it("defaults to two hours", () => {
    expect(parseLease(undefined)).toBe(DEFAULT_LEASE_MS);
    expect(DEFAULT_LEASE_MS).toBe(7_200_000);
  });

  it("rejects junk, zero and bare numbers", () => {
    for (const bad of ["", "abc", "0m", "10", "-1h", "1.5h"]) {
      expect(() => parseLease(bad)).toThrow(/lease/i);
    }
  });
});

describe("claimState", () => {
  const base: Issue = { id: 1, title: "t", status: "ready", sprint: "", createdAt: "", updatedAt: "" };
  const now = Date.parse("2026-10-13T12:00:00Z");

  it("is free without an assignee", () => {
    expect(claimState(base, now)).toBe("free");
  });

  it("is held until leaseUntil, then expired", () => {
    const issue = { ...base, assignee: "a", leaseUntil: "2026-10-13T13:00:00.000Z" };
    expect(claimState(issue, now)).toBe("held");
    expect(claimState(issue, now + 2 * 3_600_000)).toBe("expired");
  });
});

describe("resolveAgent", () => {
  it("prefers --as, then SCRUMMY_AGENT, then the worktree directory name", () => {
    expect(resolveAgent("flag", { SCRUMMY_AGENT: "env" }, "/x/wt")).toBe("flag");
    expect(resolveAgent(undefined, { SCRUMMY_AGENT: "env" }, "/x/wt")).toBe("env");
    expect(resolveAgent(undefined, {}, "/x/wt")).toBe("wt");
  });

  it("ignores a bare --as flag without a value", () => {
    expect(resolveAgent(true, {}, "/x/wt")).toBe("wt");
  });
});

describe("resolveAgent validation", () => {
  it("trims the name", () => {
    expect(resolveAgent("  alice ", {}, "/x/wt")).toBe("alice");
  });

  it("rejects control characters and whitespace-only names", () => {
    expect(() => resolveAgent("a\nb", {}, "/x/wt")).toThrow(/agent/i);
    expect(() => resolveAgent("a\u001b[31m", {}, "/x/wt")).toThrow(/agent/i);
    expect(() => resolveAgent(undefined, { SCRUMMY_AGENT: "x\ty" }, "/x/wt")).toThrow(/agent/i);
  });

  it("falls back past a blank flag", () => {
    expect(resolveAgent("   ", {}, "/x/wt")).toBe("wt");
  });
});

describe("withoutClaim", () => {
  it("drops the three claim fields only", () => {
    const issue: Issue = {
      id: 1, title: "t", status: "doing", sprint: "", createdAt: "c", updatedAt: "u",
      assignee: "a", claimedAt: "x", leaseUntil: "y",
    };
    expect(withoutClaim(issue)).toEqual({
      id: 1, title: "t", status: "doing", sprint: "", createdAt: "c", updatedAt: "u",
    });
  });
});
