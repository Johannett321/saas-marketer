import type { ActivityType } from "~/generated/prisma/enums";
import { db } from "./db.server";
import { emitCard, type BoardEventKind } from "./events.server";
import { ACTIVITY_COPY } from "./activity";

const KIND: Record<ActivityType, BoardEventKind> = {
  CREATED: "card.created",
  MOVED: "card.moved",
  TITLE_CHANGED: "card.updated",
  ANGLE_CHANGED: "card.updated",
  DESCRIPTION_CHANGED: "card.updated",
  ASSIGNED: "card.assigned",
  UNASSIGNED: "card.assigned",
  SCRIPT_GENERATED: "card.script",
  SCRIPT_IMPROVED: "card.script",
  SCRIPT_EDITED: "card.script",
  COMMENTED: "card.comment",
};

/**
 * Single write path for "somebody did something to a card": it appends to the
 * card's history and broadcasts the same fact to every other open tab.
 */
export async function recordActivity(input: {
  type: ActivityType;
  card: { id: string; title: string };
  workspace: { id: string; slug: string };
  projectSlug: string;
  actor: { id: string; name: string; avatarHue: number };
  /** New value, where one applies: column label, new title, assignee name. */
  detail?: string | null;
  /** Previous value, where one applies. */
  fromValue?: string | null;
}) {
  const copy = ACTIVITY_COPY[input.type];

  await db.activity.create({
    data: {
      cardId: input.card.id,
      userId: input.actor.id,
      type: input.type,
      detail: input.detail ?? null,
      fromValue: input.fromValue ?? null,
    },
  });

  emitCard({
    kind: KIND[input.type],
    workspace: input.workspace,
    projectSlug: input.projectSlug,
    card: input.card,
    actor: input.actor,
    action: copy.toast,
    suffix: input.detail ? copy.suffix : undefined,
    target: input.detail ?? undefined,
  });
}
