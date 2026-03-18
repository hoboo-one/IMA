import { type ActivityType, type Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export async function logActivity(input: {
  actorId: string;
  projectId?: string;
  type: ActivityType;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await db.activityLog.create({
    data: {
      actorId: input.actorId,
      projectId: input.projectId,
      type: input.type,
      summary: input.summary,
      metadata: input.metadata
    }
  });
}
