import fs from "node:fs";
import { assertItemExists } from "../../domain/validation.js";
import { specFilePath, specsDir } from "../../storage/paths.js";
import { readItems } from "../../storage/itemsStore.js";

export function spec(cwd: string, id: number): string {
  const items = readItems(cwd);
  assertItemExists(items, id);

  const filePath = specFilePath(cwd, id);
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(specsDir(cwd), { recursive: true });
    const item = items.find((candidate) => candidate.id === id);
    fs.writeFileSync(filePath, `# ${item?.title}\n`);
  }

  return filePath;
}
