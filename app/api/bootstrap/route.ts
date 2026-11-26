import { connection } from "next/server";
import { countOpenDuplicates, listCalendars, listEvents } from "@/lib/repo";
import { fail, ok } from "@/lib/http";
import type { Bootstrap } from "@/lib/types";

export async function GET() {
  await connection();
  try {
    const [calendars, events, openDuplicates] = await Promise.all([listCalendars(), listEvents(), countOpenDuplicates()]);
    const data: Bootstrap = { calendars, events, openDuplicates, serverTime: new Date().toISOString() };
    return ok(data);
  } catch (e) {
    return fail(e, 500);
  }
}
