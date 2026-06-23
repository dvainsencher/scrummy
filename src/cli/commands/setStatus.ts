import { editIssue } from "./editIssue.js";

export function setStatus(cwd: string, id: number, status: string): string {
  editIssue(cwd, id, { status });
  return `Set issue #${id} status to "${status}"`;
}
