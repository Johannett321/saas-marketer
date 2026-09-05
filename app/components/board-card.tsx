import { useRef } from "react";
import { Link } from "react-router";
import { useDrag, useDrop } from "react-dnd";
import { FileText, Link2, MessageSquare, Sparkles } from "lucide-react";
import { Avatar } from "./ui";
import { SOURCE_LABEL } from "~/lib/stages";
import type { CardStatus } from "~/generated/prisma/enums";

export const CARD_DND_TYPE = "video-card";

export type BoardCard = {
  id: string;
  title: string;
  status: CardStatus;
  angle: string | null;
  source: string;
  sourceUrl: string | null;
  hasScript: boolean;
  commentCount: number;
  assignee: { id: string; name: string; avatarHue: number } | null;
};

export type DragItem = { id: string; status: CardStatus };

export function BoardCardTile({
  card,
  to,
  onDropBefore,
  isSelected,
}: {
  card: BoardCard;
  to: string;
  onDropBefore: (item: DragItem, beforeCardId: string) => void;
  isSelected: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: CARD_DND_TYPE,
      item: { id: card.id, status: card.status } satisfies DragItem,
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    }),
    [card.id, card.status],
  );

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: CARD_DND_TYPE,
      canDrop: (item: DragItem) => item.id !== card.id,
      drop: (item: DragItem) => onDropBefore(item, card.id),
      collect: (monitor) => ({ isOver: monitor.isOver({ shallow: true }) && monitor.canDrop() }),
    }),
    [card.id, onDropBefore],
  );

  drag(drop(ref));

  return (
    <div ref={ref} className="relative">
      {isOver && (
        <span className="absolute -top-1 left-0 right-0 h-0.5 rounded-full bg-brand-500" />
      )}
      <Link
        to={to}
        className={`block cursor-grab rounded-selector border bg-base-100 p-3 transition-all active:cursor-grabbing ${
          isSelected
            ? "border-brand-400 ring-2 ring-brand-500/20"
            : "border-ink-200 hover:border-brand-300 hover:shadow-[0_2px_10px_-4px_hsl(274_40%_8%/0.18)]"
        } ${isDragging ? "opacity-35" : ""}`}
      >
        <p className="text-[13.5px] leading-snug font-medium text-ink-900">{card.title}</p>

        {card.angle && (
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-ink-500">
            {card.angle}
          </p>
        )}

        <div className="mt-2.5 flex items-center gap-1.5">
          {card.source !== "MANUAL" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-medium text-brand-700">
              <Sparkles className="size-2.5" />
              {SOURCE_LABEL[card.source] ?? card.source}
            </span>
          )}
          {card.sourceUrl && <Link2 className="size-3 text-ink-400" />}
          {card.hasScript && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[10.5px] font-medium text-ink-600"
              title="Has a script"
            >
              <FileText className="size-2.5" /> Script
            </span>
          )}

          <span className="ml-auto flex items-center gap-2">
            {card.commentCount > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] text-ink-400">
                <MessageSquare className="size-3" />
                {card.commentCount}
              </span>
            )}
            {card.assignee ? (
              <Avatar user={card.assignee} size={20} />
            ) : (
              <span className="size-5 rounded-full border border-dashed border-ink-300" title="Unassigned" />
            )}
          </span>
        </div>
      </Link>
    </div>
  );
}
