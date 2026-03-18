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

  return (
    <AppShell
      currentPath={currentPath}
      userName={profile.displayName}
      roleLabel={profile.role === "ADMIN" ? "管理员" : "成员"}
    >
      <div className="page-header">
        <div>
          <p className="eyebrow">Shared Team Workspace</p>
          <h2 className="page-title">产品分镜与视频工作台</h2>
          <p className="page-subtitle">
            上传产品参考图，生成候选镜头，整理正式分镜，并按分段任务生成最终成片。
          </p>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost">
            退出登录
          </Button>
        </form>
      </div>
      {children}
    </AppShell>
  );
}
