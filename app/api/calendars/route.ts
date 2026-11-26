import { connection } from "next/server";
import { createCalendar, listCalendars } from "@/lib/repo";
import { body, fail, ok } from "@/lib/http";

export async function GET() {
  await connection();
  return ok(await listCalendars());
}

export async function POST(request: Request) {
  const b = await body(request);
  const name = String(b.name ?? "").trim();
  if (!name) return fail(new Error("Bitte einen Namen eingeben"));
  return ok(await createCalendar(name, typeof b.color === "string" ? b.color : undefined), { status: 201 });
}
