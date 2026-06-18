import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readItems } from "../storage/itemsStore.js";
import { addItem } from "../cli/commands/addItem.js";
import { createSprint } from "../cli/commands/createSprint.js";
import { init } from "../cli/commands/init.js";
import { move } from "../cli/commands/move.js";
import { backlogItems } from "./backlog.js";

describe("backlogItems", () => {
  it("returns only items with an empty sprint", () => {
    const items = [
      { id: 1, title: "a", status: "idea" as const, sprint: "", createdAt: "", updatedAt: "" },
      {
        id: 2,
        title: "b",
        status: "idea" as const,
        sprint: "foundation",
        createdAt: "",
        updatedAt: "",
      },
    ];
    expect(backlogItems(items)).toEqual([items[0]]);
  });

  describe("integration with add/move", () => {
    let cwd: string;

    beforeEach(() => {
      cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pauta-test-"));
      init(cwd);
      createSprint(cwd, "foundation", { goal: "g" });
    });

    afterEach(() => {
      fs.rmSync(cwd, { recursive: true, force: true });
    });

    it("includes a freshly added item with no sprint", () => {
      addItem(cwd, "Dark mode");
      expect(backlogItems(readItems(cwd))).toHaveLength(1);
    });

    it("excludes an item once moved into a sprint", () => {
      const id = addItem(cwd, "Dark mode");
      move(cwd, id, "foundation");
      expect(backlogItems(readItems(cwd))).toHaveLength(0);
    });
  });
});
