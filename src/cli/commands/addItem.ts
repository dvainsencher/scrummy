import type { Item, ItemStatus } from "../../domain/types.js";
import { nextId } from "../../domain/ids.js";
import { assertSprintExists } from "../../domain/validation.js";
import { readItems, writeItems } from "../../storage/itemsStore.js";
import { readSprints } from "../../storage/sprintsStore.js";

export interface AddItemOptions {
  status?: ItemStatus;
  sprint?: string;
}

export function addItem(cwd: string, title: string, options: AddItemOptions = {}): number {
  const sprint = options.sprint ?? "";
  if (sprint !== "") {
    assertSprintExists(readSprints(cwd), sprint);
  }

  const items = readItems(cwd);
  const id = nextId(items);
  const now = new Date().toISOString();
  const item: Item = {
    id,
    title,
    status: options.status ?? "idea",
    sprint,
    createdAt: now,
    updatedAt: now,
  };

  writeItems(cwd, [...items, item]);
  return id;
}
