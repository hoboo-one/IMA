import Image from "next/image";
import { notFound } from "next/navigation";

import {
  createShotBatchAction,
  createVideoVersionAction,
  updateStoryboardShotAction,
  uploadReferenceAssetsAction
} from "@/app/(dashboard)/projects/[projectId]/actions";
import { TaskAutoRefresh } from "@/components/task-auto-refresh";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { StoryboardGeneratorForm } from "@/components/workspace/storyboard-generator-form";
import { StudioStageShell, type StudioStageId } from "@/components/workspace/studio-stage-shell";
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
      sizes="(max-width: 1024px) 100vw, 720px"
      src={src}
      unoptimized
      width={1200}
    />
  );
}

function FlowCheckpoint({
  active,
  complete,
  label
}: {
  active?: boolean;
  complete?: boolean;
  label: string;
}) {
  return (
    <div className={`flow-checkpoint${complete ? " flow-checkpoint-complete" : active ? " flow-checkpoint-active" : ""}`}>
      <span className="flow-checkpoint-dot" />
      <span>{label}</span>
    </div>
  );
}

function EmptyPreview({ title, text }: { title: string; text: string }) {
  return (
    <div className="stage-empty">
      <div className="stage-empty-badge">{title}</div>
      <p>{text}</p>
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

  const hasReferenceAssets = project.assets.length > 0;
  const hasMaxReferenceAssets = project.assets.length >= 3;
  const hasStoryboards = project.storyboards.length > 0;
  const hasVideoVersions = project.videos.length > 0;
  const hasRunningJobs = project.jobs.length > 0;
  const latestStoryboard = project.storyboards[0];
  const latestVideo = project.videos[0];
  const latestVideoMedia = latestVideo ? videoUrlById.get(latestVideo.id) : undefined;
  const generatedFrameUrls =
    latestStoryboard?.shots
      .map((shot) => (shot.sourceCandidateId ? candidateUrlById.get(shot.sourceCandidateId)?.previewUrl : undefined))
      .filter((url): url is string => Boolean(url)) ?? [];

  const initialStage: StudioStageId = !hasReferenceAssets ? "reference" : !hasStoryboards ? "storyboard" : "video";
  const statusTone = project.latestTaskStatus === "FAILED" ? "danger" : hasRunningJobs ? "warning" : "neutral";

  const leftRail = (
    <>
      <section className="studio-side-card">
        <p className="section-kicker">Project</p>
        <h3 className="studio-side-title">{project.name}</h3>
        <p className="studio-side-copy">{project.productName}</p>

        <div className="studio-stat-grid">
          <div className="studio-stat">
            <span>参考图</span>
            <strong>{project.assets.length}/3</strong>
          </div>
          <div className="studio-stat">
            <span>分镜版本</span>
            <strong>{project.storyboards.length}</strong>
          </div>
          <div className="studio-stat">
            <span>视频版本</span>
            <strong>{project.videos.length}</strong>
          </div>
          <div className="studio-stat">
            <span>最近更新</span>
            <strong>{formatDateTime(project.updatedAt).slice(5)}</strong>
          </div>
        </div>

        <div className="studio-note">
          {project.notes || "先上传产品参考图，再让系统自动起提示词并生成一组可编辑分镜。"}
        </div>
      </section>

      <section className="studio-side-card">
        <p className="section-kicker">Workflow</p>
        <div className="flow-checkpoint-list">
          <FlowCheckpoint label="上传参考图" complete={hasReferenceAssets} />
          <FlowCheckpoint label="生成分镜图" active={hasRunningJobs && !hasStoryboards} complete={hasStoryboards} />
          <FlowCheckpoint label="生成视频版本" active={hasRunningJobs && hasStoryboards} complete={hasVideoVersions} />
        </div>
      </section>

      <section className="studio-side-card">
        <div className="inline-meta">
          <p className="section-kicker">Reference</p>
          <span className="meta-text">{project.assets.length}/3</span>
        </div>
        {hasReferenceAssets ? (
          <div className="mini-media-grid">
            {project.assets.map((asset) => {
              const media = assetUrlById.get(asset.id);

              return media?.previewUrl ? (
                <div key={asset.id} className="mini-media-card">
                  <PreviewImage alt={asset.fileName} src={media.previewUrl} />
                </div>
              ) : null;
            })}
          </div>
        ) : (
          <div className="compact-empty">还没有参考图。</div>
        )}
      </section>
    </>
  );

  const inspectorFooter = (
    <section className="studio-side-card">
      <div className="inline-meta">
        <p className="section-kicker">Activity</p>
        <span className="meta-text">{project.activities.length}</span>
      </div>
      <div className="activity-feed">
        {project.activities.slice(0, 6).map((activity) => (
          <div key={activity.id} className="activity-item">
            <span className="activity-dot" />
            <div>
              <strong>{activity.summary}</strong>
              <span>
                {activity.actor.displayName} · {formatDateTime(activity.createdAt)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const referencePreview = hasReferenceAssets ? (
    <div className="preview-collage">
      {project.assets.map((asset) => {
        const media = assetUrlById.get(asset.id);

        return media?.previewUrl ? (
          <div key={asset.id} className="preview-collage-card">
            <PreviewImage alt={asset.fileName} src={media.previewUrl} />
          </div>
        ) : null;
      })}
    </div>
  ) : (
    <EmptyPreview
      title="等待参考图"
      text="上传 1 到 3 张产品图后，这里会变成你的主预览区，后面的分镜和视频都会围绕这些图生成。"
    />
  );

  const storyboardPreview = generatedFrameUrls.length > 0 ? (
    <div className="preview-filmstrip">
      {generatedFrameUrls.slice(0, 4).map((url, index) => (
        <article key={url} className="preview-film-frame">
          <PreviewImage alt={`分镜 ${index + 1}`} src={url} />
          <div className="preview-film-copy">
            <strong>分镜 {index + 1}</strong>
            <span>{latestStoryboard?.shots[index]?.targetSeconds ?? 2}s</span>
          </div>
        </article>
      ))}
    </div>
  ) : hasRunningJobs ? (
    <EmptyPreview
      title="分镜生成中"
      text="系统正在根据参考图和提示词生成一组分镜图。完成后这里会直接展示最新一版分镜，不再额外让你处理候选镜头。"
    />
  ) : (
    <EmptyPreview
      title="等待分镜"
      text="上传参考图后，在右侧一键生成提示词并选模型，就能直接得到一组可编辑分镜。"
    />
  );

  const videoPreview = latestVideoMedia?.previewUrl ? (
    <div className="preview-video">
      <div className="preview-video-poster">
        <PreviewImage alt={latestVideo?.id ?? "最新视频"} className="video-preview" src={latestVideoMedia.previewUrl} />
      </div>
      <div className="preview-video-copy">
        <Badge
          tone={
            latestVideo?.status === "FAILED"
              ? "danger"
              : latestVideo?.status === "READY"
                ? "success"
                : "warning"
          }
        >
          {latestVideo?.status ?? "QUEUED"}
        </Badge>
        <h3>{latestVideo ? videoModelLabels[latestVideo.model] : "最新视频"}</h3>
        <p>
          {latestVideo?.storyboardVersion.name || "视频版本"} · {latestVideo?.targetSeconds ?? 0}s ·{" "}
          {latestVideo ? formatDateTime(latestVideo.createdAt) : ""}
        </p>
        {latestVideoMedia.downloadHref ? (
          <a className="button button-primary" href={latestVideoMedia.downloadHref} target="_blank" rel="noreferrer">
            下载最新视频
          </a>
        ) : null}
      </div>
    </div>
  ) : (
    <EmptyPreview
      title="等待视频版本"
      text="生成出满意的分镜后，在右侧选择视频模型即可生成最终视频。"
    />
  );

  const referenceBody = (
    <section className="stage-surface">
      <div className="stage-surface-header">
        <div>
          <p className="section-kicker">Reference Gallery</p>
          <h3>参考图素材</h3>
        </div>
      </div>
      {hasReferenceAssets ? (
        <div className="reference-gallery">
          {project.assets.map((asset) => {
            const media = assetUrlById.get(asset.id);

            return (
              <article key={asset.id} className="media-card">
                {media?.previewUrl ? <PreviewImage alt={asset.fileName} src={media.previewUrl} /> : <div className="media-placeholder" />}
                <div className="media-card-copy">
                  <strong>{asset.fileName}</strong>
                  <span>{bytesToLabel(asset.byteSize)}</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="stage-inline-empty">先上传产品参考图，后面的分镜生成才会稳定。</div>
      )}
    </section>
  );

  const referenceInspector = (
    <div className="inspector-stack">
      <section className="inspector-card">
        <div className="inspector-card-header">
          <div>
            <p className="section-kicker">Upload</p>
            <h3>上传参考图</h3>
          </div>
          <span className="meta-text">{project.assets.length}/3</span>
        </div>
        <form action={uploadReferenceAssetsAction} className="stack-form" encType="multipart/form-data">
          <input type="hidden" name="projectId" value={project.id} />
          <label className="field">
            <span>图片文件</span>
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
      </section>

      <section className="inspector-card">
        <div className="inspector-card-header">
          <div>
            <p className="section-kicker">Guide</p>
            <h3>推荐做法</h3>
          </div>
        </div>
        <ul className="hint-list">
          <li>优先传正面、背面和一张细节图。</li>
          <li>背景越干净，后续分镜越稳定。</li>
          <li>单张图片建议控制在 20MB 以内。</li>
        </ul>
      </section>
    </div>
  );

  const storyboardBody = hasStoryboards ? (
    <div className="storyboard-version-list">
      {project.storyboards.map((storyboard) => (
        <section key={storyboard.id} className="stage-surface">
          <div className="stage-surface-header">
            <div>
              <p className="section-kicker">Storyboard Version</p>
              <h3>{storyboard.name}</h3>
            </div>
            <span className="meta-text">{formatDateTime(storyboard.createdAt)}</span>
          </div>

          {storyboard.notes ? <div className="stage-inline-empty">{storyboard.notes}</div> : null}

          <div className="storyboard-shot-grid">
            {storyboard.shots.map((shot) => {
              const media = shot.sourceCandidateId ? candidateUrlById.get(shot.sourceCandidateId) : undefined;

              return (
                <article key={shot.id} className="storyboard-shot-card">
                  {media?.previewUrl ? <PreviewImage alt={shot.title} src={media.previewUrl} /> : <div className="media-placeholder" />}
                  <form action={updateStoryboardShotAction} className="shot-editor-panel">
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
                      <span>镜头提示词</span>
                      <textarea name="prompt" defaultValue={shot.prompt} />
                    </label>
                    <SubmitButton type="submit" variant="ghost" pendingText="保存中...">
                      保存镜头设置
                    </SubmitButton>
                  </form>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  ) : (
    <section className="stage-surface">
      <div className="stage-inline-empty">还没有生成分镜图。右侧完成提示词和模型选择后，系统会自动生成一整版可编辑分镜。</div>
    </section>
  );

  const storyboardInspector = (
    <div className="inspector-stack">
      <section className="inspector-card">
        <div className="inspector-card-header">
          <div>
            <p className="section-kicker">Generate Storyboard</p>
            <h3>直接生成分镜图</h3>
          </div>
        </div>
        <StoryboardGeneratorForm
          action={createShotBatchAction}
          notes={project.notes}
          productName={project.productName}
          projectId={project.id}
        />
      </section>

      <section className="inspector-card">
        <div className="inspector-card-header">
          <div>
            <p className="section-kicker">Current Status</p>
            <h3>运行状态</h3>
          </div>
        </div>
        <div className="detail-list">
          <div>
            <span>当前摘要</span>
            <strong>{project.latestTaskSummary ?? "等待开始"}</strong>
          </div>
          <div>
            <span>最近分镜版本</span>
            <strong>{latestStoryboard?.name ?? "还没有"}</strong>
          </div>
        </div>
      </section>
    </div>
  );

  const videoBody = (
    <section className="stage-surface">
      <div className="stage-surface-header">
        <div>
          <p className="section-kicker">Video Versions</p>
          <h3>视频版本</h3>
        </div>
      </div>
      {project.videos.length > 0 ? (
        <div className="video-gallery">
          {project.videos.map((video) => {
            const media = videoUrlById.get(video.id);

            return (
              <article key={video.id} className="video-version-card">
                {media?.previewUrl ? (
                  <PreviewImage alt={video.id} className="video-preview" src={media.previewUrl} />
                ) : (
                  <div className="media-placeholder video-preview" />
                )}
                <div className="video-version-copy">
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
                </div>
                {media?.downloadHref ? (
                  <a className="button button-primary" href={media.downloadHref} target="_blank" rel="noreferrer">
                    下载视频
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="stage-inline-empty">生成出满意的分镜后，在右侧选择视频模型即可输出视频。</div>
      )}
    </section>
  );

  const videoInspector = (
    <div className="inspector-stack">
      <section className="inspector-card">
        <div className="inspector-card-header">
          <div>
            <p className="section-kicker">Generate Video</p>
            <h3>生成视频</h3>
          </div>
        </div>
        {project.storyboards.length > 0 ? (
          <div className="video-launch-list">
            {project.storyboards.map((storyboard) => (
              <article key={storyboard.id} className="launch-card">
                <div className="launch-card-copy">
                  <strong>{storyboard.name}</strong>
                  <span>{storyboard.shots.length} 个镜头</span>
                </div>
                <VideoRunForm
                  action={createVideoVersionAction}
                  projectId={project.id}
                  storyboardVersionId={storyboard.id}
                />
              </article>
            ))}
          </div>
        ) : (
          <div className="stage-inline-empty">先生成一版分镜，这里才会出现视频生成入口。</div>
        )}
      </section>

      <section className="inspector-card">
        <div className="inspector-card-header">
          <div>
            <p className="section-kicker">Model Notes</p>
            <h3>模型说明</h3>
          </div>
        </div>
        <ul className="hint-list">
          <li>Veo 3.1 仍然是默认主模型。</li>
          <li>Sora 2 保留为可切换测试项。</li>
          <li>下载时会实时生成新链接，不会再因为链接过期失败。</li>
        </ul>
      </section>
    </div>
  );

  return (
    <div className="studio-window studio-window-flat">
      <TaskAutoRefresh enabled={hasRunningJobs} />

      <StudioStageShell
        title={project.name}
        subtitle={`${project.productName} · 上传参考图后直接生成分镜，不再让你处理额外的候选镜头步骤。`}
        status={
          <div className="generator-status-stack">
            <Badge tone={statusTone}>{project.latestTaskSummary ?? "等待开始"}</Badge>
            <span className="meta-text">最近更新：{formatDateTime(project.updatedAt)}</span>
          </div>
        }
        rail={leftRail}
        footer={inspectorFooter}
        initialStage={initialStage}
        storageKey={`project-stage:${project.id}`}
        stages={[
          {
            id: "reference",
            label: "参考图",
            hint: "素材",
            count: `${project.assets.length}/3`,
            preview: referencePreview,
            body: referenceBody,
            inspector: referenceInspector
          },
          {
            id: "storyboard",
            label: "分镜图",
            hint: "生成",
            count: String(project.storyboards.length),
            preview: storyboardPreview,
            body: storyboardBody,
            inspector: storyboardInspector
          },
          {
            id: "video",
            label: "视频",
            hint: "输出",
            count: String(project.videos.length),
            preview: videoPreview,
            body: videoBody,
            inspector: videoInspector
          }
        ]}
      />
    </div>
  );
}
