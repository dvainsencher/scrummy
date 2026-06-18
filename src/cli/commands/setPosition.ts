import { assertSprintExists } from "../../domain/validation.js";
import { readSprints, writeSprints } from "../../storage/sprintsStore.js";

export function setPosition(cwd: string, name: string, position: number): void {
  const sprints = readSprints(cwd);
  assertSprintExists(sprints, name);

  writeSprints(
    cwd,
    sprints.map((sprint) => (sprint.name === name ? { ...sprint, position } : sprint)),
  );
}
