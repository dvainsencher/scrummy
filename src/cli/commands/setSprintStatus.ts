import type { SprintStatus } from "../../domain/types.js";
import { assertSprintExists, assertSprintStatus } from "../../domain/validation.js";
import { readSprints, writeSprints } from "../../storage/sprintsStore.js";

export function setSprintStatus(cwd: string, name: string, status: string): string {
  const sprints = readSprints(cwd);
  assertSprintExists(sprints, name);
  assertSprintStatus(status);

  writeSprints(
    cwd,
    sprints.map((sprint) =>
      sprint.name === name ? { ...sprint, status: status as SprintStatus } : sprint,
    ),
  );
  return `Set sprint "${name}" status to "${status}"`;
}
