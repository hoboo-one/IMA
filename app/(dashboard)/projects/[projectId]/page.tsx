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
import { SubmitButton } from "@/components/ui/submit-button";
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
      sizes="(max-width: 1024px) 100vw, 360px"
      src={src}
      unoptimized
      width={1200}
    />
  );
}

function StepBadge({ active, complete, label }: { active?: boolean; complete?: boolean; label: string }) {
  return (
    <div className={`step-pill${complete ? " step-pill-complete" : active ? " step-pill-active" : ""}`}>
      <span />
      {label}
    </div>
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
  const hasReferenceAssets = project.assets.length > 0;
  const hasMaxReferenceAssets = project.assets.length >= 3;
  const hasCandidatePool = project.batches.some((batch) => batch.candidates.length > 0);
  const hasStoryboards = project.storyboards.length > 0;
  const hasVideoVersions = project.videos.length > 0;
  const hasRunningJobs = project.jobs.length > 0;
  const flattenedCandidates = project.batches.flatMap((batch) =>
    batch.candidates.map((candidate) => ({
      batch,
      candidate,
      media: candidateUrls.find((item) => item.id === candidate.id)
    }))
  );

  return (
    <div className="studio-window">
      <TaskAutoRefresh enabled={hasRunningJobs} />

      <div className="window-toolbar">
        <div className="window-toolbar-group">
          <div className="traffic-lights" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <p className="window-caption">Project Workspace</p>
            <h3 className="window-title">{project.name}</h3>
          </div>
        </div>
        <div className="window-toolbar-meta">
          <Badge tone={project.latestTaskStatus === "FAILED" ? "danger" : hasRunningJobs ? "warning" : "neutral"}>
            {project.latestTaskSummary ?? "等待开始"}
          </Badge>
          <span className="meta-text">最近更新：{formatDateTime(project.updatedAt)}</span>
        </div>
      </div>

      <div className="studio-layout">
        <aside className="studio-column studio-column-left">
          <section className="surface-panel">
            <div className="surface-header">
              <div>
                <p className="section-kicker">Overview</p>
                <h4>项目概览</h4>
              </div>
            </div>
            <div className="surface-body stack-12">
              <div className="detail-list">
                <div>
                  <span>产品名称</span>
                  <strong>{project.productName}</strong>
                </div>
                <div>
                  <span>创建人</span>
                  <strong>{project.createdBy.displayName}</strong>
                </div>
                <div>
                  <span>保留策略</span>
                  <strong>文件保存 24 小时</strong>
                </div>
              </div>
              <div className="note-panel">{project.notes || "还没有填写项目备注。这里适合记录产品定位、卖点和镜头语气。"}</div>
            </div>
          </section>

          <section className="surface-panel">
            <div className="surface-header">
              <div>
                <p className="section-kicker">Reference</p>
                <h4>参考图</h4>
              </div>
              <span className="meta-text">{project.assets.length}/3</span>
            </div>
            <div className="surface-body stack-16">
              <form action={uploadReferenceAssetsAction} className="stack-form">
                <input type="hidden" name="projectId" value={project.id} />
                <label className="field">
                  <span>上传产品参考图</span>
                  <input
                    name="files"
                    type="file"
                    accept="image/*"
                    multiple
                    disabled={hasMaxReferenceAssets}
                    required={!hasReferenceAssets}
                  />
                </label>
                <SubmitButton type="submit" pendingText="上传中..." disabled={hasMaxReferenceAssets}>
                  {hasMaxReferenceAssets ? "参考图已满" : "上传参考图"}
                </SubmitButton>
              </form>

              {hasReferenceAssets ? (
                <div className="asset-strip">
                  {project.assets.map((asset) => {
                    const urls = assetUrls.find((item) => item.id === asset.id);
                    return (
                      <article key={asset.id} className="asset-card">
                        {urls?.previewUrl ? <PreviewImage src={urls.previewUrl} alt={asset.fileName} /> : <div className="video-preview" />}
                        <div className="asset-card-copy">
                          <strong>{asset.fileName}</strong>
                          <span>{bytesToLabel(asset.byteSize)}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">先放入正面、背面或细节图，后面的镜头生成会更稳定。</div>
              )}
            </div>
          </section>

          <section className="surface-panel">
            <div className="surface-header">
              <div>
                <p className="section-kicker">Progress</p>
                <h4>流程状态</h4>
              </div>
            </div>
            <div className="surface-body stack-12">
              <StepBadge label="上传参考图" complete={hasReferenceAssets} />
              <StepBadge
                label="生成候选镜头"
                active={hasRunningJobs && !hasCandidatePool}
                complete={hasCandidatePool}
              />
              <StepBadge label="整理正式分镜" complete={hasStoryboards} />
              <StepBadge label="生成视频版本" active={hasRunningJobs && hasStoryboards} complete={hasVideoVersions} />
              {hasRunningJobs ? (
                <div className="note-panel">当前有任务在运行。页面会在空闲状态下每 8 秒自动刷新一次，不会打断你正在输入的内容。</div>
              ) : null}
            </div>
          </section>
        </aside>

        <main className="studio-column studio-column-main">
          <section className="surface-panel">
            <div className="surface-header">
              <div>
                <p className="section-kicker">Shot Generator</p>
                <h4>候选镜头生成</h4>
              </div>
            </div>
            <div className="surface-body">
              <form action={createShotBatchAction} className="stack-form">
                <input type="hidden" name="projectId" value={project.id} />
                <label className="field">
                  <span>生成提示词</span>
                  <textarea
                    name="prompt"
                    disabled={!hasReferenceAssets}
                    placeholder="例如：突出金属材质、轮廓切面、柔和高光和高级电商产品摄影氛围。"
                    required
                  />
                </label>
                <div className="card-grid">
                  <label className="field">
                    <span>候选数量</span>
                    <select name="targetCount" defaultValue="4" disabled={!hasReferenceAssets}>
                      {[2, 4, 6, 8, 10, 12].map((count) => (
                        <option key={count} value={count}>
                          {count} 张
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>图片模型</span>
                    <select name="model" defaultValue="NANO_BANANA_2" disabled={!hasReferenceAssets}>
                      {Object.entries(imageModelLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <SubmitButton type="submit" pendingText="提交中..." disabled={!hasReferenceAssets}>
                  生成候选镜头
                </SubmitButton>
                <div className="form-note">
                  {!hasReferenceAssets ? "先上传至少一张参考图后，才能开始生成。" : "提交后进入异步队列，镜头完成后会自动回到工作台。"}
                </div>
              </form>
            </div>
          </section>

          <section className="surface-panel">
            <div className="surface-header">
              <div>
                <p className="section-kicker">Candidate Pool</p>
                <h4>候选镜头池</h4>
              </div>
            </div>
            <div className="surface-body">
              {project.batches.length === 0 ? (
                <div className="empty-state">候选镜头会在这里以素材带的形式出现，方便你快速挑选和对比。</div>
              ) : (
                <div className="batch-list">
                  {project.batches.map((batch) => (
                    <article key={batch.id} className="batch-panel">
                      <div className="batch-header">
                        <div>
                          <strong>{imageModelLabels[batch.model]}</strong>
                          <span className="meta-text">
                            {batch.targetCount} 张 · {formatDateTime(batch.createdAt)}
                          </span>
                        </div>
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
                      </div>

                      {batch.errorMessage ? <div className="note-panel">{batch.errorMessage}</div> : null}

                      <div className="candidate-strip">
                        {batch.candidates.map((candidate) => {
                          const media = candidateUrls.find((item) => item.id === candidate.id);
                          return (
                            <article key={candidate.id} className="candidate-card">
                              {media?.previewUrl ? <PreviewImage src={media.previewUrl} alt={candidate.title} /> : <div className="video-preview" />}
                              <div className="candidate-card-copy">
                                <strong>{candidate.title}</strong>
                                <span>{candidate.prompt}</span>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="surface-panel">
            <div className="surface-header">
              <div>
                <p className="section-kicker">Storyboard</p>
                <h4>正式分镜</h4>
              </div>
            </div>
            <div className="surface-body stack-20">
              <form action={createStoryboardVersionAction} className="stack-form">
                <input type="hidden" name="projectId" value={project.id} />
                <div className="card-grid">
                  <label className="field">
                    <span>版本名称</span>
                    <input name="name" placeholder="例如：第一版主镜头结构" required disabled={!hasCandidatePool} />
                  </label>
                  <label className="field">
                    <span>版本备注</span>
                    <input name="notes" placeholder="记录这一版的镜头重点和排序策略" disabled={!hasCandidatePool} />
                  </label>
                </div>

                <div className="candidate-picker-grid">
                  {flattenedCandidates.map(({ batch, candidate, media }) => (
                    <label key={candidate.id} className="picker-card">
                      {media?.previewUrl ? <PreviewImage src={media.previewUrl} alt={candidate.title} /> : <div className="video-preview" />}
                      <input type="checkbox" name="candidateIds" value={candidate.id} disabled={!hasCandidatePool} />
                      <div className="picker-card-copy">
                        <strong>{candidate.title}</strong>
                        <span>{imageModelLabels[batch.model]}</span>
                      </div>
                    </label>
                  ))}
                </div>

                <SubmitButton type="submit" pendingText="创建中..." disabled={!hasCandidatePool}>
                  从候选镜头生成正式分镜
                </SubmitButton>
              </form>

              {project.storyboards.length === 0 ? (
                <div className="empty-state">从候选池里勾选需要的镜头，就能整理出正式分镜版本。</div>
              ) : (
                <div className="storyboard-list">
                  {project.storyboards.map((storyboard) => (
                    <article key={storyboard.id} className="storyboard-card">
                      <div className="storyboard-card-header">
                        <div>
                          <strong>{storyboard.name}</strong>
                          <span>{storyboard.notes || "没有备注"}</span>
                        </div>
                        <span className="meta-text">{formatDateTime(storyboard.createdAt)}</span>
                      </div>

                      <div className="storyboard-shot-list">
                        {storyboard.shots.map((shot) => (
                          <form key={shot.id} action={updateStoryboardShotAction} className="shot-editor">
                            <input type="hidden" name="shotId" value={shot.id} />
                            <div className="shot-editor-grid">
                              <label className="field">
                                <span>镜头标题</span>
                                <input name="title" defaultValue={shot.title} />
                              </label>
                              <label className="field">
                                <span>排序</span>
                                <input name="orderIndex" type="number" min={0} defaultValue={shot.orderIndex} />
                              </label>
                              <label className="field">
                                <span>时长</span>
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
                            <SubmitButton type="submit" variant="ghost" pendingText="保存中...">
                              保存镜头设置
                            </SubmitButton>
                          </form>
                        ))}
                      </div>

                      <div className="video-run-panel">
                        <VideoRunForm
                          action={createVideoVersionAction}
                          projectId={project.id}
                          storyboardVersionId={storyboard.id}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>

        <aside className="studio-column studio-column-right">
          <section className="surface-panel">
            <div className="surface-header">
              <div>
                <p className="section-kicker">Inspector</p>
                <h4>状态检查器</h4>
              </div>
            </div>
            <div className="surface-body stack-12">
              <div className="detail-list">
                <div>
                  <span>当前摘要</span>
                  <strong>{project.latestTaskSummary ?? "等待开始"}</strong>
                </div>
                <div>
                  <span>候选批次</span>
                  <strong>{project.batches.length}</strong>
                </div>
                <div>
                  <span>正式分镜</span>
                  <strong>{project.storyboards.length}</strong>
                </div>
                <div>
                  <span>视频版本</span>
                  <strong>{project.videos.length}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="surface-panel">
            <div className="surface-header">
              <div>
                <p className="section-kicker">Video Versions</p>
                <h4>视频版本</h4>
              </div>
            </div>
            <div className="surface-body stack-16">
              {project.videos.length === 0 ? (
                <div className="empty-state">正式分镜确认后，这里会出现视频版本和下载入口。</div>
              ) : (
                project.videos.map((video) => {
                  const media = videoUrls.find((item) => item.id === video.id);
                  return (
                    <article key={video.id} className="video-card">
                      {media?.previewUrl ? (
                        <PreviewImage src={media.previewUrl} alt={video.id} className="video-preview" />
                      ) : (
                        <div className="video-preview" />
                      )}
                      <div className="video-card-copy">
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
                        <span>{video.storyboardVersion.name}</span>
                        <span className="meta-text">
                          {video.targetSeconds ?? 0} 秒 · {formatDateTime(video.createdAt)}
                        </span>
                      </div>
                      {media?.downloadHref ? (
                        <a href={media.downloadHref} target="_blank" rel="noreferrer">
                          <Button type="button">下载最新视频</Button>
                        </a>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="surface-panel">
            <div className="surface-header">
              <div>
                <p className="section-kicker">Timeline</p>
                <h4>操作记录</h4>
              </div>
            </div>
            <div className="surface-body">
              <div className="timeline-list">
                {project.activities.map((activity) => (
                  <div key={activity.id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div>
                      <strong>{activity.summary}</strong>
                      <span className="meta-text">
                        {activity.actor.displayName} · {formatDateTime(activity.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
