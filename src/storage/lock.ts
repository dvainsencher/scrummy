// Cross-process mutual exclusion for docs/roadmap/ mutations.
//
// Every mutating command is a read → modify → write-whole-file cycle, so two overlapping
// writers silently discard one mutation (measured: 20 concurrent add-issue calls left 3
// issues). This serializes them.
//
// The lock file lives in the OS temp dir, never in the repo. That matters: it can never be
// committed by accident, and no project consuming scrummy needs a .gitignore change for
// this to be safe — the no-op property is structural rather than something a flag has to
// get right. Nothing here shells out; see noGitSurface.test.ts for why that is enforced.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface LockOptions {
  /** How long to wait for a held lock before giving up. */
  timeoutMs?: number;
  /** A lock older than this is treated as abandoned. */
  staleMs?: number;
  /** Delay between acquisition attempts. */
  retryMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_STALE_MS = 30_000;
const DEFAULT_RETRY_MS = 20;

interface LockRecord {
  pid: number;
  startedAt: number;
}

/**
 * The lock file for a project root. Keyed on the *resolved* path so two routes to the same
 * working tree (a symlink, a trailing slash) contend for one lock rather than two.
 */
export function lockPathFor(cwd: string): string {
  let resolved: string;
  try {
    resolved = fs.realpathSync(cwd);
  } catch {
    resolved = path.resolve(cwd);
  }
  const digest = crypto.createHash("sha256").update(resolved).digest("hex").slice(0, 16);
  return path.join(os.tmpdir(), `scrummy-${digest}.lock`);
}

// Synchronous sleep. The whole CLI is synchronous, so yielding to the event loop here
// would mean restructuring every command handler for no benefit.
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readRecord(lockPath: string): LockRecord | undefined {
  try {
    const parsed = JSON.parse(fs.readFileSync(lockPath, "utf8")) as Partial<LockRecord>;
    if (typeof parsed.pid !== "number" || typeof parsed.startedAt !== "number") {
      return undefined;
    }
    return { pid: parsed.pid, startedAt: parsed.startedAt };
  } catch {
    // Missing (released between attempts) or malformed — both mean "not a lock we must respect".
    return undefined;
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // ESRCH: no such process. EPERM: it exists but belongs to another user, so it is alive.
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function isAbandoned(lockPath: string, record: LockRecord | undefined, staleMs: number): boolean {
  if (record === undefined) {
    // Either the holder created the file with O_EXCL microseconds ago and hasn't written
    // its record yet, or the file is genuinely corrupt. Contents can't tell these apart —
    // both read as unparseable — so judge by age instead. Reading "empty" as "abandoned"
    // let every contender steal from every other under load: 12 racing create-sprint calls
    // left 3 sprints even with the lock in place.
    let mtimeMs: number;
    try {
      mtimeMs = fs.statSync(lockPath).mtimeMs;
    } catch {
      return true; // released between our open and our stat
    }
    return Date.now() - mtimeMs > staleMs;
  }
  if (Date.now() - record.startedAt > staleMs) {
    return true;
  }
  // Covers a killed session that never reached its finally block. Guarded by the age check
  // above, so a recycled pid can at worst delay a takeover, never cause a false one.
  return !processIsAlive(record.pid);
}

/**
 * Run `fn` holding an exclusive lock on `cwd`'s roadmap. Always releases, including when
 * `fn` throws. Set SCRUMMY_NO_LOCK=1 to bypass entirely (escape hatch for a wedged lock).
 */
export function withRoadmapLock<T>(cwd: string, fn: () => T, options: LockOptions = {}): T {
  if (process.env.SCRUMMY_NO_LOCK) {
    return fn();
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
  const retryMs = options.retryMs ?? DEFAULT_RETRY_MS;
  const lockPath = lockPathFor(cwd);
  const deadline = Date.now() + timeoutMs;

  let handle: number | undefined;
  for (;;) {
    try {
      // wx is O_CREAT|O_EXCL — atomic across processes, which is the whole mechanism.
      handle = fs.openSync(lockPath, "wx");
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      const record = readRecord(lockPath);
      if (isAbandoned(lockPath, record, staleMs)) {
        // Best-effort steal. If a rival stole it first our next openSync just fails again
        // and we come back through here, so a lost race costs one extra iteration.
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // already gone
        }
        continue;
      }
      if (Date.now() >= deadline) {
        const held = record === undefined ? "another process" : `pid ${record.pid}`;
        throw new Error(
          `Timed out after ${timeoutMs}ms waiting for the roadmap lock held by ${held}.\n` +
            `If that process is gone, remove ${lockPath} or re-run with SCRUMMY_NO_LOCK=1.`,
        );
      }
      sleepSync(retryMs);
    }
  }

  try {
    const record: LockRecord = { pid: process.pid, startedAt: Date.now() };
    fs.writeSync(handle, JSON.stringify(record));
    fs.closeSync(handle);
    handle = undefined;
    return fn();
  } finally {
    if (handle !== undefined) {
      try {
        fs.closeSync(handle);
      } catch {
        // already closed
      }
    }
    try {
      fs.unlinkSync(lockPath);
    } catch {
      // already released or stolen after going stale
    }
  }
}
