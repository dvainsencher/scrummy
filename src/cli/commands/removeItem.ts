import fs from "node:fs";
import { assertItemExists } from "../../domain/validation.js";
import { specFilePath } from "../../storage/paths.js";
import { readItems, writeItems } from "../../storage/itemsStore.js";

export function removeItem(cwd: string, id: number): void {
  const items = readItems(cwd);
  assertItemExists(items, id);

  writeItems(cwd, items.filter((item) => item.id !== id));

  const specPath = specFilePath(cwd, id);
  if (fs.existsSync(specPath)) {
    fs.rmSync(specPath);
  }
}
