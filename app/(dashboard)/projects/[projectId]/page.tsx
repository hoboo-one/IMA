import Image from "next/image";
import { notFound } from "next/navigation";

import {
  createShotBatchAction,
  createVideoVersionAction,
  deleteReferenceAssetAction,
  updateStoryboardShotAction,
  uploadReferenceAssetsAction
} from "@/app/(dashboard)/projects/[projectId]/actions";
import { TaskAutoRefresh } from "@/components/task-auto-refresh";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { StoryboardGeneratorForm } from "@/components/workspace/storyboard-generator-form";
import { VideoRunForm } from "@/components/workspace/video-run-form";
import { getProjectWorkspace } from "@/lib/projects";
import { bytesToLabel, formatDateTime } from "@/lib/utils";
import { videoModelLabels } from "@/shared";

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
      sizes="(max-width: 1024px) 100vw, 560px"
      src={src}
      unoptimized
      width={1200}
    />
  );
}

function getReadableLabel(value: string | null | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim();

  if (!normalized) {
    return fallback;
  }

  if (/[?]{3,}|�/.test(normalized)) {
    return fallback;
  }

  return normalized;
}

function EmptyState({
  description,
  title
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="smart-empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
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
  const assetUrlById = new Map(assetUrls.map((item) => [item.id, item]));
  const candidateUrlById = new Map(candidateUrls.map((item) => [item.id, item]));
  const videoUrlById = new Map(videoUrls.map((item) => [item.id, item]));

  const displayProductName = getReadableLabel(project.productName, "未命名产品");
  const displayProjectName = getReadableLabel(project.name, displayProductName);
  const hasReferenceAssets = project.assets.length > 0;
  const hasMaxReferenceAssets = project.assets.length >= 3;
  const hasRunningJobs = project.jobs.length > 0;
  const statusTone = project.latestTaskStatus === "FAILED" ? "danger" : hasRunningJobs ? "warning" : "neutral";
  const latestStoryboard = project.storyboards[0];
  const storyboardShots =
    latestStoryboard?.shots.map((shot) => ({
      shot,
      media: shot.sourceCandidateId ? candidateUrlById.get(shot.sourceCandidateId) : undefined
    })) ?? [];
  const latestVideo = project.videos[0];
  const latestVideoMedia = latestVideo ? videoUrlById.get(latestVideo.id) : undefined;

  return (
    <div className="smart-workspace">
      <TaskAutoRefresh enabled={hasRunningJobs} />

      <section className="smart-header-card">
        <div>
          <p className="section-kicker">Creative Studio</p>
          <h2 className="smart-title">{displayProjectName}</h2>
          <p className="smart-subtitle">
            {displayProductName} · 上传参考图后直接生成分镜，参考图和分镜图会放在同一个创作面板里。
          </p>
        </div>
        <div className="smart-header-meta">
          <Badge tone={statusTone}>{project.latestTaskSummary ?? "等待开始"}</Badge>
          <span className="meta-text">最近更新：{formatDateTime(project.updatedAt)}</span>
        </div>
      </section>

      <section className="smart-board">
        <div className="smart-board-header">
          <div>
            <p className="section-kicker">Creation Board</p>
            <h3>创作面板</h3>
          </div>
          <div className="smart-board-meta">
            <span>{project.assets.length}/3 张参考图</span>
            <span>{storyboardShots.length} 张分镜图</span>
          </div>
        </div>

        <div className="smart-board-grid">
          <section className="smart-lane">
            <div className="smart-lane-header">
              <div>
                <h4>参考图</h4>
                <p>可以上传、删除和替换，不需要跳到别的模块。</p>
              </div>
            </div>

            <div className="smart-media-grid">
              {project.assets.map((asset) => {
                const media = assetUrlById.get(asset.id);

                return (
                  <article key={asset.id} className="smart-media-card">
                    <div className="smart-media-visual">
                      {media?.previewUrl ? <PreviewImage alt={asset.fileName} src={media.previewUrl} /> : <div className="media-placeholder" />}
                      <form action={deleteReferenceAssetAction} className="smart-media-delete">
                        <input type="hidden" name="assetId" value={asset.id} />
                        <SubmitButton type="submit" variant="danger" pendingText="删除中...">
                          删除
                        </SubmitButton>
                      </form>
                    </div>
                    <div className="smart-media-copy">
                      <strong>{asset.fileName}</strong>
                      <span>{bytesToLabel(asset.byteSize)}</span>
                    </div>
                  </article>
                );
              })}

              {!hasMaxReferenceAssets ? (
                <article className="smart-upload-card">
                  <form action={uploadReferenceAssetsAction} className="stack-form smart-upload-form" encType="multipart/form-data">
                    <input type="hidden" name="projectId" value={project.id} />
                    <label className="field">
                      <span>继续上传参考图</span>
                      <input name="files" type="file" accept="image/*" multiple required={!hasReferenceAssets} />
                    </label>
                    <SubmitButton type="submit" pendingText="上传中...">
                      上传参考图
                    </SubmitButton>
                  </form>
                </article>
              ) : null}
            </div>
          </section>

          <section className="smart-lane">
            <div className="smart-lane-header">
              <div>
                <h4>分镜图</h4>
                <p>系统生成后会直接出现在这里，不再单独塞一个候选镜头步骤。</p>
              </div>
            </div>

            {storyboardShots.length > 0 ? (
              <div className="smart-storyboard-grid">
                {storyboardShots.map(({ shot, media }, index) => (
                  <article key={shot.id} className="smart-shot-card">
                    <div className="smart-shot-visual">
                      {media?.previewUrl ? <PreviewImage alt={shot.title} src={media.previewUrl} /> : <div className="media-placeholder" />}
                    </div>
                    <div className="smart-shot-summary">
                      <strong>{shot.title || `分镜 ${index + 1}`}</strong>
                      <span>{shot.targetSeconds}s</span>
                    </div>
                    <details className="smart-shot-editor">
                      <summary>编辑这张分镜</summary>
                      <form action={updateStoryboardShotAction} className="stack-form">
                        <input type="hidden" name="shotId" value={shot.id} />
                        <div className="smart-shot-fields">
                          <label className="field">
                            <span>标题</span>
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
                          <span>说明</span>
                          <input name="description" defaultValue={shot.description ?? ""} />
                        </label>
                        <label className="field">
                          <span>提示词</span>
                          <textarea name="prompt" defaultValue={shot.prompt} />
                        </label>
                        <SubmitButton type="submit" variant="ghost" pendingText="保存中...">
                          保存修改
                        </SubmitButton>
                      </form>
                    </details>
                  </article>
                ))}
              </div>
            ) : hasRunningJobs ? (
              <EmptyState
                title="分镜生成中"
                description="系统正在根据参考图生成分镜图，完成后会直接出现在这里。"
              />
            ) : (
              <EmptyState
                title="还没有分镜图"
                description="先上传参考图，然后在右侧点击生成分镜图。"
              />
            )}
          </section>
        </div>
      </section>

      <div className="smart-controls-grid">
        <section className="smart-control-card">
          <div className="smart-control-header">
            <div>
              <p className="section-kicker">AI Generate</p>
              <h3>生成分镜图</h3>
            </div>
          </div>
          {hasReferenceAssets ? (
            <StoryboardGeneratorForm
              action={createShotBatchAction}
              notes={project.notes}
              productName={displayProductName}
              projectId={project.id}
            />
          ) : (
            <EmptyState title="先上传参考图" description="没有参考图时，系统不会开始生成分镜。" />
          )}
        </section>

        <section className="smart-control-card">
          <div className="smart-control-header">
            <div>
              <p className="section-kicker">Video Output</p>
              <h3>生成视频</h3>
            </div>
          </div>
          {latestStoryboard ? (
            <div className="stack-form">
              <div className="smart-inline-note">
                <strong>{latestStoryboard.name}</strong>
                <span>{storyboardShots.length} 张分镜图</span>
              </div>
              <VideoRunForm
                action={createVideoVersionAction}
                projectId={project.id}
                storyboardVersionId={latestStoryboard.id}
              />
            </div>
          ) : (
            <EmptyState title="先生成分镜图" description="分镜图出来后，这里才会出现视频生成入口。" />
          )}
        </section>
      </div>

      <section className="smart-video-board">
        <div className="smart-board-header">
          <div>
            <p className="section-kicker">Latest Videos</p>
            <h3>视频结果</h3>
          </div>
        </div>

        {project.videos.length > 0 ? (
          <div className="smart-video-grid">
            {project.videos.map((video) => {
              const media = videoUrlById.get(video.id);

              return (
                <article key={video.id} className="smart-video-card">
                  <div className="smart-video-visual">
                    {media?.previewUrl ? (
                      <PreviewImage alt={video.id} className="video-preview" src={media.previewUrl} />
                    ) : (
                      <div className="media-placeholder video-preview" />
                    )}
                  </div>
                  <div className="smart-video-copy">
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
                    <span>
                      {video.targetSeconds ?? 0}s · {formatDateTime(video.createdAt)}
                    </span>
                    {media?.downloadHref ? (
                      <a className="button button-primary" href={media.downloadHref} target="_blank" rel="noreferrer">
                        下载视频
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState title="还没有视频" description="分镜图确认后，就可以在上方直接发起视频生成。" />
        )}

        {latestVideoMedia?.previewUrl ? (
          <div className="smart-video-highlight">
            <div className="smart-video-highlight-poster">
              <PreviewImage alt={latestVideo?.id ?? "最新视频"} className="video-preview" src={latestVideoMedia.previewUrl} />
            </div>
            <div className="smart-video-highlight-copy">
              <strong>最新视频</strong>
              <span>{latestVideo ? videoModelLabels[latestVideo.model] : "视频"}</span>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
