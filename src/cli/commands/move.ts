import { assertItemExists, assertSprintExists } from "../../domain/validation.js";
import { readItems, writeItems } from "../../storage/itemsStore.js";
import { readSprints } from "../../storage/sprintsStore.js";

export function move(cwd: string, id: number, sprintName: string): void {
  const items = readItems(cwd);
  assertItemExists(items, id);
  assertSprintExists(readSprints(cwd), sprintName);

  writeMoved(cwd, items, id, sprintName);
}

export function moveToBacklog(cwd: string, id: number): void {
  const items = readItems(cwd);
  assertItemExists(items, id);

  writeMoved(cwd, items, id, "");
}

function writeMoved(
  cwd: string,
  items: ReturnType<typeof readItems>,
  id: number,
  sprint: string,
): void {
  const now = new Date().toISOString();
  const updated = items.map((item) =>
    item.id === id ? { ...item, sprint, updatedAt: now } : item,
  );
  writeItems(cwd, updated);
}
