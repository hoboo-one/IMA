import { type Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getServerEnv } from "@/lib/env";
import { signStoragePath } from "@/lib/storage";

export async function getProjects(search?: string) {
  return db.project.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { productName: { contains: search, mode: "insensitive" } }
          ]
        }
      : undefined,
    include: {
      createdBy: true
    },
    orderBy: {
      updatedAt: "desc"
    }
  });
}

const workspaceInclude = {
  createdBy: true,
  assets: {
    orderBy: {
      sortOrder: "asc"
    }
  },
  batches: {
    orderBy: {
      createdAt: "desc"
    },
    include: {
      candidates: {
        orderBy: {
          createdAt: "desc"
        }
      }
    }
  },
  storyboards: {
    orderBy: {
      createdAt: "desc"
    },
    include: {
      shots: {
        orderBy: {
          orderIndex: "asc"
        }
      }
    }
  },
  videos: {
    orderBy: {
      createdAt: "desc"
    },
    include: {
      segments: {
        orderBy: {
          orderIndex: "asc"
        }
      },
      storyboardVersion: true,
      createdBy: true
    }
  },
  activities: {
    take: 20,
    orderBy: {
      createdAt: "desc"
    },
    include: {
      actor: true
    }
  },
  jobs: {
    where: {
      status: {
        in: ["QUEUED", "RUNNING"]
      }
    }
  }
} satisfies Prisma.ProjectInclude;

export async function getProjectWorkspace(projectId: string) {
  const env = getServerEnv();
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: workspaceInclude
  });

  if (!project) {
    return null;
  }

  const assetUrls = await Promise.all(
    project.assets.map(async (asset) => ({
      id: asset.id,
      originalUrl: await signStoragePath(env.STORAGE_BUCKET_RAW, asset.storagePath),
      previewUrl: await signStoragePath(env.STORAGE_BUCKET_RAW, asset.previewPath ?? asset.storagePath)
    }))
  );

  const candidateUrls = await Promise.all(
    project.batches.flatMap((batch) =>
      batch.candidates.map(async (candidate) => ({
        id: candidate.id,
        url: await signStoragePath(env.STORAGE_BUCKET_GENERATED, candidate.imagePath),
        previewUrl: await signStoragePath(
          env.STORAGE_BUCKET_GENERATED,
          candidate.previewPath ?? candidate.imagePath
        )
      }))
    )
  );

  const videoUrls = await Promise.all(
    project.videos.map(async (video) => ({
      id: video.id,
      previewUrl: await signStoragePath(env.STORAGE_BUCKET_VIDEO, video.stitchedPreviewImagePath),
      downloadHref: video.stitchedVideoPath ? `/api/videos/${video.id}/download` : null
    }))
  );

  return {
    project,
    assetUrls,
    candidateUrls,
    videoUrls
  };
}
