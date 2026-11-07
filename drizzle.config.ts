import { defineConfig } from "drizzle-kit";

const connectionString = process.env.TIDB_DATABASE_URL ?? process.env.DATABASE_URL;
const tidbHost = process.env.TIDB_HOST;
const tidbUser = process.env.TIDB_USER;
const tidbPassword = process.env.TIDB_PASSWORD;
const tidbDatabase = process.env.TIDB_DATABASE;
if (!connectionString && !(tidbHost && tidbUser && tidbPassword && tidbDatabase)) {
  throw new Error("TiDB connection variables or DATABASE_URL are required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: connectionString
    ? { url: connectionString }
    : {
        host: tidbHost!,
        port: Number(process.env.TIDB_PORT ?? 4000),
        user: tidbUser!,
        password: tidbPassword!,
        database: tidbDatabase!,
        ssl: { rejectUnauthorized: true },
      },
});
