import { connection } from "next/server";
import { dismissDuplicate, listDuplicates, mergeEvents, splitLink } from "@/lib/repo";
import { body, fail, ok } from "@/lib/http";

export async function GET() {
  await connection();
  return ok(await listDuplicates());
}

export async function POST(request: Request) {
  const b = await body(request);
  try {
    if (b.action === "merge") {
      await mergeEvents(String(b.keepId), String(b.dropId));
      return ok({ ok: true });
    }
    if (b.action === "dismiss") {
      await dismissDuplicate(String(b.aId), String(b.bId));
      return ok({ ok: true });
    }
    if (b.action === "split") {
      return ok(await splitLink(String(b.eventId), String(b.source), String(b.sourceId)));
    }
    return fail(new Error("Unbekannte Aktion"));
  } catch (e) {
    return fail(e);
  }
}
