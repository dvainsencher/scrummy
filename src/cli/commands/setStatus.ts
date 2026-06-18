import { editItem } from "./editItem.js";

export function setStatus(cwd: string, id: number, status: string): void {
  editItem(cwd, id, { status });
}
