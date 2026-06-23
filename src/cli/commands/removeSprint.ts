import { assertSprintEmpty, assertSprintExists } from "../../domain/validation.js";
import { readIssues } from "../../storage/issuesStore.js";
import { readSprints, writeSprints } from "../../storage/sprintsStore.js";

export function removeSprint(cwd: string, name: string): string {
  const sprints = readSprints(cwd);
  assertSprintExists(sprints, name);

  const issues = readIssues(cwd);
  assertSprintEmpty(issues, name);

  writeSprints(cwd, sprints.filter((sprint) => sprint.name !== name));
  return `Removed sprint "${name}"`;
}
