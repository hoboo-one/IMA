"use server";

import { revalidatePath } from "next/cache";

import {
  createBatchSchema,
  createVideoVersionFromSelectionSchema,
  createVideoVersionSchema,
  updateStoryboardShotSchema
} from "@/shared";
import { logActivity } from "@/lib/activity";
import { requireActiveProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { enqueueJob } from "@/lib/jobs";
import { deleteProjectReferenceAsset, uploadProjectReferenceAsset } from "@/lib/storage";

type VideoModelInput =
  | "VEO_3_1"
  | "VEO_3_1_FAST"
  | "VEO_3_1_LANDSCAPE"
  | "VEO_3_1_LANDSCAPE_FAST"
  | "SORA_2"
  | "SORA_2_PRO";

async function createQueuedVideoVersion(input: {
  createdById: string;
  model: VideoModelInput;
  projectId: string;
  rawSeconds?: number;
  storyboardVersionId: string;
}) {
  const env = getServerEnv();
  const storyboard = await db.storyboardVersion.findUnique({
    where: { id: input.storyboardVersionId },
    include: {
      shots: {
        orderBy: { orderIndex: "asc" }
      }
    }
  });

  if (!storyboard) {
    throw new Error("没有找到要生成视频的分镜版本。");
  }

  const totalSeconds = storyboard.shots.reduce((sum, shot) => sum + shot.targetSeconds, 0);
  const expiresAt = new Date(Date.now() + env.ASSET_RETENTION_HOURS * 60 * 60 * 1000);

  const videoVersion = await db.videoVersion.create({
    data: {
      projectId: input.projectId,
      storyboardVersionId: input.storyboardVersionId,
      createdById: input.createdById,
      model: input.model,
      targetSeconds: totalSeconds,
      expiresAt,
      segments: {
        create: storyboard.shots.map((shot) => ({
          storyboardShotId: shot.id,
          orderIndex: shot.orderIndex,
          model: input.model,
          targetSeconds: shot.targetSeconds,
          prompt: shot.prompt,
          expiresAt
        }))
      }
    }
  });

  await enqueueJob({
    kind: "GENERATE_VIDEO_VERSION",
    projectId: input.projectId,
    videoVersionId: videoVersion.id,
    payload: {
      soraRawSeconds: input.rawSeconds ?? null,
      videoVersionId: videoVersion.id
    }
  });

  await db.project.update({
    where: { id: input.projectId },
    data: {
      lastActivityAt: new Date(),
      latestTaskStatus: "QUEUED",
      latestTaskSummary: "正在生成视频"
    }
  });

  return { storyboard, videoVersion };
}

async function createStoryboardFromVideoSelection(input: {
  createdById: string;
  frameIds: string[];
  projectId: string;
  sourceId: string;
  sourceType: "STORYBOARD" | "BATCH";
}) {
  const nextIndex =
    (await db.storyboardVersion.count({
      where: {
        projectId: input.projectId
      }
    })) + 1;

  if (input.sourceType === "STORYBOARD") {
    const sourceStoryboard = await db.storyboardVersion.findUnique({
      where: { id: input.sourceId },
      include: {
        shots: {
          orderBy: { orderIndex: "asc" }
        }
      }
    });

    if (!sourceStoryboard) {
      throw new Error("没有找到你选中的分镜版本。");
    }

    const selectedShots = input.frameIds.map((frameId) => {
      const shot = sourceStoryboard.shots.find((item) => item.id === frameId);

      if (!shot) {
        throw new Error("你勾选的分镜图不在当前版本里，请刷新页面后重试。");
      }

      return shot;
    });

    return db.storyboardVersion.create({
      data: {
        projectId: input.projectId,
        createdById: input.createdById,
        name: `视频分镜 ${nextIndex}`,
        notes: `从 ${sourceStoryboard.name} 里选中了 ${selectedShots.length} 张分镜图`,
        status: "ACTIVE",
        shots: {
          create: selectedShots.map((shot, index) => ({
            sourceCandidateId: shot.sourceCandidateId,
            orderIndex: index,
            title: shot.title,
            description: shot.description,
            prompt: shot.prompt,
            targetSeconds: shot.targetSeconds
          }))
        }
      }
    });
  }

  const sourceBatch = await db.shotGenerationBatch.findUnique({
    where: { id: input.sourceId },
    include: {
      candidates: {
        orderBy: { sortOrder: "asc" }
      }
    }
  });

  if (!sourceBatch) {
    throw new Error("没有找到这一批分镜结果，请重新生成后再试。");
  }

  const selectedCandidates = input.frameIds.map((frameId) => {
    const candidate = sourceBatch.candidates.find((item) => item.id === frameId);

    if (!candidate) {
      throw new Error("你勾选的分镜图不在当前可见结果里，请刷新页面后重试。");
    }

    return candidate;
  });

  return db.storyboardVersion.create({
    data: {
      projectId: input.projectId,
      createdById: input.createdById,
      name: `视频分镜 ${nextIndex}`,
      notes: `使用最新生成结果中的 ${selectedCandidates.length} 张分镜图`,
      status: "ACTIVE",
      shots: {
        create: selectedCandidates.map((candidate, index) => ({
          sourceCandidateId: candidate.id,
          orderIndex: index,
          title: candidate.title,
          description: null,
          prompt: candidate.prompt,
          targetSeconds: 2
        }))
      }
    }
  });
}

export async function uploadReferenceAssetsAction(formData: FormData) {
  const { profile } = await requireActiveProfile();
  const projectId = String(formData.get("projectId"));
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) {
    throw new Error("请至少选择 1 张参考图。");
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { assets: { where: { deletedAt: null } } }
  });

  if (!project) {
    throw new Error("项目不存在。");
  }

  if (project.assets.length + files.length > 3) {
    throw new Error("参考图最多只能保留 3 张。");
  }

  for (const [index, file] of files.entries()) {
    if (!file.type.startsWith("image/")) {
      throw new Error("目前只支持上传图片文件。");
    }

    if (file.size > 20 * 1024 * 1024) {
      throw new Error("单张图片不能超过 20MB。");
    }

    await uploadProjectReferenceAsset({
      file,
      projectId,
      sortOrder: project.assets.length + index
    });
  }

  await db.project.update({
    where: { id: projectId },
    data: {
      lastActivityAt: new Date(),
      latestTaskStatus: "SUCCEEDED",
      latestTaskSummary: "参考图已更新"
    }
  });

  await logActivity({
    actorId: profile.id,
    projectId,
    summary: `上传了 ${files.length} 张参考图`,
    type: "UPLOAD_ASSET"
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function deleteReferenceAssetAction(formData: FormData) {
  const { profile } = await requireActiveProfile();
  const assetId = String(formData.get("assetId"));
  const asset = await deleteProjectReferenceAsset(assetId);

  await db.project.update({
    where: { id: asset.projectId },
    data: {
      lastActivityAt: new Date(),
      latestTaskStatus: "SUCCEEDED",
      latestTaskSummary: "参考图已删除"
    }
  });

  await logActivity({
    actorId: profile.id,
    projectId: asset.projectId,
    summary: `删除了参考图 ${asset.fileName}`,
    type: "UPLOAD_ASSET"
  });

  revalidatePath(`/projects/${asset.projectId}`);
}

export async function createShotBatchAction(formData: FormData) {
  const env = getServerEnv();
  const { profile } = await requireActiveProfile();
  const parsed = createBatchSchema.safeParse({
    model: formData.get("model"),
    projectId: formData.get("projectId"),
    prompt: formData.get("prompt"),
    targetCount: formData.get("targetCount")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join("\n"));
  }

  const assetCount = await db.projectAsset.count({
    where: {
      deletedAt: null,
      projectId: parsed.data.projectId
    }
  });

  if (assetCount === 0) {
    throw new Error("请先上传至少 1 张参考图，再开始生成分镜。");
  }

  const batch = await db.shotGenerationBatch.create({
    data: {
      createdById: profile.id,
      expiresAt: new Date(Date.now() + env.ASSET_RETENTION_HOURS * 60 * 60 * 1000),
      model: parsed.data.model,
      projectId: parsed.data.projectId,
      prompt: parsed.data.prompt,
      targetCount: parsed.data.targetCount
    }
  });

  await enqueueJob({
    kind: "GENERATE_SHOT_BATCH",
    projectId: parsed.data.projectId,
    batchId: batch.id,
    payload: {
      batchId: batch.id
    }
  });

  await db.project.update({
    where: { id: parsed.data.projectId },
    data: {
      lastActivityAt: new Date(),
      latestTaskStatus: "QUEUED",
      latestTaskSummary: "正在生成分镜"
    }
  });

  await logActivity({
    actorId: profile.id,
    metadata: {
      model: parsed.data.model
    },
    projectId: parsed.data.projectId,
    summary: `提交了 ${parsed.data.targetCount} 张分镜生成任务`,
    type: "START_BATCH"
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
}

export async function updateStoryboardShotAction(formData: FormData) {
  const { profile } = await requireActiveProfile();
  const parsed = updateStoryboardShotSchema.safeParse({
    description: formData.get("description"),
    orderIndex: formData.get("orderIndex"),
    prompt: formData.get("prompt"),
    shotId: formData.get("shotId"),
    targetSeconds: formData.get("targetSeconds"),
    title: formData.get("title")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join("\n"));
  }

  const shot = await db.storyboardShot.update({
    where: { id: parsed.data.shotId },
    data: {
      description: parsed.data.description || null,
      orderIndex: parsed.data.orderIndex,
      prompt: parsed.data.prompt,
      targetSeconds: parsed.data.targetSeconds,
      title: parsed.data.title
    },
    include: {
      storyboardVersion: true
    }
  });

  await logActivity({
    actorId: profile.id,
    projectId: shot.storyboardVersion.projectId,
    summary: `更新了镜头 ${parsed.data.title}`,
    type: "UPDATE_STORYBOARD"
  });

  revalidatePath(`/projects/${shot.storyboardVersion.projectId}`);
}

export async function createVideoVersionAction(formData: FormData) {
  const { profile } = await requireActiveProfile();
  const parsed = createVideoVersionSchema.safeParse({
    model: formData.get("model"),
    projectId: formData.get("projectId"),
    seconds: formData.get("seconds"),
    storyboardVersionId: formData.get("storyboardVersionId")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join("\n"));
  }

  await createQueuedVideoVersion({
    createdById: profile.id,
    model: parsed.data.model,
    projectId: parsed.data.projectId,
    rawSeconds: parsed.data.seconds,
    storyboardVersionId: parsed.data.storyboardVersionId
  });

  await logActivity({
    actorId: profile.id,
    metadata: {
      model: parsed.data.model,
      rawSeconds: parsed.data.seconds ?? null
    },
    projectId: parsed.data.projectId,
    summary: "提交了视频生成任务",
    type: "START_VIDEO"
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
}

export async function createVideoVersionFromSelectionAction(formData: FormData) {
  const { profile } = await requireActiveProfile();
  const parsed = createVideoVersionFromSelectionSchema.safeParse({
    frameIds: formData.getAll("frameIds"),
    model: formData.get("model"),
    projectId: formData.get("projectId"),
    seconds: formData.get("seconds"),
    sourceId: formData.get("sourceId"),
    sourceType: formData.get("sourceType")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join("\n"));
  }

  const storyboard = await createStoryboardFromVideoSelection({
    createdById: profile.id,
    frameIds: parsed.data.frameIds,
    projectId: parsed.data.projectId,
    sourceId: parsed.data.sourceId,
    sourceType: parsed.data.sourceType
  });

  await createQueuedVideoVersion({
    createdById: profile.id,
    model: parsed.data.model,
    projectId: parsed.data.projectId,
    rawSeconds: parsed.data.seconds,
    storyboardVersionId: storyboard.id
  });

  await logActivity({
    actorId: profile.id,
    metadata: {
      frameIds: parsed.data.frameIds,
      sourceId: parsed.data.sourceId,
      sourceType: parsed.data.sourceType
    },
    projectId: parsed.data.projectId,
    summary: `从当前分镜里勾选了 ${parsed.data.frameIds.length} 张图用于视频`,
    type: "CREATE_STORYBOARD"
  });

  await logActivity({
    actorId: profile.id,
    metadata: {
      model: parsed.data.model,
      rawSeconds: parsed.data.seconds ?? null,
      selectedFrameCount: parsed.data.frameIds.length
    },
    projectId: parsed.data.projectId,
    summary: "开始使用勾选分镜生成视频",
    type: "START_VIDEO"
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
}
