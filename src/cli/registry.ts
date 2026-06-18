import type { ItemStatus, SprintStatus } from "../domain/types.js";
import { addItem } from "./commands/addItem.js";
import { createSprint } from "./commands/createSprint.js";
import { editItem } from "./commands/editItem.js";
import { editSprint } from "./commands/editSprint.js";
import { init } from "./commands/init.js";
import { move, moveToBacklog } from "./commands/move.js";
import { removeItem } from "./commands/removeItem.js";
import { setActive } from "./commands/setActive.js";
import { setPosition } from "./commands/setPosition.js";
import { setSprintStatus } from "./commands/setSprintStatus.js";
import { setStatus } from "./commands/setStatus.js";
import { spec } from "./commands/spec.js";
import { parseArgs, requireIntPositional, requirePositional } from "./parse.js";

export type CommandHandler = (cwd: string, args: string[]) => string | void;

export const commands: Record<string, CommandHandler> = {
  init: (cwd) => {
    init(cwd);
  },

  "add-item": (cwd, args) => {
    const parsed = parseArgs(args);
    const title = requirePositional(parsed, 0, "title");
    const id = addItem(cwd, title, {
      status: parsed.flags.status as ItemStatus | undefined,
      sprint: parsed.flags.sprint as string | undefined,
    });
    return String(id);
  },

  "edit-item": (cwd, args) => {
    const parsed = parseArgs(args);
    const id = requireIntPositional(parsed, 0, "id");
    editItem(cwd, id, {
      title: parsed.flags.title as string | undefined,
      status: parsed.flags.status as ItemStatus | undefined,
    });
  },

  "remove-item": (cwd, args) => {
    const parsed = parseArgs(args);
    const id = requireIntPositional(parsed, 0, "id");
    removeItem(cwd, id);
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
    const status = requirePositional(parsed, 1, "status") as ItemStatus;
    setStatus(cwd, id, status);
  },

  "set-sprint-status": (cwd, args) => {
    const parsed = parseArgs(args);
    const name = requirePositional(parsed, 0, "name");
    const status = requirePositional(parsed, 1, "status") as SprintStatus;
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
};
