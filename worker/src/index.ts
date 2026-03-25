import {
  type JobRun,
  type ProjectAsset,
  type ShotCandidate,
  type StoryboardShot,
  type VideoSegment
} from "@prisma/client";

import { workerDb } from "./db.js";
import { workerEnv } from "./env.js";
import { generateCandidateImages, generateVideoClip } from "./laozhang.js";
import { logger } from "./logger.js";
import { stitchVideoSegments } from "./media.js";
import { downloadStorageObject, removeStorageObjects, uploadStorageObject } from "./supabase.js";

async function claimNextJob(workerId: string) {
  const rows = await workerDb.$queryRaw<JobRun[]>`
    WITH next_job AS (
      SELECT id
      FROM job_runs
      WHERE status = 'QUEUED'
        AND "availableAt" <= NOW()
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE job_runs AS job
    SET
      status = 'RUNNING',
      "lockedAt" = NOW(),
      "lockedBy" = ${workerId},
      "startedAt" = NOW(),
      attempts = job.attempts + 1
    FROM next_job
    WHERE job.id = next_job.id
    RETURNING job.*
  `;

  return rows[0] ?? null;
}

async function finishJob(jobId: string) {
  await workerDb.jobRun.update({
    where: { id: jobId },
    data: {
      status: "SUCCEEDED",
      completedAt: new Date(),
      errorMessage: null
    }
  });
}

async function failJob(job: JobRun, errorMessage: string) {
  const shouldRetry = job.attempts < job.maxAttempts;
  await workerDb.jobRun.update({
    where: { id: job.id },
    data: shouldRetry
      ? {
          status: "QUEUED",
          availableAt: new Date(Date.now() + 15_000),
          errorMessage
        }
      : {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage
        }
  });

  if (job.batchId) {
    await workerDb.shotGenerationBatch.update({
      where: { id: job.batchId },
      data: {
        status: "FAILED",
        errorMessage
      }
    });
  }

  if (job.videoVersionId) {
    await workerDb.videoVersion.update({
      where: { id: job.videoVersionId },
      data: {
        status: "FAILED",
        errorMessage
      }
    });
  }

  if (job.projectId) {
    await workerDb.project.update({
      where: { id: job.projectId },
      data: {
        latestTaskStatus: "FAILED",
        latestTaskSummary: errorMessage.slice(0, 160),
        lastActivityAt: new Date()
      }
    });
  }
}

async function getReferenceImages(projectId: string) {
  const assets = await workerDb.projectAsset.findMany({
    where: {
      projectId,
      deletedAt: null
    },
    orderBy: {
      sortOrder: "asc"
    }
  });

  const references = [];
  for (const asset of assets) {
    const { buffer, mimeType } = await downloadStorageObject(workerEnv.STORAGE_BUCKET_RAW, asset.storagePath);
    references.push({
      buffer,
      mimeType,
      fileName: asset.fileName
    });
  }

  return references;
}

