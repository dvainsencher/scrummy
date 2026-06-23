import { assertSprintExists } from "../../domain/validation.js";
import { readSprints, writeSprints } from "../../storage/sprintsStore.js";

export function setActive(cwd: string, name: string): string {
  const sprints = readSprints(cwd);
  assertSprintExists(sprints, name);

  writeSprints(
    cwd,
    sprints.map((sprint) => {
      if (sprint.name === name) {
        return { ...sprint, status: "active" as const };
      }
      if (sprint.status === "active") {
        return { ...sprint, status: "planned" as const };
      }
      return sprint;
    }),
  );
  return `Activated sprint "${name}"`;
}
