import "server-only";

export function ok(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { "Cache-Control": "no-store", ...(init?.headers ?? {}) } });
}

export function fail(err: unknown, status = 400) {
  const message = err instanceof Error ? err.message : String(err);
  if (status >= 500) console.error(err);
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}
