import { createMemberAction, toggleMemberAction } from "@/app/(dashboard)/admin/members/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";

export default async function MembersPage() {
  await requireAdminProfile();
  const members = await db.userProfile.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });

  return (
    <div className="page-stack">
      <Card>
        <CardHeader>
          <CardTitle>新增成员</CardTitle>
        </CardHeader>
        <CardBody>
          <form action={createMemberAction} className="stack-form">
            <div className="card-grid">
              <label className="field">
                <span>邮箱</span>
                <input name="email" required type="email" />
              </label>
              <label className="field">
                <span>显示名称</span>
                <input name="displayName" required />
              </label>
              <label className="field">
                <span>初始密码</span>
                <input minLength={8} name="password" required type="password" />
              </label>
              <label className="field">
                <span>角色</span>
                <select defaultValue="MEMBER" name="role">
                  <option value="ADMIN">管理员</option>
                  <option value="MEMBER">成员</option>
                </select>
              </label>
            </div>
            <Button type="submit">创建成员账号</Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>成员列表</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="section-list">
            {members.map((member) => (
              <div key={member.id} className="section-row">
                <div className="panel-block">
                  <div className="inline-meta">
                    <strong>{member.displayName}</strong>
                    <Badge tone={member.isActive ? "success" : "danger"}>{member.isActive ? "启用中" : "已停用"}</Badge>
                    <Badge tone="neutral">{member.role === "ADMIN" ? "管理员" : "成员"}</Badge>
                  </div>
                  <span className="meta-text">
                    {member.email} · 创建于 {formatDateTime(member.createdAt)} · 最近登录 {formatDateTime(member.lastLoginAt)}
                  </span>
                </div>
                <form action={toggleMemberAction}>
                  <input name="memberId" type="hidden" value={member.id} />
                  <input name="isActive" type="hidden" value={String(!member.isActive)} />
                  <Button type="submit" variant={member.isActive ? "danger" : "ghost"}>
                    {member.isActive ? "停用" : "启用"}
                  </Button>
                </form>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
