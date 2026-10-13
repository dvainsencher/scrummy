import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readIssues } from "../../storage/issuesStore.js";
import { addIssue } from "./addIssue.js";
import { claimIssue, nextIssue, releaseIssue, renewIssue } from "./claim.js";
import { createSprint } from "./createSprint.js";
import { init } from "./init.js";
import { move } from "./move.js";
import { setStatus } from "./setStatus.js";

const T0 = Date.parse("2026-10-13T12:00:00Z");
const HOUR = 3_600_000;

describe("claims", () => {
  let cwd: string;
  let id: number;

  const issue = (n = id) => readIssues(cwd).find((i) => i.id === n)!;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-claim-"));
    init(cwd);
    id = addIssue(cwd, "Dark mode", { status: "ready" });
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  describe("claimIssue", () => {
    it("records the holder, sets doing, and applies the default 2h lease", () => {
      claimIssue(cwd, id, { agent: "alice", now: T0 });
      expect(issue()).toMatchObject({
        status: "doing",
        assignee: "alice",
        claimedAt: new Date(T0).toISOString(),
        leaseUntil: new Date(T0 + 2 * HOUR).toISOString(),
      });
    });

    it("honours a custom lease", () => {
      claimIssue(cwd, id, { agent: "alice", lease: "30m", now: T0 });
      expect(issue().leaseUntil).toBe(new Date(T0 + HOUR / 2).toISOString());
    });

    it("refuses while another agent holds an unexpired lease", () => {
      claimIssue(cwd, id, { agent: "alice", now: T0 });
      expect(() => claimIssue(cwd, id, { agent: "bob", now: T0 + HOUR })).toThrow(/alice/);
      expect(issue().assignee).toBe("alice");
    });

    it("lets another agent take an expired lease", () => {
      claimIssue(cwd, id, { agent: "alice", now: T0 });
      claimIssue(cwd, id, { agent: "bob", now: T0 + 3 * HOUR });
      expect(issue().assignee).toBe("bob");
    });

    it("lets --steal override a live lease", () => {
      claimIssue(cwd, id, { agent: "alice", now: T0 });
      claimIssue(cwd, id, { agent: "bob", steal: true, now: T0 + HOUR });
      expect(issue().assignee).toBe("bob");
    });

    it("is idempotent for the same agent, keeping claimedAt and extending the lease", () => {
      claimIssue(cwd, id, { agent: "alice", now: T0 });
      claimIssue(cwd, id, { agent: "alice", now: T0 + HOUR });
      expect(issue().claimedAt).toBe(new Date(T0).toISOString());
      expect(issue().leaseUntil).toBe(new Date(T0 + 3 * HOUR).toISOString());
    });

    it("refuses a done issue and an unknown id", () => {
      setStatus(cwd, id, "done");
      expect(() => claimIssue(cwd, id, { agent: "alice" })).toThrow(/done/);
      expect(() => claimIssue(cwd, 999, { agent: "alice" })).toThrow(/999/);
    });
  });

  describe("releaseIssue", () => {
    it("clears the claim and puts a doing issue back to ready", () => {
      claimIssue(cwd, id, { agent: "alice", now: T0 });
      releaseIssue(cwd, id, { agent: "alice", now: T0 });
      expect(issue()).toMatchObject({ status: "ready" });
      expect(issue().assignee).toBeUndefined();
      expect(issue().leaseUntil).toBeUndefined();
    });

    it("refuses another agent's live claim unless --steal", () => {
      claimIssue(cwd, id, { agent: "alice", now: T0 });
      expect(() => releaseIssue(cwd, id, { agent: "bob", now: T0 })).toThrow(/alice/);
      releaseIssue(cwd, id, { agent: "bob", steal: true, now: T0 });
      expect(issue().assignee).toBeUndefined();
    });

    it("is a harmless no-op on an unclaimed issue", () => {
      releaseIssue(cwd, id, { agent: "alice" });
      expect(issue().status).toBe("ready");
    });
  });

  describe("renewIssue", () => {
    it("extends the holder's lease from now", () => {
      claimIssue(cwd, id, { agent: "alice", now: T0 });
      renewIssue(cwd, id, { agent: "alice", lease: "1h", now: T0 + HOUR });
      expect(issue().leaseUntil).toBe(new Date(T0 + 2 * HOUR).toISOString());
    });

    it("refuses someone who does not hold the claim", () => {
      claimIssue(cwd, id, { agent: "alice", now: T0 });
      expect(() => renewIssue(cwd, id, { agent: "bob", now: T0 })).toThrow(/alice/);
      expect(() => renewIssue(cwd, addIssue(cwd, "free"), { agent: "bob" })).toThrow(/not claimed/);
    });
  });

  describe("status changes end the claim", () => {
    it("moving a claimed issue to ready or idea clears it", () => {
      claimIssue(cwd, id, { agent: "alice", now: T0 });
      setStatus(cwd, id, "ready");
      expect(issue().assignee).toBeUndefined();
    });

    it("setting doing keeps an existing claim", () => {
      claimIssue(cwd, id, { agent: "alice", now: T0 });
      setStatus(cwd, id, "doing");
      expect(issue().assignee).toBe("alice");
    });
  });

  describe("expired claims", () => {
    it("can be released by anyone and renewed by the original holder", () => {
      claimIssue(cwd, id, { agent: "alice", now: T0 });
      renewIssue(cwd, id, { agent: "alice", now: T0 + 3 * HOUR });
      expect(issue().leaseUntil).toBe(new Date(T0 + 5 * HOUR).toISOString());
      releaseIssue(cwd, id, { agent: "bob", now: T0 + 9 * HOUR });
      expect(issue().assignee).toBeUndefined();
    });

    it("renew bumps updatedAt", () => {
      claimIssue(cwd, id, { agent: "alice", now: T0 });
      renewIssue(cwd, id, { agent: "alice", now: T0 + HOUR });
      expect(issue().updatedAt).toBe(new Date(T0 + HOUR).toISOString());
    });
  });

  describe("done clears the claim", () => {
    it("drops assignee, claimedAt and leaseUntil", () => {
      claimIssue(cwd, id, { agent: "alice", now: T0 });
      setStatus(cwd, id, "done");
      const done = issue();
      expect(done.assignee).toBeUndefined();
      expect(done.claimedAt).toBeUndefined();
      expect(done.leaseUntil).toBeUndefined();
    });
  });

  describe("nextIssue", () => {
    it("picks the first ready unclaimed issue, active sprint first", () => {
      createSprint(cwd, "later", { goal: "" });
      createSprint(cwd, "now", { goal: "" });
      const a = addIssue(cwd, "A", { status: "ready" });
      const b = addIssue(cwd, "B", { status: "ready" });
      const c = addIssue(cwd, "C", { status: "doing" });
      move(cwd, a, "later");
      move(cwd, b, "now");
      move(cwd, c, "now");
      expect(nextIssue(cwd, { agent: "x" })).toContain(`#${b}`);
      expect(nextIssue(cwd, { agent: "x", sprint: "later" })).toContain(`#${a}`);
    });

    it("skips live claims but takes expired ones", () => {
      const other = addIssue(cwd, "Other", { status: "ready" });
      claimIssue(cwd, id, { agent: "alice", now: T0 });
      expect(nextIssue(cwd, { agent: "bob", now: T0 + HOUR })).toContain(`#${other}`);
      releaseIssue(cwd, other, { agent: "x", steal: true });
      setStatus(cwd, other, "idea");
      expect(() => nextIssue(cwd, { agent: "bob", now: T0 + HOUR })).toThrow(/No ready/);
      expect(nextIssue(cwd, { agent: "bob", now: T0 + 3 * HOUR })).toContain(`#${id}`);
    });

    it("rejects an unknown sprint", () => {
      expect(() => nextIssue(cwd, { agent: "x", sprint: "nope" })).toThrow(/does not exist/);
    });

    it("says so when nothing is available", () => {
      setStatus(cwd, id, "idea");
      expect(() => nextIssue(cwd, { agent: "x" })).toThrow(/No ready unclaimed issue/);
    });

    it("only claims with --claim", () => {
      nextIssue(cwd, { agent: "bob", now: T0 });
      expect(issue().assignee).toBeUndefined();
      nextIssue(cwd, { agent: "bob", claim: true, now: T0 });
      expect(issue()).toMatchObject({ assignee: "bob", status: "doing" });
    });
  });
});
