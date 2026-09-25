import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Generating SQL needs only the schema; migrating requires DATABASE_URL.
  ...(process.env.DATABASE_URL && {
    dbCredentials: { url: process.env.DATABASE_URL },
  }),
});
