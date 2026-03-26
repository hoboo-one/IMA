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
            <h2 className="page-title">成员管理</h2>
            <p className="page-subtitle">这里仅保留团队成员管理。创作相关操作都在创作台里完成。</p>
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
