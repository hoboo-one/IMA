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
  { href: "/projects", label: "项目工作台" },
  { href: "/admin/members", label: "成员管理" }
];

export function AppShell({ children, currentPath, userName, roleLabel }: AppShellProps) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">Internal Studio</p>
          <h1>Product Storyboard</h1>
          <p className="sidebar-copy">多图输入、分镜筛选、视频拼接的一体化内部工作台。</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn("sidebar-link", currentPath.startsWith(item.href) && "sidebar-link-active")}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div>
            <p className="sidebar-user">{userName}</p>
            <Badge tone={roleLabel === "管理员" ? "success" : "neutral"}>{roleLabel}</Badge>
          </div>
        </div>
      </aside>
      <main className="workspace">{children}</main>
    </div>
  );
}
