import type { ItemStatus } from "../../domain/types.js";
import { assertItemExists } from "../../domain/validation.js";
import { readItems, writeItems } from "../../storage/itemsStore.js";

export interface EditItemOptions {
  title?: string;
  status?: ItemStatus;
}

export function editItem(cwd: string, id: number, options: EditItemOptions): void {
  const items = readItems(cwd);
  assertItemExists(items, id);

  const now = new Date().toISOString();
  const updated = items.map((item) =>
    item.id === id
      ? {
          ...item,
          title: options.title ?? item.title,
          status: options.status ?? item.status,
          updatedAt: now,
        }
      : item,
  );

  writeItems(cwd, updated);
}
