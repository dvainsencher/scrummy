import path from "node:path";

export function roadmapDir(cwd: string): string {
  return path.join(cwd, "docs", "roadmap");
}

export function issuesDir(cwd: string): string {
  return path.join(roadmapDir(cwd), "issues");
}

export function sprintsDir(cwd: string): string {
  return path.join(roadmapDir(cwd), "sprints");
}

export function progressDir(cwd: string): string {
  return path.join(roadmapDir(cwd), "progress");
}

// Pre-directory layout. Still read so existing projects migrate on first write; never
// written to again. See storage/recordDir.ts for why the layout changed.
export function legacyIssuesFilePath(cwd: string): string {
  return path.join(roadmapDir(cwd), "issues.jsonl");
}

export function legacySprintsFilePath(cwd: string): string {
  return path.join(roadmapDir(cwd), "sprints.json");
}

export function specsDir(cwd: string): string {
  return path.join(roadmapDir(cwd), "specs");
}

export function specFilePath(cwd: string, id: number): string {
  return path.join(specsDir(cwd), `${id}.md`);
}

export function legacyProgressFilePath(cwd: string): string {
  return path.join(roadmapDir(cwd), "progress.jsonl");
}

export function roadmapMarkdownPath(cwd: string): string {
  return path.join(cwd, "ROADMAP.md");
}
