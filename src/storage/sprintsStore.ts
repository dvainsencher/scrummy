import crypto from "node:crypto";
import fs from "node:fs";
import type { Sprint } from "../domain/types.js";
import { legacySprintsFilePath, sprintsDir } from "./paths.js";
import { readRecordDir, serializeRecord, syncRecordDir } from "./recordDir.js";

const SPRINT_KEYS = ["name", "position", "goal", "notes"] as const;

// Sprint names are free text ("Terminal Kanban Viewer"), so they need a filename-safe key.
// The name itself is stored inside the file — the filename only has to be stable and unique.
function baseSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "sprint";
}

/**
 * Filenames for a whole set of sprints. Two different names can slugify identically
 * ("A B" and "A-B"), so any slug claimed by more than one name gets a per-name suffix.
 * Computed over the whole set rather than sequentially, so a sprint's filename depends
 * only on the set of names — never on their order, which would churn files on reorder.
 */
function sprintFileNames(sprints: readonly Sprint[]): Map<string, string> {
  const claimants = new Map<string, number>();
  for (const sprint of sprints) {
    const slug = baseSlug(sprint.name);
    claimants.set(slug, (claimants.get(slug) ?? 0) + 1);
  }
  const names = new Map<string, string>();
  for (const sprint of sprints) {
    const slug = baseSlug(sprint.name);
    const disambiguated =
      (claimants.get(slug) ?? 0) > 1
        ? `${slug}-${crypto.createHash("sha256").update(sprint.name).digest("hex").slice(0, 6)}`
        : slug;
    names.set(sprint.name, `${disambiguated}.json`);
  }
  return names;
}

// Status is derived, never stored (see domain/sprintStatus.ts) — strip any legacy field
// so subsequent writes stay clean.
function normalize(record: Sprint & { status?: unknown }): Sprint {
  const { name, position, goal, notes } = record;
  return { name, position, goal, notes };
}

function readLegacySprints(cwd: string): Sprint[] {
  const filePath = legacySprintsFilePath(cwd);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const records = JSON.parse(fs.readFileSync(filePath, "utf8")) as (Sprint & { status?: unknown })[];
  return records.map(normalize);
}

export function readSprints(cwd: string): Sprint[] {
  const dir = sprintsDir(cwd);
  const sprints = fs.existsSync(dir)
    ? readRecordDir<Sprint & { status?: unknown }>(dir, "sprints").map(normalize)
    : readLegacySprints(cwd);
  // Deterministic order. Callers that care sort by position themselves (reader/plan.ts).
  return sprints.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

export function writeSprints(cwd: string, sprints: Sprint[]): void {
  const fileNames = sprintFileNames(sprints);
  const files = new Map(
    sprints.map((sprint) => [fileNames.get(sprint.name) as string, serializeRecord(normalize(sprint), SPRINT_KEYS)]),
  );
  syncRecordDir(sprintsDir(cwd), files);
  fs.rmSync(legacySprintsFilePath(cwd), { force: true });
}
