import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, UserPlus } from "lucide-react";
import { Avatar, type AvatarUser } from "./ui";
import { STAGES, STAGE_BY_ID } from "~/lib/stages";
import type { CardStatus } from "~/generated/prisma/enums";

/** Shared shell: a button that opens a small panel, closing on outside click or Escape. */
function Popover({
  trigger,
  children,
  align = "left",
  width = "13rem",
}: {
  trigger: (open: boolean) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-ink-200 bg-base-100 py-1.5 pr-2 pl-2.5 text-[13px] transition-colors hover:border-ink-300 hover:bg-ink-100/60"
      >
        {trigger(open)}
        <ChevronDown
          className={`size-3.5 shrink-0 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          style={{ width }}
          className={`absolute top-full z-50 mt-1 overflow-hidden rounded-box border border-ink-200 bg-base-100 p-1 shadow-xl animate-fade-in ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function Row({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
        selected ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-ink-100"
      }`}
    >
      {children}
      {selected && <Check className="ml-auto size-3.5 shrink-0" />}
    </button>
  );
}

export function StatusPicker({
  value,
  onChange,
}: {
  value: CardStatus;
  onChange: (status: CardStatus) => void;
}) {
  const current = STAGE_BY_ID[value];

  return (
    <Popover
      width="15rem"
      trigger={() => (
        <>
          <span className={`size-2 shrink-0 rounded-full ${current.dot}`} />
          <span className="text-ink-800">{current.label}</span>
        </>
      )}
    >
      {(close) => (
        <>
          {STAGES.map((stage) => (
            <Row
              key={stage.id}
              selected={stage.id === value}
              onSelect={() => {
                close();
                if (stage.id !== value) onChange(stage.id);
              }}
            >
              <span className={`size-2 shrink-0 rounded-full ${stage.dot}`} />
              <span className="truncate">{stage.label}</span>
            </Row>
          ))}
        </>
      )}
    </Popover>
  );
}

export function AssigneePicker({
  value,
  members,
  currentUserId,
  onChange,
}: {
  value: string | null;
  members: AvatarUser[];
  currentUserId: string;
  onChange: (assigneeId: string) => void;
}) {
  const assignee = members.find((m) => m.id === value) ?? null;

  return (
    <Popover
      width="15rem"
      trigger={() =>
        assignee ? (
          <>
            <Avatar user={assignee} size={20} />
            <span className="max-w-[9rem] truncate text-ink-800">{assignee.name}</span>
          </>
        ) : (
          <>
            <span className="grid size-5 shrink-0 place-items-center rounded-full border border-dashed border-ink-300 text-ink-400">
              <UserPlus className="size-2.5" />
            </span>
            <span className="text-ink-500">Unassigned</span>
          </>
        )
      }
    >
      {(close) => (
        <>
          <Row
            selected={value === null}
            onSelect={() => {
              close();
              if (value !== null) onChange("");
            }}
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-dashed border-ink-300 text-ink-400">
              <UserPlus className="size-3" />
            </span>
            <span className="text-ink-500">Unassigned</span>
          </Row>

          {members.map((m) => (
            <Row
              key={m.id}
              selected={m.id === value}
              onSelect={() => {
                close();
                if (m.id !== value) onChange(m.id);
              }}
            >
              <Avatar user={m} size={24} />
              <span className="truncate">
                {m.name}
                {m.id === currentUserId && <span className="text-ink-400"> (you)</span>}
              </span>
            </Row>
          ))}
        </>
      )}
    </Popover>
  );
}
