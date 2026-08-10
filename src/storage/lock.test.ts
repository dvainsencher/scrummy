import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lockPathFor, withRoadmapLock } from "./lock.js";

describe("lockPathFor", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-lockpath-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("puts the lock in the OS temp dir, never inside the project", () => {
    const lockPath = lockPathFor(dir);
    expect(path.dirname(lockPath)).toBe(fs.realpathSync(os.tmpdir()));
    expect(lockPath.startsWith(dir)).toBe(false);
  });

  it("gives different projects different locks", () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-lockpath-"));
    try {
      expect(lockPathFor(dir)).not.toBe(lockPathFor(other));
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  it("resolves two routes to the same tree onto one lock", () => {
    const link = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-lnk-")), "alias");
    fs.symlinkSync(dir, link, "dir");
    try {
      expect(lockPathFor(link)).toBe(lockPathFor(dir));
      expect(lockPathFor(`${dir}${path.sep}`)).toBe(lockPathFor(dir));
    } finally {
      fs.rmSync(path.dirname(link), { recursive: true, force: true });
    }
  });
});

describe("withRoadmapLock", () => {
  let dir: string;
  let lockPath: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-lock-"));
    lockPath = lockPathFor(dir);
    fs.rmSync(lockPath, { force: true });
    delete process.env.SCRUMMY_NO_LOCK;
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(lockPath, { force: true });
    delete process.env.SCRUMMY_NO_LOCK;
  });

  function holdLock(record: { pid: number; startedAt: number }): void {
    fs.writeFileSync(lockPath, JSON.stringify(record));
  }

  it("runs the callback and returns its value", () => {
    expect(withRoadmapLock(dir, () => "result")).toBe("result");
  });

  it("holds the lock for the duration of the callback", () => {
    withRoadmapLock(dir, () => {
      expect(fs.existsSync(lockPath)).toBe(true);
      const record = JSON.parse(fs.readFileSync(lockPath, "utf8")) as { pid: number };
      expect(record.pid).toBe(process.pid);
    });
  });

  it("releases the lock afterwards", () => {
    withRoadmapLock(dir, () => undefined);
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it("releases the lock when the callback throws", () => {
    expect(() => withRoadmapLock(dir, () => {
      throw new Error("boom");
    })).toThrow("boom");
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it("times out against a live holder, naming the pid and the escape hatch", () => {
    holdLock({ pid: process.pid, startedAt: Date.now() });
    expect(() => withRoadmapLock(dir, () => undefined, { timeoutMs: 60, retryMs: 5 })).toThrow(
      new RegExp(`pid ${process.pid}[\\s\\S]*SCRUMMY_NO_LOCK`),
    );
    // The rightful holder's lock must survive a failed acquisition.
    expect(fs.existsSync(lockPath)).toBe(true);
  });

  it("takes over a lock whose holder is long gone by age", () => {
    holdLock({ pid: process.pid, startedAt: Date.now() - 60_000 });
    expect(withRoadmapLock(dir, () => "took over", { staleMs: 1_000, timeoutMs: 200 })).toBe("took over");
  });

  it("takes over a lock whose holder process no longer exists", () => {
    // pid 2^22 is above Linux's default pid_max, so it can never be live.
    holdLock({ pid: 4_194_304, startedAt: Date.now() });
    expect(withRoadmapLock(dir, () => "took over", { timeoutMs: 200 })).toBe("took over");
  });

  // Regression: openSync(path, "wx") creates an EMPTY file and the record lands a moment
  // later. Treating an unparseable record as "abandoned" made every contender steal the
  // lock from the holder that had just created it — 12 racing create-sprint calls left 3
  // sprints. An unreadable lock must be judged by age, never by its contents.
  it("respects a just-created lock that has not been filled in yet", () => {
    fs.writeFileSync(lockPath, "");
    expect(() => withRoadmapLock(dir, () => undefined, { timeoutMs: 60, retryMs: 5 })).toThrow(
      /Timed out/,
    );
    expect(fs.existsSync(lockPath)).toBe(true);
  });

  it("takes over an unparseable lock once it ages out, rather than wedging forever", () => {
    fs.writeFileSync(lockPath, "not json");
    const twoMinutesAgo = new Date(Date.now() - 120_000);
    fs.utimesSync(lockPath, twoMinutesAgo, twoMinutesAgo);
    expect(withRoadmapLock(dir, () => "took over", { staleMs: 1_000, timeoutMs: 200 })).toBe("took over");
  });

  it("does not contend with a lock held for a different project", () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), "scrummy-lock-other-"));
    try {
      fs.writeFileSync(lockPathFor(other), JSON.stringify({ pid: process.pid, startedAt: Date.now() }));
      expect(withRoadmapLock(dir, () => "unblocked", { timeoutMs: 200 })).toBe("unblocked");
    } finally {
      fs.rmSync(lockPathFor(other), { force: true });
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  it("bypasses locking entirely under SCRUMMY_NO_LOCK", () => {
    process.env.SCRUMMY_NO_LOCK = "1";
    holdLock({ pid: process.pid, startedAt: Date.now() });
    expect(withRoadmapLock(dir, () => {
      // The held lock is neither respected nor disturbed.
      return fs.readFileSync(lockPath, "utf8");
    }, { timeoutMs: 50 })).toContain(String(process.pid));
  });
});