async function createStoryboardFromBatch(batch: {
  id: string;
  projectId: string;
  createdById: string;
  model: string;
  targetCount: number;
}, createdCandidates: ShotCandidate[]) {
  const existingCount = await workerDb.storyboardVersion.count({
    where: {
      projectId: batch.projectId
    }
  });

  const storyboard = await workerDb.storyboardVersion.create({
    data: {
      projectId: batch.projectId,
      createdById: batch.createdById,
      name: `自动分镜 ${existingCount + 1}`,
      notes: `${batch.targetCount} 张分镜 · ${batch.model}`,
      status: "ACTIVE",
      shots: {
        create: createdCandidates.map((candidate, index) => ({
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

  await workerDb.activityLog.create({
    data: {
      actorId: batch.createdById,
      projectId: batch.projectId,
      type: "CREATE_STORYBOARD",
      summary: `系统生成分镜版本 ${storyboard.name}`,
      metadata: {
        batchId: batch.id,
        model: batch.model
      }
    }
  });
}

async function handleGenerateShotBatch(job: JobRun) {
  if (!job.batchId) {
    throw new Error("Missing batch id");
  }

  const batch = await workerDb.shotGenerationBatch.findUnique({
    where: { id: job.batchId }
  });

  if (!batch) {
    throw new Error("Batch not found");
  }

  await workerDb.shotGenerationBatch.update({
    where: { id: batch.id },
    data: {
      status: "PROCESSING",
      errorMessage: null
    }
  });

  const references = await getReferenceImages(batch.projectId);
  if (references.length === 0) {
    throw new Error("No reference images found for project");
  }

  const generatedImages = await generateCandidateImages({
    model: batch.model,
    prompt: batch.prompt,
    targetCount: batch.targetCount,
    referenceImages: references
  });

  const createdCandidates: ShotCandidate[] = [];

  for (const [index, generated] of generatedImages.entries()) {
    const imagePath = `${batch.projectId}/candidates/${batch.id}/candidate-${index + 1}.png`;
    await uploadStorageObject({
      bucket: workerEnv.STORAGE_BUCKET_GENERATED,
      path: imagePath,
      buffer: generated.buffer,
      contentType: generated.mimeType
    });

    const candidate = await workerDb.shotCandidate.create({
      data: {
        batchId: batch.id,
        projectId: batch.projectId,
        title: `分镜 ${index + 1}`,
        prompt: batch.prompt,
        imagePath,
        previewPath: imagePath,
        sortOrder: index,
        mimeType: generated.mimeType,
        byteSize: generated.buffer.byteLength,
        expiresAt: batch.expiresAt
      }
    });

    createdCandidates.push(candidate);
  }

  await createStoryboardFromBatch(batch, createdCandidates);

  await workerDb.shotGenerationBatch.update({
    where: { id: batch.id },
    data: {
      status: "READY",
      completedAt: new Date()
    }
  });

  await workerDb.project.update({
    where: { id: batch.projectId },
    data: {
      latestTaskSummary: "分镜图已就绪",
      latestTaskStatus: "SUCCEEDED",
      lastActivityAt: new Date()
    }
  });
}

async function resolveSegmentReferences(
  segment: VideoSegment & { storyboardShot: StoryboardShot & { sourceCandidate: ShotCandidate | null } },
  projectAssets: ProjectAsset[]
) {
  const references = [];

  if (segment.storyboardShot.sourceCandidate) {
    const candidate = segment.storyboardShot.sourceCandidate;
    const { buffer, mimeType } = await downloadStorageObject(workerEnv.STORAGE_BUCKET_GENERATED, candidate.imagePath);
    references.push({
      buffer,
      mimeType: candidate.mimeType ?? mimeType,
      fileName: `${candidate.id}.png`
    });
    return references;
  }

  if (projectAssets.length > 0) {
    const asset = projectAssets[0];
    const { buffer, mimeType } = await downloadStorageObject(workerEnv.STORAGE_BUCKET_RAW, asset.storagePath);
    references.push({
      buffer,
      mimeType: asset.mimeType ?? mimeType,
      fileName: asset.fileName
    });
  }

  return references;
}

async function handleGenerateVideoVersion(job: JobRun) {
  if (!job.videoVersionId) {
    throw new Error("Missing video version id");
  }

  const videoVersion = await workerDb.videoVersion.findUnique({
    where: { id: job.videoVersionId },
    include: {
      project: {
        include: {
          assets: {
            where: { deletedAt: null },
            orderBy: { sortOrder: "asc" }
          }
        }
      },
      segments: {
        orderBy: { orderIndex: "asc" },
        include: {
          storyboardShot: {
            include: {
              sourceCandidate: true
            }
          }
        }
      }
    }
  });

  if (!videoVersion) {
    throw new Error("Video version not found");
  }

  await workerDb.videoVersion.update({
    where: { id: videoVersion.id },
    data: {
      status: "PROCESSING",
      errorMessage: null
    }
  });

  const payload = job.payload as { soraRawSeconds?: number | null };
  const segmentBuffers: Array<{ buffer: Buffer; targetSeconds: number }> = [];

  for (const segment of videoVersion.segments) {
    const references = await resolveSegmentReferences(segment, videoVersion.project.assets);
    if (references.length === 0) {
      throw new Error(`Segment ${segment.orderIndex + 1} has no reference image`);
    }

    const clip = await generateVideoClip({
      model: segment.model,
      prompt: segment.prompt,
      referenceImages: references,
      soraRawSeconds: payload.soraRawSeconds ?? null
    });

    const segmentPath = `${videoVersion.projectId}/videos/${videoVersion.id}/segment-${segment.orderIndex + 1}.mp4`;
    await uploadStorageObject({
      bucket: workerEnv.STORAGE_BUCKET_VIDEO,
      path: segmentPath,
      buffer: clip.buffer,
      contentType: clip.mimeType
    });

    await workerDb.videoSegment.update({
      where: { id: segment.id },
      data: {
        vendorTaskId: clip.vendorTaskId,
        vendorStatus: "completed",
        segmentPath,
        mimeType: clip.mimeType,
        byteSize: clip.buffer.byteLength,
        completedAt: new Date(),
        errorMessage: null
      }
    });

    segmentBuffers.push({
      buffer: clip.buffer,
      targetSeconds: segment.targetSeconds
    });
  }

  const stitched = await stitchVideoSegments(segmentBuffers);
  const finalPath = `${videoVersion.projectId}/videos/${videoVersion.id}/final.mp4`;
  const previewPath = `${videoVersion.projectId}/videos/${videoVersion.id}/preview.jpg`;

  await uploadStorageObject({
    bucket: workerEnv.STORAGE_BUCKET_VIDEO,
    path: finalPath,
    buffer: stitched.videoBuffer,
    contentType: "video/mp4"
  });
  await uploadStorageObject({
    bucket: workerEnv.STORAGE_BUCKET_VIDEO,
    path: previewPath,
    buffer: stitched.previewBuffer,
    contentType: "image/jpeg"
  });

  await workerDb.videoVersion.update({
    where: { id: videoVersion.id },
    data: {
      status: "READY",
      stitchedVideoPath: finalPath,
      stitchedPreviewImagePath: previewPath,
      actualSeconds: videoVersion.segments.reduce((sum, segment) => sum + segment.targetSeconds, 0),
      completedAt: new Date()
    }
  });

  await workerDb.project.update({
    where: { id: videoVersion.projectId },
    data: {
      latestTaskSummary: "视频版本已就绪",
      latestTaskStatus: "SUCCEEDED",
      lastActivityAt: new Date()
    }
  });
}

async function cleanupExpiredAssets() {
  const now = new Date();

  const expiredAssets = await workerDb.projectAsset.findMany({
    where: {
      expiresAt: { lt: now },
      deletedAt: null
    }
  });

  for (const asset of expiredAssets) {
    await removeStorageObjects(workerEnv.STORAGE_BUCKET_RAW, [asset.storagePath, asset.previewPath].filter(Boolean) as string[]);
    await workerDb.projectAsset.update({
      where: { id: asset.id },
      data: {
        deletedAt: new Date()
      }
    });
  }

  const expiredVideos = await workerDb.videoVersion.findMany({
    where: {
      expiresAt: { lt: now },
      OR: [{ stitchedVideoPath: { not: null } }, { stitchedPreviewImagePath: { not: null } }]
    }
  });

  for (const video of expiredVideos) {
    await removeStorageObjects(
      workerEnv.STORAGE_BUCKET_VIDEO,
      [video.stitchedVideoPath, video.stitchedPreviewImagePath].filter(Boolean) as string[]
    );
    await workerDb.videoVersion.update({
      where: { id: video.id },
      data: {
        stitchedVideoPath: null,
        stitchedPreviewImagePath: null
      }
    });
  }

  const expiredSegments = await workerDb.videoSegment.findMany({
    where: {
      expiresAt: { lt: now },
      segmentPath: { not: null }
    }
  });

  for (const segment of expiredSegments) {
    await removeStorageObjects(workerEnv.STORAGE_BUCKET_VIDEO, [segment.segmentPath!]);
    await workerDb.videoSegment.update({
      where: { id: segment.id },
      data: {
        segmentPath: null
      }
    });
  }

  const expiredCandidates = await workerDb.shotCandidate.findMany({
    where: {
      expiresAt: { lt: now },
      previewPath: { not: null }
    }
  });

  for (const candidate of expiredCandidates) {
    await removeStorageObjects(
      workerEnv.STORAGE_BUCKET_GENERATED,
      [candidate.imagePath, candidate.previewPath].filter(Boolean) as string[]
    );
    await workerDb.shotCandidate.update({
      where: { id: candidate.id },
      data: {
        previewPath: null
      }
    });
  }
}

async function processJob(job: JobRun) {
  switch (job.kind) {
    case "GENERATE_SHOT_BATCH":
      await handleGenerateShotBatch(job);
      return;
    case "GENERATE_VIDEO_VERSION":
      await handleGenerateVideoVersion(job);
      return;
    case "REGENERATE_SHOT":
      throw new Error("Single-shot regeneration is not implemented yet");
  }
}

async function workerLoop() {
  const workerId = `worker-${process.pid}`;
  const running = new Set<Promise<void>>();

  const launch = async () => {
    if (running.size >= workerEnv.WORKER_CONCURRENCY) {
      return;
    }

    const job = await claimNextJob(workerId);
    if (!job) {
      return;
    }

    logger.info({ jobId: job.id, kind: job.kind }, "Processing job");
    const task = processJob(job)
      .then(async () => {
        await finishJob(job.id);
      })
      .catch(async (error: Error) => {
        logger.error({ jobId: job.id, err: error }, "Job failed");
        await failJob(job, error.message);
      })
      .finally(() => {
        running.delete(task);
      });

    running.add(task);
  };

  await cleanupExpiredAssets();

  setInterval(async () => {
    try {
      await cleanupExpiredAssets();
    } catch (error) {
      logger.error({ err: error }, "Cleanup pass failed");
    }
  }, workerEnv.WORKER_CLEANUP_INTERVAL_MINUTES * 60 * 1000);

  setInterval(async () => {
    try {
      await launch();
    } catch (error) {
      logger.error({ err: error }, "Worker loop failed");
    }
  }, workerEnv.WORKER_POLL_INTERVAL_MS);

  await launch();
}

workerLoop()
  .then(() => {
    logger.info("Worker started");
  })
  .catch((error) => {
    logger.error({ err: error }, "Worker failed to boot");
    process.exit(1);
  });
