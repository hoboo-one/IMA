import Image from "next/image";
import { notFound } from "next/navigation";

import {
  createShotBatchAction,
  createStoryboardVersionAction,
  createVideoVersionAction,
  updateStoryboardShotAction,
  uploadReferenceAssetsAction
} from "@/app/(dashboard)/projects/[projectId]/actions";
import { TaskAutoRefresh } from "@/components/task-auto-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoRunForm } from "@/components/workspace/video-run-form";
import { getProjectWorkspace } from "@/lib/projects";
import { bytesToLabel, formatDateTime } from "@/lib/utils";
import { imageModelLabels, videoModelLabels } from "@/shared";

function PreviewImage({
  alt,
  className,
  src
}: {
  alt: string;
  className?: string;
  src: string;
}) {
  return (
    <Image
      alt={alt}
      className={className}
      height={900}
      sizes="(max-width: 1024px) 100vw, 420px"
      src={src}
      unoptimized
      width={1200}
    />
  );
}

export default async function ProjectWorkspacePage({
  params
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const workspace = await getProjectWorkspace(projectId);

  if (!workspace) {
    notFound();
  }

  const { project, assetUrls, candidateUrls, videoUrls } = workspace;

  return (
    <div className="page-stack">
      <TaskAutoRefresh enabled={project.jobs.length > 0} />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{project.name}</CardTitle>
            <p className="meta-text">产品：{project.productName}</p>
          </div>
          <div className="inline-meta">
            <Badge tone={project.latestTaskStatus === "FAILED" ? "danger" : "neutral"}>
              {project.latestTaskSummary ?? "等待开始"}
            </Badge>
            <span className="meta-text">最近更新：{formatDateTime(project.updatedAt)}</span>
          </div>
        </CardHeader>
      </Card>

      <div className="workspace-grid">
        <div className="page-stack">
          <Card>
            <CardHeader>
              <CardTitle>参考图输入</CardTitle>
              <span className="meta-text">最多 3 张，单张 20MB</span>
            </CardHeader>
            <CardBody className="panel-block">
              <form action={uploadReferenceAssetsAction} className="stack-form" encType="multipart/form-data">
                <input type="hidden" name="projectId" value={project.id} />
                <label className="field">
                  <span>上传产品参考图</span>
                  <input name="files" type="file" accept="image/*" multiple />
                </label>
                <Button type="submit">上传参考图</Button>
                {project.assets.length === 0 ? (
                  <div className="meta-text">请先上传至少一张参考图，再开始生成候选镜头。</div>
                ) : null}
              </form>

              {project.assets.length === 0 ? (
                <div className="empty-state">先上传产品正面、背面或侧面图，后续模型会基于这些轮廓生成镜头。</div>
              ) : (
                <div className="gallery-grid">
                  {project.assets.map((asset) => {
                    const urls = assetUrls.find((item) => item.id === asset.id);
                    return (
                      <div key={asset.id} className="gallery-card">
                        {urls?.previewUrl ? <PreviewImage src={urls.previewUrl} alt={asset.fileName} /> : <div className="video-preview" />}
                        <strong>{asset.fileName}</strong>
                        <span className="meta-text">
                          {asset.mimeType} · {bytesToLabel(asset.byteSize)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>候选镜头生成</CardTitle>
            </CardHeader>
            <CardBody className="panel-block">
              <form action={createShotBatchAction} className="stack-form">
                <input type="hidden" name="projectId" value={project.id} />
                <label className="field">
                  <span>生成提示词</span>
                  <textarea
                    name="prompt"
                    placeholder="例如：强调金属杯身反光、干净桌面场景、从材质细节到整体轮廓的产品分镜候选"
                    required
                  />
                </label>
                <div className="card-grid">
                  <label className="field">
                    <span>候选数量</span>
                    <select name="targetCount" defaultValue="4">
                      {[2, 4, 6, 8, 10, 12].map((count) => (
                        <option key={count} value={count}>
                          {count} 张
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>图片模型</span>
                    <select name="model" defaultValue="NANO_BANANA_2">
                      {Object.entries(imageModelLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <Button type="submit">生成候选镜头</Button>
                {project.assets.length === 0 ? (
                  <div className="meta-text">请先上传至少一张参考图，再开始生成候选镜头。</div>
                ) : null}
              </form>

              <div className="section-list">
                {project.batches.length === 0 ? (
                  <div className="empty-state">还没有候选镜头批次。输入本轮目标和风格后即可开始生成。</div>
                ) : (
                  project.batches.map((batch) => (
                    <div key={batch.id} className="panel-block">
                      <div className="inline-meta">
                        <strong>{imageModelLabels[batch.model]}</strong>
                        <Badge
                          tone={
                            batch.status === "FAILED"
                              ? "danger"
                              : batch.status === "READY"
                                ? "success"
                                : "warning"
                          }
                        >
                          {batch.status}
                        </Badge>
                        <span className="meta-text">
                          目标 {batch.targetCount} 张 · {formatDateTime(batch.createdAt)}
                        </span>
                      </div>
                      <div className="gallery-grid">
                        {batch.candidates.map((candidate) => {
                          const urls = candidateUrls.find((item) => item.id === candidate.id);
                          return (
                            <div key={candidate.id} className="gallery-card">
                              {urls?.previewUrl ? <PreviewImage src={urls.previewUrl} alt={candidate.title} /> : <div className="video-preview" />}
                              <strong>{candidate.title}</strong>
                              <span className="meta-text">{candidate.prompt}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="page-stack">
          <Card>
            <CardHeader>
              <CardTitle>正式分镜版本</CardTitle>
            </CardHeader>
            <CardBody className="panel-block">
              <form action={createStoryboardVersionAction} className="stack-form">
                <input type="hidden" name="projectId" value={project.id} />
                <label className="field">
                  <span>版本名称</span>
                  <input name="name" placeholder="例如：第一版主镜头结构" required />
                </label>
                <label className="field">
                  <span>版本备注</span>
                  <textarea name="notes" placeholder="记录这版分镜强调的卖点、场景或镜头逻辑" />
                </label>
                <div className="checkbox-grid">
                  {project.batches.flatMap((batch) =>
                    batch.candidates.map((candidate) => {
                      const urls = candidateUrls.find((item) => item.id === candidate.id);
                      return (
                        <div key={candidate.id} className="checkbox-card">
                          {urls?.previewUrl ? <PreviewImage src={urls.previewUrl} alt={candidate.title} /> : <div className="video-preview" />}
                          <label>
                            <input type="checkbox" name="candidateIds" value={candidate.id} />
                            <span>
                              <strong>{candidate.title}</strong>
                              <br />
                              <span className="meta-text">{candidate.prompt}</span>
                            </span>
                          </label>
                        </div>
                      );
                    })
                  )}
                </div>
                <Button type="submit">从候选中创建正式分镜</Button>
              </form>

              {project.storyboards.length === 0 ? (
                <div className="empty-state">候选图生成后，你可以勾选并创建正式分镜版本。</div>
              ) : (
                project.storyboards.map((storyboard) => (
                  <Card key={storyboard.id}>
                    <CardHeader>
                      <div>
                        <CardTitle>{storyboard.name}</CardTitle>
                        <p className="meta-text">{storyboard.notes ?? "无备注"}</p>
                      </div>
                      <span className="meta-text">{formatDateTime(storyboard.createdAt)}</span>
                    </CardHeader>
                    <CardBody className="panel-block">
                      {storyboard.shots.map((shot) => (
                        <form key={shot.id} action={updateStoryboardShotAction} className="stack-form">
                          <input type="hidden" name="shotId" value={shot.id} />
                          <div className="card-grid">
                            <label className="field">
                              <span>镜头标题</span>
                              <input name="title" defaultValue={shot.title} />
                            </label>
                            <label className="field">
                              <span>排序</span>
                              <input name="orderIndex" type="number" min={0} defaultValue={shot.orderIndex} />
                            </label>
                            <label className="field">
                              <span>目标时长（秒）</span>
                              <input name="targetSeconds" type="number" min={1} max={15} defaultValue={shot.targetSeconds} />
                            </label>
                          </div>
                          <label className="field">
                            <span>镜头说明</span>
                            <input name="description" defaultValue={shot.description ?? ""} />
                          </label>
                          <label className="field">
                            <span>单镜头提示词</span>
                            <textarea name="prompt" defaultValue={shot.prompt} />
                          </label>
                          <Button type="submit" variant="ghost">
                            保存镜头设置
                          </Button>
                        </form>
                      ))}
                      <VideoRunForm
                        action={createVideoVersionAction}
                        projectId={project.id}
                        storyboardVersionId={storyboard.id}
                      />
                    </CardBody>
                  </Card>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>视频版本与任务日志</CardTitle>
            </CardHeader>
            <CardBody className="panel-block">
              {project.videos.length === 0 ? (
                <div className="empty-state">正式分镜确认后，这里会显示视频版本、片段状态和下载入口。</div>
              ) : (
                project.videos.map((video) => {
                  const urls = videoUrls.find((item) => item.id === video.id);
                  return (
                    <div key={video.id} className="gallery-card">
                      {urls?.previewUrl ? (
                        <PreviewImage src={urls.previewUrl} alt={video.id} className="video-preview" />
                      ) : (
                        <div className="video-preview" />
                      )}
                      <div className="inline-meta">
                        <strong>{videoModelLabels[video.model]}</strong>
                        <Badge
                          tone={
                            video.status === "FAILED"
                              ? "danger"
                              : video.status === "READY"
                                ? "success"
                                : "warning"
                          }
                        >
                          {video.status}
                        </Badge>
                      </div>
                      <div className="meta-text">
                        正式分镜：{video.storyboardVersion.name} · 创建人：{video.createdBy.displayName}
                      </div>
                      <div className="meta-text">
                        目标总时长：{video.targetSeconds ?? 0} 秒 · 生成时间：{formatDateTime(video.createdAt)}
                      </div>
                      {urls?.url ? (
                        <a href={urls.url} target="_blank" rel="noreferrer">
                          <Button type="button">查看或下载视频</Button>
                        </a>
                      ) : null}
                    </div>
                  );
                })
              )}

              <div className="section-list">
                {project.activities.map((activity) => (
                  <div key={activity.id} className="section-row">
                    <div className="panel-block">
                      <strong>{activity.summary}</strong>
                      <span className="meta-text">
                        {activity.actor.displayName} · {formatDateTime(activity.createdAt)}
                      </span>
                    </div>
                    <Badge tone="neutral">{activity.type}</Badge>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
