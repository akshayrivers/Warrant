import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let dbInstance: Database | null = null;
let sqlInstance: postgres.Sql | null = null;

export function getDb(): Database | null {
  if (dbInstance) {
    return dbInstance;
  }

  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    return null;
  }

  sqlInstance = postgres(connectionString, { max: 10 });
  dbInstance = drizzle(sqlInstance, { schema });
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (sqlInstance) {
    await sqlInstance.end();
    sqlInstance = null;
    dbInstance = null;
  }
}
