import { connection } from "next/server";
import { runSync, syncStatus } from "@/lib/sync/run";
import { body, fail, ok } from "@/lib/http";

export const maxDuration = 300;

export async function GET() {
  await connection();
  try {
    return ok(await syncStatus());
  } catch (e) {
    return fail(e, 500);
  }
}

export async function POST(request: Request) {
  const b = await body(request);
  try {
    const result = await runSync({
      trigger: "manual",
      full: Boolean(b.full),
      only: typeof b.only === "string" ? b.only : undefined,
    });
    return ok({ ...result, status: await syncStatus() });
  } catch (e) {
    return fail(e, 500);
  }
}
