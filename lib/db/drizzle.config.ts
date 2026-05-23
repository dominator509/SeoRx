import { defineConfig } from "drizzle-kit";

const command = process.argv[2];
const databaseRequiredCommands = new Set(["migrate", "push", "studio", "up"]);
const databaseUrl = process.env.DATABASE_URL;

if (databaseRequiredCommands.has(command ?? "") && !databaseUrl) {
  throw new Error("DATABASE_URL is required for database-mutating Drizzle commands");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl ?? "postgres://user:password@localhost:5432/seorx",
  },
});
