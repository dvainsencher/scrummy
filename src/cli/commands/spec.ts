import fs from "node:fs";
import { assertIssueExists } from "../../domain/validation.js";
import { specFilePath, specsDir } from "../../storage/paths.js";
import { readIssues } from "../../storage/issuesStore.js";

export function spec(cwd: string, id: number): string {
  const issues = readIssues(cwd);
  assertIssueExists(issues, id);

  const filePath = specFilePath(cwd, id);
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(specsDir(cwd), { recursive: true });
    const issue = issues.find((candidate) => candidate.id === id);
    const skeleton = `# ${issue?.title}\n\n## Problem\n\n## Approach\n\n## Acceptance criteria\n\n## Open questions\n`;
    fs.writeFileSync(filePath, skeleton);
  }

  return filePath;
}
