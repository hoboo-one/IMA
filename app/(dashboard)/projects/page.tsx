import { redirect } from "next/navigation";

import { requireActiveProfile } from "@/lib/auth";
import { getOrCreateWorkspaceProject } from "@/lib/projects";

export default async function ProjectsPage() {
  const { profile } = await requireActiveProfile();
  const workspaceProject = await getOrCreateWorkspaceProject(profile.id);

  redirect(`/projects/${workspaceProject.id}`);
}
