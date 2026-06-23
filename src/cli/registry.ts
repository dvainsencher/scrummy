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
import { skillsSourceDir } from "../packageRoot.js";
import { parseArgs, requireIntPositional, requirePositional } from "./parse.js";

export type CommandHandler = (cwd: string, args: string[]) => string | void;

export const commands: Record<string, CommandHandler> = {
  init: (cwd) => {
    init(cwd);
  },

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
    editIssue(cwd, id, {
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
    removeIssue(cwd, id);
  },

  "create-sprint": (cwd, args) => {
    const parsed = parseArgs(args);
    const name = requirePositional(parsed, 0, "name");
    createSprint(cwd, name, {
      goal: (parsed.flags.goal as string | undefined) ?? "",
      notes: parsed.flags.notes as string | undefined,
      position: parsed.flags.position !== undefined ? Number(parsed.flags.position) : undefined,
    });
  },

  "edit-sprint": (cwd, args) => {
    const parsed = parseArgs(args);
    const name = requirePositional(parsed, 0, "name");
    editSprint(cwd, name, {
      goal: parsed.flags.goal as string | undefined,
      notes: parsed.flags.notes as string | undefined,
    });
  },

  "remove-sprint": (cwd, args) => {
    const parsed = parseArgs(args);
    const name = requirePositional(parsed, 0, "name");
    removeSprint(cwd, name);
  },

  move: (cwd, args) => {
    const parsed = parseArgs(args);
    const id = requireIntPositional(parsed, 0, "id");
    if (parsed.flags.backlog) {
      moveToBacklog(cwd, id);
      return;
    }
    const sprintName = requirePositional(parsed, 1, "sprint-name");
    move(cwd, id, sprintName);
  },

  "set-status": (cwd, args) => {
    const parsed = parseArgs(args);
    const id = requireIntPositional(parsed, 0, "id");
    const status = requirePositional(parsed, 1, "status");
    setStatus(cwd, id, status);
  },

  "set-sprint-status": (cwd, args) => {
    const parsed = parseArgs(args);
    const name = requirePositional(parsed, 0, "name");
    const status = requirePositional(parsed, 1, "status");
    setSprintStatus(cwd, name, status);
  },

  "set-active": (cwd, args) => {
    const parsed = parseArgs(args);
    const name = requirePositional(parsed, 0, "name");
    setActive(cwd, name);
  },

  "set-position": (cwd, args) => {
    const parsed = parseArgs(args);
    const name = requirePositional(parsed, 0, "name");
    const position = requireIntPositional(parsed, 1, "position");
    setPosition(cwd, name, position);
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
    logProgress(cwd, id, parsed.flags.type, message);
  },

  "show-log": (cwd, args) => {
    const parsed = parseArgs(args);
    const id = requireIntPositional(parsed, 0, "id");
    return JSON.stringify(showLog(cwd, id), null, 2);
  },

  show: (cwd, args) => {
    const parsed = parseArgs(args);
    return show(cwd, {
      sprint: parsed.flags.sprint as string | undefined,
      done: parsed.flags.done === true,
      json: parsed.flags.json === true,
    });
  },

  "install-skills": (cwd) => {
    const installed = installSkills(cwd, skillsSourceDir());
    return installed.join("\n");
  },
};
