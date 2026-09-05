/**
 * Demo data: one workspace, four people, two projects and a board that looks like
 * a team has been using it for a couple of months.
 *
 * Run with `npm run db:seed`. It is safe to run repeatedly — the demo workspace is
 * deleted and rebuilt each time, and nothing outside it is touched.
 *
 * This exists for three reasons: trying the app without inventing your own content,
 * having something on screen for the README screenshots, and giving the analytics
 * page real numbers to draw.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import type { CardStatus, WorkspaceRole } from "../app/generated/prisma/enums";
import { hashPassword } from "../app/lib/auth.server";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const WORKSPACE_SLUG = "northwind-studio";
const PASSWORD = "demo1234";

const now = new Date();
/** `daysAgo(3, 14)` → three days ago at 14:00. Keeps the timeline readable. */
const daysAgo = (days: number, hour = 10) => {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(hour, (days * 7) % 60, 0, 0);
  return d;
};

const PEOPLE = [
  { key: "maya", name: "Maya Lindqvist", email: "maya@northwind.demo", hue: 280, role: "OWNER" },
  { key: "tobias", name: "Tobias Berg", email: "tobias@northwind.demo", hue: 205, role: "ADMIN" },
  { key: "priya", name: "Priya Raman", email: "priya@northwind.demo", hue: 145, role: "MEMBER" },
  { key: "sam", name: "Sam Okafor", email: "sam@northwind.demo", hue: 25, role: "MEMBER" },
] as const satisfies ReadonlyArray<{
  key: string;
  name: string;
  email: string;
  hue: number;
  role: WorkspaceRole;
}>;

type PersonKey = (typeof PEOPLE)[number]["key"];

/**
 * One script per card that has one. Written in the same shape `generateScript()`
 * asks the model for — Hook / Body / CTA, markdown, spoken language — so the
 * editor and the revision history show something representative.
 */
