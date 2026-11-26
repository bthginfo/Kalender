import { ok } from "@/lib/http";

export async function GET(request: Request) {
  const token = process.env.ICS_TOKEN;
  const origin = new URL(request.url).origin;
  return ok({
    icsUrl: token ? `${origin}/api/ics/${token}` : null,
  });
}
