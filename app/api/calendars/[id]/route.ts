import { deleteCalendar, updateCalendar } from "@/lib/repo";
import { body, fail, ok } from "@/lib/http";

export async function PATCH(request: Request, ctx: RouteContext<"/api/calendars/[id]">) {
  const { id } = await ctx.params;
  const b = await body(request);
  const cal = await updateCalendar(id, {
    name: typeof b.name === "string" ? b.name : undefined,
    color: typeof b.color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : undefined,
    sortOrder: typeof b.sortOrder === "number" ? b.sortOrder : undefined,
    defaultMinutes: typeof b.defaultMinutes === "number" ? Math.max(5, Math.min(1440, b.defaultMinutes)) : undefined,
    visible: typeof b.visible === "boolean" ? b.visible : undefined,
  });
  return cal ? ok(cal) : fail(new Error("Nicht gefunden"), 404);
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/calendars/[id]">) {
  const { id } = await ctx.params;
  const moveTo = new URL(request.url).searchParams.get("moveTo");
  try {
    await deleteCalendar(id, moveTo);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
