import type { Item } from "../domain/types.js";

export function backlogItems(items: Item[]): Item[] {
  return items.filter((item) => item.sprint === "");
}