const SCRIPTS: Record<string, string> = {
  "Your onboarding isn't too long, it's too vague": `## Hook
Your onboarding is not too long. It is too vague. People do not quit at step four
because there were four steps — they quit because step one never told them what
they were building towards.

## Body
Look at where your drop-off actually happens. In almost every product we have
measured it is not the longest screen. It is the first screen that asks for effort
without showing a result.

Three things fix that faster than cutting steps:

- Show the finished thing first, even as a mock. People will fill in a lot of
  fields once they can picture the payoff.
- Make step one something the product does for them, not something they do for
  the product. Import, detect, pre-fill.
- Save everything. Someone who closes the tab at step two and comes back to an
  empty form does not come back a third time.

Cutting steps is the easiest change to ship and the least likely to move the
number. Sequence beats length.

## CTA
Open your funnel, find the first screen where effort comes before payoff, and swap
those two around. That is the whole fix.`,

  "The activation metric nobody on your team agrees on": `## Hook
Ask three people on your team what "activated" means and you will get three
answers. Your roadmap is built on all three at once.

## Body
This is not a semantics problem. Support counts a user who logged in twice.
Growth counts a user who invited someone. Product counts a user who finished
setup. Every team optimises a different funnel and every dashboard tells a
slightly different story.

Pick the one event that predicts week-four retention better than any other. Not
the one that sounds most impressive — the one that actually correlates. Then
delete the other definitions from every dashboard you own.

You will lose a metric that made the deck look good. You will gain a number that
means the same thing in every room.

## CTA
Run the correlation this week. One definition, written down, everywhere.`,

  "Stop A/B testing your empty state": `## Hook
You do not have the traffic to A/B test your empty state. Nobody at your stage
does. Ship the obviously better one and go work on something that matters.

## Body
To detect a five percent lift you need thousands of users through that screen.
Most products get dozens. What you get instead is a result that looks
significant, is not, and costs you three weeks of not shipping.

Tests are for when you genuinely cannot tell which option is better. Empty states
are almost never that. One of your two versions explains what the product does
and gives people something to click. The other is a shrug with an illustration.

Save the testing budget for pricing and onboarding, where the volume is real and
the stakes are worth the wait.

## CTA
Pick the version you would defend out loud, ship it today, and move on.`,

  "What a 40% trial-to-paid rate actually looks like": `## Hook
Someone posted a 40% trial-to-paid rate this week and half your timeline felt
bad about themselves. The number is real. The denominator is doing all the work.

## Body
Forty percent of what? If the trial requires a sales call, a credit card and a
manual approval, you have filtered out everyone who was never going to buy. Your
conversion rate is measuring your qualification process, not your product.

An open, no-card, self-serve trial with the same product might convert at four
percent — and bring in more revenue, because the top of that funnel is fifty
times wider.

So before you copy a benchmark, ask what it took to get into that trial. Then
compare it to yours. Usually the comparison stops being interesting immediately.

## CTA
Write down the entry requirements for your trial next to theirs. That is the
whole story.`,

  "Pricing pages that answer the wrong question": `## Hook
People are not on your pricing page comparing tiers. They are deciding whether
to trust you at all.

## Body
Watch a session recording. The scroll pattern is not "Pro versus Business". It is
a hunt for the thing that will go wrong: the hidden per-seat charge, the annual
lock-in, whether the cheap plan is deliberately broken.

Answer that and the tier comparison takes care of itself. Show the total for a
team the size of theirs. Say what happens when they exceed a limit — before they
have to ask. Put the cancellation policy on the page instead of three clicks into
a help centre.

The best pricing pages read like someone anticipating an objection, not like a
spreadsheet with a gradient on it.

## CTA
List the three questions people email you before buying. Answer all three above
the fold.`,

  "The scope creep conversation nobody wants to have": `## Hook
The scope conversation costs you an awkward ten minutes in week one. In week six
it costs you the client.

## Body
Scope creep is never one big request. It is five small ones, each individually
reasonable, none of which you pushed back on because the relationship was going
well.

Two sentences fix most of it. "That is outside what we scoped — want me to price
it?" and "We can do that instead of X, or in addition for Y." Neither is
confrontational. Both make the trade visible while it is still small.

Clients almost never react badly to this. They react badly to a project that
quietly runs late and an invoice that quietly grows, which is what happens when
you say nothing.

## CTA
Next request that lands outside scope, price it out loud. Same day.`,

  "Retainers die in month four. Here's why.": `## Hook
Retainers rarely die because the work got worse. They die because the reporting
got worse — and month four is when that catches up with you.

## Body
Months one to three, everything is visible. Kickoff, first deliverables, obvious
wins. By month four the work has moved into maintenance, which is genuinely
valuable and completely invisible from the client's side of the table.

So they start doing the maths. Same invoice, no new artefacts, nothing to forward
to their boss. The renewal conversation is already lost before anyone brings it
up.

Fix it with something forwardable every single month. One number that moved, one
decision you made for them, one thing you stopped them from wasting money on.
Three bullets beats a forty-slide deck.

## CTA
Send this month's three bullets today, before anyone asks for them.`,

  "Your changelog is a retention feature": `## Hook
You shipped forty improvements last quarter. Your customers can name zero of
them. That is not a product problem, it is a changelog problem.

## Body
People do not churn the month they stop getting value. They churn the month they
stop noticing it. Silence reads as a product that has stopped moving, and a
product that has stopped moving is an easy line item to cut.

A changelog fixes this cheaply, but only if it is written for users instead of
for you. "Refactored the sync layer" means nothing. "Sync is now four seconds
instead of forty" means something. One sentence about what changed for them, one
screenshot, and a link into the product where they can try it.

Publish on a fixed day. Predictability is most of the value.

## CTA
Take last month's shipped list, rewrite three items as outcomes, and send it.`,

  "Stop sending decks. Send a loom and a number.": `## Hook
Your client skims the deck. They will watch four minutes of video if it opens
with their own number.

## Body
A deck asks someone to reconstruct your reasoning from bullet points. A recording
hands them the reasoning directly, with your voice doing the emphasis that bold
text is trying and failing to do.

The format that works is short and always the same. Start on the metric that
changed. Say what you did. Say what you would do next and what it costs. Stop.

Four minutes, one screen share, no intro slide. The client can forward it to
someone who was not on the call, which is the actual job a deck was doing badly.

## CTA
Record next week's update instead of building it. Time yourself — under five
minutes.`,
};

