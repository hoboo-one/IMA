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
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join("\n"));
  }

  const supabase = createSupabaseAdminClient();
  const authResult = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    email_confirm: true,
    password: parsed.data.password
  });

  if (authResult.error || !authResult.data.user) {
    throw new Error(authResult.error?.message ?? "创建账号失败");
  }

  await db.userProfile.create({
    data: {
      displayName: parsed.data.displayName,
      email: parsed.data.email,
      id: authResult.data.user.id,
      role: parsed.data.role
    }
  });

  await logActivity({
    actorId: profile.id,
    metadata: {
      role: parsed.data.role
    },
    summary: `创建成员 ${parsed.data.displayName}`,
    type: "CREATE_MEMBER"
  });

  revalidatePath("/admin/members");
}

export async function toggleMemberAction(formData: FormData) {
  const { profile } = await requireAdminProfile();
  const parsed = toggleMemberSchema.safeParse({
    isActive: formData.get("isActive") === "true",
    memberId: formData.get("memberId")
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
    summary: `${parsed.data.isActive ? "启用" : "停用"}成员 ${member.displayName}`,
    type: "TOGGLE_MEMBER"
  });

  revalidatePath("/admin/members");
}
