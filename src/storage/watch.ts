// Change detection for the roadmap: a cheap fingerprint of the record files, plus a
// snapshot diff that turns "something changed" into typed events.
//
// Polling a fingerprint beats fs.watch here — recursive watch is unreliable across
// platforms and tmp+rename writes fire event storms. No on-disk event log: events are the
// diff between two snapshots, so the store layout stays exactly as it is.
import fs from "node:fs";
import path from "node:path";
import type { Issue, Sprint } from "../domain/types.js";
import { readIssues } from "./issuesStore.js";
import { sleepSync } from "./lock.js";
import {
  issuesDir,
  legacyIssuesFilePath,
  legacyProgressFilePath,
  legacySprintsFilePath,
  progressDir,
  specsDir,
  sprintsDir,
} from "./paths.js";
import { readSprints } from "./sprintsStore.js";

function statLine(file: string): string {
  try {
    const st = fs.statSync(file);
    return `${file}:${st.mtimeMs}:${st.size}`;
  } catch {
    return "";
  }
}

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    // Writers stage `.<name>.<pid>.tmp` files and rename them; ignore those.
    if (entry.name.endsWith(".tmp")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
}

/** Cheap change signal: path + mtime + size of every roadmap record file. */
export function fingerprint(cwd: string): string {
  const files: string[] = [];
  for (const dir of [issuesDir(cwd), sprintsDir(cwd), progressDir(cwd), specsDir(cwd)]) {
    walk(dir, files);
  }
  files.push(legacyIssuesFilePath(cwd), legacySprintsFilePath(cwd), legacyProgressFilePath(cwd));
  return files.sort().map(statLine).filter(Boolean).join("\n");
}

export interface Snapshot {
  issues: Map<number, Issue>;
  sprints: Map<string, Sprint>;
}

/** Throws if a record is caught mid-write; callers retry on the next tick. */
export function takeSnapshot(cwd: string): Snapshot {
  return {
    issues: new Map(readIssues(cwd).map((issue) => [issue.id, issue])),
    sprints: new Map(readSprints(cwd).map((sprint) => [sprint.name, sprint])),
  };
}

type Change = { from: unknown; to: unknown };

export type WatchEvent =
  | { type: "issue.added"; id: number; title: string; status: string }
  | { type: "issue.removed"; id: number; title: string }
  | { type: "issue.changed"; id: number; title: string; changes: Record<string, Change> }
  | { type: "sprint.added"; name: string }
  | { type: "sprint.removed"; name: string }
  | { type: "sprint.changed"; name: string; changes: Record<string, Change> }
  | { type: "claim.acquired"; id: number; title: string; assignee: string; leaseUntil?: string; previousAssignee?: string }
  | { type: "claim.renewed"; id: number; title: string; assignee: string; leaseUntil?: string }
  | { type: "claim.released"; id: number; title: string; assignee: string };

function fieldChanges<T extends object>(before: T, after: T, fields: readonly (keyof T & string)[]): Record<string, Change> {
  const out: Record<string, Change> = {};
  for (const field of fields) {
    if (before[field] !== after[field]) {
      out[field] = { from: before[field], to: after[field] };
    }
  }
  return out;
}

const ISSUE_FIELDS = ["title", "status", "sprint"] as const;
const SPRINT_FIELDS = ["goal", "notes", "position"] as const;

function diffIssue(before: Issue, after: Issue): WatchEvent[] {
  const events: WatchEvent[] = [];
  const changes = fieldChanges(before, after, ISSUE_FIELDS);

  const claim = { id: after.id, title: after.title };
  if (before.assignee !== after.assignee) {
    if (after.assignee) {
      events.push({
        type: "claim.acquired", ...claim, assignee: after.assignee, leaseUntil: after.leaseUntil,
        ...(before.assignee ? { previousAssignee: before.assignee } : {}),
      });
      // Claiming sets doing; that status change is part of the claim, not news of its own.
      if (after.status === "doing") delete changes.status;
    } else if (before.assignee) {
      events.push({ type: "claim.released", ...claim, assignee: before.assignee });
      if (before.status === "doing" && after.status === "ready") delete changes.status;
    }
  } else if (after.assignee && before.leaseUntil !== after.leaseUntil) {
    events.push({ type: "claim.renewed", ...claim, assignee: after.assignee, leaseUntil: after.leaseUntil });
  }

  if (Object.keys(changes).length > 0) {
    events.unshift({ type: "issue.changed", id: after.id, title: after.title, changes });
  }
  return events;
}

export function diffSnapshots(before: Snapshot, after: Snapshot): WatchEvent[] {
  const events: WatchEvent[] = [];
  for (const [id, issue] of after.issues) {
    const old = before.issues.get(id);
    if (!old) {
      events.push({ type: "issue.added", id, title: issue.title, status: issue.status });
    } else {
      events.push(...diffIssue(old, issue));
    }
  }
  for (const [id, issue] of before.issues) {
    if (!after.issues.has(id)) {
      events.push({ type: "issue.removed", id, title: issue.title });
    }
  }
  for (const [name, sprint] of after.sprints) {
    const old = before.sprints.get(name);
    if (!old) {
      events.push({ type: "sprint.added", name });
      continue;
    }
    const changes = fieldChanges(old, sprint, SPRINT_FIELDS);
    if (Object.keys(changes).length > 0) {
      events.push({ type: "sprint.changed", name, changes });
    }
  }
  for (const name of before.sprints.keys()) {
    if (!after.sprints.has(name)) {
      events.push({ type: "sprint.removed", name });
    }
  }
  return events;
}

export interface WatchOptions {
  emit: (event: WatchEvent) => void;
  intervalMs?: number;
  /** Injectable for tests; the default blocks, like the rest of the synchronous CLI. */
  sleep?: (ms: number) => void;
  shouldStop?: () => boolean;
}

/** Block, emitting an event for every change other processes make to the roadmap. */
export function watchRoadmap(cwd: string, options: WatchOptions): void {
  const { emit, intervalMs = 500, sleep = sleepSync, shouldStop = () => false } = options;
  // Fingerprint first, so a write racing the snapshot is picked up on the next tick.
  let last = fingerprint(cwd);
  let previous = takeSnapshot(cwd);
  while (!shouldStop()) {
    sleep(intervalMs);
    const current = fingerprint(cwd);
    if (current === last) continue;
    let next: Snapshot;
    try {
      next = takeSnapshot(cwd);
    } catch {
      continue; // caught mid-write; `last` is unchanged so we retry next tick
    }
    for (const event of diffSnapshots(previous, next)) emit(event);
    previous = next;
    last = current;
  }
}
