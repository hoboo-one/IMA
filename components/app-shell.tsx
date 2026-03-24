import Link from "next/link";
import { type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  currentPath: string;
  userName: string;
  roleLabel: string;
};

const navItems = [
  { href: "/projects", label: "项目", hint: "Project Library" },
  { href: "/admin/members", label: "成员", hint: "People" }
];

export function AppShell({ children, currentPath, userName, roleLabel }: AppShellProps) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="traffic-lights" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <p className="eyebrow">Internal Studio</p>
            <h1>Product Storyboard</h1>
            <p className="sidebar-copy">多图参考、分镜挑选、视频拼接的一体化工作台。</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn("sidebar-link", currentPath.startsWith(item.href) && "sidebar-link-active")}
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
