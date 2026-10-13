import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addIssue } from "../cli/commands/addIssue.js";
import { claimIssue, releaseIssue, renewIssue } from "../cli/commands/claim.js";
import { createSprint } from "../cli/commands/createSprint.js";
import { editSprint } from "../cli/commands/editSprint.js";
import { init } from "../cli/commands/init.js";
import { move } from "../cli/commands/move.js";
import { removeIssue } from "../cli/commands/removeIssue.js";
import { setStatus } from "../cli/commands/setStatus.js";
import { diffSnapshots, fingerprint, takeSnapshot, watchRoadmap, type WatchEvent } from "./watch.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

describe("diffSnapshots", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-watch-"));
    init(cwd);
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  function changes(mutate: () => void): WatchEvent[] {
    const before = takeSnapshot(cwd);
    mutate();
    return diffSnapshots(before, takeSnapshot(cwd));
  }

  it("is empty when nothing changed", () => {
    addIssue(cwd, "A");
    expect(changes(() => {})).toEqual([]);
  });

  it("reports issue.added, issue.changed and issue.removed", () => {
    let id = 0;
    expect(changes(() => (id = addIssue(cwd, "A")))).toEqual([
      { type: "issue.added", id: 1, title: "A", status: "idea" },
    ]);
    expect(changes(() => setStatus(cwd, id, "ready"))).toEqual([
      { type: "issue.changed", id: 1, title: "A", changes: { status: { from: "idea", to: "ready" } } },
    ]);
    expect(changes(() => removeIssue(cwd, id))).toEqual([{ type: "issue.removed", id: 1, title: "A" }]);
  });

  it("reports sprint.added, sprint.changed, and a sprint move as an issue change", () => {
    const id = addIssue(cwd, "A");
    expect(changes(() => createSprint(cwd, "s1", { goal: "g" }))).toEqual([{ type: "sprint.added", name: "s1" }]);
    expect(changes(() => editSprint(cwd, "s1", { goal: "new" }))).toEqual([
      { type: "sprint.changed", name: "s1", changes: { goal: { from: "g", to: "new" } } },
    ]);
    expect(changes(() => move(cwd, id, "s1"))).toEqual([
      { type: "issue.changed", id, title: "A", changes: { sprint: { from: "", to: "s1" } } },
    ]);
  });

  it("emits a single claim event for a claim, renew and release", () => {
    const id = addIssue(cwd, "A", { status: "ready" });
    const T0 = Date.parse("2026-10-13T12:00:00Z");
    const acquired = changes(() => claimIssue(cwd, id, { agent: "alice", now: T0 }));
    expect(acquired).toEqual([
      { type: "claim.acquired", id, title: "A", assignee: "alice", leaseUntil: new Date(T0 + 7_200_000).toISOString() },
    ]);
    expect(changes(() => renewIssue(cwd, id, { agent: "alice", now: T0 + 1000 }))).toEqual([
      { type: "claim.renewed", id, title: "A", assignee: "alice", leaseUntil: new Date(T0 + 1000 + 7_200_000).toISOString() },
    ]);
    expect(changes(() => releaseIssue(cwd, id, { agent: "alice", now: T0 }))).toEqual([
      { type: "claim.released", id, title: "A", assignee: "alice" },
    ]);
  });

  it("reports a takeover with the previous holder", () => {
    const id = addIssue(cwd, "A", { status: "ready" });
    claimIssue(cwd, id, { agent: "alice" });
    const events = changes(() => claimIssue(cwd, id, { agent: "bob", steal: true }));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "claim.acquired", assignee: "bob", previousAssignee: "alice" });
  });

  it("reports done as an issue change plus the claim ending", () => {
    const id = addIssue(cwd, "A", { status: "ready" });
    claimIssue(cwd, id, { agent: "alice" });
    const events = changes(() => setStatus(cwd, id, "done"));
    expect(events.map((e) => e.type).sort()).toEqual(["claim.released", "issue.changed"]);
  });
});

describe("fingerprint", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-fp-"));
    init(cwd);
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("is stable when nothing changed and moves when something does", () => {
    const id = addIssue(cwd, "A");
    const before = fingerprint(cwd);
    expect(fingerprint(cwd)).toBe(before);
    setStatus(cwd, id, "doing");
    expect(fingerprint(cwd)).not.toBe(before);
  });
});

describe("watchRoadmap", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-watchloop-"));
    init(cwd);
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("emits events for changes made by another process", () => {
    const events: WatchEvent[] = [];
    const tsx = path.join(repoRoot, "node_modules", ".bin", "tsx");
    const cli = (...argv: string[]) =>
      expect(spawnSync(tsx, [path.join(repoRoot, "src", "bin", "scrummy.ts"), ...argv], { cwd, encoding: "utf8" }).status).toBe(0);

    const steps = [
      () => cli("add-issue", "from afar", "--status", "ready"),
      () => cli("claim", "1", "--as", "alice"),
      () => cli("remove-issue", "1"),
    ];
    let tick = 0;
    watchRoadmap(cwd, {
      emit: (event) => events.push(event),
      intervalMs: 0,
      sleep: () => steps[tick++]?.(),
      shouldStop: () => tick > steps.length,
    });

    expect(events.map((e) => e.type)).toEqual(["issue.added", "claim.acquired", "issue.removed"]);
  }, 60_000);

  it("retries instead of crashing when it catches a half-written file", () => {
    const events: WatchEvent[] = [];
    const bad = path.join(cwd, "docs", "roadmap", "issues", "9.json");
    let tick = 0;
    watchRoadmap(cwd, {
      emit: (event) => events.push(event),
      intervalMs: 0,
      sleep: () => {
        tick++;
        if (tick === 1) fs.writeFileSync(bad, "{ not json");
        if (tick === 2) fs.writeFileSync(bad, JSON.stringify({ id: 9, title: "ok", status: "idea", sprint: "", createdAt: "", updatedAt: "" }));
      },
      shouldStop: () => tick >= 3,
    });
    expect(events).toEqual([{ type: "issue.added", id: 9, title: "ok", status: "idea" }]);
  });
});
