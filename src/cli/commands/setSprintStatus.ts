import type { SprintStatus } from "../../domain/types.js";
import { assertSprintExists } from "../../domain/validation.js";
import { readSprints, writeSprints } from "../../storage/sprintsStore.js";

export function setSprintStatus(cwd: string, name: string, status: SprintStatus): void {
  const sprints = readSprints(cwd);
  assertSprintExists(sprints, name);

  writeSprints(
    cwd,
    sprints.map((sprint) => (sprint.name === name ? { ...sprint, status } : sprint)),
  );
}
