import { cookies, headers } from "next/headers";
import { createSession, passwordMatches, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/auth";
import { db } from "@/lib/db";
import { body, fail, ok } from "@/lib/http";

const MAX_FAILS = 10;
const WINDOW_MIN = 15;

export async function POST(request: Request) {
  const b = await body(request);
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unbekannt").split(",")[0].trim();
  const sql = db();

  // Schutz gegen Durchprobieren: nach 10 Fehlversuchen 15 Minuten Pause (pro IP)
  const [{ fails }] = (await sql.query(
    `select count(*)::int as fails from login_attempts where ip = $1 and at > now() - make_interval(mins => $2)`,
    [ip, WINDOW_MIN],
  )) as { fails: number }[];
  if (fails >= MAX_FAILS) {
    return fail(new Error(`Zu viele Versuche – bitte in ${WINDOW_MIN} Minuten erneut probieren`), 429);
  }

  await new Promise((r) => setTimeout(r, 400));
  if (!passwordMatches(String(b.password ?? ""))) {
    await sql.query("insert into login_attempts (ip) values ($1)", [ip]);
    if (Math.random() < 0.05) await sql.query("delete from login_attempts where at < now() - interval '1 day'");
    return fail(new Error("Das Passwort stimmt nicht"), 401);
  }

  await sql.query("delete from login_attempts where ip = $1", [ip]);
  (await cookies()).set(SESSION_COOKIE, await createSession("lena"), SESSION_COOKIE_OPTIONS);
  return ok({ ok: true });
}
