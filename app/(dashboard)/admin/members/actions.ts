"use server";

import { revalidatePath } from "next/cache";

import { createMemberSchema, toggleMemberSchema } from "@/shared";
import { logActivity } from "@/lib/activity";
import { requireAdminProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function createMemberAction(formData: FormData) {
  const { profile } = await requireAdminProfile();
  const parsed = createMemberSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    password: formData.get("password"),
    role: formData.get("role")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join("\n"));
  }

  const supabase = createSupabaseAdminClient();
  const authResult = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true
  });

  if (authResult.error || !authResult.data.user) {
    throw new Error(authResult.error?.message ?? "创建账号失败");
  }

  await db.userProfile.create({
    data: {
      id: authResult.data.user.id,
      email: parsed.data.email,
      displayName: parsed.data.displayName,
      role: parsed.data.role
    }
  });

  await logActivity({
    actorId: profile.id,
    type: "CREATE_MEMBER",
    summary: `创建成员 ${parsed.data.displayName}`,
    metadata: {
      role: parsed.data.role
    }
  });

  revalidatePath("/admin/members");
}

export async function toggleMemberAction(formData: FormData) {
  const { profile } = await requireAdminProfile();
  const parsed = toggleMemberSchema.safeParse({
    memberId: formData.get("memberId"),
    isActive: formData.get("isActive") === "true"
  });

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join("\n"));
  }

  const member = await db.userProfile.update({
    where: { id: parsed.data.memberId },
    data: { isActive: parsed.data.isActive }
  });

  await logActivity({
    actorId: profile.id,
    type: "TOGGLE_MEMBER",
    summary: `${parsed.data.isActive ? "启用" : "停用"}成员 ${member.displayName}`
  });

  revalidatePath("/admin/members");
}
