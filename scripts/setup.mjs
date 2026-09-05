#!/usr/bin/env node
/**
 * Everything that has to be true before the dev server can boot, in one place.
 *
 * `npm run dev` and `npm start` both run this first, so a fresh clone is
 * `npm install && npm run dev` — no separate "start the database", "copy the env
 * file", "run the migrations" steps to get wrong. Every step is idempotent and
 * skips itself when it has nothing to do, so the happy path costs about a second.
 *
 * Run it on its own with `npm run setup` if you just want the environment ready.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const envPath = join(root, ".env");
const examplePath = join(root, ".env.example");

/** The database docker-compose.yml brings up. Anything else is assumed to be yours. */
const BUNDLED_DB_URL =
  "postgresql://saasmarketer:saasmarketer@localhost:5433/saas_marketer?schema=public";

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

const step = (msg) => console.log(`${c.dim("setup")} ${msg}`);
const done = (msg) => console.log(`${c.dim("setup")} ${c.green("✓")} ${msg}`);

function fail(title, ...lines) {
  console.error(`\n${c.red("✗")} ${c.bold(title)}\n`);
  for (const line of lines) console.error(`  ${line}`);
  console.error("");
  process.exit(1);
}

function run(command, args, opts = {}) {
  return spawnSync(command, args, { cwd: root, stdio: "inherit", shell: false, ...opts });
}

function capture(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  return { ok: result.status === 0, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

// ---------------------------------------------------------------- 1. .env

function ensureEnvFile() {
  if (existsSync(envPath)) return;

  if (!existsSync(examplePath)) {
    fail(".env.example is missing", "Cannot generate a .env without it.");
  }

  // SESSION_SECRET signs cookies and derives the key that encrypts stored API
  // keys, so it has to be unique per install — generate it rather than shipping one.
  const contents = readFileSync(examplePath, "utf8").replace(
    /^SESSION_SECRET=.*$/m,
    `SESSION_SECRET="${randomBytes(32).toString("base64url")}"`,
  );

  writeFileSync(envPath, contents);
  done(`created ${c.bold(".env")} with a freshly generated SESSION_SECRET`);
}

function readEnvFile() {
  const env = {};
  if (!existsSync(envPath)) return env;

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

// ---------------------------------------------------------------- 2. database

function dockerAvailable() {
  return capture("docker", ["compose", "version"]).ok;
}

/** True once Postgres accepts connections, polled until `timeoutMs` runs out. */
async function waitForPostgres(timeoutMs = 60_000) {
  const { default: pg } = await import("pg");
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      await client.end();
      return true;
    } catch (error) {
      await client.end().catch(() => {});
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

async function ensureDatabase(usesBundledDb) {
  if (!usesBundledDb) {
    step("DATABASE_URL points somewhere other than the bundled database — leaving it alone");
    return;
  }

  if (!dockerAvailable()) {
    fail(
      "Docker is not available",
      "This project ships a Postgres container so you do not have to install one.",
      "",
      `  ${c.bold("Either")}  start Docker Desktop (or the Docker daemon) and run this again,`,
      `  ${c.bold("or")}      point DATABASE_URL in .env at a Postgres you already run.`,
    );
  }

  step("starting Postgres…");
  const up = run("docker", ["compose", "up", "-d"], { stdio: "pipe" });
  if (up.status !== 0) {
    fail(
      "Could not start the Postgres container",
      String(up.stderr ?? "").trim() || "docker compose up -d failed.",
    );
  }

  try {
    await waitForPostgres();
  } catch (error) {
    fail(
      "Postgres did not become reachable",
      `Waited 60s for ${BUNDLED_DB_URL.replace(/:[^:@]+@/, ":····@")}.`,
      String(error?.message ?? error),
      "",
      "  Try: docker compose logs postgres",
    );
  }
  done("Postgres is up on port 5433");
}

// ---------------------------------------------------------------- 3. prisma

function applyMigrations() {
  step("applying migrations…");
  const result = capture("npx", ["prisma", "migrate", "deploy"]);
  if (!result.ok) {
    fail("Migrations failed", result.out.trim());
  }
  done(
    /No pending migrations/i.test(result.out)
      ? "database schema is up to date"
      : "migrations applied",
  );
}

/** The generated client is gitignored, so a fresh clone always has to build it. */
function generateClient() {
  const clientEntry = join(root, "app/generated/prisma/client.ts");
  const schemaPath = join(root, "prisma/schema.prisma");

  if (existsSync(clientEntry) && statSync(clientEntry).mtimeMs > statSync(schemaPath).mtimeMs) {
    return; // already newer than the schema it was generated from
  }

  step("generating the Prisma client…");
  const result = capture("npx", ["prisma", "generate"]);
  if (!result.ok) fail("prisma generate failed", result.out.trim());
  done("Prisma client generated");
}

// ---------------------------------------------------------------- run

ensureEnvFile();

const env = readEnvFile();
for (const [key, value] of Object.entries(env)) {
  process.env[key] ??= value;
}

if (!process.env.DATABASE_URL) {
  fail("DATABASE_URL is not set", "Add it to .env — see .env.example for the expected shape.");
}
if (!process.env.SESSION_SECRET) {
  fail(
    "SESSION_SECRET is not set",
    "Add it to .env. Any long random string works:",
    "",
    `  ${c.bold("node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"")}`,
  );
}

const usesBundledDb = process.env.DATABASE_URL.includes("localhost:5433");
await ensureDatabase(usesBundledDb);
applyMigrations();
generateClient();

// `npm run setup` on its own should say so; when chained into `dev` the dev
// server's own banner takes over from here.
if (process.env.npm_lifecycle_event === "setup") {
  console.log(`\n${c.green("Ready.")} Start the app with ${c.bold("npm run dev")}\n`);
}
