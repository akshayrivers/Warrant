import { defineConfig } from "drizzle-kit";
export default defineConfig({
    schema: "./src/db/schema/index.ts", // wherever your schema file actually lives
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: { url: process.env.DATABASE_URL! },
});