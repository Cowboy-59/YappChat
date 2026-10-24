import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/lib/db/schema.ts",
    "./src/lib/db/auth-schema.ts",
    "./src/lib/db/studio-schema.ts",
    "./src/lib/db/pa-schema.ts",
    "./src/lib/db/engine-schema.ts",
    "./src/lib/db/ws-schema.ts",
    "./src/lib/db/communities-schema.ts",
    "./src/lib/db/presentations-schema.ts",
    "./src/lib/db/support-schema.ts",
    "./src/lib/db/contacts-schema.ts",
    "./src/lib/db/remotecontrol-schema.ts",
    "./src/lib/db/training-schema.ts",
  ],
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
