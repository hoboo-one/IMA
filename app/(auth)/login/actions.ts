"use server";

import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { clearAppSessionCookie, writeAppSessionCookie } from "@/lib/session-cookie";
import { loginSchema } from "@/shared";

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    redirect("/login?error=invalid");
  }

  const env = getServerEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.session || !data.user) {
    await clearAppSessionCookie();
    redirect("/login?error=auth");
  }

  const profile = await db.userProfile.findUnique({
    where: { id: data.user.id }
  });

  if (!profile || !profile.isActive) {
    await clearAppSessionCookie();
    redirect("/login?error=inactive");
  }

  await writeAppSessionCookie(data.session);

  await db.userProfile.update({
    where: { id: data.user.id },
    data: {
      lastLoginAt: new Date()
    }
  });

  redirect("/projects");
}
