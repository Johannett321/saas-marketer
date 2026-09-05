import OpenAI from "openai";
import type { AiCredentials } from "./ai-credentials.server";

/**
 * All AI features run through the OpenAI Responses API.
 * The web_search tool lets the model look things up and open pages before it writes.
 *
 * Nothing here is tied to a vertical — every prompt is grounded in the project's
 * own niche and description, which the user sets when creating the project.
 *
 * There is no instance-wide API key. Every exported call takes the `AiCredentials`
 * of the person who triggered it, loaded from their profile, so on a shared instance
 * each person spends their own OpenAI credit and picks their own model.
 */

/** One client per key, so a request does not pay TLS setup for a key we already used. */
const clients = new Map<string, OpenAI>();

function openai({ apiKey }: AiCredentials) {
  let client = clients.get(apiKey);
  if (!client) {
    client = new OpenAI({ apiKey });
    clients.set(apiKey, client);
  }
  return client;
}

/** The knobs every `responses.create` call shares. */
function callDefaults(credentials: AiCredentials) {
  return {
    model: credentials.model,
    reasoning: { effort: credentials.reasoningEffort },
  } as const;
}

// ---------------------------------------------------------------- types

export type GenerationMode = "URL" | "NEWS" | "RANDOM";

export type ProjectContext = {
  name: string;
  niche: string | null;
  description: string | null;
};

export type Suggestion = {
  title: string;
  angle: string;
  rationale: string;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
};

export type IdeaResult = {
  suggestions: Suggestion[];
  source?: { url: string; title: string; excerpt: string } | null;
};

// ---------------------------------------------------------------- prompt building

const CRAFT_BRIEF = `You write short vertical marketing videos (Reels / TikTok / Shorts, 30-90 seconds).
The tone is direct, concrete and free of filler. Titles are short enough to read in under two
seconds, and each title attacks one clear objection or one clear problem.`;

/** The project's own niche and description are the only domain knowledge in the prompt. */
function projectBrief(project: ProjectContext) {
  const lines = [`Project: "${project.name}".`];
  if (project.niche) lines.push(`Audience / niche: ${project.niche}.`);
  if (project.description) lines.push(`What this project is about: ${project.description}`);
  if (!project.niche && !project.description) {
    lines.push(
      "No niche has been set for this project, so keep the ideas broadly useful and say so in the rationale.",
    );
  }
  return lines.join("\n");
}

const SUGGESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "angle", "rationale", "sourceUrl", "sourceTitle"],
        properties: {
          title: { type: "string", description: "The video title as it appears on the card" },
          angle: {
            type: "string",
            description: "The objection or angle this video attacks, in one sentence",
          },
          rationale: {
            type: "string",
            description: "Short reasoning for why this angle works for the audience",
          },
          sourceUrl: { type: ["string", "null"], description: "Source URL if the idea builds on an article" },
          sourceTitle: { type: ["string", "null"], description: "Title of the source" },
        },
      },
    },
  },
} as const;

const jsonFormat = {
  type: "json_schema" as const,
  name: "video_ideas",
  strict: true,
  schema: SUGGESTION_SCHEMA as unknown as Record<string, unknown>,
};

async function fetchHtml(url: string, timeoutMs = 15_000) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; saas-marketer/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) throw new Error(`Could not fetch that page (HTTP ${res.status}).`);

  const html = await res.text();
  const title =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] ??
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ??
    url;
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ??
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)/i)?.[1] ??
    "";

  return {
    url: res.url || url,
    html,
    title: decodeEntities(title.trim()),
    description: decodeEntities(description.trim()),
    text: htmlToText(html),
  };
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pulls readable text out of an HTML page so it can be used as model context. */
export async function fetchArticle(url: string) {
  const page = await fetchHtml(url, 20_000);
  return { url: page.url, title: page.title, excerpt: page.text.slice(0, 12_000) };
}

/** Same-origin paths most likely to describe what a company actually does. */
const INTERESTING = [
  "about", "about-us", "our-story", "company", "who-we-are",
  "product", "products", "features", "solutions", "services",
  "pricing", "plans", "how-it-works", "use-cases", "customers",
];