type CardSpec = {
  title: string;
  status: CardStatus;
  angle?: string;
  description?: string;
  assignee?: PersonKey;
  creator: PersonKey;
  source?: "MANUAL" | "URL" | "NEWS" | "RANDOM";
  sourceUrl?: string;
  sourceTitle?: string;
  /** Whether this card has a script — the text lives in SCRIPTS, keyed by title. */
  hasScript?: boolean;
  /** How long ago the card was created, in days. */
  age: number;
  /** Days ago the card entered each column it has passed through. */
  moves?: Array<{ status: CardStatus; daysAgo: number; by: PersonKey }>;
  comments?: Array<{ by: PersonKey; body: string; daysAgo: number }>;
  scheduledInDays?: number;
};

const ONBOARDING_CARDS: CardSpec[] = [
  {
    title: "Your onboarding isn't too long, it's too vague",
    status: "SCHEDULED",
    angle: "Teams cut steps when the real problem is that step one has no visible payoff.",
    description:
      "Counter-take on the 'reduce friction' advice everyone repeats. Sequence beats length.",
    assignee: "maya",
    creator: "maya",
    source: "RANDOM",
    hasScript: true,
    age: 21,
    scheduledInDays: 2,
    moves: [
      { status: "READY_TO_FILM", daysAgo: 17, by: "maya" },
      { status: "READY_TO_EDIT", daysAgo: 12, by: "tobias" },
      { status: "READY_TO_PUBLISH", daysAgo: 6, by: "tobias" },
      { status: "SCHEDULED", daysAgo: 3, by: "maya" },
    ],
    comments: [
      { by: "tobias", body: "Hook lands. Can we get the funnel chart on screen at 0:12?", daysAgo: 11 },
      { by: "maya", body: "Added it to the shot list — filming Thursday.", daysAgo: 10 },
    ],
  },
  {
    title: "The activation metric nobody on your team agrees on",
    status: "SCHEDULED",
    angle: "Three people, three definitions of 'activated' — and a roadmap built on all three.",
    assignee: "priya",
    creator: "tobias",
    source: "NEWS",
    sourceUrl: "https://example.com/product-analytics-2026",
    sourceTitle: "The state of product analytics in 2026",
    hasScript: true,
    age: 26,
    scheduledInDays: 5,
    moves: [
      { status: "READY_TO_FILM", daysAgo: 20, by: "priya" },
      { status: "READY_TO_EDIT", daysAgo: 15, by: "priya" },
      { status: "READY_TO_PUBLISH", daysAgo: 9, by: "sam" },
      { status: "SCHEDULED", daysAgo: 4, by: "maya" },
    ],
  },
  {
    title: "Stop A/B testing your empty state",
    status: "READY_TO_PUBLISH",
    angle: "You do not have the traffic. Ship the obviously better one and move on.",
    assignee: "sam",
    creator: "sam",
    source: "MANUAL",
    hasScript: true,
    age: 15,
    moves: [
      { status: "READY_TO_FILM", daysAgo: 12, by: "sam" },
      { status: "READY_TO_EDIT", daysAgo: 8, by: "sam" },
      { status: "READY_TO_PUBLISH", daysAgo: 2, by: "tobias" },
    ],
    comments: [{ by: "maya", body: "Love this one. Ship it.", daysAgo: 1 }],
  },
  {
    title: "What a 40% trial-to-paid rate actually looks like",
    status: "READY_TO_EDIT",
    angle: "The number is real but the denominator is doing all the work.",
    assignee: "tobias",
    creator: "priya",
    source: "URL",
    sourceUrl: "https://example.com/saas-benchmarks",
    sourceTitle: "2026 SaaS conversion benchmarks",
    hasScript: true,
    age: 11,
    moves: [
      { status: "READY_TO_FILM", daysAgo: 8, by: "tobias" },
      { status: "READY_TO_EDIT", daysAgo: 3, by: "tobias" },
    ],
  },
  {
    title: "Pricing pages that answer the wrong question",
    status: "READY_TO_EDIT",
    angle: "People are not comparing your tiers. They are deciding whether to trust you at all.",
    assignee: "maya",
    creator: "maya",
    source: "RANDOM",
    hasScript: true,
    age: 9,
    moves: [
      { status: "READY_TO_FILM", daysAgo: 6, by: "maya" },
      { status: "READY_TO_EDIT", daysAgo: 2, by: "priya" },
    ],
  },
  {
    title: "Your changelog is a retention feature",
    status: "READY_TO_FILM",
    angle: "Shipping quietly is why people forget they pay you.",
    assignee: "priya",
    creator: "sam",
    source: "MANUAL",
    hasScript: true,
    age: 7,
    moves: [{ status: "READY_TO_FILM", daysAgo: 4, by: "priya" }],
  },
  {
    title: "The demo call you should have replaced with a loom",
    status: "READY_TO_FILM",
    angle: "Synchronous by default is a tax you charge your own pipeline.",
    assignee: "sam",
    creator: "tobias",
    source: "RANDOM",
    age: 5,
    moves: [{ status: "READY_TO_FILM", daysAgo: 2, by: "sam" }],
  },
  {
    title: "Why your best users never open the dashboard",
    status: "IDEA",
    angle: "The dashboard is where you look at them. The value happens elsewhere.",
    creator: "maya",
    source: "RANDOM",
    age: 4,
  },
  {
    title: "Three onboarding emails that outperform a product tour",
    status: "IDEA",
    angle: "Tours interrupt. Emails arrive when someone already decided to come back.",
    creator: "priya",
    source: "NEWS",
    sourceUrl: "https://example.com/lifecycle-email-teardown",
    sourceTitle: "Lifecycle email teardown: 40 B2B products",
    age: 3,
  },
  {
    title: "You do not have a churn problem, you have a segment problem",
    status: "IDEA",
    angle: "One bad-fit segment can make a healthy product look like it is bleeding.",
    creator: "tobias",
    source: "RANDOM",
    age: 2,
  },
  {
    title: "The free plan question, answered with actual numbers",
    status: "IDEA",
    angle: "When a free tier pays for itself, and the two cases where it never will.",
    creator: "sam",
    source: "MANUAL",
    age: 1,
  },
];

