import path from "node:path";

export function roadmapDir(cwd: string): string {
  return path.join(cwd, "docs", "roadmap");
}

export function itemsFilePath(cwd: string): string {
  return path.join(roadmapDir(cwd), "items.jsonl");
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
