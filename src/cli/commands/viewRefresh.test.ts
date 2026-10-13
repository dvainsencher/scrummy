import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { issuesDir } from "../../storage/paths.js";
import { addIssue } from "./addIssue.js";
import { createSprint } from "./createSprint.js";
import { init } from "./init.js";
import { move } from "./move.js";
import { setStatus } from "./setStatus.js";
import { fingerprint } from "../../storage/watch.js";
import { refreshViewData } from "./viewRefresh.js";

describe("viewRefresh", () => {
  let cwd: string;

  beforeEach(() => {
    cwd = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-refresh-"));
    init(cwd);
  });

  afterEach(() => {
    fs.rmSync(cwd, { recursive: true, force: true });
  });

  it("fingerprint is stable when nothing changed", () => {
    addIssue(cwd, "A");
    expect(fingerprint(cwd)).toBe(fingerprint(cwd));
  });

  it("fingerprint changes after add-issue, set-status and move", () => {
    const seen = new Set([fingerprint(cwd)]);
    const id = addIssue(cwd, "A");
    seen.add(fingerprint(cwd));
    setStatus(cwd, id, "doing");
    seen.add(fingerprint(cwd));
    createSprint(cwd, "s1", { goal: "g" });
    seen.add(fingerprint(cwd));
    move(cwd, id, "s1");
    seen.add(fingerprint(cwd));
    expect(seen.size).toBe(5);
  });

  it("refreshViewData returns fresh plan and data", () => {
    const id = addIssue(cwd, "A");
    setStatus(cwd, id, "done");
    const result = refreshViewData(cwd);
    expect(result?.data.columns.done.map((i) => i.id)).toContain(id);
  });

  it("refreshViewData returns null instead of throwing on a half-written file", () => {
    addIssue(cwd, "A");
    fs.writeFileSync(path.join(issuesDir(cwd), "999.json"), "{ not json");
    expect(refreshViewData(cwd)).toBeNull();
  });
});
