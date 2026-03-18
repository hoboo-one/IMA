import Link from "next/link";

import { createProjectAction } from "@/app/(dashboard)/projects/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { getProjects } from "@/lib/projects";
import { formatDateTime } from "@/lib/utils";

export default async function ProjectsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const projects = await getProjects(params.q);

  return (
    <div className="page-stack">
      <div className="card-grid">
        <Card>
          <CardHeader>
            <CardTitle>新建项目</CardTitle>
          </CardHeader>
          <CardBody>
            <form action={createProjectAction} className="stack-form">
              <label className="field">
                <span>项目名称</span>
                <input name="name" placeholder="例如：春季保温杯分镜" required />
              </label>
              <label className="field">
                <span>产品名称</span>
                <input name="productName" placeholder="例如：真空保温杯" required />
              </label>
              <label className="field">
                <span>补充说明</span>
                <textarea name="notes" placeholder="补充产品定位、材质、希望强调的卖点" />
              </label>
              <Button type="submit">创建并进入工作台</Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>项目搜索</CardTitle>
          </CardHeader>
          <CardBody>
            <form className="stack-form">
              <label className="field">
                <span>关键词</span>
                <input className="search-input" name="q" defaultValue={params.q ?? ""} placeholder="按项目名或产品名搜索" />
              </label>
              <Button type="submit" variant="ghost">
                更新列表
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>项目列表</CardTitle>
          <span className="meta-text">{projects.length} 个项目</span>
        </CardHeader>
        <CardBody>
          {projects.length === 0 ? (
            <div className="empty-state">还没有项目。先创建一个产品工作台，再上传参考图开始生成。</div>
          ) : (
            <div className="section-list">
              {projects.map((project) => (
                <div key={project.id} className="section-row">
                  <div className="panel-block">
                    <div className="inline-meta">
                      <h3 style={{ margin: 0 }}>{project.name}</h3>
                      <Badge tone={project.latestTaskStatus === "FAILED" ? "danger" : "neutral"}>
                        {project.latestTaskSummary ?? "待开始"}
                      </Badge>
                    </div>
                    <div className="meta-text">
                      产品：{project.productName} · 创建人：{project.createdBy.displayName} · 最近更新：{formatDateTime(project.updatedAt)}
                    </div>
                  </div>
                  <Link href={`/projects/${project.id}`}>
                    <Button>进入工作台</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
