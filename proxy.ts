import { NextResponse, type NextRequest } from "next/server";
import { createSession, SESSION_COOKIE, SESSION_COOKIE_OPTIONS, shouldRenew, verifySession } from "./lib/auth";

// Alles außer Login, PWA-Dateien, Abo-Feed und dem privaten Sync-Job erfordert eine Sitzung.
const PUBLIC = [/^\/login/, /^\/api\/auth\//, /^\/api\/ics\//, /^\/api\/cron\//, /^\/manifest\.webmanifest$/, /^\/sw\.js$/, /^\/offline/];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    const res = NextResponse.next();
    if (shouldRenew(session)) res.cookies.set(SESSION_COOKIE, await createSession(session.n), SESSION_COOKIE_OPTIONS);
    return res;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|icons/|favicon|apple-icon|icon|.*\\.(?:png|svg|jpg|ico|webp|txt)$).*)"],
};
