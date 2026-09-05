import type { ActivityType } from "~/generated/prisma/enums";

/**
 * One phrasing table for both surfaces: the live toast ("**Max** moved **Card** to
 * **Ready to edit**") and the card's own history ("moved this to Ready to edit").
 */
export const ACTIVITY_COPY: Record<
  ActivityType,
  { toast: string; history: string; suffix?: string }
> = {
  CREATED: { toast: "created", history: "created this card" },
  MOVED: { toast: "moved", history: "moved this to", suffix: "to" },
  TITLE_CHANGED: { toast: "renamed", history: "renamed this to", suffix: "to" },
  ANGLE_CHANGED: { toast: "updated the angle on", history: "updated the angle" },
  DESCRIPTION_CHANGED: {
    toast: "updated the description on",
    history: "updated the description",
  },
  ASSIGNED: { toast: "assigned", history: "assigned this to", suffix: "to" },
  UNASSIGNED: { toast: "unassigned", history: "removed the assignee" },
  SCRIPT_GENERATED: { toast: "generated a script for", history: "generated the script with AI" },
  SCRIPT_IMPROVED: { toast: "improved the script on", history: "improved the script with AI" },
  SCRIPT_EDITED: { toast: "edited the script on", history: "edited the script" },
  COMMENTED: { toast: "commented on", history: "left a comment" },
};

export type ActivityEntry = {
  id: string;
  type: ActivityType;
  detail: string | null;
  fromValue: string | null;
  createdAt: string;
  user: { id: string; name: string; avatarHue: number };
};

/** "moved this to" + detail, or just the plain phrase when there is no value. */
export function historyText(entry: Pick<ActivityEntry, "type" | "detail">) {
  const copy = ACTIVITY_COPY[entry.type];
  return entry.detail && copy.suffix ? `${copy.history} ${entry.detail}` : copy.history;
}
