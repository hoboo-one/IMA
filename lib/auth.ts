import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { clearAppSessionCookie, readAppSessionCookie } from "@/lib/session-cookie";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function getCurrentUser() {
  const storedSession = await readAppSessionCookie();

  if (!storedSession?.accessToken) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.getUser(storedSession.accessToken);
  return error || !data.user ? null : data.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    await clearAppSessionCookie().catch(() => undefined);
    redirect("/login");
  }

  return user;
}

export async function getActiveProfileOrNull() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const profile = await db.userProfile.findUnique({
    where: { id: user.id }
  });

  if (!profile || !profile.isActive) {
    await clearAppSessionCookie().catch(() => undefined);
    return null;
  }

  return {
    user,
    profile
  };
}

export async function requireActiveProfile() {
  const user = await requireUser();
  const profile = await db.userProfile.findUnique({
    where: { id: user.id }
  });

  if (!profile || !profile.isActive) {
    await clearAppSessionCookie().catch(() => undefined);
    redirect("/login?error=inactive");
  }

  return {
    user,
    profile
  };
}

export async function requireAdminProfile() {
  const session = await requireActiveProfile();

  if (session.profile.role !== "ADMIN") {
    redirect("/projects");
  }

  return session;
}
