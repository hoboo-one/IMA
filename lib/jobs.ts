import { type JobKind, type Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export async function enqueueJob(input: {
  kind: JobKind;
  projectId?: string;
  batchId?: string;
  videoVersionId?: string;
  payload: Prisma.InputJsonValue;
}) {
  return db.jobRun.create({
    data: {
      kind: input.kind,
      projectId: input.projectId,
      batchId: input.batchId,
      videoVersionId: input.videoVersionId,
      payload: input.payload
    }
  });
}
