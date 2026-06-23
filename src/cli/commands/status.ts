import { readIssues } from "../../storage/issuesStore.js";
import { readSprints } from "../../storage/sprintsStore.js";

export function status(cwd: string): string {
  const active = readSprints(cwd).find((sprint) => sprint.status === "active");
  if (!active) {
    return "no active sprint";
  }

  const issues = readIssues(cwd)
    .filter((issue) => issue.sprint === active.name)
    .sort((a, b) => a.id - b.id);

  const done = issues.filter((issue) => issue.status === "done").length;
  const base = `${active.name} ${done}/${issues.length}`;

  const current =
    issues.find((issue) => issue.status === "doing") ??
    issues.find((issue) => issue.status !== "done");

  return current ? `${base} → #${current.id} ${current.title}` : base;
}
