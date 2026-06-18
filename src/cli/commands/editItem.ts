import type { ItemStatus } from "../../domain/types.js";
import { assertItemExists, assertItemStatus } from "../../domain/validation.js";
import { readItems, writeItems } from "../../storage/itemsStore.js";

export interface EditItemOptions {
  title?: string;
  status?: string;
}

export function editItem(cwd: string, id: number, options: EditItemOptions): void {
  const items = readItems(cwd);
  assertItemExists(items, id);
  if (options.status !== undefined) {
    assertItemStatus(options.status);
  }

  const now = new Date().toISOString();
  const updated = items.map((item) =>
    item.id === id
      ? {
          ...item,
          title: options.title ?? item.title,
          status: (options.status as ItemStatus | undefined) ?? item.status,
          updatedAt: now,
        }
      : item,
  );

  writeItems(cwd, updated);
}