const AGENCY_CARDS: CardSpec[] = [
  {
    title: "The scope creep conversation nobody wants to have",
    status: "SCHEDULED",
    angle: "Saying it in week one costs an awkward call. Saying it in week six costs the client.",
    assignee: "tobias",
    creator: "tobias",
    source: "MANUAL",
    hasScript: true,
    age: 24,
    scheduledInDays: 1,
    moves: [
      { status: "READY_TO_FILM", daysAgo: 19, by: "tobias" },
      { status: "READY_TO_EDIT", daysAgo: 13, by: "sam" },
      { status: "READY_TO_PUBLISH", daysAgo: 7, by: "sam" },
      { status: "SCHEDULED", daysAgo: 2, by: "tobias" },
    ],
  },
  {
    title: "Retainers die in month four. Here's why.",
    status: "READY_TO_PUBLISH",
    angle: "The work got better and the reporting got worse.",
    assignee: "priya",
    creator: "maya",
    source: "RANDOM",
    hasScript: true,
    age: 18,
    moves: [
      { status: "READY_TO_FILM", daysAgo: 14, by: "priya" },
      { status: "READY_TO_EDIT", daysAgo: 9, by: "priya" },
      { status: "READY_TO_PUBLISH", daysAgo: 3, by: "maya" },
    ],
  },
  {
    title: "Stop sending decks. Send a loom and a number.",
    status: "READY_TO_EDIT",
    angle: "Clients skim decks. They watch four minutes if it opens with their own metric.",
    assignee: "sam",
    creator: "priya",
    source: "MANUAL",
    hasScript: true,
    age: 10,
    moves: [
      { status: "READY_TO_FILM", daysAgo: 7, by: "sam" },
      { status: "READY_TO_EDIT", daysAgo: 2, by: "sam" },
    ],
  },
  {
    title: "The discovery question that saves you six weeks",
    status: "READY_TO_FILM",
    angle: "Ask what they already tried before you ask what they want.",
    assignee: "maya",
    creator: "sam",
    source: "RANDOM",
    age: 6,
    moves: [{ status: "READY_TO_FILM", daysAgo: 3, by: "maya" }],
  },
  {
    title: "Pricing by deliverable is why you are underpaid",
    status: "IDEA",
    angle: "You are billing for the artefact, not the decision it unlocks.",
    creator: "maya",
    source: "RANDOM",
    age: 3,
  },
  {
    title: "What clients actually mean by 'make it pop'",
    status: "IDEA",
    angle: "It is almost never colour. It is hierarchy.",
    creator: "tobias",
    source: "MANUAL",
    age: 2,
  },
];

