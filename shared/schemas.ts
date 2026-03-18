import { z } from "zod";

import { imageModels, soraSeconds, userRoles, videoModels } from "./models";

export const loginSchema = z.object({
  email: z.email().max(255),
  password: z.string().min(8).max(128)
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(80),
  productName: z.string().min(1).max(80),
  notes: z.string().max(500).optional().or(z.literal(""))
});

export const createMemberSchema = z.object({
  email: z.email().max(255),
  displayName: z.string().min(1).max(80),
  password: z.string().min(8).max(128),
  role: z.enum(userRoles)
});

export const createBatchSchema = z.object({
  projectId: z.uuid(),
  prompt: z.string().min(10).max(2000),
  targetCount: z.coerce.number().int().min(1).max(12),
  model: z.enum(imageModels)
});

export const createStoryboardSchema = z.object({
  projectId: z.uuid(),
  name: z.string().min(1).max(80),
  notes: z.string().max(500).optional().or(z.literal("")),
  candidateIds: z.array(z.uuid()).min(1).max(12)
});

export const updateStoryboardShotSchema = z.object({
  shotId: z.uuid(),
  title: z.string().min(1).max(80),
  description: z.string().max(240).optional().or(z.literal("")),
  prompt: z.string().min(10).max(2000),
  targetSeconds: z.coerce.number().int().min(1).max(15),
  orderIndex: z.coerce.number().int().min(0).max(30)
});

export const createVideoVersionSchema = z.object({
  projectId: z.uuid(),
  storyboardVersionId: z.uuid(),
  model: z.enum(videoModels),
  seconds: z.preprocess(
    (value) => (value === null || value === "" ? undefined : value),
    z
      .coerce.number()
      .int()
      .optional()
      .refine((value) => value === undefined || soraSeconds.includes(value as (typeof soraSeconds)[number]), {
        message: "Sora 2 仅支持 10 秒或 15 秒"
      })
  )
});

export const toggleMemberSchema = z.object({
  memberId: z.uuid(),
  isActive: z.boolean()
});

export const uploadAssetSchema = z.object({
  projectId: z.uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().startsWith("image/"),
  byteSize: z.number().int().positive().max(20 * 1024 * 1024)
});
