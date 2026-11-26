import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

/** Verbindung zur eigenen Kalender-Datenbank (Neon, über Vercel Marketplace provisioniert). */
export function db(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL ist nicht gesetzt");
    client = neon(url);
  }
  return client;
}

const external = new Map<string, NeonQueryFunction<false, false>>();

/** Read-only-Zugriff auf eine fremde Datenbank (DigitalMask, Website). */
export function externalDb(url: string): NeonQueryFunction<false, false> {
  let c = external.get(url);
  if (!c) {
    c = neon(url);
    external.set(url, c);
  }
  return c;
}

export function newId(): string {
  return crypto.randomUUID();
}
