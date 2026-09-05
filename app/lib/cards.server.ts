import type { CardStatus } from "~/generated/prisma/enums";
import { db } from "./db.server";

const GAP = 1000;

/**
 * Places `cardId` in `status` directly above `beforeCardId` (or last when null),
 * recording a StatusEvent whenever the column actually changes.
 */
export async function moveCard(opts: {
  cardId: string;
  status: CardStatus;
  beforeCardId: string | null;
  userId: string;
}) {
  const { cardId, status, beforeCardId, userId } = opts;

  const card = await db.videoCard.findUniqueOrThrow({
    where: { id: cardId },
    select: { id: true, status: true, projectId: true },
  });

  const siblings = await db.videoCard.findMany({
    where: { projectId: card.projectId, status, id: { not: cardId } },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });

  const index = beforeCardId ? siblings.findIndex((c) => c.id === beforeCardId) : -1;
  const after = index === -1 ? siblings.at(-1) : siblings[index - 1];
  const before = index === -1 ? undefined : siblings[index];

  let position: number;
  if (!after && !before) position = GAP;
  else if (!after && before) position = before.position - GAP;
  else if (after && !before) position = after.position + GAP;
  else position = (after!.position + before!.position) / 2;

  await db.videoCard.update({ where: { id: cardId }, data: { status, position } });

  if (card.status !== status) {
    await db.statusEvent.create({
      data: { cardId, fromStatus: card.status, toStatus: status, userId },
    });
  }

  return { position };
}

/** Next free slot at the bottom of a column. */
export async function nextPosition(projectId: string, status: CardStatus) {
  const last = await db.videoCard.findFirst({
    where: { projectId, status },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? 0) + GAP;
}
