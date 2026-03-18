"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createProjectSchema } from "@/shared";
import { logActivity } from "@/lib/activity";
import { requireActiveProfile } from "@/lib/auth";
import { db } from "@/lib/db";

export async function createProjectAction(formData: FormData) {
  const { profile } = await requireActiveProfile();
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    productName: formData.get("productName"),
    notes: formData.get("notes")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join("\n"));
  }

  const project = await db.project.create({
    data: {
      name: parsed.data.name,
      productName: parsed.data.productName,
      notes: parsed.data.notes || null,
      createdById: profile.id,
      latestTaskSummary: "项目已创建"
    }
  });

  await logActivity({
    actorId: profile.id,
    projectId: project.id,
    type: "CREATE_PROJECT",
    summary: `创建项目 ${project.name}`
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}
