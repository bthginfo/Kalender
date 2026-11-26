// Legt das Datenbankschema an (idempotent).  Aufruf: node scripts/migrate.mjs
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL fehlt (.env.local mit `vercel env pull` holen)");

const pool = new Pool({ connectionString: url });
const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
await pool.query(schema);
const { rows } = await pool.query(
  "select table_name from information_schema.tables where table_schema='public' order by 1",
);
console.log("Tabellen:", rows.map((r) => r.table_name).join(", "));
await pool.end();
