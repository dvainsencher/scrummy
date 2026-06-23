import path from "node:path";

export function roadmapDir(cwd: string): string {
  return path.join(cwd, "docs", "roadmap");
}

export function issuesFilePath(cwd: string): string {
  return path.join(roadmapDir(cwd), "issues.jsonl");
}

export function sprintsFilePath(cwd: string): string {
  return path.join(roadmapDir(cwd), "sprints.json");
}

export function specsDir(cwd: string): string {
  return path.join(roadmapDir(cwd), "specs");
}

export function specFilePath(cwd: string, id: number): string {
  return path.join(specsDir(cwd), `${id}.md`);
}

export function progressFilePath(cwd: string): string {
  return path.join(roadmapDir(cwd), "progress.jsonl");
}
