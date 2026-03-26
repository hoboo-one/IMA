import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  createShotBatchAction,
  createVideoVersionFromSelectionAction,
  deleteReferenceAssetAction,
  updateStoryboardShotAction,
  uploadReferenceAssetsAction
} from "@/app/(dashboard)/projects/[projectId]/actions";
import { TaskAutoRefresh } from "@/components/task-auto-refresh";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { StoryboardGeneratorForm } from "@/components/workspace/storyboard-generator-form";
import { VideoRunForm } from "@/components/workspace/video-run-form";
import { getProjectWorkspace } from "@/lib/projects";
import { bytesToLabel, cn, formatDateTime } from "@/lib/utils";
import { videoModelLabels } from "@/shared";

type ProjectWorkspacePageProps = {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ storyboard?: string }>;
};

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

function looksBrokenText(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return /�|锟|鈥|\?{2,}/.test(value);
}

function getReadableLabel(value: string | null | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim();

  if (!normalized || looksBrokenText(normalized)) {
    return fallback;
  }

  return normalized;
}

function getTaskSummary(summary: string | null | undefined, status: string | null | undefined) {
  if (summary && !looksBrokenText(summary)) {
    return summary;
  }

  switch (status) {
    case "FAILED":
      return "最近一次任务失败";
    case "RUNNING":
    case "QUEUED":
      return "任务处理中";
    case "SUCCEEDED":
      return "已准备就绪";
    default:
      return "等待开始";
  }
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

export default async function ProjectWorkspacePage({ params, searchParams }: ProjectWorkspacePageProps) {
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;
  const workspace = await getProjectWorkspace(projectId);

  if (!workspace) {
    notFound();
  }

  const { project, assetUrls, candidateUrls, videoUrls } = workspace;
  const assetUrlById = new Map(assetUrls.map((item) => [item.id, item]));
  const candidateUrlById = new Map(candidateUrls.map((item) => [item.id, item]));
  const videoUrlById = new Map(videoUrls.map((item) => [item.id, item]));

  const productName = getReadableLabel(project.productName, "未命名产品");
  const workspaceTitle = getReadableLabel(project.productName, "创作台");
  const taskSummary = getTaskSummary(project.latestTaskSummary, project.latestTaskStatus);
  const hasReferenceAssets = project.assets.length > 0;
  const hasMaxReferenceAssets = project.assets.length >= 3;
  const hasRunningJobs = project.jobs.length > 0;
  const statusTone = project.latestTaskStatus === "FAILED" ? "danger" : hasRunningJobs ? "warning" : "neutral";

  const latestBatch = project.batches[0];
  const latestBatchFrames =
    latestBatch?.candidates.map((candidate, index) => {
      const media = candidateUrlById.get(candidate.id);
      const label = getReadableLabel(candidate.title, `分镜 ${index + 1}`);

      return {
        id: candidate.id,
        description: null,
        isEditable: false,
        isExpired: !media?.previewUrl && !media?.url,
        openHref: media?.url ?? media?.previewUrl ?? null,
        orderIndex: candidate.sortOrder,
        previewUrl: media?.previewUrl ?? null,
        prompt: candidate.prompt,
        shotId: null,
        targetSeconds: 2,
        title: label
      };
    }) ?? [];

  const latestBatchSelectableFrames = latestBatchFrames.filter((frame) => !frame.isExpired);

  const storyboardEntries = project.storyboards.map((storyboard, storyboardIndex) => {
    const displayName = getReadableLabel(storyboard.name, `分镜版本 ${project.storyboards.length - storyboardIndex}`);
    const frames = storyboard.shots.map((shot, frameIndex) => {
      const media = shot.sourceCandidateId ? candidateUrlById.get(shot.sourceCandidateId) : undefined;

      return {
        id: shot.id,
        description: shot.description,
        isEditable: true,
        isExpired: !media?.previewUrl && !media?.url,
        openHref: media?.url ?? media?.previewUrl ?? null,
        orderIndex: shot.orderIndex,
        previewUrl: media?.previewUrl ?? null,
        prompt: shot.prompt,
        shotId: shot.id,
        targetSeconds: shot.targetSeconds,
        title: getReadableLabel(shot.title, `分镜 ${frameIndex + 1}`)
      };
    });

    const selectableFrames = frames.filter((frame) => !frame.isExpired);

    return {
      coverHref: selectableFrames[0]?.previewUrl ?? selectableFrames[0]?.openHref ?? null,
      displayName,
      frames,
      isExpired: selectableFrames.length === 0,
      selectableFrames,
      storyboard
    };
  });

  const requestedStoryboardId =
    typeof resolvedSearchParams.storyboard === "string" && resolvedSearchParams.storyboard.length > 0
      ? resolvedSearchParams.storyboard
      : null;

  const selectedStoryboardEntry =
    (requestedStoryboardId
      ? storyboardEntries.find((entry) => entry.storyboard.id === requestedStoryboardId)
      : undefined) ?? storyboardEntries[0];

  const useBatchFallback =
    !requestedStoryboardId &&
    (!selectedStoryboardEntry || selectedStoryboardEntry.selectableFrames.length === 0) &&
    latestBatchSelectableFrames.length > 0;

  const currentFrames = useBatchFallback ? latestBatchFrames : selectedStoryboardEntry?.frames ?? [];
  const selectableFrames = useBatchFallback
    ? latestBatchSelectableFrames
    : selectedStoryboardEntry?.selectableFrames ?? [];
  const currentSourceType = useBatchFallback ? "BATCH" : selectedStoryboardEntry ? "STORYBOARD" : null;
  const currentSourceId = useBatchFallback ? latestBatch?.id ?? null : selectedStoryboardEntry?.storyboard.id ?? null;
  const currentStoryboardLabel = useBatchFallback
    ? "最新生成分镜"
    : selectedStoryboardEntry?.displayName ?? "当前分镜";
  const videoSelectionFormId = "video-selection-form";

  const visibleVideos = project.videos
    .map((video) => ({
      media: videoUrlById.get(video.id),
      video
    }))
    .filter((entry) => entry.video.status !== "READY" || entry.media?.previewUrl || entry.media?.downloadHref);

  return (
    <div className="creator-page">
      <TaskAutoRefresh enabled={hasRunningJobs} />

      <section className="creator-hero">
        <div>
          <p className="section-kicker">Creative Workspace</p>
          <h2 className="creator-title">{workspaceTitle}</h2>
          <p className="creator-subtitle">
            {project.notes?.trim()
              ? project.notes.trim()
              : "上传参考图，生成分镜，再从分镜里直接勾选图像生成视频。"}
          </p>
        </div>
        <div className="creator-hero-meta">
          <Badge tone={statusTone}>{taskSummary}</Badge>
          <span className="meta-text">最近更新：{formatDateTime(project.updatedAt)}</span>
        </div>
      </section>

      <div className="creator-grid">
        <aside className="creator-sidebar">
          <section className="creator-panel">
            <div className="creator-section-head">
              <div>
                <p className="section-kicker">Reference</p>
                <h3>参考图</h3>
              </div>
              <span className="meta-text">{project.assets.length}/3 张</span>
            </div>

            {project.assets.length > 0 ? (
              <div className="creator-reference-grid">
                {project.assets.map((asset) => {
                  const media = assetUrlById.get(asset.id);
                  const href = media?.originalUrl ?? media?.previewUrl ?? null;

                  return (
                    <article key={asset.id} className="creator-reference-card">
                      <div className="creator-card-visual">
                        {href ? (
                          <a href={href} target="_blank" rel="noreferrer" className="smart-visual-link">
                            <PreviewImage alt={asset.fileName} src={media?.previewUrl ?? href} />
                          </a>
                        ) : (
                          <div className="creator-card-placeholder">图片预览已过期</div>
                        )}
                        <form action={deleteReferenceAssetAction} className="creator-card-delete">
                          <input type="hidden" name="assetId" value={asset.id} />
                          <SubmitButton type="submit" variant="danger" pendingText="删除中...">
                            删除
                          </SubmitButton>
                        </form>
                      </div>
                      <div className="creator-card-copy">
                        <strong>{asset.fileName}</strong>
                        <span>{bytesToLabel(asset.byteSize)}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="还没有参考图" description="先上传 1 到 3 张参考图，再开始生成分镜。" />
            )}

            {!hasMaxReferenceAssets ? (
              <form action={uploadReferenceAssetsAction} className="stack-form creator-upload-form" encType="multipart/form-data">
                <input type="hidden" name="projectId" value={project.id} />
                <label className="field">
                  <span>继续上传参考图</span>
                  <input name="files" type="file" accept="image/*" multiple required={!hasReferenceAssets} />
                </label>
                <SubmitButton type="submit" pendingText="上传中...">
                  上传参考图
                </SubmitButton>
              </form>
            ) : null}
          </section>

          <section className="creator-panel">
            <div className="creator-section-head">
              <div>
                <p className="section-kicker">Generate</p>
                <h3>生成分镜</h3>
              </div>
            </div>
            {hasReferenceAssets ? (
              <StoryboardGeneratorForm
                action={createShotBatchAction}
                notes={project.notes}
                productName={productName}
                projectId={project.id}
              />
            ) : (
              <EmptyState title="先上传参考图" description="没有参考图时，系统不会开始生成分镜。" />
            )}
          </section>
        </aside>

        <section className="creator-main">
          <section className="creator-panel">
            <div className="creator-section-head">
              <div>
                <p className="section-kicker">Storyboard History</p>
                <h3>历史分镜</h3>
              </div>
              <span className="meta-text">{project.storyboards.length} 个版本</span>
            </div>

            {storyboardEntries.length > 0 ? (
              <div className="creator-history-strip">
                {storyboardEntries.map((entry) => {
                  const isCurrent = !useBatchFallback && selectedStoryboardEntry?.storyboard.id === entry.storyboard.id;

                  return (
                    <Link
                      key={entry.storyboard.id}
                      href={`/projects/${project.id}?storyboard=${entry.storyboard.id}`}
                      className={cn("creator-history-card", isCurrent && "creator-history-card-current")}
                    >
                      <div className="creator-history-cover">
                        {entry.coverHref ? (
                          <PreviewImage alt={entry.displayName} src={entry.coverHref} />
                        ) : (
                          <div className="creator-card-placeholder">预览已过期</div>
                        )}
                      </div>
                      <div className="creator-history-copy">
                        <strong>{entry.displayName}</strong>
                        <span>{entry.frames.length} 张分镜</span>
                        <span>{formatDateTime(entry.storyboard.createdAt)}</span>
                        <Badge tone={entry.isExpired ? "warning" : isCurrent ? "success" : "neutral"}>
                          {entry.isExpired ? "已过期" : isCurrent ? "当前使用" : "可切换"}
                        </Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="还没有历史分镜" description="每次生成分镜后，这里都会自动保留一个版本，方便你以后再切回来做视频。" />
            )}
          </section>

          <section className="creator-panel">
            <div className="creator-section-head">
              <div>
                <p className="section-kicker">Storyboard</p>
                <h3>{currentStoryboardLabel}</h3>
              </div>
              <span className="meta-text">{selectableFrames.length} 张可用于视频</span>
            </div>

            {useBatchFallback ? (
              <div className="smart-inline-note">
                <strong>当前展示的是最新生成结果</strong>
                <span>旧分镜预览已过期，所以这里优先显示你最新一批可用的分镜图。</span>
              </div>
            ) : null}

            {currentFrames.length > 0 ? (
              <div className="creator-frame-grid">
                {currentFrames.map((frame, index) => {
                  const isSelectable = !frame.isExpired && Boolean(currentSourceId);

                  return (
                    <article key={frame.id} className="creator-frame-card">
                      <div className="creator-card-visual">
                        {frame.openHref ? (
                          <a href={frame.openHref} target="_blank" rel="noreferrer" className="smart-visual-link">
                            {frame.previewUrl ? (
                              <PreviewImage alt={frame.title} src={frame.previewUrl} />
                            ) : (
                              <div className="creator-card-placeholder">点击查看原图</div>
                            )}
                          </a>
                        ) : (
                          <div className="creator-card-placeholder">这张分镜已过期，请重新生成</div>
                        )}
                      </div>
                      <div className="creator-card-copy">
                        <div className="creator-frame-topline">
                          <strong>{frame.title || `分镜 ${index + 1}`}</strong>
                          <span>{frame.targetSeconds}s</span>
                        </div>
                        <label className={cn("creator-frame-check", !isSelectable && "creator-frame-check-disabled")}>
                          <input
                            defaultChecked={isSelectable}
                            disabled={!isSelectable}
                            form={videoSelectionFormId}
                            name="frameIds"
                            type="checkbox"
                            value={frame.id}
                          />
                          <span>{isSelectable ? "用于视频" : "已过期，无法用于视频"}</span>
                        </label>
                      </div>

                      {frame.isEditable && frame.shotId ? (
                        <details className="creator-frame-editor">
                          <summary>编辑镜头</summary>
                          <form action={updateStoryboardShotAction} className="stack-form">
                            <input type="hidden" name="shotId" value={frame.shotId} />
                            <div className="creator-edit-grid">
                              <label className="field">
                                <span>标题</span>
                                <input defaultValue={frame.title} name="title" />
                              </label>
                              <label className="field">
                                <span>排序</span>
                                <input defaultValue={frame.orderIndex} min={0} name="orderIndex" type="number" />
                              </label>
                              <label className="field">
                                <span>时长</span>
                                <input defaultValue={frame.targetSeconds} max={15} min={1} name="targetSeconds" type="number" />
                              </label>
                            </div>
                            <label className="field">
                              <span>说明</span>
                              <input defaultValue={frame.description ?? ""} name="description" />
                            </label>
                            <label className="field">
                              <span>提示词</span>
                              <textarea defaultValue={frame.prompt} name="prompt" />
                            </label>
                            <SubmitButton type="submit" variant="ghost" pendingText="保存中...">
                              保存修改
                            </SubmitButton>
                          </form>
                        </details>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : hasRunningJobs ? (
              <EmptyState title="分镜生成中" description="系统正在处理参考图，完成后分镜会直接出现在这里。" />
            ) : (
              <EmptyState
                title={selectedStoryboardEntry ? "这个历史分镜已过期" : "还没有分镜"}
                description={
                  selectedStoryboardEntry
                    ? "这个版本的图像已经过期了。你可以切换别的历史分镜，或者重新生成新的分镜。"
                    : "先上传参考图并生成分镜，生成后这里会直接展示。"
                }
              />
            )}
          </section>

          <div className="creator-actions-grid">
            <section className="creator-panel">
              <div className="creator-section-head">
                <div>
                  <p className="section-kicker">Video</p>
                  <h3>生成视频</h3>
                </div>
              </div>

              {currentSourceId && selectableFrames.length > 0 ? (
                <>
                  <p className="field-hint">直接在上面的分镜卡片里勾选要用于视频的图像，然后从这里开始生成。</p>
                  <VideoRunForm
                    action={createVideoVersionFromSelectionAction}
                    formId={videoSelectionFormId}
                    frameCount={selectableFrames.length}
                    projectId={project.id}
                    sourceId={currentSourceId}
                    sourceType={currentSourceType ?? "STORYBOARD"}
                  />
                </>
              ) : (
                <EmptyState
                  title="当前没有可用于视频的分镜"
                  description="先切换到一个可用的历史分镜，或者重新生成一版新的分镜。"
                />
              )}
            </section>

            <section className="creator-panel">
              <div className="creator-section-head">
                <div>
                  <p className="section-kicker">Video Results</p>
                  <h3>视频结果</h3>
                </div>
                <span className="meta-text">仅显示未过期结果</span>
              </div>

              {visibleVideos.length > 0 ? (
                <div className="creator-video-list">
                  {visibleVideos.map(({ media, video }) => (
                    <article key={video.id} className="creator-video-card">
                      <div className="creator-video-visual">
                        {media?.downloadHref ? (
                          <a href={media.downloadHref} target="_blank" rel="noreferrer" className="smart-visual-link">
                            {media.previewUrl ? (
                              <PreviewImage alt={video.id} className="video-preview" src={media.previewUrl} />
                            ) : (
                              <div className="creator-card-placeholder">点击下载视频</div>
                            )}
                          </a>
                        ) : media?.previewUrl ? (
                          <PreviewImage alt={video.id} className="video-preview" src={media.previewUrl} />
                        ) : (
                          <div className="creator-card-placeholder">视频结果已过期</div>
                        )}
                      </div>
                      <div className="creator-card-copy">
                        <div className="creator-frame-topline">
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
                        <span>{getReadableLabel(video.storyboardVersion.name, "分镜版本")}</span>
                        <span>
                          {video.targetSeconds ?? 0}s · {formatDateTime(video.createdAt)}
                        </span>
                        {media?.downloadHref ? (
                          <a className="button button-primary" href={media.downloadHref} rel="noreferrer" target="_blank">
                            下载视频
                          </a>
                        ) : (
                          <Button type="button" variant="ghost" disabled>
                            已过期
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="还没有可用视频" description="视频生成完成后，未过期的结果会显示在这里。" />
              )}
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
