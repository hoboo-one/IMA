import { headers } from "next/headers";

import { signOutAction } from "@/app/(dashboard)/actions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { requireActiveProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireActiveProfile();
  const headerList = await headers();
  const currentPath = headerList.get("x-pathname") ?? "/projects";
  const isProjectWorkspace = currentPath.startsWith("/projects/");

  return (
    <AppShell
      compact={isProjectWorkspace}
      currentPath={currentPath}
      roleLabel={profile.role === "ADMIN" ? "管理员" : "成员"}
      userName={profile.displayName}
    >
      {isProjectWorkspace ? null : (
        <div className="page-header">
          <div>
            <p className="eyebrow">Shared Team Workspace</p>
            <h2 className="page-title">产品分镜与视频工作台</h2>
            <p className="page-subtitle">把参考图、分镜版本和视频结果放在同一套团队工作流里，减少来回切换。</p>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="ghost">
              退出登录
            </Button>
          </form>
        </div>
      )}
      {children}
    </AppShell>
  );
}
