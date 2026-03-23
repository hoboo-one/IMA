import type { Session } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getServerEnv } from "@/lib/env";

const APP_SESSION_COOKIE = "ima-app-session";

type StoredSession = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
};

function isStoredSession(value: unknown): value is StoredSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredSession>;
  return (
    typeof candidate.accessToken === "string" &&
    ("refreshToken" in candidate ? typeof candidate.refreshToken === "string" || candidate.refreshToken === null : true) &&
    ("expiresAt" in candidate ? typeof candidate.expiresAt === "number" || candidate.expiresAt === null : true)
  );
}

function getCookieOptions(expiresAt?: number | null) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(expiresAt ? { expires: new Date(expiresAt * 1000) } : {})
  };
}

function getLegacySupabaseCookiePrefix() {
  const env = getServerEnv();
  const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

function encodeSession(value: StoredSession) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeSession(rawValue: string) {
  try {
    const decoded = Buffer.from(rawValue, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    return isStoredSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function clearLegacySupabaseCookies() {
  const cookieStore = await cookies();
  const prefix = getLegacySupabaseCookiePrefix();

  for (const cookie of cookieStore.getAll()) {
    if (!cookie.name.startsWith(prefix)) {
      continue;
    }

    cookieStore.set(cookie.name, "", {
      ...getCookieOptions(),
      maxAge: 0
    });
  }
}

export async function readAppSessionCookie() {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(APP_SESSION_COOKIE)?.value;
  return rawValue ? decodeSession(rawValue) : null;
}

export async function writeAppSessionCookie(session: Pick<Session, "access_token" | "refresh_token" | "expires_at">) {
  const cookieStore = await cookies();
  cookieStore.set(
    APP_SESSION_COOKIE,
    encodeSession({
      accessToken: session.access_token,
      refreshToken: session.refresh_token ?? null,
      expiresAt: session.expires_at ?? null
    }),
    getCookieOptions(session.expires_at ?? null)
  );

  await clearLegacySupabaseCookies();
}

export async function clearAppSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(APP_SESSION_COOKIE, "", {
    ...getCookieOptions(),
    maxAge: 0
  });

  await clearLegacySupabaseCookies();
}
