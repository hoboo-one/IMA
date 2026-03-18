import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireActiveProfile() {
  const user = await requireUser();
  const profile = await db.userProfile.findUnique({
    where: { id: user.id }
  });

  if (!profile || !profile.isActive) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
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