function pickInternalLinks(html: string, base: URL, limit: number) {
  const seen = new Set<string>();
  const scored: Array<{ url: string; score: number }> = [];

  for (const match of html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
    let candidate: URL;
    try {
      candidate = new URL(match[1], base);
    } catch {
      continue;
    }
    if (candidate.origin !== base.origin) continue;
    if (!/^https?:$/.test(candidate.protocol)) continue;

    candidate.hash = "";
    candidate.search = "";
    const href = candidate.toString();
    if (href === base.toString() || seen.has(href)) continue;

    const path = candidate.pathname.toLowerCase();
    if (/\.(pdf|jpg|jpeg|png|gif|svg|zip|mp4|webp|css|js)$/.test(path)) continue;
    // deep paths are usually blog posts or docs, not "what we do" pages
    if (path.split("/").filter(Boolean).length > 2) continue;

    const score = INTERESTING.findIndex((k) => path.includes(k));
    if (score === -1) continue;

    seen.add(href);
    scored.push({ url: href, score });
  }

  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.url);
}

/**
 * Shallow crawl: the entry page plus a few same-origin pages that usually explain
 * what the site is about. Sub-page failures are ignored — the entry page is enough.
 */
export async function crawlSite(entry: string, maxPages = 3) {
  const first = await fetchHtml(entry);
  const base = new URL(first.url);

  const links = pickInternalLinks(first.html, base, maxPages);
  const rest = await Promise.all(
    links.map(async (link) => {
      try {
        return await fetchHtml(link, 10_000);
      } catch {
        return null;
      }
    }),
  );

  const pages = [first, ...rest.filter((p): p is Awaited<ReturnType<typeof fetchHtml>> => p !== null)];

  const combined = pages
    .map((p) => `--- ${p.url}\nTITLE: ${p.title}\n${p.description ? `META: ${p.description}\n` : ""}${p.text.slice(0, 6_000)}`)
    .join("\n\n")
    .slice(0, 20_000);

  return { url: first.url, title: first.title, pages: pages.map((p) => p.url), text: combined };
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function outputText(response: { output_text?: string }) {
  const text = response.output_text?.trim();
  if (!text) throw new Error("The model returned an empty response. Try again.");
  return text;
}

// ---------------------------------------------------------------- project profiling

const PROFILE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "niche", "description"],
  properties: {
    name: {
      type: "string",
      description: "Short project name, usually the brand or product name. Max 40 characters.",
    },
    niche: {
      type: "string",
      description:
        "Who the marketing videos should target, as a short noun phrase — e.g. 'indie game developers', 'clinic owners' or 'people learning to cook'. Max 80 characters.",
    },
    description: {
      type: "string",
      description:
        "Two or three sentences on what this company does, who it serves and what angle its videos should take.",
    },
  },
} as const;

/** Crawls a site and turns it into a project name, niche and description. */
export async function profileProjectFromSite(credentials: AiCredentials, url: string) {
  const site = await crawlSite(url);

  const response = await openai(credentials).responses.create({
    ...callDefaults(credentials),
    input: [
      {
        role: "system",
        content: `You set up a marketing-video project from a company's own website.
Be specific and factual — use the company's actual products, audience and vocabulary.
Never invent facts that are not on the pages you were given.`,
      },
      {
        role: "user",
        content: `Here is the content of ${site.url} and a few of its sub-pages.

${site.text}

Fill in the project name, the niche its marketing videos should target, and a description
of what the project covers.`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "project_profile",
        strict: true,
        schema: PROFILE_SCHEMA as unknown as Record<string, unknown>,
      },
    },
  });

  let parsed: { name?: string; niche?: string; description?: string };
  try {
    parsed = JSON.parse(outputText(response));
  } catch {
    throw new Error("Could not read a project profile from that site. Try another page.");
  }

  return {
    name: (parsed.name ?? "").trim(),
    niche: (parsed.niche ?? "").trim(),
    description: (parsed.description ?? "").trim(),
    crawled: site.pages,
  };
}

// ---------------------------------------------------------------- idea generation

