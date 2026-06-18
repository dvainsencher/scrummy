import type { ItemStatus } from "../../domain/types.js";
import { editItem } from "./editItem.js";

export function setStatus(cwd: string, id: number, status: ItemStatus): void {
  editItem(cwd, id, { status });
}
