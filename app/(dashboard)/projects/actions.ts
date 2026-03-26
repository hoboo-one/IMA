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
    notes: formData.get("notes"),
    productName: formData.get("productName")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join("\n"));
  }

  const project = await db.project.create({
    data: {
      createdById: profile.id,
      latestTaskSummary: "创作台已创建",
      name: parsed.data.name,
      notes: parsed.data.notes || null,
      productName: parsed.data.productName
    }
  });

  await logActivity({
    actorId: profile.id,
    projectId: project.id,
    summary: `创建创作台 ${project.name}`,
    type: "CREATE_PROJECT"
  });

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}
