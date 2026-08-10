import { assertNoDuplicateIds, assertNoDuplicateSprintNames } from "../../domain/validation.js";
import { readIssues } from "../../storage/issuesStore.js";
import { readSprints } from "../../storage/sprintsStore.js";

// Read-only — deliberately not in roadmapMutatingCommands. Independent backstop:
// checks the invariants the write path already enforces, without trusting the write
// path to have been the only thing that touched the files (see domain/validation.js).
export function validate(cwd: string): string {
  const issues = readIssues(cwd);
  const sprints = readSprints(cwd);

  assertNoDuplicateIds(issues);
  assertNoDuplicateSprintNames(sprints);

  return `OK: ${issues.length} issue(s), ${sprints.length} sprint(s), no duplicates found`;
}
