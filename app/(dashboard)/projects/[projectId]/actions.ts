"use server";

import { revalidatePath } from "next/cache";

import {
  createBatchSchema,
  createStoryboardSchema,
  createVideoVersionSchema,
  updateStoryboardShotSchema
} from "@/shared";
import { logActivity } from "@/lib/activity";
import { requireActiveProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { enqueueJob } from "@/lib/jobs";
import { uploadProjectReferenceAsset } from "@/lib/storage";

export async function uploadReferenceAssetsAction(formData: FormData) {
  const { profile } = await requireActiveProfile();
  const projectId = String(formData.get("projectId"));
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) {
    throw new Error("请先选择至少一张参考图。");
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { assets: true }
  });

  if (!project) {
    throw new Error("项目不存在。");
  }

  if (project.assets.length + files.length > 3) {
    throw new Error("参考图总数最多只能上传 3 张。");
  }

  for (const [index, file] of files.entries()) {
    if (!file.type.startsWith("image/")) {
      throw new Error("目前只支持图片文件。");
    }

    if (file.size > 20 * 1024 * 1024) {
      throw new Error("单张图片大小不能超过 20MB。");
    }

    await uploadProjectReferenceAsset({
      projectId,
      file,
      sortOrder: project.assets.length + index
    });
  }

  await db.project.update({
    where: { id: projectId },
    data: {
      lastActivityAt: new Date(),
      latestTaskSummary: "参考图已更新"
    }
  });

  await logActivity({
    actorId: profile.id,
    projectId,
    type: "UPLOAD_ASSET",
    summary: `上传 ${files.length} 张参考图`
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function createShotBatchAction(formData: FormData) {
  const env = getServerEnv();
  const { profile } = await requireActiveProfile();
  const parsed = createBatchSchema.safeParse({
    projectId: formData.get("projectId"),
    prompt: formData.get("prompt"),
    targetCount: formData.get("targetCount"),
    model: formData.get("model")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join("\n"));
  }

  const assetCount = await db.projectAsset.count({
    where: {
      projectId: parsed.data.projectId,
      deletedAt: null
    }
  });

  if (assetCount === 0) {
    throw new Error("请先上传至少一张产品参考图，再开始生成候选镜头。");
  }

  const batch = await db.shotGenerationBatch.create({
    data: {
      projectId: parsed.data.projectId,
      createdById: profile.id,
      prompt: parsed.data.prompt,
      targetCount: parsed.data.targetCount,
      model: parsed.data.model,
      expiresAt: new Date(Date.now() + env.ASSET_RETENTION_HOURS * 60 * 60 * 1000)
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
      latestTaskSummary: "候选镜头生成中",
      latestTaskStatus: "QUEUED",
      lastActivityAt: new Date()
    }
  });

  await logActivity({
    actorId: profile.id,
    projectId: parsed.data.projectId,
    type: "START_BATCH",
    summary: `提交候选镜头生成（${parsed.data.targetCount} 张）`,
    metadata: {
      model: parsed.data.model
    }
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
}

export async function createStoryboardVersionAction(formData: FormData) {
  const { profile } = await requireActiveProfile();
  const candidateIds = formData.getAll("candidateIds").map(String);
  const parsed = createStoryboardSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    notes: formData.get("notes"),
    candidateIds
  });

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join("\n"));
  }

  const candidates = await db.shotCandidate.findMany({
    where: {
      projectId: parsed.data.projectId,
      id: {
        in: parsed.data.candidateIds
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  await db.storyboardVersion.create({
    data: {
      projectId: parsed.data.projectId,
      createdById: profile.id,
      name: parsed.data.name,
      notes: parsed.data.notes || null,
      status: "ACTIVE",
      shots: {
        create: candidates.map((candidate, index) => ({
          sourceCandidateId: candidate.id,
          orderIndex: index,
          title: candidate.title,
          prompt: candidate.prompt,
          targetSeconds: 2,
          description: null
        }))
      }
    }
  });

  await logActivity({
    actorId: profile.id,
    projectId: parsed.data.projectId,
    type: "CREATE_STORYBOARD",
    summary: `创建正式分镜版本 ${parsed.data.name}`
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
}

export async function updateStoryboardShotAction(formData: FormData) {
  const { profile } = await requireActiveProfile();
  const parsed = updateStoryboardShotSchema.safeParse({
    shotId: formData.get("shotId"),
    title: formData.get("title"),
    description: formData.get("description"),
    prompt: formData.get("prompt"),
    targetSeconds: formData.get("targetSeconds"),
    orderIndex: formData.get("orderIndex")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join("\n"));
  }

  const shot = await db.storyboardShot.update({
    where: { id: parsed.data.shotId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      prompt: parsed.data.prompt,
      targetSeconds: parsed.data.targetSeconds,
      orderIndex: parsed.data.orderIndex
    },
    include: {
      storyboardVersion: true
    }
  });

  await logActivity({
    actorId: profile.id,
    projectId: shot.storyboardVersion.projectId,
    type: "UPDATE_STORYBOARD",
    summary: `更新分镜镜头 ${parsed.data.title}`
  });

  revalidatePath(`/projects/${shot.storyboardVersion.projectId}`);
}

export async function createVideoVersionAction(formData: FormData) {
  const env = getServerEnv();
  const { profile } = await requireActiveProfile();
  const parsed = createVideoVersionSchema.safeParse({
    projectId: formData.get("projectId"),
    storyboardVersionId: formData.get("storyboardVersionId"),
    model: formData.get("model"),
    seconds: formData.get("seconds")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.flatten().formErrors.join("\n"));
  }

  const storyboard = await db.storyboardVersion.findUnique({
    where: { id: parsed.data.storyboardVersionId },
    include: {
      shots: {
        orderBy: { orderIndex: "asc" }
      }
    }
  });

  if (!storyboard) {
    throw new Error("正式分镜不存在。");
  }

  const totalSeconds = storyboard.shots.reduce((sum, shot) => sum + shot.targetSeconds, 0);
  const expiresAt = new Date(Date.now() + env.ASSET_RETENTION_HOURS * 60 * 60 * 1000);

  const videoVersion = await db.videoVersion.create({
    data: {
      projectId: parsed.data.projectId,
      storyboardVersionId: parsed.data.storyboardVersionId,
      createdById: profile.id,
      model: parsed.data.model,
      targetSeconds: totalSeconds,
      expiresAt,
      segments: {
        create: storyboard.shots.map((shot) => ({
          storyboardShotId: shot.id,
          orderIndex: shot.orderIndex,
          model: parsed.data.model,
          targetSeconds: shot.targetSeconds,
          prompt: shot.prompt,
          expiresAt
        }))
      }
    }
  });

  await enqueueJob({
    kind: "GENERATE_VIDEO_VERSION",
    projectId: parsed.data.projectId,
    videoVersionId: videoVersion.id,
    payload: {
      videoVersionId: videoVersion.id,
      soraRawSeconds: parsed.data.seconds ?? null
    }
  });

  await db.project.update({
    where: { id: parsed.data.projectId },
    data: {
      latestTaskSummary: "视频生成中",
      latestTaskStatus: "QUEUED",
      lastActivityAt: new Date()
    }
  });

  await logActivity({
    actorId: profile.id,
    projectId: parsed.data.projectId,
    type: "START_VIDEO",
    summary: "提交视频版本生成",
    metadata: {
      model: parsed.data.model,
      rawSeconds: parsed.data.seconds ?? null
    }
  });

  revalidatePath(`/projects/${parsed.data.projectId}`);
}
