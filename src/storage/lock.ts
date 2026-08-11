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
  /** An *unreadable* lock file older than this is treated as junk. */
  staleMs?: number;
  /** A lock held by a still-live pid is only reclaimed past this age. See isAbandoned. */
  livePidStaleMs?: number;
  /** Delay between acquisition attempts. */
  retryMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_STALE_MS = 30_000;
// Deliberately long: a live pid holding the lock is almost certainly the real holder, so
// this only exists to eventually free a lock whose pid died and was recycled onto an
// unrelated process. Anything shorter risks evicting a slow-but-healthy holder, which is
// exactly the lost-update bug the lock exists to prevent. SCRUMMY_NO_LOCK=1 is the
// escape hatch if one ever genuinely wedges.
const DEFAULT_LIVE_PID_STALE_MS = 600_000;
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

function isAbandoned(
  lockPath: string,
  record: LockRecord | undefined,
  staleMs: number,
  livePidStaleMs: number,
): boolean {
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
  // Liveness is authoritative, and it is checked FIRST. Age used to decide this on its
  // own, which meant any command whose work outlived staleMs had its lock stolen
  // mid-write by a rival — two concurrent writers, i.e. the lost-update bug this lock
  // exists to prevent. A dead holder is reclaimed at once; a live one is left alone
  // until the recycled-pid backstop, which is deliberately long.
  if (!processIsAlive(record.pid)) {
    return true;
  }
  return Date.now() - record.startedAt > livePidStaleMs;
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
  const livePidStaleMs = options.livePidStaleMs ?? DEFAULT_LIVE_PID_STALE_MS;
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
      if (isAbandoned(lockPath, record, staleMs, livePidStaleMs)) {
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

  const ourRecord: LockRecord = { pid: process.pid, startedAt: Date.now() };
  try {
    fs.writeSync(handle, JSON.stringify(ourRecord));
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
    releaseIfStillOurs(lockPath, ourRecord);
  }
}

/**
 * Remove the lock only if this process still holds it.
 *
 * Release used to be an unconditional unlink. If our lock had been reclaimed while we
 * worked, that deleted the *new* holder's lock and let a third process straight in — one
 * eviction cascading into unbounded concurrent writers.
 */
function releaseIfStillOurs(lockPath: string, ours: LockRecord): void {
  const current = readRecord(lockPath);
  if (current === undefined || current.pid !== ours.pid || current.startedAt !== ours.startedAt) {
    return; // gone, unreadable, or someone else's — not ours to remove
  }
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // released concurrently
  }
}
