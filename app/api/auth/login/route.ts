import { cookies } from "next/headers";
import { createSession, passwordMatches, SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";
import { body, fail, ok } from "@/lib/http";

export async function POST(request: Request) {
  const b = await body(request);
  // kleine Bremse gegen Durchprobieren
  await new Promise((r) => setTimeout(r, 400));
  if (!passwordMatches(String(b.password ?? ""))) return fail(new Error("Das Passwort stimmt nicht"), 401);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSession("lena"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return ok({ ok: true });
}
