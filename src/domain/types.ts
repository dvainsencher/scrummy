export type ItemStatus = "idea" | "ready" | "doing" | "done";

export type SprintStatus = "planned" | "active" | "done";

export interface Item {
  id: number;
  title: string;
  status: ItemStatus;
  sprint: string;
  createdAt: string;
  updatedAt: string;
}

export interface Sprint {
  name: string;
  position: number;
  status: SprintStatus;
  goal: string;
  notes: string;
}

export const ITEM_STATUSES: readonly ItemStatus[] = ["idea", "ready", "doing", "done"];
export const SPRINT_STATUSES: readonly SprintStatus[] = ["planned", "active", "done"];