const PROJECTS = [
  {
    name: "Northwind SaaS",
    slug: "northwind-saas",
    niche: "product and growth leads at B2B SaaS companies",
    description:
      "Short, opinionated videos about activation, onboarding and retention for B2B SaaS teams. Every video takes a widely repeated piece of advice and shows where it breaks.",
    cards: ONBOARDING_CARDS,
  },
  {
    name: "Agency Playbook",
    slug: "agency-playbook",
    niche: "owners of small design and marketing agencies",
    description:
      "Practical videos on pricing, scoping and client communication for agencies of two to twenty people. Concrete scripts and numbers, no mindset content.",
    cards: AGENCY_CARDS,
  },
];

const STAGE_ORDER: CardStatus[] = [
  "IDEA",
  "READY_TO_FILM",
  "READY_TO_EDIT",
  "READY_TO_PUBLISH",
  "SCHEDULED",
];

const STAGE_LABEL: Record<CardStatus, string> = {
  IDEA: "Idea",
  READY_TO_FILM: "Ready to film",
  READY_TO_EDIT: "Ready to edit",
  READY_TO_PUBLISH: "Ready to publish",
  SCHEDULED: "Scheduled",
};

async function main() {
  console.log("Seeding the demo workspace…");

  // Cascades clear projects, cards, activity and invites with it.
  await db.workspace.deleteMany({ where: { slug: WORKSPACE_SLUG } });
  await db.user.deleteMany({ where: { email: { in: PEOPLE.map((p) => p.email) } } });

  const passwordHash = await hashPassword(PASSWORD);

  const users: Record<string, { id: string; name: string }> = {};
  for (const person of PEOPLE) {
    const user = await db.user.create({
      data: {
        email: person.email,
        name: person.name,
        passwordHash,
        avatarHue: person.hue,
        createdAt: daysAgo(60),
      },
      select: { id: true, name: true },
    });
    users[person.key] = user;
  }

  const workspace = await db.workspace.create({
    data: {
      name: "Northwind Studio",
      slug: WORKSPACE_SLUG,
      createdAt: daysAgo(60),
      members: {
        create: PEOPLE.map((person) => ({
          userId: users[person.key].id,
          role: person.role,
          createdAt: daysAgo(60),
        })),
      },
    },
  });

  for (const spec of PROJECTS) {
    const project = await db.project.create({
      data: {
        workspaceId: workspace.id,
        name: spec.name,
        slug: spec.slug,
        niche: spec.niche,
        description: spec.description,
        createdAt: daysAgo(45),
      },
    });

    // Positions are floats spaced 1000 apart, same as moveCard() writes them.
    const nextPosition: Record<string, number> = {};

    for (const card of spec.cards) {
      const column = card.status;
      nextPosition[column] = (nextPosition[column] ?? 0) + 1000;

      const created = daysAgo(card.age, 9);
      const lastMove = card.moves?.at(-1);
      const script = card.hasScript ? SCRIPTS[card.title] : undefined;
      if (card.hasScript && !script) throw new Error(`No script written for "${card.title}"`);
      const scriptTouched = script ? daysAgo(Math.max(card.age - 4, 1), 11) : null;

      const row = await db.videoCard.create({
        data: {
          projectId: project.id,
          title: card.title,
          status: card.status,
          position: nextPosition[column],
          angle: card.angle ?? null,
          description: card.description ?? null,
          source: card.source ?? "MANUAL",
          sourceUrl: card.sourceUrl ?? null,
          sourceTitle: card.sourceTitle ?? null,
          script: script ?? null,
          scriptUpdatedAt: scriptTouched,
          scheduledFor:
            card.scheduledInDays === undefined ? null : daysAgo(-card.scheduledInDays, 12),
          createdById: users[card.creator].id,
          assigneeId: card.assignee ? users[card.assignee].id : null,
          createdAt: created,
          updatedAt: lastMove ? daysAgo(lastMove.daysAgo, 15) : created,
        },
      });

      // --- status history, which is what the analytics page counts
      await db.statusEvent.create({
        data: {
          cardId: row.id,
          toStatus: "IDEA",
          userId: users[card.creator].id,
          createdAt: created,
        },
      });
      await db.activity.create({
        data: {
          cardId: row.id,
          userId: users[card.creator].id,
          type: "CREATED",
          createdAt: created,
        },
      });

      let from: CardStatus = "IDEA";
      for (const move of card.moves ?? []) {
        const at = daysAgo(move.daysAgo, 15);
        await db.statusEvent.create({
          data: {
            cardId: row.id,
            fromStatus: from,
            toStatus: move.status,
            userId: users[move.by].id,
            createdAt: at,
          },
        });
        await db.activity.create({
          data: {
            cardId: row.id,
            userId: users[move.by].id,
            type: "MOVED",
            fromValue: STAGE_LABEL[from],
            detail: STAGE_LABEL[move.status],
            createdAt: at,
          },
        });
        from = move.status;
      }

      // --- script revisions, which the analytics page counts as "scripts written"
      if (script && scriptTouched) {
        const author = card.assignee ?? card.creator;
        await db.scriptRevision.create({
          data: {
            cardId: row.id,
            content: script,
            source: "AI_GENERATED",
            createdById: users[author].id,
            createdAt: scriptTouched,
          },
        });
        await db.activity.create({
          data: {
            cardId: row.id,
            userId: users[author].id,
            type: "SCRIPT_GENERATED",
            createdAt: scriptTouched,
          },
        });

        // A second pass a day later, so revision history is not always length one.
        if (card.age > 12) {
          const improved = daysAgo(Math.max(card.age - 5, 1), 16);
          await db.scriptRevision.create({
            data: {
              cardId: row.id,
              content: script,
              source: "AI_IMPROVED",
              createdById: users[author].id,
              createdAt: improved,
            },
          });
          await db.activity.create({
            data: {
              cardId: row.id,
              userId: users[author].id,
              type: "SCRIPT_IMPROVED",
              createdAt: improved,
            },
          });
        }
      }

      if (card.assignee) {
        await db.activity.create({
          data: {
            cardId: row.id,
            userId: users[card.creator].id,
            type: "ASSIGNED",
            detail: users[card.assignee].name,
            createdAt: daysAgo(Math.max(card.age - 1, 1), 12),
          },
        });
      }

      for (const comment of card.comments ?? []) {
        await db.comment.create({
          data: {
            cardId: row.id,
            authorId: users[comment.by].id,
            body: comment.body,
            createdAt: daysAgo(comment.daysAgo, 13),
          },
        });
        await db.activity.create({
          data: {
            cardId: row.id,
            userId: users[comment.by].id,
            type: "COMMENTED",
            createdAt: daysAgo(comment.daysAgo, 13),
          },
        });
      }
    }
  }

  // Scores from the game people play while the AI is thinking.
  const scores = [
    { key: "maya", score: 4_820 },
    { key: "tobias", score: 3_140 },
    { key: "priya", score: 6_275 },
    { key: "sam", score: 2_090 },
    { key: "priya", score: 5_010 },
  ] as const;
  for (const [index, entry] of scores.entries()) {
    await db.gameScore.create({
      data: {
        workspaceId: workspace.id,
        userId: users[entry.key].id,
        score: entry.score,
        createdAt: daysAgo(index + 2, 14),
      },
    });
  }

  const cardCount = PROJECTS.reduce((total, p) => total + p.cards.length, 0);
  console.log(`
  Workspace   Northwind Studio  (/app/${WORKSPACE_SLUG})
  Projects    ${PROJECTS.map((p) => p.name).join(", ")}
  Cards       ${cardCount} across ${STAGE_ORDER.length} columns

  Sign in as any of:
${PEOPLE.map((p) => `    ${p.email.padEnd(24)} ${PASSWORD}`).join("\n")}
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
