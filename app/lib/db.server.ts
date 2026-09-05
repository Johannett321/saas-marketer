import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "~/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

function createClient() {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: ReturnType<typeof createClient> | undefined;
}

// Reuse the client across HMR reloads in dev so we don't exhaust connections.
export const db = global.__prisma__ ?? createClient();
if (process.env.NODE_ENV !== "production") global.__prisma__ = db;
