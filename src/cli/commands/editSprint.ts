import { assertSprintExists } from "../../domain/validation.js";
import { readSprints, writeSprints } from "../../storage/sprintsStore.js";

export interface EditSprintOptions {
  goal?: string;
  notes?: string;
}

export function editSprint(cwd: string, name: string, options: EditSprintOptions): void {
  const sprints = readSprints(cwd);
  assertSprintExists(sprints, name);

  const updated = sprints.map((sprint) =>
    sprint.name === name
      ? {
          ...sprint,
          goal: options.goal ?? sprint.goal,
          notes: options.notes ?? sprint.notes,
        }
      : sprint,
  );

  writeSprints(cwd, updated);
}