export async function generateIdeas(credentials: AiCredentials, opts: {
  mode: GenerationMode;
  count: number;
  url?: string;
  project: ProjectContext;
  existingTitles: string[];
}): Promise<IdeaResult> {
  const { mode, count, project, existingTitles } = opts;

  const avoid = existingTitles.length
    ? `\n\nAvoid repeating these titles that are already on the board:\n${existingTitles
        .slice(0, 40)
        .map((t) => `- ${t}`)
        .join("\n")}`
    : "";

  const system = `${CRAFT_BRIEF}\n\n${projectBrief(project)}${avoid}`;

  if (mode === "URL") {
    if (!opts.url) throw new Error("Missing link.");
    const article = await fetchArticle(opts.url);

    const response = await openai(credentials).responses.create({
      ...callDefaults(credentials),
      input: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Here is an article I want to make a video from.

TITLE: ${article.title}
URL: ${article.url}

CONTENT:
${article.excerpt}

Give me ${count} different video titles based on this article. Each title must attack a
COMPLETELY different objection or angle from the others — not ${count} variations of the
same sentence. Set sourceUrl and sourceTitle to the article above.`,
        },
      ],
      text: { format: jsonFormat },
    });

    return { suggestions: parseSuggestions(response, count), source: article };
  }

  if (mode === "NEWS") {
    const today = new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const topic = project.niche
      ? `the ${project.niche} space`
      : "the topics this project covers";

    const response = await openai(credentials).responses.create({
      ...callDefaults(credentials),
      tools: [{ type: "web_search", search_context_size: "high" }],
      input: [
        { role: "system", content: system },
        {
          role: "user",
          content: `Today is ${today}. Search for today's news in ${topic}. Read the most
relevant stories. Then create ${count} video ideas where EVERY idea is grounded in a
specific news story you found.

For each idea, set sourceUrl to the article's URL and sourceTitle to its title.
Do not invent sources — only use pages you actually opened.`,
        },
      ],
      text: { format: jsonFormat },
    });

    return { suggestions: parseSuggestions(response, count), source: null };
  }

  // RANDOM — pure brainstorm, no sources
  const response = await openai(credentials).responses.create({
    ...callDefaults(credentials),
    input: [
      { role: "system", content: system },
      {
        role: "user",
        content: `Come up with ${count} video ideas from scratch. Mix the formats:
myths debunked, mistakes that cost time or money, "do this instead", numbers and
benchmarks, and concrete things someone can act on in ten minutes.
Leave sourceUrl and sourceTitle null.`,
      },
    ],
    text: { format: jsonFormat },
  });

  return { suggestions: parseSuggestions(response, count), source: null };
}

function parseSuggestions(response: { output_text?: string }, count: number): Suggestion[] {
  let parsed: { suggestions?: Suggestion[] };
  try {
    parsed = JSON.parse(outputText(response));
  } catch {
    throw new Error("Could not parse the model's response. Try again.");
  }

  const suggestions = (parsed.suggestions ?? [])
    .filter((s) => s?.title?.trim())
    .slice(0, count)
    .map((s) => ({
      title: s.title.trim(),
      angle: (s.angle ?? "").trim(),
      rationale: (s.rationale ?? "").trim(),
      sourceUrl: s.sourceUrl || null,
      sourceTitle: s.sourceTitle || null,
    }));

  if (suggestions.length === 0) throw new Error("The model returned no ideas. Try again.");
  return suggestions;
}

// ---------------------------------------------------------------- title rewriting

const TITLE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["options"],
  properties: {
    options: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "note"],
        properties: {
          title: { type: "string", description: "The rewritten title" },
          note: {
            type: "string",
            description: "Half a sentence on what this version does differently",
          },
        },
      },
    },
  },
} as const;

export type TitleOption = { title: string; note: string };

/**
 * Rewrites a card title. The card's own description and angle are the strongest
 * signal available, so they go in whenever they are set.
 */
export async function improveTitle(credentials: AiCredentials, opts: {
  title: string;
  description?: string | null;
  angle?: string | null;
  project: ProjectContext;
  count?: number;
}): Promise<TitleOption[]> {
  const { title, description, angle, project, count = 3 } = opts;

  const context = [
    description?.trim() ? `What the video is about:\n${description.trim()}` : null,
    angle?.trim() ? `The angle it attacks: ${angle.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await openai(credentials).responses.create({
    ...callDefaults(credentials),
    input: [
      {
        role: "system",
        content: `${CRAFT_BRIEF}\n\n${projectBrief(project)}

You are rewriting one video title. A good title is short enough to read in under two
seconds, makes one specific promise or names one specific mistake, and does not sound
like a generic listicle. Never use clickbait that the video cannot pay off.`,
      },
      {
        role: "user",
        content: `Current title: "${title}"
${context ? `\n${context}\n` : ""}
Give me ${count} stronger versions of this title. Each one should take a clearly different
approach — do not give me ${count} rewordings of the same sentence. Keep them faithful to
what the video is actually about.`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "title_options",
        strict: true,
        schema: TITLE_SCHEMA as unknown as Record<string, unknown>,
      },
    },
  });

  let parsed: { options?: TitleOption[] };
  try {
    parsed = JSON.parse(outputText(response));
  } catch {
    throw new Error("Could not read the suggestions. Try again.");
  }

  const options = (parsed.options ?? [])
    .filter((o) => o?.title?.trim() && o.title.trim() !== title.trim())
    .slice(0, count)
    .map((o) => ({ title: o.title.trim(), note: (o.note ?? "").trim() }));

  if (options.length === 0) throw new Error("The model had nothing better to offer.");
  return options;
}

// ---------------------------------------------------------------- script generation

const SCRIPT_FORMAT = `Write the script in markdown with this structure:

## Hook
One or two sentences that stop the scroll. Concrete, not generic.

## Body
The actual point, broken into short paragraphs or bullets. Spoken language — this gets read aloud.

## CTA
One clear call to action at the end.

Rules:
- English, conversational tone, short sentences.
- 130-200 words total (30-75 seconds spoken).
- No emoji, no stage directions in parentheses, no "in this video we will".
- Be concrete: numbers, examples and specific names where they fit.
- Reply with ONLY the script in markdown, no commentary around it.`;

export async function generateScript(credentials: AiCredentials, opts: {
  title: string;
  angle?: string | null;
  project: ProjectContext;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourceExcerpt?: string | null;
}) {
  const { title, angle, project, sourceUrl, sourceTitle, sourceExcerpt } = opts;

  const context = sourceExcerpt
    ? `\n\nThis video builds on a specific source. Use it as the factual basis:

SOURCE: ${sourceTitle ?? sourceUrl}
URL: ${sourceUrl}

CONTENT:
${sourceExcerpt.slice(0, 12_000)}`
    : "";

  const research = sourceExcerpt
    ? `You may search the web to confirm numbers or find fresh examples, but the source
above is the main basis.`
    : `Search the web for this topic first. Open the pages that look most useful and read
them before writing, so the script is built on real, current facts.`;

  const response = await openai(credentials).responses.create({
    ...callDefaults(credentials),
    tools: [{ type: "web_search", search_context_size: "medium" }],
    input: [
      { role: "system", content: `${CRAFT_BRIEF}\n\n${projectBrief(project)}\n\n${SCRIPT_FORMAT}` },
      {
        role: "user",
        content: `Video title: "${title}"${angle ? `\nAngle / objection: ${angle}` : ""}

${research}${context}

Write the script.`,
      },
    ],
  });

  return { content: outputText(response), sources: extractSources(response) };
}

export async function improveScript(credentials: AiCredentials, opts: {
  title: string;
  script: string;
  project: ProjectContext;
  instruction?: string;
}) {
  const { title, script, project, instruction } = opts;

  const response = await openai(credentials).responses.create({
    ...callDefaults(credentials),
    input: [
      { role: "system", content: `${CRAFT_BRIEF}\n\n${projectBrief(project)}\n\n${SCRIPT_FORMAT}` },
      {
        role: "user",
        content: `Here is an existing script for the video "${title}".

${
  instruction?.trim()
    ? `Improve it like this: ${instruction.trim()}`
    : `Make it sharper: stronger hook, cut filler words, make the points more concrete
and make the CTA clearer. Keep the same core message and roughly the same length.`
}

SCRIPT:
${script}

Return the improved script in the same markdown structure.`,
      },
    ],
  });

  return { content: outputText(response) };
}

/** Best-effort extraction of the pages the model actually opened. */
function extractSources(response: unknown): Array<{ url: string; title: string }> {
  const out = (response as { output?: unknown[] })?.output;
  if (!Array.isArray(out)) return [];

  const found = new Map<string, string>();
  for (const item of out) {
    const content = (item as { content?: unknown[] })?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const annotations = (part as { annotations?: unknown[] })?.annotations;
      if (!Array.isArray(annotations)) continue;
      for (const a of annotations) {
        const ann = a as { type?: string; url?: string; title?: string };
        if (ann.type === "url_citation" && ann.url) found.set(ann.url, ann.title || ann.url);
      }
    }
  }
  return [...found].map(([url, title]) => ({ url, title })).slice(0, 8);
}
