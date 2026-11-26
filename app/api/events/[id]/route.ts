import { deleteEvent, getEvent, restoreEvent, updateEvent, validateInput } from "@/lib/repo";
import { body, fail, ok } from "@/lib/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/events/[id]">) {
  const { id } = await ctx.params;
  const ev = await getEvent(id);
  return ev ? ok(ev) : fail(new Error("Nicht gefunden"), 404);
}

export async function PUT(request: Request, ctx: RouteContext<"/api/events/[id]">) {
  const { id } = await ctx.params;
  try {
    const ev = await updateEvent(id, validateInput(await body(request)));
    return ev ? ok(ev) : fail(new Error("Nicht gefunden"), 404);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/events/[id]">) {
  const { id } = await ctx.params;
  await deleteEvent(id);
  return ok({ ok: true });
}

/** Wiederherstellen (Rückgängig nach dem Löschen) */
export async function POST(request: Request, ctx: RouteContext<"/api/events/[id]">) {
  const { id } = await ctx.params;
  const b = await body(request);
  if (b.action !== "restore") return fail(new Error("Unbekannte Aktion"));
  const ev = await restoreEvent(id);
  return ev ? ok(ev) : fail(new Error("Nicht gefunden"), 404);
}
