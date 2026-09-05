import type { CardStatus } from "~/generated/prisma/enums";

export type Stage = {
  id: CardStatus;
  label: string;
  short: string;
  hint: string;
  dot: string;
  bar: string;
};

export const STAGES: Stage[] = [
  {
    id: "IDEA",
    label: "Idea",
    short: "Idea",
    hint: "Raw ideas and titles waiting for a script",
    dot: "bg-stage-idea",
    bar: "from-stage-idea/80 to-stage-idea/10",
  },
  {
    id: "READY_TO_FILM",
    label: "Ready to film",
    short: "Filming",
    hint: "Script is done — ready for camera",
    dot: "bg-stage-film",
    bar: "from-stage-film/80 to-stage-film/10",
  },
  {
    id: "READY_TO_EDIT",
    label: "Ready to edit",
    short: "Editing",
    hint: "Footage shot, waiting to be cut",
    dot: "bg-stage-edit",
    bar: "from-stage-edit/80 to-stage-edit/10",
  },
  {
    id: "READY_TO_PUBLISH",
    label: "Ready to publish",
    short: "Publishing",
    hint: "Edited and approved",
    dot: "bg-stage-publish",
    bar: "from-stage-publish/80 to-stage-publish/10",
  },
  {
    id: "SCHEDULED",
    label: "Scheduled",
    short: "Scheduled",
    hint: "Queued for publishing",
    dot: "bg-stage-scheduled",
    bar: "from-stage-scheduled/80 to-stage-scheduled/10",
  },
];

export const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<
  CardStatus,
  Stage
>;

export const SOURCE_LABEL: Record<string, string> = {
  MANUAL: "Manual",
  URL: "From a page",
  NEWS: "From the news",
  RANDOM: "AI generated",
};
