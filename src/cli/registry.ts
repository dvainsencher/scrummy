import { addIssue } from "./commands/addIssue.js";
import { createSprint } from "./commands/createSprint.js";
import { editIssue } from "./commands/editIssue.js";
import { editSprint } from "./commands/editSprint.js";
import { importFromFile } from "./commands/import.js";
import { init } from "./commands/init.js";
import { logProgress } from "./commands/logProgress.js";
import { move, moveToBacklog } from "./commands/move.js";
import { removeIssue } from "./commands/removeIssue.js";
import { removeSprint } from "./commands/removeSprint.js";
import { setActive } from "./commands/setActive.js";
import { setPosition } from "./commands/setPosition.js";
import { setSprintStatus } from "./commands/setSprintStatus.js";
import { installSkills } from "./commands/installSkills.js";
import { setStatus } from "./commands/setStatus.js";
import { show } from "./commands/show.js";
import { showLog } from "./commands/showLog.js";
import { spec } from "./commands/spec.js";
import { status } from "./commands/status.js";
import { skillsSourceDir } from "../packageRoot.js";
import { parseArgs, requireIntPositional, requirePositional } from "./parse.js";

export type CommandHandler = (cwd: string, args: string[]) => string | void;

export const commands: Record<string, CommandHandler> = {
  init: (cwd) => init(cwd),

  "add-issue": (cwd, args) => {
    const parsed = parseArgs(args);
    const title = requirePositional(parsed, 0, "title");
    const id = addIssue(cwd, title, {
      status: parsed.flags.status as string | undefined,
      sprint: parsed.flags.sprint as string | undefined,
    });
    return String(id);
  },

  "edit-issue": (cwd, args) => {
    const parsed = parseArgs(args);
    const id = requireIntPositional(parsed, 0, "id");
    return editIssue(cwd, id, {
      title: parsed.flags.title as string | undefined,
      status: parsed.flags.status as string | undefined,
    });
  },

  import: (cwd, args) => {
    const parsed = parseArgs(args);
    const filePath = requirePositional(parsed, 0, "file");
    const ids = importFromFile(cwd, filePath);
    return ids.join("\n");
  },

  "remove-issue": (cwd, args) => {
    const parsed = parseArgs(args);
    const id = requireIntPositional(parsed, 0, "id");
    return removeIssue(cwd, id);
  },

  "create-sprint": (cwd, args) => {
    const parsed = parseArgs(args);
    const name = requirePositional(parsed, 0, "name");
    return createSprint(cwd, name, {
      goal: (parsed.flags.goal as string | undefined) ?? "",
      notes: parsed.flags.notes as string | undefined,
      position: parsed.flags.position !== undefined ? Number(parsed.flags.position) : undefined,
    });
  },

  "edit-sprint": (cwd, args) => {
    const parsed = parseArgs(args);
    const name = requirePositional(parsed, 0, "name");
    return editSprint(cwd, name, {
      goal: parsed.flags.goal as string | undefined,
      notes: parsed.flags.notes as string | undefined,
    });
  },

  "remove-sprint": (cwd, args) => {
    const parsed = parseArgs(args);
    const name = requirePositional(parsed, 0, "name");
    return removeSprint(cwd, name);
  },

  move: (cwd, args) => {
    const parsed = parseArgs(args);
    const id = requireIntPositional(parsed, 0, "id");
    if (parsed.flags.backlog) {
      return moveToBacklog(cwd, id);
    }
    const sprintName = requirePositional(parsed, 1, "sprint-name");
    return move(cwd, id, sprintName);
  },

  "set-status": (cwd, args) => {
    const parsed = parseArgs(args);
    const id = requireIntPositional(parsed, 0, "id");
    const status = requirePositional(parsed, 1, "status");
    return setStatus(cwd, id, status);
  },

  "set-sprint-status": (cwd, args) => {
    const parsed = parseArgs(args);
    const name = requirePositional(parsed, 0, "name");
    const status = requirePositional(parsed, 1, "status");
    return setSprintStatus(cwd, name, status);
  },

  "set-active": (cwd, args) => {
    const parsed = parseArgs(args);
    const name = requirePositional(parsed, 0, "name");
    return setActive(cwd, name);
  },

  "set-position": (cwd, args) => {
    const parsed = parseArgs(args);
    const name = requirePositional(parsed, 0, "name");
    const position = requireIntPositional(parsed, 1, "position");
    return setPosition(cwd, name, position);
  },

  spec: (cwd, args) => {
    const parsed = parseArgs(args);
    const id = requireIntPositional(parsed, 0, "id");
    return spec(cwd, id);
  },

  "log-issue": (cwd, args) => {
    const parsed = parseArgs(args);
    const id = requireIntPositional(parsed, 0, "id");
    const message = requirePositional(parsed, 1, "message");
    if (parsed.flags.type === undefined || parsed.flags.type === true) {
      throw new Error("Missing required flag: --type");
    }
    return logProgress(cwd, id, parsed.flags.type, message);
  },

  "show-log": (cwd, args) => {
    const parsed = parseArgs(args);
    const id = requireIntPositional(parsed, 0, "id");
    return JSON.stringify(showLog(cwd, id), null, 2);
  },

  show: (cwd, args) => {
    const parsed = parseArgs(args);
    const rawId = parsed.positionals[0];
    let id: number | undefined;
    if (rawId !== undefined) {
      id = parseInt(rawId, 10);
      if (isNaN(id)) {
        throw new Error(`Invalid id "${rawId}" — expected an integer`);
      }
    }
    return show(cwd, {
      id,
      sprint: parsed.flags.sprint as string | undefined,
      done: parsed.flags.done === true,
      json: parsed.flags.json === true,
    });
  },

  "install-skills": (cwd) => {
    const installed = installSkills(cwd, skillsSourceDir());
    return installed.join("\n");
  },

  status: (cwd) => status(cwd),
};

export const commandDescriptions: Record<string, string> = {
  init: "Scaffold docs/roadmap/ in a project",
  "add-issue": "Add an issue to the backlog",
  "edit-issue": "Edit an issue's title or status",
  import: "Batch-import issues from a JSON file",
  "remove-issue": "Remove an issue",
  "create-sprint": "Create a new sprint",
  "edit-sprint": "Edit a sprint's goal or notes",
  "remove-sprint": "Remove an empty sprint",
  move: "Move an issue to a sprint, or back to the backlog with --backlog",
  "set-status": "Set an issue's status",
  "set-sprint-status": "Set a sprint's status",
  "set-active": "Mark a sprint as the active one",
  "set-position": "Set a sprint's advisory sort position",
  spec: "Create or return an issue's spec file path",
  "log-issue": "Append a progress log entry to an issue",
  "show-log": "Show an issue's progress log",
  show: "Show the backlog and sprints",
  "install-skills": "Install pauta's Claude Code skills into this project",
  status: "Print a one-line summary of the active sprint",
};
