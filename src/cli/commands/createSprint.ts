import type { Sprint } from "../../domain/types.js";
import { assertSprintNameAvailable } from "../../domain/validation.js";
import { readSprints, writeSprints } from "../../storage/sprintsStore.js";

export interface CreateSprintOptions {
  goal: string;
  notes?: string;
  position?: number;
}

export function createSprint(cwd: string, name: string, options: CreateSprintOptions): void {
  const sprints = readSprints(cwd);
  assertSprintNameAvailable(sprints, name);

  const maxPosition = sprints.reduce((max, sprint) => Math.max(max, sprint.position), 0);
  const sprint: Sprint = {
    name,
    position: options.position ?? maxPosition + 10,
    status: "planned",
    goal: options.goal,
    notes: options.notes ?? "",
  };

  writeSprints(cwd, [...sprints, sprint]);
}
