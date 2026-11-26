// Schlanke Sitzungs-Cookies mit HMAC-Signatur (Web Crypto – läuft im Proxy und in Route Handlern).

export const SESSION_COOKIE = "mk_session";
export const SESSION_DAYS = 400; // Maximum, das Browser für Cookies erlauben

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

async function key(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("SESSION_SECRET fehlt");
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSession(name: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ n: name, exp: Date.now() + SESSION_DAYS * 86400000 })));
  const sig = await crypto.subtle.sign("HMAC", await key(), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 86400,
};

/** Sitzung verlängern, wenn sie älter als einen Tag ist → wer die App nutzt, bleibt dauerhaft angemeldet */
export function shouldRenew(session: { exp: number }): boolean {
  return session.exp - Date.now() < (SESSION_DAYS - 1) * 86400000;
}

export async function verifySession(token: string | undefined | null): Promise<{ n: string; exp: number } | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    const expected = b64url(await crypto.subtle.sign("HMAC", await key(), enc.encode(payload)));
    if (expected.length !== sig.length) return null;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    if (diff !== 0) return null;
    const data = JSON.parse(b64urlDecode(payload)) as { n: string; exp: number };
    if (!data.exp || data.exp < Date.now()) return null;
    return { n: data.n, exp: data.exp };
  } catch {
    return null;
  }
}

/** Passwortvergleich in konstanter Zeit */
export function passwordMatches(input: string): boolean {
  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected) return false;
  const a = enc.encode(input.trim());
  const b = enc.encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}
