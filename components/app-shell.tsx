import Link from "next/link";
import { type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  compact?: boolean;
  currentPath: string;
  roleLabel: string;
  userName: string;
};

const navItems = [
  { href: "/projects", label: "项目", hint: "Project Library" },
  { href: "/admin/members", label: "成员", hint: "People" }
];

export function AppShell({ children, compact = false, currentPath, roleLabel, userName }: AppShellProps) {
  return (
    <div className={cn("shell", compact && "shell-compact")}>
      <aside className={cn("sidebar", compact && "sidebar-compact")}>
        <div className="sidebar-brand">
          <div className="traffic-lights" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <p className="eyebrow">Internal Studio</p>
            <h1>Product Storyboard</h1>
            {!compact ? <p className="sidebar-copy">上传参考图、生成分镜、再把分镜做成视频，全部收在一个工作台里。</p> : null}
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "sidebar-link",
                compact && "sidebar-link-compact",
                currentPath.startsWith(item.href) && "sidebar-link-active"
              )}
            >
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-chip">
            <div className="profile-avatar">{userName.slice(0, 1).toUpperCase()}</div>
            <div>
              <p className="sidebar-user">{userName}</p>
              <Badge tone={roleLabel === "管理员" ? "success" : "neutral"}>{roleLabel}</Badge>
            </div>
          </div>
        </div>
      </aside>

      <main className="workspace">{children}</main>
    </div>
  );
}
